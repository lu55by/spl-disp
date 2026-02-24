import { TextureLoaderInstance } from "../constants/index.ts";
import type { Texture } from "three/webgpu";

export async function loadTexture(path: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    TextureLoaderInstance.load(path, resolve, undefined, reject);
  });
}
