import * as THREE from 'three/webgpu';

export async function loadTexture(path: string): Promise<THREE.Texture> {
    const texLoader = new THREE.TextureLoader();

    return new Promise((resolve, reject) => {
        texLoader.load(path, resolve, undefined, reject);
    });
}