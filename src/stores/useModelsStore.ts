import GUI from "lil-gui";
import { defineStore } from "pinia";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MaxModelLength } from "../constants";
import { CutHeadDebugProps, ModelPaths } from "../three/constants";
import { addTransformDebug } from "../three/gui";
import { loadObj } from "../three/loaders/ModelLoader.ts";
import { disposeGeoMat } from "../three/meshOps/index.ts";
import { getCutHeadV2 } from "../three/utils/csgCutHead.ts";

const ObjLoader = new OBJLoader();
const GUIGlobal = new GUI();

// Load the default head

const loadDefaultHeadAsync = async () => {
  const loadedHeadModel: THREE.Object3D = await loadObj(
    // Male
    ModelPaths.HeadMale.Model
  );
  const loadedCuttersModel: THREE.Object3D = await loadObj(
    ModelPaths.Cutters.OralSphereCylinderCombined
  );
  const cutHead = await getCutHeadV2(loadedHeadModel, loadedCuttersModel);
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
      disposeGeoMat(this.group);
    },

    async importObj(file: File) {
      if (this.group.children.length >= MaxModelLength) return;
      const text = await file.text();
      const object = ObjLoader.parse(text);

      this.group.add(object);
    },
  },
});
