import * as THREE from 'three/webgpu';

import { GlobalLoadingManager } from "../managers/GlobalLoadingManager.ts";

export async function loadTexture(path: string): Promise<THREE.Texture> {
  const texLoader = new THREE.TextureLoader(GlobalLoadingManager);

  return new Promise((resolve, reject) => {
    texLoader.load(path, resolve, undefined, reject);
  });
}