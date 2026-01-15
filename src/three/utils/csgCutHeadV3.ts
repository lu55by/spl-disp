import * as THREE from "three";
import {
  Brush,
  Evaluator,
  HOLLOW_SUBTRACTION,
  SUBTRACTION,
} from "three-bvh-csg";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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

/*
  CutHead Height Threshold to decide whether to execute the hollow subtraction of the oral cavity
 */
const CutHeadHeightThreshold4OralCavity = 20;

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
  cutters: THREE.Group<THREE.Object3DEventMap> | string,
  isDispose: boolean = true
): Promise<THREE.Group<THREE.Object3DEventMap>> {
  console.log("\nheadModel 2 be cut ->", headModel);
  // return;
  // 切割模型
  const loadedCuttersModel: THREE.Group<THREE.Object3DEventMap> =
    cutters instanceof THREE.Group ? cutters : await loadObj(cutters);
  console.log("loadedCuttersModel ->", loadedCuttersModel);
  // return headModel;
  const cuttersLen = loadedCuttersModel.children.length;

  // 没有切割节点，返回头模
  if (cuttersLen === 0) {
    console.warn("No cutters found.");
    return headModel;
  }

  // 判断是否为单个切割节点
  const isCuttersLen1 = cuttersLen === 1;

  // 加载口腔切割模型

  // 获取节点

  /*
    头部节点
   */
  const headNode = headModel.getObjectByName("head_lod0_mesh") as THREE.Mesh;

  /*
    原始牙齿节点 (如为单个切割节点，则返回原始牙齿节点，否则直接进行切割，防止牙齿节点后部突出)
   */
  const teethNodeOrg = headModel.getObjectByName(
    "teeth_lod0_mesh"
  ) as THREE.Mesh;

  /*
    牙齿切割节点
   */
  let cutterTeethNode: THREE.Mesh | null = null;
  if (!isCuttersLen1)
    cutterTeethNode = loadedCuttersModel.getObjectByName(
      "cutter-teeth"
    ) as THREE.Mesh;
  console.log("\n -- getCutHead -- cutterTeethNode ->", cutterTeethNode);

  /*
    牙齿节点
   */
  // 判断是否是单个切割节点，不是则进行切割，否则直接使用原始牙齿节点
  const teethNode = !isCuttersLen1
    ? csgSubtract(teethNodeOrg, cutterTeethNode, true, null, null, {
        isLog: IsCSGOperationLog,
        value: "Teeth Cutter Node Hollow Subtraction.",
      })
    : teethNodeOrg.clone();
  // Set the name of the teeth node
  teethNode.name = "TeethNode";
  // Set the name of the teeth node material
  (teethNode.material as THREE.MeshPhongMaterial).name = "TeethNodeMat";

  /*
    左眼节点
   */
  const eyeLNode = headModel
    .getObjectByName("eyeLeft_lod0_mesh")
    .clone() as THREE.Mesh;
  // Set the name of the left eye node
  eyeLNode.name = "EyeLNode";
  // Set the name of the left eye node material
  (eyeLNode.material as THREE.MeshPhongMaterial).name = "EyeLNodeMat";

  /*
    右眼节点
   */
  const eyeRNode = headModel
    .getObjectByName("eyeRight_lod0_mesh")
    .clone() as THREE.Mesh;
  // Set the name of the right eye node
  eyeRNode.name = "EyeRNode";
  // Set the name of the right eye node material
  (eyeRNode.material as THREE.MeshPhongMaterial).name = "EyeRNodeMat";

  /*
    预创建 Brush
  */
  let cutHeadBrush: Brush | THREE.Mesh;

  // 一个切割节点，直接切
  if (isCuttersLen1) {
    const cutterSingle = loadedCuttersModel.children[0] as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material
    >;
    // Pre-create brush for cutter
    const cutterSingleBrush = new Brush(
      cutterSingle.geometry,
      cutterSingle.material
    );
    cutterSingleBrush.updateMatrixWorld();

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
      disposeGeoMat(headModel);
      headModel = null;
    }
    // 返回切割过后的头部节点，左眼节点和右眼节点组
    return combineMeshesToGroup(
      "CutHeadEyesNodeCombinedGrp",
      cutHeadBrush,
      teethNode,
      eyeLNode,
      eyeRNode
    );
  }

  /*
    切割节点 (根据名称获取)
   */

  // Cutter Oral Cavity (口腔切割节点)
  const cutter4OralCavityNode = loadedCuttersModel.getObjectByName(
    "cutting01"
  ) as THREE.Mesh;
  console.log(
    "\n -- getCutHead -- cutter4OralCavityNode ->",
    cutter4OralCavityNode
  );

  // Cutter Sphere (底座椭圆切割节点)
  const sphereCutterNode = loadedCuttersModel.getObjectByName(
    "cutting02"
  ) as THREE.Mesh;
  console.log("\n -- getCutHead -- sphereCutterNode ->", sphereCutterNode);

  // Cutter Cylinder (圆柱切割节点)
  const cylinderCutterNode = loadedCuttersModel.getObjectByName(
    "cutting03"
  ) as THREE.Mesh;
  console.log("\n -- getCutHead -- cylinderCutterNode ->", cylinderCutterNode);

  // Pre-create Brushes for cutters to avoid repeated instantiation
  const oralCavityBrush = new Brush(
    cutter4OralCavityNode.geometry,
    cutter4OralCavityNode.material
  );
  // oralCavityBrush.position.y += 2.3;
  oralCavityBrush.updateMatrixWorld();

  /*
    Reuse the same brush for sphere cutter to operate csgSubtract two times
    TIME 1: HOLLOW Subtraction
    TIME 2: Solid Subtraction
   */

  // Sphere Cutter Brush
  const sphereCutterBrush = new Brush(
    sphereCutterNode.geometry,
    sphereCutterNode.material
  );
  sphereCutterBrush.updateMatrixWorld();
  // Cylinder Cutter Brush
  const cylinderCutterBrush = new Brush(
    cylinderCutterNode.geometry,
    cylinderCutterNode.material
  );
  cylinderCutterBrush.updateMatrixWorld();

  /**
   *  !! 执行切割操作
   */
  // 执行底座椭圆切割以获取头模高度，根据头模高度判断是否需要执行口腔布尔孔洞切割
  const sphHollowCutHead4OralHollowCSGValidation = csgSubtract(
    headNode,
    sphereCutterBrush,
    false,
    ["position"],
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Sphere Cutter Node Subtraction for getting head height.",
    }
  );
  const isSmallHead = validateSmallCutHead(
    sphHollowCutHead4OralHollowCSGValidation
  );
  console.log("\n -- getCutHead -- isSmallHead ->", isSmallHead);

  /*
    Optionally execute the operation of oral cavity brush hollow cut based on the boolean value of 'isSmallHead'.
   */
  // 执行口腔布尔孔洞切割 (HOLLOW_SUBTRACTION from 'three-bvh-csg')
  // Note: first operand (headNode) is a Mesh, csgSubtract will convert it to a Brush.
  cutHeadBrush = isSmallHead
    ? headNode
    : csgSubtract(headNode, oralCavityBrush, true, null, null, {
        isLog: IsCSGOperationLog,
        value: "Oral Cavity Cutter Node Hollow Subtraction.",
      });
  // DEBUG hollow cut.
  // cutHeadBrush.name = "CutHeadNode";
  // return new THREE.Group().add(cutHeadBrush);

  // ! 更正：获取孔洞切割后的头模，取出其实际顶点数量修改 UV，而不是取之前未切割过后的原头模顶点数量
  const sphHollowCutHead = csgSubtract(
    cutHeadBrush,
    // headNode,
    sphereCutterBrush,
    true,
    ["position"],
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Sphere Cutter Node Hollow Subtraction.",
    }
  );
  // DEBUG sph hollow cut.
  // sphHollowCutHead.name = "CutHeadNode";
  // return new THREE.Group().add(sphHollowCutHead);

  // 执行底座椭圆切割
  cutHeadBrush = csgSubtract(
    cutHeadBrush,
    // headNode,
    sphereCutterBrush,
    false,
    null,
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Sphere Cutter Node Subtraction.",
    }
  );

  // UV 修改 (基于前一个切割几何体顶点数量)
  const postSphereCutOffest = { pos: 0, neg: 0 };
  modifyNewVerticesUv(
    // Pass the hollow cut Brush directly as the "originalNode" reference for count
    sphHollowCutHead,
    cutHeadBrush,
    postSphereCutOffest.pos,
    postSphereCutOffest.neg
  );
  // DEBUG sph cut.
  // cutHeadBrush.name = "CutHeadNode";
  // return new THREE.Group().add(cutHeadBrush);

  // ! 更正：获取孔洞切割后的头模，取出其实际顶点数量修改 UV，而不是取之前未切割过后的原头模顶点数量
  const cylHollowCutHead = csgSubtract(
    cutHeadBrush,
    cylinderCutterBrush,
    true,
    ["position"],
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Cylinder Cutter Node Hollow Subtraction.",
    }
  );

  // 执行圆柱切割
  cutHeadBrush = csgSubtract(
    cutHeadBrush,
    cylinderCutterBrush,
    false,
    null,
    null,
    {
      isLog: IsCSGOperationLog,
      value: "Cylinder Cutter Node Subtraction.",
    }
  );

  // UV 修改 (基于前一个切割几何体顶点数量)
  const postCylinderCutOffest = { pos: 0, neg: 0 };
  modifyNewVerticesUv(
    cylHollowCutHead, // Pass the hollow cut Brush directly
    cutHeadBrush,
    postCylinderCutOffest.pos,
    postCylinderCutOffest.neg
  );

  // Set the name of the cut head node
  cutHeadBrush.name = "CutHeadNode";
  // Set the name of the cut head node material
  (cutHeadBrush.material as THREE.MeshPhongMaterial).name = "CutHeadNodeMat";
  // console.log("\ncutHeadBrush.material ->", cutHeadBrush.material);

  // 释放资源
  if (isDispose) {
    disposeGeoMat(headModel);
    headModel = null;
  }
  // 返回切割过后的头部节点，左眼节点和右眼节点组
  return combineMeshesToGroup(
    "CutHeadEyesNodeCombinedGrp",
    cutHeadBrush,
    // TODO: Uncomment the teethNode later
    // teethNode,
    eyeLNode,
    eyeRNode
  );
}

/**
 * CSG 切割方法
 * @param {THREE.Mesh | Brush} obj2Cut 被切割模型
 * @param {THREE.Mesh | Brush} cutter 切割模型
 * @param {boolean} isHollowSub 是否为孔洞切割
 * @param {string[] | null} evaluatorAttributes 计算器属性 {@remarks ["position", "normal", "uv"]} @see {@link https://threejs.org/docs/?q=BufferAttribute#BufferAttribute}
 * @param {THREE.Material | null}  material 执行切割操作时所使用的材质
 * @param {CSGOperationLog} operationLog 切割操作 DEBUG 日志
 * @returns {Brush} 切割后的模型 {@see Brush extends THREE.Mesh}
 */
function csgSubtract(
  obj2Cut: THREE.Mesh | Brush,
  cutter: THREE.Mesh | Brush,
  isHollowSub: boolean,
  evaluatorAttributes?: string[] | null,
  material?: THREE.Material | null,
  operationLog?: CSGOperationLog
): Brush {
  // Opt: Reuse Brush if passed
  let brushObj2Cut: Brush;
  if (obj2Cut instanceof Brush) {
    brushObj2Cut = obj2Cut;
    // Ensure material is updated if one is provided
    if (material) brushObj2Cut.material = material;
  } else {
    brushObj2Cut = new Brush(obj2Cut.geometry, material || obj2Cut.material);
    brushObj2Cut.updateMatrixWorld();
  }

  // Opt: Reuse Brush if passed
  let brushCutter: Brush;
  if (cutter instanceof Brush) {
    brushCutter = cutter;
    if (material) brushCutter.material = material;
  } else {
    brushCutter = new Brush(cutter.geometry, material || cutter.material);
    brushCutter.updateMatrixWorld();
  }

  CSGEvaluator.attributes = evaluatorAttributes
    ? evaluatorAttributes
    : DefaultCSGEvaluatorAttributes;

  /*
    Operation Logs
  */
  if (operationLog && operationLog.isLog) {
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
  rs.geometry = mergeVertices(rs.geometry);
  rs.updateMatrixWorld();
  return rs;
}

/**
 * Modify the uv coordinates of the new vertices.
 * @param {Brush | THREE.Mesh} originalNode Original Node before csg operation.
 * @param {Brush | THREE.Mesh} cutObj Cut Object after csg operation.
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

  // Get the original node vertices count
  const orgCount = originalNodeAttr.uv!.count;
  // Get the final cut object vertices count
  const finalCount = finalCutObjAttr.uv!.count;
  // Get the new vertices count
  const newVerticesCount = finalCount - orgCount;

  // Calculate the offset positive percentage
  const orgCountOffsetPositive = Math.floor(
    newVerticesCount * offsetPositivePercentage
  );
  // Calculate the offset negative percentage
  const orgCountOffsetNegative = Math.floor(
    orgCount * offsetNegativePercentage
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
function disposeGeoMat(obj3D: THREE.Group<THREE.Object3DEventMap>) {
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

/**
 * Validate the small cut head
 * @param sphHollowCutHead4OralHollowCSGValidation The post sphere cut head brush
 * @returns true if the cut head is small enough to not execute the hollow subtraction of the oral cavity
 */
function validateSmallCutHead(
  sphHollowCutHead4OralHollowCSGValidation: Brush
): boolean {
  // Get the boudingBox of the cutHeadBrush
  const boundingBox = new THREE.Box3().setFromObject(
    sphHollowCutHead4OralHollowCSGValidation
  );
  console.log(
    "\n -- validateSmallCutHead -- calculated boundingBox of cutHeadBrush ->",
    boundingBox
  );
  // Get the height of the boundingBox
  const height = boundingBox.max.y - boundingBox.min.y;
  console.log(
    "\n -- validateSmallCutHead -- calculated height of cutHeadBrush ->",
    height
  );
  return height < CutHeadHeightThreshold4OralCavity;
}
