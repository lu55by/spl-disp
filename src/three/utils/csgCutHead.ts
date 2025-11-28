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
 * 接收头模对象，布尔切割后返回。
 * @param headModel 头模对象 (THREE.Object3D)
 * @param oralCavityPath 布尔切割口腔顶点模型路径 [切割口腔后部顶点防止出现孔洞问题] (string)
 * @param cuttersPath 布尔切割模型的路径 (string)
 */
export async function getCutHead(
  headModel: THREE.Object3D,
  oralCavityPath: string,
  cuttersPath: string
): Promise<THREE.Object3D> {
  // 加载切割模型
  const loadedCuttersModel: THREE.Object3D = await loadObj(cuttersPath);
  // console.log("loadedCuttersModel ->", loadedCuttersModel);
  const cuttersLen = loadedCuttersModel.children.length;

  // 没有切割节点，返回头模
  if (cuttersLen === 0) {
    console.warn("No cutters found.");
    return headModel;
  }

  // 加载口腔切割模型
  const loadedOralCavityModel: THREE.Object3D = await loadObj(oralCavityPath);
  // console.log("loadedOralCavityModel ->", loadedOralCavityModel);

  // 获取节点

  // 头部节点
  const headNode = headModel.getObjectByName("head_lod0_mesh") as THREE.Mesh;
  // 左眼节点
  const eyeLNode = headModel.getObjectByName("eyeLeft_lod0_mesh") as THREE.Mesh;
  // 右眼节点
  const eyeRNode = headModel.getObjectByName(
    "eyeRight_lod0_mesh"
  ) as THREE.Mesh;
  // 口腔切割节点
  const cutter4OralCavityNode = loadedOralCavityModel.children[0] as THREE.Mesh;

  let cutHeadObj: Brush | THREE.Mesh;

  // 执行口腔布尔孔洞切割 (HOLLOW_SUBTRACTION from 'three-bvh-csg')
  cutHeadObj = csgSubtract(headNode, cutter4OralCavityNode, true);
  // return new THREE.Group().add(cutHeadObj);

  // 一个切割节点，直接切
  if (cuttersLen === 1) {
    const cutter = loadedCuttersModel.children[0] as THREE.Mesh;
    // cutHeadObj = csgSubtract(headNode, cutter, false);
    cutHeadObj = csgSubtract(cutHeadObj, cutter, false);
    cutHeadObj.name = "CutHead";
    return combineMeshesToGroup(
      "CutHeadEyesNodeCombinedGrp",
      cutHeadObj,
      eyeLNode,
      eyeRNode
    );
  }

  // 切割节点 (先根据索引获取)

  // Sphere Cutter
  // sphereCutterNode = loadedCuttersModel.getObjectByName('Sphere006') as THREE.Mesh;
  const sphereCutterNode = loadedCuttersModel.children[0] as THREE.Mesh;
  // Cylinder Cutter
  // cylinderCutterNode = loadedCuttersModel.getObjectByName('Cylinder004') as THREE.Mesh;
  const cylinderCutterNode = loadedCuttersModel.children[1] as THREE.Mesh;

  // 执行切割操作

  /* 
    男头还是女头？
      需要区分，因为目前男女头新增顶点在 UV 数组中索引不同，有可能只有 0.002 (开始索引位置偏移百分比) 的差别.
      目前仅能基于调试无误后的 [固定值] 进行新增顶点的获取.
      eg.
        const postCylinderCutOffest = isFemale ? { pos: 0, neg: 0.046 } : { pos: 0, neg: 0.044 };
        (pos -> 基于切割之前的顶点数量作为开始索引向切割后的几何体 UV 数组 [后] 寻找新增顶点)
        (neg -> 基于切割之前的顶点数量作为开始索引向切割后的几何体 UV 数组 [前] 寻找新增顶点)
  */
  const isFemale = true;

  // 基础材质，只为创建新网格使用
  const basicMat = new THREE.MeshBasicMaterial();

  // 切割之前克隆几何体
  const sphCutHeadGeoPreCloned = cutHeadObj.geometry.clone();
  cutHeadObj = csgSubtract(cutHeadObj, sphereCutterNode, false);
  // UV 修改 (基于前一个切割几何体顶点数量)
  const postSphereCutOffest = { pos: 0, neg: 0.08 };
  modifyNewVerticesUv(
    new THREE.Mesh(sphCutHeadGeoPreCloned, basicMat),
    cutHeadObj,
    postSphereCutOffest.pos,
    postSphereCutOffest.neg
  );

  // 切割之前克隆几何体
  const cylCutHeadGeoPreCloned = cutHeadObj.geometry.clone();
  cutHeadObj = csgSubtract(cutHeadObj, cylinderCutterNode, false);
  // UV 修改 (基于前一个切割几何体顶点数量)
  const postCylinderCutOffest = isFemale
    ? { pos: 0, neg: 0.046 }
    : { pos: 0, neg: 0.044 };
  modifyNewVerticesUv(
    new THREE.Mesh(cylCutHeadGeoPreCloned, basicMat),
    cutHeadObj,
    postCylinderCutOffest.pos,
    postCylinderCutOffest.neg
  );

  // 修改 cutHead 名称
  cutHeadObj!.name = "CutHead";

  // 返回切割过后的头部节点，左眼节点和右眼节点组
  return combineMeshesToGroup(
    "cutHeadEyesCombinedGrp",
    cutHeadObj!,
    eyeLNode,
    eyeRNode
  );
}

export async function getCutHeadV2(
  headModel: THREE.Object3D,
  cuttersPath: string
): Promise<THREE.Object3D> {
  // 加载切割模型
  const loadedCuttersModel: THREE.Object3D = await loadObj(cuttersPath);
  console.log("loadedCuttersModel ->", loadedCuttersModel);
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
  const eyeLNode = headModel.getObjectByName("eyeLeft_lod0_mesh") as THREE.Mesh;
  // 右眼节点
  const eyeRNode = headModel.getObjectByName(
    "eyeRight_lod0_mesh"
  ) as THREE.Mesh;

  let cutHeadObj: Brush | THREE.Mesh;

  // 一个切割节点，直接切
  if (cuttersLen === 1) {
    const cutter = loadedCuttersModel.children[0] as THREE.Mesh;
    cutHeadObj = csgSubtract(headNode, cutter, false);
    // cutHeadObj = csgSubtract(cutHeadObj, cutter, false);
    cutHeadObj.name = "CutHead";
    return combineMeshesToGroup(
      "CutHeadEyesNodeCombinedGrp",
      cutHeadObj,
      eyeLNode,
      eyeRNode
    );
  }

  // 口腔切割节点
  const cutter4OralCavityNode = loadedCuttersModel.getObjectByName(
    "cutting01"
  ) as THREE.Mesh;

  // 执行口腔布尔孔洞切割 (HOLLOW_SUBTRACTION from 'three-bvh-csg')
  cutHeadObj = csgSubtract(headNode, cutter4OralCavityNode, true);
  // return new THREE.Group().add(cutHeadObj);

  // 切割节点 (先根据索引获取)

  // Sphere Cutter
  // sphereCutterNode = loadedCuttersModel.getObjectByName('Sphere006') as THREE.Mesh;
  // const sphereCutterNode = loadedCuttersModel.children[0] as THREE.Mesh;
  const sphereCutterNode = loadedCuttersModel.getObjectByName(
    "cutting02"
  ) as THREE.Mesh;
  // Cylinder Cutter
  // cylinderCutterNode = loadedCuttersModel.getObjectByName('Cylinder004') as THREE.Mesh;
  // const cylinderCutterNode = loadedCuttersModel.children[1] as THREE.Mesh;
  const cylinderCutterNode = loadedCuttersModel.getObjectByName(
    "cutting03"
  ) as THREE.Mesh;

  // 执行切割操作

  /* 
    男头还是女头？
      需要区分，因为目前男女头新增顶点在 UV 数组中索引不同，有可能只有 0.002 (开始索引位置偏移百分比) 的差别.
      目前仅能基于调试无误后的 [固定值] 进行新增顶点的获取.
      eg.
        const postCylinderCutOffest = isFemale ? { pos: 0, neg: 0.046 } : { pos: 0, neg: 0.044 };
        (pos -> 基于切割之前的顶点数量作为开始索引向切割后的几何体 UV 数组 [后] 寻找新增顶点)
        (neg -> 基于切割之前的顶点数量作为开始索引向切割后的几何体 UV 数组 [前] 寻找新增顶点)
  */
  const isFemale = true;

  // 基础材质，只为创建新网格使用
  const basicMat = new THREE.MeshBasicMaterial();

  // 切割之前克隆几何体
  const sphCutHeadGeoPreCloned = cutHeadObj.geometry.clone();
  cutHeadObj = csgSubtract(cutHeadObj, sphereCutterNode, false);
  // UV 修改 (基于前一个切割几何体顶点数量)
  const postSphereCutOffest = { pos: 0, neg: 0.08 };
  modifyNewVerticesUv(
    new THREE.Mesh(sphCutHeadGeoPreCloned, basicMat),
    cutHeadObj,
    postSphereCutOffest.pos,
    postSphereCutOffest.neg
  );

  // 切割之前克隆几何体
  const cylCutHeadGeoPreCloned = cutHeadObj.geometry.clone();
  cutHeadObj = csgSubtract(cutHeadObj, cylinderCutterNode, false);
  // UV 修改 (基于前一个切割几何体顶点数量)
  const postCylinderCutOffest = isFemale
    ? { pos: 0, neg: 0.046 }
    : { pos: 0, neg: 0.044 };
  modifyNewVerticesUv(
    new THREE.Mesh(cylCutHeadGeoPreCloned, basicMat),
    cutHeadObj,
    postCylinderCutOffest.pos,
    postCylinderCutOffest.neg
  );

  // 修改 cutHead 名称
  cutHeadObj!.name = "CutHead";

  // 返回切割过后的头部节点，左眼节点和右眼节点组
  return combineMeshesToGroup(
    "cutHeadEyesCombinedGrp",
    cutHeadObj!,
    eyeLNode,
    eyeRNode
  );
}

interface LoadObjOptions {
  mtlPath?: string;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3 | number;
}

async function loadObj(
  path: string,
  options: LoadObjOptions = {}
): Promise<THREE.Object3D> {
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

  const loadedObj = await new Promise<THREE.Object3D>((resolve, reject) => {
    objLoader.load(path, resolve, undefined, reject);
  });

  // Optional transforms
  if (position) loadedObj.position.copy(position);

  if (rotation) loadedObj.rotation.copy(rotation);

  if (scale) {
    if (typeof scale === "number") loadedObj.scale.setScalar(scale);
    else loadedObj.scale.copy(scale);
  }

  return loadedObj;
}

let CSGEvaluator = new Evaluator();
// csgEvaluator.attributes = ['position', 'normal'];
// csgEvaluator.attributes = ['position', 'uv'];
CSGEvaluator.attributes = ["position", "normal", "uv"];
CSGEvaluator.useGroups = false;

function csgSubtract(
  obj2Cut: THREE.Mesh | Brush,
  cutter: THREE.Mesh | Brush,
  isHollowSub: boolean,
  material?: THREE.Material
) {
  const brushObj2Cut = new Brush(
    obj2Cut.geometry,
    material || obj2Cut.material
  );
  brushObj2Cut.updateMatrixWorld();

  const brushCutter = new Brush(cutter.geometry, material || cutter.material);
  brushCutter.updateMatrixWorld();

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
 * @param originalNode Original Node before csg operation.
 * @param cutObj Cut Object after csg operation.
 * @param offsetPositivePercentage 0 ~ 1 value of the positive offset of the uv start idx based on the original node vertices count.
 * @param offsetNegativePercentage 0 ~ 1 value of the negative offset of the uv start idx based on the original node vertices count.
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
  const orgCountOffsetNegative =
    Math.floor(orgCount * offsetNegativePercentage) * -1;

  const offsetCount =
    orgCount + orgCountOffsetPositive + orgCountOffsetNegative;

  // 新增顶点 uv 坐标更新

  const uvCoordinateMod = new THREE.Vector2(0.1, 0.1);

  for (let i = offsetCount; i < finalCount; i++) {
    finalCutObjAttr.uv!.setX(i, uvCoordinateMod.x);
    finalCutObjAttr.uv!.setY(i, uvCoordinateMod.y);
  }
  finalCutObjAttr.uv!.needsUpdate = true;
}

function getAttributes(mesh: THREE.Mesh): THREE.NormalBufferAttributes {
  return mesh.geometry.attributes;
}

/**
 * Combines multiple meshes into a THREE.Group.
 *
 * @param name Optional name for the group.
 * @param meshes List of meshes to combine.
 * @returns THREE.Group containing all meshes.
 */
export function combineMeshesToGroup(
  name: string,
  ...meshes: THREE.Mesh[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  for (const mesh of meshes) {
    // Avoid accidental re-parenting if mesh already has a parent
    if (mesh.parent) mesh.parent.remove(mesh);
    group.add(mesh);
  }

  return group;
}
