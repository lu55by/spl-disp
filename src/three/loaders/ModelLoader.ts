import * as THREE from 'three/webgpu';
import {MTLLoader} from "three/examples/jsm/loaders/MTLLoader.js";
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader.js";

export interface LoadObjOptions {
  mtlPath?: string | undefined;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3 | number;
}

/**
 * Load the obj file with some options.
 * @param path OBJ file path
 * @param options Optional options contains mtlPath(mtl file path) | position, rotation, scale(the position, rotation, scale set to the loaded model) 
 * @returns Loaded obj with the type of THREE.Object3D
 */
export async function loadObj(path: string, options: LoadObjOptions = {}): Promise<THREE.Object3D> {
    const {mtlPath, scale, position, rotation} = options;

    // let materials: THREE.Material | THREE.Material[] | undefined;
    let materials: MTLLoader.MaterialCreator | undefined;

    // Load MTL (if provided)
    if (mtlPath) {
        const mtlLoader = new MTLLoader()
        materials = await new Promise<MTLLoader.MaterialCreator>((resolve, reject) => {
            mtlLoader.load(
                mtlPath,
                (mtl) => {
                    mtl.preload();
                    resolve(mtl);
                },
                undefined,
                reject);
        })
    }

    // Load OBJ
    const objLoader = new OBJLoader()
    if (materials) objLoader.setMaterials(materials)

    const loadedObj = await new Promise<THREE.Object3D>((resolve, reject) => {
        objLoader.load(path, resolve, undefined, reject);
    });

    // Optional transforms
    if (position) loadedObj.position.copy(position);

    if (rotation) loadedObj.rotation.copy(rotation);

    if (scale) {
        if (typeof scale === 'number')
            loadedObj.scale.setScalar(scale);
        else loadedObj.scale.copy(scale);
    }


    return loadedObj;
}