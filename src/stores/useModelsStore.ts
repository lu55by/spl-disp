import { defineStore } from "pinia";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MaxModelLength } from "../constants";
import {
  CutHeadDebugProps,
  ModelPaths,
  OBJLoaderInstance,
} from "../three/constants";
import { addTransformDebug } from "../three/gui";
import { disposeGeoMat } from "../three/meshOps/index.ts";
import { getCutHead } from "../three/utils/csgCutHeadV3.ts";
import { Pane } from "tweakpane";

// const ObjLoader = new OBJLoader();
const GUIGlobal = new Pane({ title: "Global Settings" });

// Load the default head

// Cutters Model
const loadedCuttersModel: THREE.Group<THREE.Object3DEventMap> =
  await OBJLoaderInstance.loadAsync(
    ModelPaths.Cutters.OralSphereCylinderCombined
  );

const loadDefaultCutHeadAsync = async () => {
  const loadedHeadModel: THREE.Group<THREE.Object3DEventMap> =
    await OBJLoaderInstance.loadAsync(
      // Male
      ModelPaths.HeadMale.Model
    );
  const cutHeadDefault = await getCutHead(loadedHeadModel, loadedCuttersModel);
  cutHeadDefault.scale.setScalar(CutHeadDebugProps.ScalarSplicing);
  if (GUIGlobal)
    addTransformDebug("Cut Head", GUIGlobal, cutHeadDefault, {
      showScale: true,
    });
  return cutHeadDefault;
};

const CutHeadDefault = await loadDefaultCutHeadAsync();

export const useModelsStore = defineStore("models", {
  state: () => ({
    guiGlobal: GUIGlobal as Pane,
    cuttersModelGlobal:
      loadedCuttersModel as THREE.Group<THREE.Object3DEventMap>,
    group: new THREE.Group().add(
      CutHeadDefault
    ) as THREE.Group<THREE.Object3DEventMap>,
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
      const object = OBJLoaderInstance.parse(text);

      this.group.add(object);
    },
  },
});
