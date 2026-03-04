import * as THREE from "three";
import {
  Brush,
  Evaluator,
  HOLLOW_SUBTRACTION,
  SUBTRACTION,
} from "three-bvh-csg";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MTLLoader, OBJLoader } from "three/examples/jsm/Addons.js";

/*
  CSGEvaluator
 */
const CSGEvaluator: Evaluator = new Evaluator();
CSGEvaluator.useGroups = false;
const DefaultCSGEvaluatorAttributes = ["position", "normal", "uv"];

/*
  CSGEvaluator Log
 */
const IsCSGOperationLog = false;
type CSGOperationLog = { isLog: boolean; value: string };

/**
 * Types
 */
interface LoadObjOptions {
  mtlPath?: string;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3 | number;
}

/**
 * Get the cut head of the new head model
 * @param headToBeCut The Head to be cut
 * @param cutters The Cutters
 * @param isDispose Whether to dispose the head to be cut
 * @returns The cut head
 */
export async function getCutHeadNew(
  headToBeCut: THREE.Group<THREE.Object3DEventMap>,
  cutters: THREE.Group<THREE.Object3DEventMap> | string,
  isDispose: boolean = true,
): Promise<THREE.Group<THREE.Object3DEventMap>> {
  headToBeCut.updateMatrixWorld(true);
  console.log("\nheadToBeCut ->", headToBeCut);

  // DEBUG head node
  // return groupToBeReturned.add(headToBeCut.children[0]);

  const groupToBeReturned = new THREE.Group();
  groupToBeReturned.name = "CutHeadGroup";

  // 切割模型
  const loadedCuttersModel: THREE.Group<THREE.Object3DEventMap> =
    cutters instanceof THREE.Group ? cutters : await loadObj(cutters);
  console.log("loadedCuttersModel ->", loadedCuttersModel);
  // return headModel;
  const cuttersLen = loadedCuttersModel.children.length;

  // 没有切割节点，返回头模
  if (cuttersLen === 0) {
    console.warn("No cutters found.");
    return headToBeCut;
  }

  // 判断是否为单个切割节点
  const isCuttersLen1 = cuttersLen === 1;

  /**
   * Ⅰ. 获取头模各节点 (网格对象, 根据名称获取)
   */

  // 1.1 头部节点
  const headNode = headToBeCut.children[0] as THREE.Mesh;
  if (!headNode) throw new Error("Head node not found.");
  headNode.applyMatrix4(headToBeCut.matrixWorld);
  headNode.geometry.applyMatrix4(headNode.matrixWorld);
  console.log("\n -- getCutHeadNew -- headNode ->", headNode);
  // return groupToBeReturned.add(headNode);

  /*
    预创建头模切割对象 Brush (type from `three-bvh-csg`) | THREE.Mesh
  */
  let cutHeadBrush: Brush | THREE.Mesh;

  /**
   * Ⅱ. 一个切割节点 -> 直接进行切割 (真人模型)
   */
  if (isCuttersLen1) {
    const cutterSingle = loadedCuttersModel.children[0] as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material
    >;
    // Pre-create brush for cutter
    const cutterSingleBrush = new Brush(
      cutterSingle.geometry,
      cutterSingle.material,
    );
    cutterSingleBrush.updateMatrixWorld();

    // 执行头模切割 (SUBTRACTION from `three-bvh-csg`)
    cutHeadBrush = csgSubtract(headNode, cutterSingleBrush, false, null, null, {
      isLog: true,
      value: "One single Cutter Node Subtraction.",
    });
    // Set the name of the cut head node
    cutHeadBrush.name = "CutHeadNode";
    // Set the name of the cut head node material
    (cutHeadBrush.material as THREE.MeshPhongMaterial).name = "CutHeadNodeMat";
    console.log("\ncutHeadBrush.material set ->", cutHeadBrush.material);

    // 释放资源
    if (isDispose) {
      disposeGeoMat(headToBeCut);
      headToBeCut = null;
    }
    // 返回切割过后的头部节点，左眼节点和右眼节点组
    return groupToBeReturned.add(cutHeadBrush);
  }

  /**
   * Ⅲ. 获取兵人头模切割各节点 (网格对象, 根据名称获取)
   */

  // 3.1 Cutter Sphere (底座椭圆切割节点)
  const sphereCutterNode = loadedCuttersModel.getObjectByName(
    "cutting02",
  ) as THREE.Mesh;
  console.log("\n -- getCutHeadNew -- sphereCutterNode ->", sphereCutterNode);

  // 3.2 Cutter Cylinder (圆柱切割节点)
  const cylinderCutterNode = loadedCuttersModel.getObjectByName(
    "cutting03",
  ) as THREE.Mesh;
  console.log(
    "\n -- getCutHeadNew -- cylinderCutterNode ->",
    cylinderCutterNode,
  );

  /**
   * Ⅳ. 预创建切割 Brush 对象以避免重复实例化
   * 复用底座椭圆切割对象和圆柱切割对象进行两次 csgSubtract 操作
   * Operation 1: HOLLOW Subtraction (获取顶点以精确修改 UV)
   * Operation 2: Solid Subtraction (获取最终的切割头网格)
   */

  // 4.1 Sphere Cutter Brush
  const sphereCutterBrush = new Brush(
    sphereCutterNode.geometry,
    sphereCutterNode.material,
  );
  sphereCutterBrush.updateMatrixWorld();

  // 4.2 Cylinder Cutter Brush
  const cylinderCutterBrush = new Brush(
    cylinderCutterNode.geometry,
    cylinderCutterNode.material,
  );
  cylinderCutterBrush.updateMatrixWorld();

  /**
   *  Ⅴ. 执行底座椭圆切割操作
   */

  // 5.1 获取孔洞切割后的头模，取出其实际顶点数量修改 UV
  const sphHollowCutHead = csgSubtract(
    headNode,
    sphereCutterBrush,
    true,
    // ["position"],
    // ["uv"],
    ["position", "uv"],
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Sphere Cutter Node Hollow Subtraction for UV modification.",
    },
  );
  console.log("\n -- getCutHeadNew -- sphHollowCutHead ->", sphHollowCutHead);
  // DEBUG sph hollow cut.
  // sphHollowCutHead.name = "CutHeadNode";
  // return groupToBeReturned.add(sphHollowCutHead);

  // 5.2 执行底座椭圆切割 (SOLID SUBTRACTION from 'three-bvh-csg')
  cutHeadBrush = csgSubtract(headNode, sphereCutterBrush, false, null, null, {
    isLog: IsCSGOperationLog,
    value: "Sphere Cutter Node Subtraction.",
  });

  // 5.3 UV 修改 (基于前一个切割几何体顶点数量)
  const postSphereCutOffest = { pos: 0, neg: 0 };
  modifyNewVerticesUv(
    sphHollowCutHead,
    cutHeadBrush,
    postSphereCutOffest.pos,
    postSphereCutOffest.neg,
  );
  // DEBUG sph cut.
  // cutHeadBrush.name = "CutHeadNode";
  // return groupToBeReturned.add(cutHeadBrush);

  /**
   * Ⅵ. 执行圆柱切割操作
   */
  // 6.1 获取孔洞切割后的头模，取出其实际顶点数量修改 UV
  const cylHollowCutHead = csgSubtract(
    cutHeadBrush,
    cylinderCutterBrush,
    true,
    ["position"],
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Cylinder Cutter Node Hollow Subtraction.",
    },
  );

  // 6.2 执行圆柱切割 (SOLID SUBTRACTION from 'three-bvh-csg')
  cutHeadBrush = csgSubtract(
    cutHeadBrush,
    cylinderCutterBrush,
    false,
    null,
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Cylinder Cutter Node Subtraction.",
    },
  );

  // 6.3 UV 修改 (基于前一个切割几何体顶点数量)
  const postCylinderCutOffest = { pos: 0, neg: 0 };
  modifyNewVerticesUv(
    cylHollowCutHead, // Pass the hollow cut Brush directly
    cutHeadBrush,
    postCylinderCutOffest.pos,
    postCylinderCutOffest.neg,
  );

  // Set the name of the cut head node
  cutHeadBrush.name = "CutHeadNode";
  // Set the name of the cut head node material
  (cutHeadBrush.material as THREE.MeshPhongMaterial).name = "CutHeadNodeMat";
  // console.log("\ncutHeadBrush.material ->", cutHeadBrush.material);

  /**
   * Ⅶ. 释放资源
   */
  if (isDispose) {
    disposeGeoMat(headToBeCut);
    headToBeCut = null;
  }

  /**
   * Ⅷ. 返回切割过后的头模组
   */
  return groupToBeReturned.add(cutHeadBrush);
}

/**
 * CSG 切割方法
 * @param {THREE.Mesh | Brush} objToBeCut 被切割模型
 * @param {THREE.Mesh | Brush} cutter 切割模型
 * @param {boolean} isHollowSub 是否为孔洞切割
 * @param {string[] | null} evaluatorAttributes 计算器属性 {@remarks ["position", "normal", "uv"]} @see {@link https://threejs.org/docs/?q=BufferAttribute#BufferAttribute}
 * @param {THREE.Material | null}  material 执行切割操作时所使用的材质
 * @param {CSGOperationLog} operationLog 切割操作 DEBUG 日志
 * @returns {Brush} 切割后的模型 {@see Brush extends THREE.Mesh}
 */
export function csgSubtract(
  objToBeCut: THREE.Mesh | Brush,
  cutter: THREE.Mesh | Brush,
  isHollowSub: boolean,
  evaluatorAttributes?: string[] | null,
  material?: THREE.Material | null,
  operationLog?: CSGOperationLog,
): Brush {
  /**
   *  Opt: Reuse Brush to be cut if passed
   */
  let brushObjToBeCut: Brush;
  if (objToBeCut instanceof Brush) {
    brushObjToBeCut = objToBeCut;
    // Ensure material is updated if one is provided
    if (material) brushObjToBeCut.material = material;
  } else {
    brushObjToBeCut = new Brush(
      objToBeCut.geometry,
      material || objToBeCut.material,
    );
    brushObjToBeCut.updateMatrixWorld();
  }

  /**
   *  Opt: Reuse Brush cutter if passed
   */
  let brushCutter: Brush;
  if (cutter instanceof Brush) {
    brushCutter = cutter;
    if (material) brushCutter.material = material;
  } else {
    brushCutter = new Brush(cutter.geometry, material || cutter.material);
    brushCutter.updateMatrixWorld();
  }

  /**
   *  Set the attributes for the CSG evaluator
   */
  CSGEvaluator.attributes = evaluatorAttributes
    ? evaluatorAttributes
    : DefaultCSGEvaluatorAttributes;

  /**
   *  Operation Logs
   */
  if (operationLog && operationLog.isLog) {
    console.log("\n -- csgSubtract -- operationLog ->", operationLog);
    console.log(
      "\n -- csgSubtract -- CSGEvaluator.attributes ->",
      CSGEvaluator.attributes,
    );
  }

  /**
   *  Perform the CSG subtraction operation
   */
  const rs = CSGEvaluator.evaluate(
    brushObjToBeCut,
    brushCutter,
    isHollowSub ? HOLLOW_SUBTRACTION : SUBTRACTION,
  );

  /**
   *  Merge vertices and update matrix world
   */
  rs.geometry = mergeVertices(rs.geometry);
  rs.updateMatrixWorld();

  /**
   *  Return the result
   */
  return rs;
}

/**
 * Modify the uv coordinates of the new vertices.
 * @param {Brush | THREE.Mesh} originalNode Original Node before csg operation.
 * @param {Brush | THREE.Mesh} cutObj Cut Object after csg operation.
 * @param {number} offsetPositivePercentage 0 ~ 1 value of the positive offset of the uv start idx based on the original node vertices count.
 * @param {number} offsetNegativePercentage -1 ~ 0 value of the negative offset of the uv start idx based on the original node vertices count.
 */
export function modifyNewVerticesUv(
  originalNode: Brush | THREE.Mesh,
  cutObj: Brush | THREE.Mesh,
  offsetPositivePercentage: number,
  offsetNegativePercentage: number,
): void {
  const originalNodeAttr = getAttributes(originalNode);
  // console.log('originalNode Geometry attributes before cut ->', originalNodeAttr)
  const finalCutObjAttr = getAttributes(cutObj);
  // console.log('cylinder cut cutHead geometry attributes -> ', cylCutHeadAttr)

  // Get the original node vertices count
  const orgCount = originalNodeAttr.uv!.count;
  // Get the final cut object vertices count
  const finalCount = finalCutObjAttr.uv!.count;
  // Get the new vertices count
  const newVerticesCount = finalCount - orgCount;

  // Calculate the offset positive percentage
  const orgCountOffsetPositive = Math.floor(
    newVerticesCount * offsetPositivePercentage,
  );
  // Calculate the offset negative percentage
  const orgCountOffsetNegative = Math.floor(
    orgCount * offsetNegativePercentage,
  );

  // Calculate the offset count
  const offsetCount =
    orgCount + orgCountOffsetPositive + orgCountOffsetNegative;

  /*
    Update the uv coordinates of the new vertices
   */

  // Define the uv coordinate modifier
  const uvCoordinateMod = new THREE.Vector2(0.1, 0.1);

  // Loop through the new vertices and update the uv coordinates
  for (let i = offsetCount; i < finalCount; i++) {
    finalCutObjAttr.uv!.setX(i, uvCoordinateMod.x);
    finalCutObjAttr.uv!.setY(i, uvCoordinateMod.y);
  }

  // Mark the uv attribute as needs update
  finalCutObjAttr.uv!.needsUpdate = true;
}

/**
 * Dispose the geometry and material of the object.
 * @param {THREE.Group<THREE.Object3DEventMap>} obj3D The object to dispose.
 */
export function disposeGeoMat(obj3D: THREE.Group<THREE.Object3DEventMap>) {
  console.log("\n -- disposeGeoMat -- ready to dispose obj3D ->", obj3D);
  obj3D.traverse((m) => {
    if (m instanceof THREE.Mesh) {
      // 1. Dispose GPU resources
      if (m.geometry) m.geometry.dispose();

      // 2. Dispose material resources
      if (m.material) {
        if (Array.isArray(m.material)) {
          m.material.forEach((material: THREE.Material) => material.dispose());
        } else {
          m.material.dispose();
        }
      }

      m.geometry = undefined as any;
      m.material = undefined as any;
    }
  });

  if (obj3D.parent) {
    obj3D.parent.remove(obj3D);
  }

  obj3D.clear();
}

/**
 * Loads an OBJ file and returns a Promise of the loaded object.
 * @param path The path to the OBJ file.
 * @param options Optional load options.
 * @returns Promise of the loaded object.
 */
async function loadObj(
  path: string,
  options: LoadObjOptions = {},
): Promise<THREE.Group<THREE.Object3DEventMap>> {
  const { mtlPath, scale, position, rotation } = options;

  // let materials: THREE.Material | THREE.Material[] | undefined;
  let materials: MTLLoader.MaterialCreator | undefined;

  // Load MTL (if provided)
  if (mtlPath) {
    const mtlLoader = new MTLLoader();
    materials = await new Promise<MTLLoader.MaterialCreator>(
      (resolve, reject) => {
        mtlLoader.load(
          mtlPath,
          (mtl) => {
            mtl.preload();
            resolve(mtl);
          },
          undefined,
          reject,
        );
      },
    );
  }

  // Load OBJ
  const objLoader = new OBJLoader();
  if (materials) objLoader.setMaterials(materials);

  const loadedObj = await new Promise<THREE.Group<THREE.Object3DEventMap>>(
    (resolve, reject) => {
      objLoader.load(path, resolve, undefined, reject);
    },
  );

  // Optional transforms
  if (position) loadedObj.position.copy(position);

  if (rotation) loadedObj.rotation.copy(rotation);

  if (scale) {
    if (typeof scale === "number") loadedObj.scale.setScalar(scale);
    else loadedObj.scale.copy(scale);
  }

  return loadedObj;
}

/**
 * Gets the attributes of a mesh.
 * @param {THREE.Mesh} mesh The mesh to get attributes from.
 * @returns {THREE.NormalBufferAttributes} The attributes of the mesh.
 */
function getAttributes(mesh: THREE.Mesh): THREE.NormalBufferAttributes {
  return mesh.geometry.attributes;
}
