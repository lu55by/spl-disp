import * as THREE from "three/webgpu";
import { TextureLoaderInstance } from "../constants/index.ts";

export async function loadTexture(path: string): Promise<THREE.Texture> {
  // const texLoader = new THREE.TextureLoader(GlobalLoadingManager);

  return new Promise((resolve, reject) => {
    TextureLoaderInstance.load(path, resolve, undefined, reject);
  });
}
