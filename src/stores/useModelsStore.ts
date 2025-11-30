import {defineStore} from "pinia";
import * as THREE from 'three';
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader.js";

const OBJ_LOADER = new OBJLoader();

export const useModelsStore = defineStore(
    'models', {
        state: () => ({
            group: new THREE.Group as THREE.Group,
        }),

        getters: {
            groupLen: state => state.group.children.length,
        },

        actions: {
            addChild(child: THREE.Object3D) {
                this.group.add(child);
            },

            clear() {
                this.group.traverse((child: THREE.Object3D<THREE.Object3DEventMap>) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (child.material instanceof THREE.MeshPhongMaterial) child.material.dispose();
                    }
                    this.group.clear();
                })
            },

            async importObj(file: File) {
                if (this.group.children.length >= 3) return;
                const text = await file.text();
                const object = OBJ_LOADER.parse(text);

                this.group.add(object);
            },
        }
    }
);