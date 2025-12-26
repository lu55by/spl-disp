import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshPhongMaterial,
  type NormalBufferAttributes,
  Object3D,
  type Object3DEventMap,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import { Brush } from "three-bvh-csg";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  type MeshStandardNodeMaterialParameters,
} from "three/webgpu";
import {
  Colors,
  CutHeadBoundingBoxHeight,
  CutHeadDebugProps,
  CutHeadEyesNodeCombinedGroupName,
  ModelPaths,
  NodeNames,
  type PhongMesh,
  UVCoordinateMod,
} from "../constants";
import { exportObjectToOBJ } from "../exporters";
import { loadTexture } from "../loaders/TextureLoader";
import { getCutHead } from "../utils/csgCutHeadV3";

export function combineMeshes(meshes: Mesh[]) {
  const geometries = meshes.map((mesh) => {
    const g = mesh.geometry.clone();
    // console.log(`Geometry of [${g.name}] -> `, g)
    g.applyMatrix4(mesh.matrixWorld);
    return g;
  });
  const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
  const mesh0 = meshes[0] as Mesh;
  return new Mesh(mergedGeometry, mesh0.material);
}

export function flattenMesh(mesh2Simplify: Mesh) {
  mesh2Simplify.updateMatrixWorld(true);
  mesh2Simplify.geometry.applyMatrix4(mesh2Simplify.matrixWorld);
  // mesh2Simplify.geometry.deleteAttribute('normal'); // optional
  // mesh2Simplify.geometry.deleteAttribute('uv');     // not needed for printing
  mesh2Simplify.position.set(0, 0, 0);
  mesh2Simplify.rotation.set(0, 0, 0);
  mesh2Simplify.scale.set(1, 1, 1);
}

export function getAttributes(mesh: Mesh): NormalBufferAttributes {
  return mesh.geometry.attributes;
}

export async function applyTextures2LoadedHeadModelAsync(
  loadedHeadModel: Group<Object3DEventMap>,
  isModelFeMale: boolean
) {
  const headNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.Head
  ) as PhongMesh;
  const teethNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.Teeth
  ) as PhongMesh;
  const eyeLNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.EyeL
  ) as PhongMesh;
  const eyeRNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.EyeR
  ) as PhongMesh;

  const applyTexture = async (): Promise<void> => {
    /*
      Texture Paths
    */
    const headColTexPath = isModelFeMale
      ? ModelPaths.HeadFemale.Texture.HeadColTex
      : ModelPaths.HeadMale.Texture.HeadColorTex;
    const teethColTexPath = isModelFeMale
      ? ModelPaths.HeadFemale.Texture.TeethColTex
      : ModelPaths.HeadMale.Texture.TeethColTex;
    const eyeLColTexPath = isModelFeMale
      ? ModelPaths.HeadFemale.Texture.EyeLColTex
      : ModelPaths.HeadMale.Texture.EyeLColTex;
    const eyeRColTexPath = isModelFeMale
      ? ModelPaths.HeadFemale.Texture.EyeRColTex
      : ModelPaths.HeadMale.Texture.EyeRColTex;

    /*
      Head Color Texture
    */
    const headColTex = await loadTexture(headColTexPath);
    /*
      Teeth Color Texture
    */
    let teethColTex: Texture | null = null;
    try {
      teethColTex = await loadTexture(teethColTexPath);
    } catch (err: any) {
      console.error(err);
    }
    /*
      Eye Left Color Texture
    */
    const eyeLColTex = await loadTexture(eyeLColTexPath);
    /*
      Eye Right Color Texture
    */
    const eyeRColTex = await loadTexture(eyeRColTexPath);

    headNode.material.map = headColTex;
    if (teethColTex) teethNode.material.map = teethColTex;
    eyeLNode.material.map = eyeLColTex;
    eyeRNode.material.map = eyeRColTex;
  };
  await applyTexture();
}

export function applyGeometryScaling(mesh: Mesh | Brush, scale: number): void {
  mesh.geometry.scale(scale, scale, scale);
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

export function applyMaterialWireframe(obj: Object3D, color?: Color) {
  if (obj instanceof Group)
    obj.traverse((m) => {
      if (m instanceof Mesh) {
        const mat = m.material as MeshPhongMaterial;
        mat.color = color || Colors.White;
        mat.wireframe = true;
      }
    });
  if (obj instanceof Mesh) {
    const mat = obj.material as MeshPhongMaterial;
    mat.color = color || Colors.White;
    mat.wireframe = true;
  }
}

export function applyDebugTransformation(
  obj: Object3D,
  posOffset: Vector3 = new Vector3()
): void {
  const { x, y, z } = posOffset;
  obj?.position.set(
    CutHeadDebugProps.Pos.x + x,
    CutHeadDebugProps.Pos.y + y,
    CutHeadDebugProps.Pos.z + z
  );
  obj?.scale.setScalar(CutHeadDebugProps.Scalar);
}

export function applyPBRMaterialAndSRGBColorSpace(
  obj: Object3D,
  isStandard: boolean,
  params?: MeshStandardNodeMaterialParameters
): void {
  obj.traverse((m) => {
    if (m instanceof Mesh && m.material instanceof MeshPhongMaterial) {
      const orgMat = m.material;
      m.material = isStandard
        ? new MeshStandardNodeMaterial({
            ...params,
            map: orgMat.map,
            name: orgMat.name,
          })
        : new MeshPhysicalNodeMaterial({
            ...params,
            map: orgMat.map,
            name: orgMat.name,
          });
      if (m.material.map) m.material.map.colorSpace = SRGBColorSpace;
      orgMat.dispose();
    }
  });
}

export function applyDoubleSide(obj: Object3D) {
  // console.log("\n -- applyDoubleSide -- obj ->", obj);
  if (!(obj instanceof Group)) return;
  obj.traverse((m: Object3D) => {
    if (m instanceof Mesh) {
      const mesh = m as any;
      mesh.material.side = DoubleSide;
    }
  });
}

/**
 * Modify the uv coordinates of the new vertices.
 * @param originalNode Original Node before csg operation.
 * @param cutObj Cut Object after csg operation.
 * @param offsetPositivePercentage 0 ~ 1 value of the positive offset of the uv start idx based on the original node vertices count.
 * @param offsetNegativePercentage 0 ~ 1 value of the negative offset of the uv start idx based on the original node vertices count.
 */
export function modifyNewVerticesUv(
  originalNode: Brush | Mesh,
  cutObj: Brush | Mesh,
  offsetPositivePercentage: number,
  offsetNegativePercentage: number
): void {
  const originalNodeAttr = getAttributes(originalNode);
  const finalCutObjAttr = getAttributes(cutObj);

  // Get the vertices count

  const orgCount = originalNodeAttr.uv!.count;
  const finalCount = finalCutObjAttr.uv!.count;
  const newVerticesCount = finalCount - orgCount;
  // console.log('newVerticesCount ->', newVerticesCount)

  const orgCountOffsetPositive = Math.floor(
    newVerticesCount * offsetPositivePercentage
  );
  const orgCountOffsetNegative =
    Math.floor(orgCount * offsetNegativePercentage) * -1;
  // console.log('orgCountOffsetPositive -> ', orgCountOffsetPositive);
  // console.log('orgCountOffsetNegative -> ', orgCountOffsetNegative);

  const offsetCount =
    orgCount + orgCountOffsetPositive + orgCountOffsetNegative;
  // console.log('offsetCount -> ', offsetCount);

  // Update uv coordinates of the new vertices

  for (let i = offsetCount; i < finalCount; i++) {
    finalCutObjAttr.uv!.setX(i, UVCoordinateMod.x);
    finalCutObjAttr.uv!.setY(i, UVCoordinateMod.y);
  }
  finalCutObjAttr.uv!.needsUpdate = true;
}

/**
 * Combines multiple meshes into a THREE.Group.
 *
 * @param name Optional name for the group.
 * @param meshes List of meshes to combine.
 * @returns THREE.Group containing all meshes.
 */
export function combineMeshesToGroup(name: string, ...meshes: Mesh[]): Group {
  const group = new Group();
  group.name = name;

  for (const mesh of meshes) {
    // Avoid accidental re-parenting if mesh already has a parent
    if (mesh.parent) mesh.parent.remove(mesh);
    group.add(mesh);
  }

  return group;
}

/**
 * Scales all meshes inside a group to a final real-world height of 37mm.
 * The scaling is applied directly to geometry vertices (not mesh.scale).
 *
 * @param group Group containing meshes
 * @param targetHeight number (millimeters)
 */
export function scaleGroupToHeight(
  group: Group,
  targetHeight: number = 37
): Group {
  // -------------------------------
  // 1. Compute the current height
  // -------------------------------
  const groupCloned = group.clone();
  const grp2Scale = groupCloned;
  const groupBox = new Box3().setFromObject(grp2Scale);
  const currentHeight = groupBox.max.y - groupBox.min.y;
  console.log("Grp height -> ", currentHeight);

  if (currentHeight === 0) {
    console.warn("Group has zero height; cannot scale.");
    return group;
  }

  // Compute scale factor
  const scale = targetHeight / currentHeight;

  // -------------------------------
  // 2. Apply scaling to each mesh geometry
  // -------------------------------
  grp2Scale.traverse((m) => {
    if (m instanceof Mesh && m.geometry instanceof BufferGeometry) {
      const geom = m.geometry;
      const pos = geom.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
          i,
          pos.getX(i) * scale,
          pos.getY(i) * scale,
          pos.getZ(i) * scale
        );
      }

      pos.needsUpdate = true;

      // Recompute bounds
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
    }
  });

  // -------------------------------
  // 3. Reset transforms to identity (VERY IMPORTANT)
  // -------------------------------
  grp2Scale.scale.set(1, 1, 1);
  grp2Scale.position.set(0, 0, 0);
  grp2Scale.rotation.set(0, 0, 0);

  console.log(`Group scaled by factor: ${scale}`);

  return grp2Scale;
}

export const exportCutHead = (
  exporterBtn: Element,
  cutHead2Export: Object3D
): void => {
  exporterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    // if (cutHead.isBrush) {
    if (cutHead2Export instanceof Group) {
      const scaledCutHeadGrp = scaleGroupToHeight(cutHead2Export);
      exportObjectToOBJ(scaledCutHeadGrp);
    }
  });
};

export function disposeHairBodyGroup(
  splicingGroupGlobal: Group<Object3DEventMap>,
  hairOrBodyGroup: Group<Object3DEventMap>
) {
  console.log("\nhairOrBodyGroup to be disposed ->", hairOrBodyGroup);
  hairOrBodyGroup.children.forEach((m) => {
    if (
      m instanceof Mesh &&
      m.geometry instanceof BufferGeometry &&
      m.material instanceof MeshPhongMaterial
    ) {
      m.geometry.dispose();
      m.material.dispose();
      m.geometry = undefined;
      m.material = undefined;
      hairOrBodyGroup.remove(m);
    }
  });
  splicingGroupGlobal.remove(hairOrBodyGroup);
}

export function disposeHairBodyFromSplicingGroupGlobal(
  splicingGroupGlobal: Group<Object3DEventMap>,
  filteredSubGroups: Group<Object3DEventMap>[]
) {
  /*
    ! The Hair or Body Group or both are definitely the children of the splicingGroupGlobal as we checked in `clearModels` fn from `ButtonContainer.vue` if this fn is called.
   */
  filteredSubGroups.forEach((hairOrBodyGroup) => {
    disposeHairBodyGroup(splicingGroupGlobal, hairOrBodyGroup);
  });
}

export function getObject3DHeight(obj3D: Object3D): number {
  const box = new Box3().setFromObject(obj3D);
  const height = box.max.y - box.min.y;
  return height;
}

export function getObject3DBoundingBoxCenter(obj3D: Object3D): Vector3 {
  return new Box3().setFromObject(obj3D).getCenter(new Vector3());
}

export function getFilteredSubGroups(
  splicingGroupGlobal: Group<Object3DEventMap>
): Group<Object3DEventMap>[] {
  // Filter out the cut head group
  return splicingGroupGlobal.children.filter(
    (c) => c.name !== CutHeadEyesNodeCombinedGroupName
  ) as Group<Object3DEventMap>[];
}

export function removeAndAddModelWithModelHeight(
  splicingGroupGlobal: Group<Object3DEventMap>,
  importedGroup: Group<Object3DEventMap>,
  isHairImported: boolean
) {
  // Check if there is a hair or body group in the splicingGroupGlobal
  const filteredSubGroups = getFilteredSubGroups(splicingGroupGlobal);
  // console.log(
  //   "\n -- removeAndAddModel -- filteredSubGroups length ->",
  //   filteredSubGroups.length
  // );
  // return;

  if (filteredSubGroups.length === 0) {
    // No hair or body group found, add it to the group.
    splicingGroupGlobal.add(importedGroup);
    return;
  }

  // Has hair or body group found, remove it and add the new one, or add it straightly if it is not conflicting.
  if (filteredSubGroups.length === 1) {
    // Check if the existed one is hair or body
    const existedHairOrBodyGroup = filteredSubGroups[0];
    // Get the height of the group to check if it is hair or body
    const existedHairOrBodyGroupHeight = getObject3DHeight(
      existedHairOrBodyGroup
    );
    const isHairGroupExisted =
      existedHairOrBodyGroupHeight < CutHeadBoundingBoxHeight;
    if (isHairImported === isHairGroupExisted) {
      // Conflicting, remove the existed hair or body group and add the new one
      disposeHairBodyGroup(splicingGroupGlobal, existedHairOrBodyGroup);
      splicingGroupGlobal.add(importedGroup);
      return;
    }
    // Not conflicting, add the new one straightly
    splicingGroupGlobal.add(importedGroup);
    return;
  }

  // return;
  console.log("\nPrepare to remove the hair or body group...");

  // Handle the condition of hair and body groups existing at the same time
  // Get the hair and body groups
  let hairGroup = filteredSubGroups[0];
  let bodyGroup = filteredSubGroups[1];
  if (getObject3DHeight(hairGroup) > CutHeadBoundingBoxHeight) {
    hairGroup = filteredSubGroups[1];
    bodyGroup = filteredSubGroups[0];
  }

  console.log(
    "\nHair Group Height after checking ->",
    getObject3DHeight(hairGroup)
  );
  console.log(
    "\nBody Group Height after checking ->",
    getObject3DHeight(bodyGroup)
  );

  // Create a variable to store the group to remove
  let group2Dispose: Group<Object3DEventMap> | null = null;
  // Check if the new group is hair or body
  if (isHairImported) group2Dispose = hairGroup;
  else group2Dispose = bodyGroup;

  console.log("\nGroup to dispose ->", getObject3DHeight(group2Dispose));

  // Dispose the group
  disposeHairBodyGroup(splicingGroupGlobal, group2Dispose);
  // Add the new group
  splicingGroupGlobal.add(importedGroup);
}

export function removeAndAddModelWithNodeNames(
  splicingGroupGlobal: Group<Object3DEventMap>,
  importedGroup: Group<Object3DEventMap>,
  isHairImported: boolean
) {
  // Check if there is a hair or body group in the splicingGroupGlobal
  const filteredSubGroups = getFilteredSubGroups(splicingGroupGlobal);
  console.log(
    "\n -- removeAndAddModelV2 -- filteredSubGroups length ->",
    filteredSubGroups.length
  );
  // return;

  if (filteredSubGroups.length === 0) {
    // No hair or body group found, add it to the group.
    splicingGroupGlobal.add(importedGroup);
    return;
  }

  // Has hair or body group found, remove it and add the new one, or add it straightly if they are not conflicting.
  if (filteredSubGroups.length === 1) {
    // Check if the existed one is hair or body
    const existedHairOrBodyGroup = filteredSubGroups[0];
    const isHairGroupExisted = existedHairOrBodyGroup.children[0].name
      .toLowerCase()
      .includes(NodeNames.HairNames.Hair.toLocaleLowerCase());
    if (isHairImported === isHairGroupExisted) {
      // Conflicting, remove the existed hair or body group and add the new one
      disposeHairBodyGroup(splicingGroupGlobal, existedHairOrBodyGroup);
      splicingGroupGlobal.add(importedGroup);
      return;
    }
    // Not conflicting, add the new one straightly
    splicingGroupGlobal.add(importedGroup);
    return;
  }

  // return;
  console.log("\nPrepare to remove the hair or body group...");

  // Handle the condition of hair and body groups existing at the same time
  // Get the hair and body groups
  let hairGroup = filteredSubGroups[0];
  let bodyGroup = filteredSubGroups[1];
  // Reverse the assignments if the first group is body
  if (
    hairGroup.children[0].name
      .toLocaleLowerCase()
      .includes(NodeNames.BodyNames.Body.toLocaleLowerCase())
  ) {
    hairGroup = filteredSubGroups[1];
    bodyGroup = filteredSubGroups[0];
  }

  console.log("\nHair Group Name after reverse checking ->", hairGroup.name);
  console.log("\nBody Group Name after reverse checking ->", bodyGroup.name);

  // Create a variable to store the group to remove
  let group2Dispose: Group<Object3DEventMap> | null = null;
  // Check if the new group is hair or body
  if (isHairImported) group2Dispose = hairGroup;
  else group2Dispose = bodyGroup;

  console.log("\nGroup to dispose ->", group2Dispose.name);

  // Dispose the group
  disposeHairBodyGroup(splicingGroupGlobal, group2Dispose);
  // Add the new group
  splicingGroupGlobal.add(importedGroup);
}

export function disposeGroupObject(obj2Dispose: Group<Object3DEventMap>) {
  obj2Dispose.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry?.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((mat) => {
          // Dispose textures in material properties
          for (const key in mat) {
            const value = (mat as any)[key];
            if (value && value instanceof Texture) {
              value.dispose();
            }
          }
          mat.dispose();
        });
      }
    }
  });
}

/**
 * Disposes the current cut head in the splicing group global.
 * @param splicingGroupGlobal The splicing group global.
 */
function disposeAndRemoveCurrentCutHead(
  splicingGroupGlobal: Group<Object3DEventMap>
) {
  let currentCutHead: Group<Object3DEventMap> | null = null;
  // Find the current cut head
  currentCutHead = splicingGroupGlobal.children.find((child) => {
    return (
      child.name.toLocaleLowerCase() ===
      CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase()
    );
  }) as Group<Object3DEventMap>;
  console.log(
    "\n -- disposeCurrentCutHead -- currentCutHead to be disposed ->",
    currentCutHead
  );

  // Check if the current cut head is found
  if (!currentCutHead) {
    console.warn("\n -- disposeCurrentCutHead -- No cut head found to dispose");
    return;
  }
  // Execute the dispose operation
  disposeGroupObject(currentCutHead);

  // Finally remove from the splicingGroupGlobal
  splicingGroupGlobal.remove(currentCutHead);
}

/**
 * Replaces the default head with the imported cutter.
 * @param splicingGroupGlobal The splicing group global.
 * @param defaultOriginalHead The default original head.
 * @param importedCutter The imported cutter.
 */
export async function replaceCurrentHeadWithCutHead(
  splicingGroupGlobal: Group<Object3DEventMap>,
  defaultOriginalHead: Group<Object3DEventMap>,
  importedCutter: Group<Object3DEventMap>
) {
  // Remove the current default original head in the splicing group global
  disposeAndRemoveCurrentCutHead(splicingGroupGlobal);
  // Execute the getCutHead operation
  const newCutHead = await getCutHead(
    defaultOriginalHead,
    importedCutter,
    false
  );
  console.log(
    "\n -- replaceDefaultHeadWithCutHead -- newCutHead ->",
    newCutHead
  );
  disposeGroupObject(importedCutter);
  // Add the new cut head to the splicing group global
  splicingGroupGlobal.add(newCutHead);
}
