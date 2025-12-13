import { defineStore } from "pinia";
import * as THREE from "three";
import { Pane } from "tweakpane";
import { MaxModelLength } from "../constants";
import {
  CutHeadDebugProps,
  ModelPaths,
  OBJLoaderInstance,
} from "../three/constants";
import { addTransformDebug } from "../three/gui";
import {
  applyPBRMaterialAndSRGBColorSpace,
  applyTextures2LoadedHeadModelAsync,
  disposeGeoMat,
} from "../three/meshOps/index.ts";
import { getCutHead } from "../three/utils/csgCutHeadV3.ts";

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
  // Apply textures
  await applyTextures2LoadedHeadModelAsync(loadedHeadModel, false);
  // Get Cut Head
  const cutHeadDefault = await getCutHead(loadedHeadModel, loadedCuttersModel);
  // Apply PBR Material and SRGB Color Space
  applyPBRMaterialAndSRGBColorSpace(cutHeadDefault, false);
  cutHeadDefault.scale.setScalar(CutHeadDebugProps.ScalarSplicing);
  addTransformDebug("Cut Head", GUIGlobal, cutHeadDefault, {
    showScale: true,
  });
  return cutHeadDefault;
};

const CutHeadDefault = await loadDefaultCutHeadAsync();
console.log("\n CutHeadDefault ->", CutHeadDefault);

export const useModelsStore = defineStore("models", {
  state: () => ({
    // Splicing Group
    splicingGroupGlobal: new THREE.Group().add(
      CutHeadDefault
    ) as THREE.Group<THREE.Object3DEventMap>,
    // Hair
    hairModelGlobal: null as THREE.Object3D | null,
    // Body
    bodyModelGlobal: null as THREE.Object3D | null,
    // Cutters
    cuttersModelGlobal:
      loadedCuttersModel as THREE.Group<THREE.Object3DEventMap>,
    // GUI
    guiGlobal: GUIGlobal as Pane,
  }),

  getters: {
    splicingGroupLen: (state): number =>
      state.splicingGroupGlobal.children.length,
  },

  actions: {
    addChild(child: THREE.Object3D) {
      this.splicingGroupGlobal.add(child);
    },

    clear() {
      if (this.splicingGroupGlobal.children.length === 0) return;
      // TODO: Clear the Hair and Body except the CutHead.
      disposeGeoMat(this.splicingGroupGlobal);
    },

    async importObj(file: File) {
      if (this.splicingGroupGlobal.children.length >= MaxModelLength) return;
      const text = await file.text();
      const object = OBJLoaderInstance.parse(text);

      this.splicingGroupGlobal.add(object);
    },
  },
});
