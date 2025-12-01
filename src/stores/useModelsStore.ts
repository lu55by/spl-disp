import GUI from "lil-gui";
import { defineStore } from "pinia";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MaxModelLength } from "../constants";
import { CutHeadDebugProps, ModelPaths } from "../three/constants";
import { addTransformDebug } from "../three/gui";
import { disposeGeoMat } from "../three/meshOps/index.ts";
import { getCutHeadV3 } from "../three/utils/csgCutHead.ts";

const ObjLoader = new OBJLoader();
const GUIGlobal = new GUI();

// Load the default head

// Cutters Model
const loadedCuttersModel: THREE.Object3D = await ObjLoader.loadAsync(
  ModelPaths.Cutters.OralSphereCylinderCombined
);

const loadDefaultHeadAsync = async () => {
  const loadedHeadModel: THREE.Object3D = await ObjLoader.loadAsync(
    // Male
    ModelPaths.HeadMale.Model
  );
  const cutHead = await getCutHeadV3(loadedHeadModel, loadedCuttersModel);
  cutHead.scale.setScalar(CutHeadDebugProps.ScalarSplicing);
  if (GUIGlobal)
    addTransformDebug("Cut Head", GUIGlobal, cutHead, { showScale: true });
  return cutHead;
};

const DefaultCutHead = await loadDefaultHeadAsync();

export const useModelsStore = defineStore("models", {
  state: () => ({
    guiGlobal: GUIGlobal as GUI,
    cuttersModelGlobal: loadedCuttersModel as THREE.Object3D,
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
      // TODO: Clear the Hair and Body except the CutHead.
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
