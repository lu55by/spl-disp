import { defineStore } from "pinia";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MaxModelLength } from "../constants";
import { CutHeadDebugProps, ModelPaths } from "../three/constants";
import { loadObj } from "../three/loaders/ModelLoader.ts";
import { getCutHeadV2 } from "../three/utils/csgCutHead.ts";
import { addTransformDebug } from "../three/gui";
import GUI from "lil-gui";

const ObjLoader = new OBJLoader();
const GUIGlobal = new GUI();

// Load the default head

// Male
const loadDefaultHeadAsync = async () => {
  const loadedMaleHeadModel: THREE.Object3D = await loadObj(
    ModelPaths.HeadMale.Model
  );
  const cutHead = await getCutHeadV2(
    loadedMaleHeadModel,
    ModelPaths.Cutters.OralSphereCylinderCombined
  );
  cutHead.scale.setScalar(CutHeadDebugProps.ScalarSplicing);
  addTransformDebug("Cut Head", GUIGlobal, cutHead, { showScale: true });
  return cutHead;
};

const DefaultCutHead = await loadDefaultHeadAsync();

export const useModelsStore = defineStore("models", {
  state: () => ({
    guiGlobal: GUIGlobal as GUI,
    group: new THREE.Group().add(DefaultCutHead) as THREE.Group,
  }),

  getters: {
    groupLen: (state): number => state.group.children.length,
  },

  actions: {
    addChild(child: THREE.Object3D) {
      this.group.add(child);
    },

    clear() {
      if (this.group.children.length === 0) return;
      this.group.traverse((child: THREE.Object3D<THREE.Object3DEventMap>) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material)
            child.material.dispose();
        }
        this.group.clear();
      });
    },

    async importObj(file: File) {
      if (this.group.children.length >= MaxModelLength) return;
      const text = await file.text();
      const object = ObjLoader.parse(text);

      this.group.add(object);
    },
  },
});
