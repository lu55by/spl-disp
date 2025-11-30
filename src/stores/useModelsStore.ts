import {defineStore} from "pinia";
import * as THREE from 'three';
import type {MeshOf} from "../three/constants";

export const useModelsStore = defineStore(
    'models', {
        state: () => ({
            group: new THREE.Group as THREE.Group,
        }),

        getters: {
            groupLen: state => state.group.children.length,
        },

        actions: {
            addChild(child: THREE.Mesh) {
                this.group.add(child);
            },

            clear() {
                this.group.traverse((child: MeshOf<THREE.Material>) => {
                    child.geometry.dispose();
                    child.material.dispose();
                    this.group.remove(child);
                })
            }
        }
    }
);