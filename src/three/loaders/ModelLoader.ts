import * as THREE from "three/webgpu";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OBJLoaderInstance, STLLoaderInstance } from "../constants";

export interface LoadObjOptions {
  mtlPath?: string | undefined;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3 | number;
}

/**
 * Load the obj file with some options.
 * @param {string} path OBJ file path
 * @param {LoadObjOptions} options Optional options contains mtlPath(mtl file path) | position, rotation, scale(the position, rotation, scale set to the loaded model)
 * @returns {Promise<THREE.Group<THREE.Object3DEventMap>>} Loaded obj with the type of THREE.Object3D
 */
export async function loadObj(
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
  if (materials) OBJLoaderInstance.setMaterials(materials);

  const loadedObj = await new Promise<THREE.Group<THREE.Object3DEventMap>>(
    (resolve, reject) => {
      OBJLoaderInstance.load(path, resolve, undefined, reject);
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

export async function loadSTLFile(file: File) {
  // Read file as ArrayBuffer as the stl file is binary or ASCII
  const arrayBuffer = await file.arrayBuffer();

  // Parse the geometry of STL using STLLoader
  const geo = STLLoaderInstance.parse(arrayBuffer);

  // Create a Mesh
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());

  // Set name for the mesh
  m.name = file.name.toLocaleLowerCase().split(".")[0] + "Node";
  // Set name for the material
  m.material.name = m.name + "Mat";

  return m;
}
