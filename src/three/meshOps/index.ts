import * as THREE from "three/webgpu";
import { Brush } from "three-bvh-csg";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

import initManifold, { type Mesh as IManifoldMesh } from "manifold-3d";
import manifoldWasm from "manifold-3d/manifold.wasm?url";

/**
 * Generates facial morphs for a given mesh.
 * @param mesh The mesh to generate facial morphs for.
 */
export function generateFacialMorphs(
  mesh: THREE.Mesh,
  brushParams: { noseRadius: number }
) {
  const geoOrg = mesh.geometry;
  // Clone geometry to ensure we don't affect other meshes sharing the same geometry
  mesh.geometry = mesh.geometry.clone();
  // Dispose the original geometry before cloning
  geoOrg.dispose();
  const geo = mesh.geometry;
  const positions = geo.getAttribute("position");
  const vertex = new THREE.Vector3();

  // 1. AUTO-DETECT NOSE TIP
  // Look for the vertex with the max Z value within a narrow vertical strip in the center
  let noseTip = new THREE.Vector3(0, 0, -Infinity);
  let boundingBox = geo.boundingBox;
  if (!boundingBox) {
    geo.computeBoundingBox();
    boundingBox = geo.boundingBox;
  }
  console.log(
    `\n -- generateFacialMorphs -- geometry of [${mesh.name}] boundingBox ->`,
    boundingBox
  );

  /*
    Variables for excluding the vertices that the y coordinate is outside the
    offset boundingBox on the Y axis
   */
  const maxVertYPerc = 0.3;
  const minVertYPerc = 0.25;
  const dYBoundingBox = boundingBox.max.y - boundingBox.min.y;
  const maxVertYNose = boundingBox.max.y - maxVertYPerc * dYBoundingBox;
  const minVertYNose = boundingBox.min.y + minVertYPerc * dYBoundingBox;

  // Traverse through the vertex count to get the nose tip
  for (let i = 0; i < positions.count; i++) {
    // Update the vertex based on the current index
    vertex.fromBufferAttribute(positions, i);
    // Exclude the vertices that the y coordinate is outside the offset boundingBox on the Y axis
    if (vertex.y > maxVertYNose || vertex.y < minVertYNose) continue;
    // Find the vertex with maximal Z
    if (vertex.z > noseTip.z) noseTip.copy(vertex);
  }

  console.log("\n -- generateFacialMorphs -- noseTip calculated ->", noseTip);

  // 2. CREATE BUFFERS FOR MORPHS
  // Define the distinct arrays for each "shape" we want
  const noseTarget = new Float32Array(positions.array);
  const jawTarget = new Float32Array(positions.array);

  // Parameters for the procedural brushes
  const { noseRadius } = brushParams;

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);

    // --- A. GENERATE NOSE MORPH (Move Forward) ---
    const distToNoseTip = vertex.distanceTo(noseTip);
    if (distToNoseTip < noseRadius) {
      // Gaussian Falloff: smooth curve 0 -> 1 -> 0
      const influence = Math.pow(1 - distToNoseTip / noseRadius, 4);
      // Add '1.0' unit of height to the target. The slider will control how much of this is applied.
      const i3Y = i * 3 + 1;
      const i3Z = i * 3 + 2;
      // const factorInf = vertex.y > noseTip.y + 1 ? 1.5 : 0.2;
      const factorInf = 0.2;
      const finalInf = factorInf * influence;
      noseTarget[i3Y] += finalInf;
      noseTarget[i3Z] += finalInf;
    }

    // --- B. GENERATE JAW MORPH (Widen) ---
    // Target the lower jaw area specifically
    const jawYCenter = noseTip.y - 12.0; // Rough distance from nose tip to jaw
    const jawYRange = 10.0;
    const dyJaw = Math.abs(vertex.y - jawYCenter);

    // Only affect vertices within the jaw's vertical range and in the front half of the head
    if (
      dyJaw < jawYRange &&
      vertex.z > noseTip.z - 7.5 &&
      vertex.y > noseTip.y - 24
    ) {
      // Gaussian Falloff for Y (vertical)
      const influenceY = Math.exp(-Math.pow(dyJaw / (jawYRange * 0.6), 2));

      // Gaussian Falloff for Z (depth) - focus on the front of the jaw
      const dzJaw = Math.abs(vertex.z - (noseTip.z - 5.0));
      const influenceZ = Math.exp(-Math.pow(dzJaw / 10.0, 2));

      // Combine influences and scale down to a reasonable max (e.g., 3.0 units)
      const totalInfluence = influenceY * influenceZ * 3.0;

      // Widen X: Use a factor that smoothly increases from the center to avoid tearing
      const centerXFalloff = Math.min(Math.abs(vertex.x) / 2.0, 1.0);
      jawTarget[i * 3] += Math.sign(vertex.x) * totalInfluence * centerXFalloff;
    }
  }

  // 3. ATTACH THE MORPH TARGETS TO THE `morphAttributes.position` OF THE GEOMETRY
  const noseAttr = new THREE.BufferAttribute(noseTarget, 3);
  const jawAttr = new THREE.BufferAttribute(jawTarget, 3);
  noseAttr.name = "nose-morph-target-attr";
  jawAttr.name = "jaw-morph-target-attr";
  // console.log("\n -- generateFacialMorphs -- noseAttr ->", noseAttr);
  // console.log("\n -- generateFacialMorphs -- jawAttr ->", jawAttr);

  geo.morphAttributes.position = [noseAttr, jawAttr];

  // Required for lighting to update correctly when morphed
  geo.computeVertexNormals();

  // Update Morph Targets on the mesh
  mesh.updateMorphTargets();

  // Explicitly set the dictionary for UI labeling
  mesh.morphTargetDictionary = {
    nose: 0,
    jaw: 1,
  };

  // Initialize at 0 of the morph targets on the mesh
  mesh.morphTargetInfluences = [0, 0];
}

/**
 * Bakes the current morph target influences into the geometry's position attribute.
 * This effectively makes the current morph state the "base" shape of the mesh.
 * @param mesh The mesh to bake morphs for.
 */
export function bakeMorphTargets(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry;
  const influences = mesh.morphTargetInfluences;

  if (!influences || influences.length === 0) return;

  const positionAttr = geometry.getAttribute("position");
  const morphAttr = geometry.morphAttributes.position;

  if (!morphAttr || morphAttr.length === 0) return;

  const vertexCount = positionAttr.count;
  const isRelative = (geometry as any).morphTargetsRelative;

  // I. VERTEX PROCESSING LOOP: Calculate final positions based on active morph targets
  for (let i = 0; i < vertexCount; i++) {
    // 1. Get current base coordinate for the vertex
    let x = positionAttr.getX(i);
    let y = positionAttr.getY(i);
    let z = positionAttr.getZ(i);

    // 2. Clear displacement accumulators for the current vertex
    let dx = 0,
      dy = 0,
      dz = 0;

    // 3. MORPH ACCUMULATION: Loop through each available morph target
    for (let j = 0; j < morphAttr.length; j++) {
      const influence = influences[j];

      // Skip influence calculation if the target has no effect (influence is 0)
      if (influence === 0) continue;

      const target = morphAttr[j];

      if (isRelative) {
        // RELATIVE MODE: Target positions represent offsets (deltas) from the base position
        dx += target.getX(i) * influence;
        dy += target.getY(i) * influence;
        dz += target.getZ(i) * influence;
      } else {
        // ABSOLUTE MODE: Target positions represent final world-space coordinates
        // Calculate displacement as: (Final Position - Base Position) * Influence
        dx += (target.getX(i) - x) * influence;
        dy += (target.getY(i) - y) * influence;
        dz += (target.getZ(i) - z) * influence;
      }
    }

    // 4. APPLY DISPLACEMENT: Update the vertex position attribute with the final calculated coordinates
    positionAttr.setXYZ(i, x + dx, y + dy, z + dz);
  }

  // II. ATTRIBUTE UPDATE: Mark the position attribute as needing an update on the GPU
  positionAttr.needsUpdate = true;

  // III. NORMALS RECOMPUTATION: Re-generate normals to ensure lighting matches the new shape
  geometry.computeVertexNormals();

  // IV. CLEANUP: Clear morph data since they are now permanently baked into the base geometry
  geometry.morphAttributes = {};
  mesh.morphTargetDictionary = {};
  mesh.morphTargetInfluences = [];
}

let cachedManifoldModule: any = null;

/**
 * Optimized and more robust version of repairMesh.
 * 1. Caches the Manifold WASM module to avoid re-loading.
 * 2. Enforces strict typed arrays for Wasm compatibility.
 * 3. Handles memory cleanup more reliably.
 */
export async function repairMeshV2(mesh: THREE.Mesh): Promise<THREE.Mesh> {
  // 1. Initialize or get cached Manifold WASM module
  if (!cachedManifoldModule) {
    cachedManifoldModule = await initManifold({
      locateFile: () => manifoldWasm,
    });
    if (cachedManifoldModule.setup) cachedManifoldModule.setup();
  }

  const { Manifold, Mesh: ManifoldMeshRaw } = cachedManifoldModule;

  // 2. Prepare Geometry
  let geo = mesh.geometry.clone();
  // Merge vertices to handle floating point precision issues that cause non-manifold edges
  geo = BufferGeometryUtils.mergeVertices(geo, 1e-4);

  const posAttr = geo.getAttribute("position");
  const indexAttr = geo.index;

  if (!posAttr || !indexAttr) {
    throw new Error("Geometry must have position and index attributes");
  }

  // Ensure strict Float32Array for positions
  const vertices =
    posAttr.array instanceof Float32Array
      ? posAttr.array
      : new Float32Array(posAttr.array);

  // CRITICAL: Manifold WASM requires Uint32Array for triangle indices
  const indices =
    indexAttr.array instanceof Uint32Array
      ? indexAttr.array
      : new Uint32Array(indexAttr.array);

  console.log("\n -- repairMeshV2 -- input ->", {
    verts: vertices.length / 3,
    tris: indices.length / 3,
  });

  // 3. Create Manifold objects
  // Use the Mesh constructor from the module to ensure proper internal prototype linkage
  const inputMesh = new ManifoldMeshRaw({
    numProp: 3,
    vertProperties: vertices,
    triVerts: indices,
  });

  const manifold = new Manifold(inputMesh);

  // Check if construction was successful
  if (manifold.isEmpty()) {
    console.warn("\n -- repairMeshV2 -- Warning -> Created manifold is empty");
  }

  // 4. Extract Repaired Geometry
  // Use getMesh() (standard) or getMeshGL() (fallback for specific builds)
  const resultMesh = manifold.getMesh
    ? manifold.getMesh()
    : (manifold as any).getMeshGL();

  console.log("\n -- repairMeshV2 -- output ->", {
    verts: resultMesh.vertProperties.length / 3,
    tris: resultMesh.triVerts.length / 3,
  });

  // 5. Convert back to Three.js
  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(resultMesh.vertProperties, 3)
  );
  newGeo.setIndex(new THREE.BufferAttribute(resultMesh.triVerts, 1));
  newGeo.computeVertexNormals();

  // 6. Cleanup WASM memory (Crucial to avoid leaks)
  manifold.delete();
  inputMesh.delete();

  // Return a new mesh with the same material
  const outMesh = new THREE.Mesh(newGeo, mesh.material);
  outMesh.name = `${mesh.name}_repaired`;

  return outMesh;
}

export async function repairMesh(mesh: THREE.Mesh): Promise<THREE.Mesh> {
  // 1. Initialize the Manifold WASM module
  // Provide the WASM file location to avoid 404/HTML fallback issues in Vite
  const manifoldModule = await initManifold({
    locateFile: () => manifoldWasm,
  });
  const { Manifold, setup } = manifoldModule as any;
  if (setup) setup();

  // 2. Pre-process -> Merge vertices to close tiny gaps
  let geo = mesh.geometry.clone();
  geo = BufferGeometryUtils.mergeVertices(geo, 0.001);

  // 3. Convert THREE.js geometry to Manifold format
  // Extract the flat arrays for position and index
  const vertices = geo.getAttribute("position").array as Float32Array;
  const indices = geo.index?.array as Uint32Array;
  // console.log(
  //   "\n -- repairMesh -- vertices from original geometry ->",
  //   vertices
  // );
  // console.log("\n -- repairMesh -- indices from original geometry ->", indices);
  // return;

  if (!indices) throw new Error("Geometry must be indexed");

  // Create a proper Manifold Mesh instance
  // Use the Mesh constructor from the initialized module
  const { Mesh } = manifoldModule as any;
  const manifoldMesh = new Mesh({
    numProp: 3,
    vertProperties: vertices,
    triVerts: indices,
  });

  // 4. Run the repair
  const manifold = new Manifold(manifoldMesh);

  // Use `getMesh` or fallback to `getMeshGL` to get the cleaned geometry back
  const repairedMesh = manifold.getMesh
    ? manifold.getMesh()
    : (manifold as any).getMeshGL();

  console.log("\n -- repairMesh -- repairedMesh ->", repairedMesh);

  // 5. Convert back to Three.js BufferGeometry
  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(repairedMesh.vertProperties, 3)
  );
  newGeo.setIndex(new THREE.BufferAttribute(repairedMesh.triVerts, 1));
  newGeo.computeVertexNormals();

  // Clean up WASM memory
  manifold.delete();
  if ((manifoldMesh as any).delete) (manifoldMesh as any).delete();

  return new THREE.Mesh(newGeo, mesh.material);
}

export function combineMeshes(meshes: THREE.Mesh[]) {
  const geometries = meshes.map((mesh) => {
    const g = mesh.geometry.clone();
    // console.log(`Geometry of [${g.name}] -> `, g)
    g.applyMatrix4(mesh.matrixWorld);
    return g;
  });
  const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
  const mesh0 = meshes[0] as THREE.Mesh;
  return new THREE.Mesh(mergedGeometry, mesh0.material);
}

export function flattenMesh(mesh2Simplify: THREE.Mesh) {
  mesh2Simplify.updateMatrixWorld(true);
  mesh2Simplify.geometry.applyMatrix4(mesh2Simplify.matrixWorld);
  // mesh2Simplify.geometry.deleteAttribute('normal'); // optional
  // mesh2Simplify.geometry.deleteAttribute('uv');     // not needed for printing
  mesh2Simplify.position.set(0, 0, 0);
  mesh2Simplify.rotation.set(0, 0, 0);
  mesh2Simplify.scale.set(1, 1, 1);
}

export function getAttributes(mesh: THREE.Mesh): THREE.NormalBufferAttributes {
  return mesh.geometry.attributes;
}

export async function applyTextures2LoadedHeadModelAsync(
  loadedHeadModel: THREE.Group<THREE.Object3DEventMap>,
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
    let teethColTex: THREE.Texture | null = null;
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

export function applyGeometryScaling(
  mesh: THREE.Mesh | Brush,
  scale: number
): void {
  mesh.geometry.scale(scale, scale, scale);
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

export function applyMaterialWireframe(
  obj: THREE.Object3D,
  color?: THREE.Color
) {
  if (obj instanceof THREE.Group)
    obj.traverse((m) => {
      if (m instanceof THREE.Mesh) {
        const mat = m.material as THREE.MeshPhongMaterial;
        mat.color = color || Colors.White;
        mat.wireframe = true;
      }
    });
  if (obj instanceof THREE.Mesh) {
    const mat = obj.material as THREE.MeshPhongMaterial;
    mat.color = color || Colors.White;
    mat.wireframe = true;
  }
}

export function applyDebugTransformation(
  obj: THREE.Object3D,
  posOffset: THREE.Vector3 = new THREE.Vector3()
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
  obj: THREE.Object3D,
  isStandard: boolean,
  params?: THREE.MeshStandardNodeMaterialParameters
): void {
  obj.traverse((m) => {
    if (
      m instanceof THREE.Mesh &&
      m.material instanceof THREE.MeshPhongMaterial
    ) {
      const orgMat = m.material;
      m.material = isStandard
        ? new THREE.MeshStandardNodeMaterial({
            ...params,
            map: orgMat.map,
            name: orgMat.name,
          })
        : new THREE.MeshPhysicalNodeMaterial({
            ...params,
            map: orgMat.map,
            name: orgMat.name,
          });
      if (m.material.map) m.material.map.colorSpace = THREE.SRGBColorSpace;
      orgMat.dispose();
    }
  });
}

export function applyDoubleSide(obj: THREE.Object3D) {
  // console.log("\n -- applyDoubleSide -- obj ->", obj);
  if (!(obj instanceof THREE.Group)) return;
  obj.traverse((m: THREE.Object3D) => {
    if (m instanceof THREE.Mesh) {
      const mesh = m as any;
      mesh.material.side = THREE.DoubleSide;
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
  originalNode: Brush | THREE.Mesh,
  cutObj: Brush | THREE.Mesh,
  offsetPositivePercentage: number,
  offsetNegativePercentage: number
): void {
  const originalNodeAttr = getAttributes(originalNode as THREE.Mesh);
  const finalCutObjAttr = getAttributes(cutObj as THREE.Mesh);

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

/**
 * Scales all meshes inside a group to a final real-world height of 37mm.
 * The scaling is applied directly to geometry vertices (not mesh.scale).
 *
 * @param group Group containing meshes
 * @param targetHeight number (millimeters)
 */
export function scaleGroupToHeight(
  group: THREE.Group,
  targetHeight: number = 37
): THREE.Group {
  // -------------------------------
  // 1. Compute the current height
  // -------------------------------
  const groupCloned = group.clone();
  const grp2Scale = groupCloned;
  const groupBox = new THREE.Box3().setFromObject(grp2Scale);
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
    if (m instanceof THREE.Mesh && m.geometry instanceof THREE.BufferGeometry) {
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
  cutHead2Export: THREE.Object3D
): void => {
  exporterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    // if (cutHead.isBrush) {
    if (cutHead2Export instanceof THREE.Group) {
      const scaledCutHeadGrp = scaleGroupToHeight(cutHead2Export);
      exportObjectToOBJ(scaledCutHeadGrp);
    }
  });
};

export function disposeHairBodyGroup(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  hairOrBodyGroup: THREE.Group<THREE.Object3DEventMap>
) {
  console.log("\nhairOrBodyGroup to be disposed ->", hairOrBodyGroup);
  hairOrBodyGroup.children.forEach((m) => {
    if (
      m instanceof THREE.Mesh &&
      m.geometry instanceof THREE.BufferGeometry &&
      m.material instanceof THREE.MeshPhongMaterial
    ) {
      m.geometry.dispose();
      m.material.dispose();
      (m as any).geometry = undefined;
      (m as any).material = undefined;
      hairOrBodyGroup.remove(m);
    }
  });
  splicingGroupGlobal.remove(hairOrBodyGroup);
}

export function disposeHairBodyFromSplicingGroupGlobal(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  filteredSubGroups: THREE.Group<THREE.Object3DEventMap>[]
) {
  /*
    ! The Hair or Body Group or both are definitely the children of the splicingGroupGlobal as we checked in `clearModels` fn from `ButtonContainer.vue` if this fn is called.
   */
  filteredSubGroups.forEach((hairOrBodyGroup) => {
    disposeHairBodyGroup(splicingGroupGlobal, hairOrBodyGroup);
  });
}

export function getObject3DHeight(obj3D: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj3D);
  const height = box.max.y - box.min.y;
  return height;
}

export function getObject3DBoundingBoxCenter(
  obj3D: THREE.Object3D
): THREE.Vector3 {
  return new THREE.Box3().setFromObject(obj3D).getCenter(new THREE.Vector3());
}

export function getFilteredSubGroups(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>
): THREE.Group<THREE.Object3DEventMap>[] {
  // Filter out the cut head group
  return splicingGroupGlobal.children.filter(
    (c) => c.name !== CutHeadEyesNodeCombinedGroupName
  ) as THREE.Group<THREE.Object3DEventMap>[];
}

export function removeAndAddModelWithModelHeight(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  importedGroup: THREE.Group<THREE.Object3DEventMap>,
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
  let group2Dispose: THREE.Group<THREE.Object3DEventMap> | null = null;
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
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  importedGroup: THREE.Group<THREE.Object3DEventMap>,
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
  let group2Dispose: THREE.Group<THREE.Object3DEventMap> | null = null;
  // Check if the new group is hair or body
  if (isHairImported) group2Dispose = hairGroup;
  else group2Dispose = bodyGroup;

  console.log("\nGroup to dispose ->", group2Dispose.name);

  // Dispose the group
  disposeHairBodyGroup(splicingGroupGlobal, group2Dispose);
  // Add the new group
  splicingGroupGlobal.add(importedGroup);
}

/**
 * Dispose each geometry and material of meshes in the group object.
 * @param obj2Dispose The group object to dispose.
 */
export function disposeGroupObject(
  obj2Dispose: THREE.Group<THREE.Object3DEventMap>
) {
  obj2Dispose.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((mat) => {
          // Dispose textures in material properties
          for (const key in mat) {
            const value = (mat as any)[key];
            if (value && value instanceof THREE.Texture) {
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
export function disposeAndRemoveCurrentCutHead(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>
) {
  let currentCutHead: THREE.Group<THREE.Object3DEventMap> | null = null;
  // Find the current cut head
  currentCutHead = splicingGroupGlobal.children.find((child) => {
    return (
      child.name.toLocaleLowerCase() ===
      CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase()
    );
  }) as THREE.Group<THREE.Object3DEventMap>;
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
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  defaultOriginalHead: THREE.Group<THREE.Object3DEventMap>,
  importedCutter: THREE.Group<THREE.Object3DEventMap>
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
