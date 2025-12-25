import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import {
  Brush,
  Evaluator,
  HOLLOW_SUBTRACTION,
  SUBTRACTION,
} from "three-bvh-csg";

/**
 * Constants
 */

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
 * 获取布尔切割后的头部模型：接收头模对象，布尔切割后返回
 * @remarks
 *    切割步骤:
 *      1. 口腔顶点切割
 *      2. 底座椭圆孔洞切割 (获取顶点数量以精确修改 UV)
 *      3. 底座椭圆切割
 *      4. 圆柱孔洞切割 (获取顶点数量以精确修改 UV)
 *      5. 圆柱切割
 * @param {THREE.Group<THREE.Object3DEventMap>} headModel 头模对象
 * @param {THREE.Group<THREE.Object3DEventMap> | string} cutters 布尔切割口腔顶点模型或路径 [切割口腔后部顶点防止出现孔洞问题]
 * @returns {Promise<THREE.Group<THREE.Object3DEventMap>>} 切割后的头模对象
 */
export async function getCutHead(
  headModel: THREE.Group<THREE.Object3DEventMap>,
  cutters: THREE.Group<THREE.Object3DEventMap> | string
): Promise<THREE.Group<THREE.Object3DEventMap>> {
  // 切割模型
  const loadedCuttersModel: THREE.Group<THREE.Object3DEventMap> =
    cutters instanceof THREE.Group ? cutters : await loadObj(cutters);
  // console.log("loadedCuttersModel ->", loadedCuttersModel);
  // return headModel;
  const cuttersLen = loadedCuttersModel.children.length;

  // 没有切割节点，返回头模
  if (cuttersLen === 0) {
    console.warn("No cutters found.");
    return headModel;
  }

  // 加载口腔切割模型

  // 获取节点

  // 头部节点
  const headNode = headModel.getObjectByName("head_lod0_mesh") as THREE.Mesh;
  // 左眼节点
  const eyeLNode = headModel
    .getObjectByName("eyeLeft_lod0_mesh")
    .clone() as THREE.Mesh;
  // 右眼节点
  const eyeRNode = headModel
    .getObjectByName("eyeRight_lod0_mesh")
    .clone() as THREE.Mesh;

  let cutHeadObj: Brush | THREE.Mesh;

  // 一个切割节点，直接切
  if (cuttersLen === 1) {
    const cutter = loadedCuttersModel.children[0] as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material
    >;
    cutHeadObj = csgSubtract(headNode, cutter, false, null, null, {
      isLog: IsCSGOperationLog,
      value: "One single Cutter Node Subtraction.",
    });
    cutHeadObj.name = "CutHead";
    // 释放资源
    disposeGeoMat(headModel);
    // 返回切割过后的头部节点，左眼节点和右眼节点组
    return combineMeshesToGroup(
      "CutHeadEyesNodeCombinedGrp",
      cutHeadObj,
      eyeLNode,
      eyeRNode
    );
  }

  // 切割节点 (根据索引获取 -> 改为根据名称获取)

  // 口腔切割节点
  const cutter4OralCavityNode = loadedCuttersModel.getObjectByName(
    "cutting01"
  ) as THREE.Mesh;

  // Sphere Cutter
  const sphereCutterNode = loadedCuttersModel.getObjectByName(
    "cutting02"
  ) as THREE.Mesh;
  // Cylinder Cutter
  const cylinderCutterNode = loadedCuttersModel.getObjectByName(
    "cutting03"
  ) as THREE.Mesh;

  // !! 执行切割操作

  // 执行口腔布尔孔洞切割 (HOLLOW_SUBTRACTION from 'three-bvh-csg')
  cutHeadObj = csgSubtract(headNode, cutter4OralCavityNode, true, null, null, {
    isLog: IsCSGOperationLog,
    value: "Oral Cavity Cutter Node Hollow Subtraction.",
  });
  // DEBUG hollow cut.
  // return new THREE.Group().add(cutHeadObj);

  // 基础材质，只为创建新网格使用
  const basicMat = new THREE.MeshBasicMaterial();

  // ! 更正：获取孔洞切割后的头模，取出其实际顶点数量修改 UV，而不是取之前未切割过后的原头模顶点数量
  const sphHollowCutHead = csgSubtract(
    cutHeadObj,
    sphereCutterNode,
    true,
    ["position"],
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Sphere Cutter Node Hollow Subtraction.",
    }
  );
  // 切割之前获取孔洞切割几何体
  const sphHollowCutHeadGeo = sphHollowCutHead.geometry;
  // 执行底座椭圆切割
  cutHeadObj = csgSubtract(cutHeadObj, sphereCutterNode, false, null, null, {
    isLog: IsCSGOperationLog,
    value: "Sphere Cutter Node Subtraction.",
  });
  // UV 修改 (基于前一个切割几何体顶点数量)
  const postSphereCutOffest = { pos: 0, neg: 0 };
  modifyNewVerticesUv(
    new THREE.Mesh(sphHollowCutHeadGeo, basicMat),
    cutHeadObj,
    postSphereCutOffest.pos,
    postSphereCutOffest.neg
  );
  // DEBUG sph cut.
  // return new THREE.Group().add(cutHeadObj);

  // ! 更正：获取孔洞切割后的头模，取出其实际顶点数量修改 UV，而不是取之前未切割过后的原头模顶点数量
  const cylHollowCutHead = csgSubtract(
    cutHeadObj,
    cylinderCutterNode,
    true,
    ["position"],
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Cylinder Cutter Node Hollow Subtraction.",
    }
  );
  // 切割之前获取孔洞切割几何体
  const cylHollowCutHeadGeo = cylHollowCutHead.geometry;
  // 执行圆柱切割
  cutHeadObj = csgSubtract(cutHeadObj, cylinderCutterNode, false, null, null, {
    isLog: IsCSGOperationLog,
    value: "Cylinder Cutter Node Subtraction.",
  });
  // UV 修改 (基于前一个切割几何体顶点数量)
  const postCylinderCutOffest = { pos: 0, neg: 0 };
  // console.log("postCylinderCutOffest ->", postCylinderCutOffest);
  modifyNewVerticesUv(
    new THREE.Mesh(cylHollowCutHeadGeo, basicMat),
    cutHeadObj,
    postCylinderCutOffest.pos,
    postCylinderCutOffest.neg
  );
  // DEBUG cyl cut.
  // return new THREE.Group().add(cutHeadObj);

  // 修改 cutHead 名称
  cutHeadObj!.name = "CutHead";

  // 释放资源
  disposeGeoMat(headModel);
  // 返回切割过后的头部节点，左眼节点和右眼节点组
  return combineMeshesToGroup(
    "CutHeadEyesNodeCombinedGrp",
    cutHeadObj!,
    eyeLNode,
    eyeRNode
  );
}

/**
 * CSG 切割方法
 * @param {THREE.Mesh | Brush} obj2Cut 被切割模型
 * @param {THREE.Mesh | Brush} cutter 切割模型
 * @param {boolean} isHollowSub 是否为孔洞切割
 * @param {string[] | null} evaluatorAttributes 计算器属性 {@remarks ["position", "normal", "uv"]}
 * @param {THREE.Material | null}  material 执行切割操作时所使用的材质
 * @param {CSGOperationLog} operationLog 切割操作 DEBUG 日志
 * @returns {Brush} 切割后的模型 {@remarks @see Brush extends THREE.Mesh}
 */
function csgSubtract(
  obj2Cut: THREE.Mesh | Brush,
  cutter: THREE.Mesh | Brush,
  isHollowSub: boolean,
  evaluatorAttributes?: string[] | null,
  material?: THREE.Material | null,
  operationLog?: CSGOperationLog
): Brush {
  const brushObj2Cut = new Brush(
    obj2Cut.geometry,
    material || obj2Cut.material
  );
  brushObj2Cut.updateMatrixWorld();

  const brushCutter = new Brush(cutter.geometry, material || cutter.material);
  brushCutter.updateMatrixWorld();

  CSGEvaluator.attributes = evaluatorAttributes
    ? evaluatorAttributes
    : DefaultCSGEvaluatorAttributes;

  /*
    Operation Logs
  */
  if (operationLog.isLog) {
    console.log("\n -- csgSubtract -- operationLog ->", operationLog);
    console.log(
      "\n -- csgSubtract -- CSGEvaluator.attributes ->",
      CSGEvaluator.attributes
    );
  }

  const rs = CSGEvaluator.evaluate(
    brushObj2Cut,
    brushCutter,
    isHollowSub ? HOLLOW_SUBTRACTION : SUBTRACTION
  );
  rs.updateMatrixWorld();
  return rs;
}

/**
 * Modify the uv coordinates of the new vertices.
 * @param {THREE.Mesh} originalNode Original Node before csg operation.
 * @param {THREE.Mesh} cutObj Cut Object after csg operation.
 * @param {number} offsetPositivePercentage 0 ~ 1 value of the positive offset of the uv start idx based on the original node vertices count.
 * @param {number} offsetNegativePercentage -1 ~ 0 value of the negative offset of the uv start idx based on the original node vertices count.
 */
function modifyNewVerticesUv(
  originalNode: Brush | THREE.Mesh,
  cutObj: Brush | THREE.Mesh,
  offsetPositivePercentage: number,
  offsetNegativePercentage: number
): void {
  const originalNodeAttr = getAttributes(originalNode);
  // console.log('originalNode Geometry attributes before cut ->', originalNodeAttr)
  const finalCutObjAttr = getAttributes(cutObj);
  // console.log('cylinder cut cutHead geometry attributes -> ', cylCutHeadAttr)

  // Get the vertices count

  const orgCount = originalNodeAttr.uv!.count;
  const finalCount = finalCutObjAttr.uv!.count;
  const newVerticesCount = finalCount - orgCount;

  const orgCountOffsetPositive = Math.floor(
    newVerticesCount * offsetPositivePercentage
  );
  const orgCountOffsetNegative = Math.floor(
    orgCount * offsetNegativePercentage
  );

  const offsetCount =
    orgCount + orgCountOffsetPositive + orgCountOffsetNegative;

  // 新增顶点的 uv 坐标更新

  const uvCoordinateMod = new THREE.Vector2(0.1, 0.1);

  for (let i = offsetCount; i < finalCount; i++) {
    finalCutObjAttr.uv!.setX(i, uvCoordinateMod.x);
    finalCutObjAttr.uv!.setY(i, uvCoordinateMod.y);
  }
  finalCutObjAttr.uv!.needsUpdate = true;
}

/**
 * Dispose the geometry and material of the object.
 * @param {THREE.Object3D<THREE.Object3DEventMap>} obj3D The object to dispose.
 */
function disposeGeoMat(obj3D: THREE.Object3D<THREE.Object3DEventMap>) {
  if (!(obj3D instanceof THREE.Group)) return;
  console.log("obj3D 2 dispose ->", obj3D);

  obj3D.traverse((m) => {
    if (m instanceof THREE.Mesh) {
      // console.log("Ready to dispose the geometry and material of mesh ->", m);

      // 1. Dispose GPU resources
      m.geometry.dispose();

      // 2. Dispose material resources (and potentially textures)
      if (Array.isArray(m.material)) {
        m.material.forEach((material: THREE.Material) => material.dispose());
      } else {
        m.material.dispose();
      }

      // console.log("Disposed the geometry and material of mesh ->", m);

      // Optional: Explicitly remove JS references if you don't need the mesh object anymore
      m.geometry = undefined as any; // Cast might be needed for TS
      m.material = undefined as any;

      // console.log("Disposed the geometry and material of mesh ->", m);
    }
  });

  // 3. Remove the entire group from the scene
  if (obj3D.parent) {
    obj3D.parent.remove(obj3D);
  }

  // 4. Set original variable reference to null,
  // e.g., myModelGroup = null; to allow the JS garbage collector to clean up the mesh objects themselves.
  obj3D.clear();
  // console.log("Disposed obj3D after clear ->", obj3D);
  obj3D = null;
  // console.log("Disposed obj3D after null ->", obj3D);
}

/**
 * Combines multiple meshes into a THREE.Group.
 * @param {string} name Optional name for the group.
 * @param {THREE.Mesh[]} meshes List of meshes to combine.
 * @returns THREE.Group containing all meshes.
 */
export function combineMeshesToGroup(
  name: string,
  ...meshes: THREE.Mesh[]
): THREE.Group<THREE.Object3DEventMap> {
  const group = new THREE.Group();
  group.name = name;

  for (const mesh of meshes) {
    // Avoid accidental re-parenting if mesh already has a parent
    if (mesh.parent) mesh.parent.remove(mesh);
    group.add(mesh);
  }

  return group;
}

/**
 * Loads an OBJ file and returns a Promise of the loaded object.
 * @param path The path to the OBJ file.
 * @param options Optional load options.
 * @returns Promise of the loaded object.
 */
async function loadObj(
  path: string,
  options: LoadObjOptions = {}
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
          reject
        );
      }
    );
  }

  // Load OBJ
  const objLoader = new OBJLoader();
  if (materials) objLoader.setMaterials(materials);

  const loadedObj = await new Promise<THREE.Group<THREE.Object3DEventMap>>(
    (resolve, reject) => {
      objLoader.load(path, resolve, undefined, reject);
    }
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
