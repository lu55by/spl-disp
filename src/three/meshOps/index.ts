import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type NormalBufferAttributes,
  Object3D,
  type Object3DEventMap,
  SRGBColorSpace,
  Vector3,
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Brush } from "three-bvh-csg";
import {
  Colors,
  CutHeadDebugProps,
  ModelPaths,
  NodeNames,
  UVCoordinateMod,
  type PhongMesh,
} from "../constants";
import { exportObjectToOBJ } from "../exporters";
import { loadTexture } from "../loaders/TextureLoader";

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
  const eyeLNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.EyeL
  ) as PhongMesh;
  const eyeRNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.EyeR
  ) as PhongMesh;

  const applyTexture = async (): Promise<void> => {
    const headColTexPath = isModelFeMale
      ? ModelPaths.HeadFemale.Texture.HeadColTex
      : ModelPaths.HeadMale.Texture.HeadColorTex;
    const eyeLColTexPath = isModelFeMale
      ? ModelPaths.HeadFemale.Texture.EyeLColTex
      : ModelPaths.HeadMale.Texture.EyeLColTex;
    const eyeRColTexPath = isModelFeMale
      ? ModelPaths.HeadFemale.Texture.EyeRColTex
      : ModelPaths.HeadMale.Texture.EyeRColTex;
    const headColTex = await loadTexture(headColTexPath);
    const eyeLColTex = await loadTexture(eyeLColTexPath);
    const eyeRColTex = await loadTexture(eyeRColTexPath);

    headNode.material.map = headColTex;
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
  isStandard: boolean
): void {
  obj.traverse((m) => {
    if (m instanceof Mesh && m.material instanceof MeshPhongMaterial) {
      const orgMat = m.material;
      m.material = isStandard
        ? new MeshStandardMaterial({
            map: orgMat.map,
          })
        : new MeshPhysicalMaterial({
            map: orgMat.map,
          });
      m.material.map.colorSpace = SRGBColorSpace;
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
  // console.log('originalNode Geometry attributes before cut ->', originalNodeAttr)
  const finalCutObjAttr = getAttributes(cutObj);
  // console.log('cylinder cut cutHead geometry attributes -> ', cylCutHeadAttr)

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
    // const u = cylCutHeadAttr.uv!.getX(i)
    // const v = cylCutHeadAttr.uv!.getY(i)
    // if (i < 3) console.log(`uv of idx (${i}) -> [${u}, ${v}]`)
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
  grp2Scale.traverse((obj) => {
    if (obj instanceof Mesh && obj.geometry instanceof BufferGeometry) {
      const geom = obj.geometry;
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

export function disposeGeoMat(obj3D: Object3D) {
  if (!(obj3D instanceof Group)) return;
  console.log("obj3D 2 dispose ->", obj3D);

  obj3D.traverse((m) => {
    if (m instanceof Mesh) {
      // console.log("Ready to dispose the geometry and material of mesh ->", m);

      // 1. Dispose GPU resources
      m.geometry.dispose();

      // 2. Dispose material resources (and potentially textures)
      if (Array.isArray(m.material)) {
        m.material.forEach((material: Material) => material.dispose());
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
    console.log("Ready to remove the entire group from the scene...");
    obj3D.parent.remove(obj3D);
  }

  obj3D.clear();

  // 4. Set original variable reference to null,
  // e.g., myModelGroup = null; to allow the JS garbage collector to clean up the mesh objects themselves.
}
