import { defineStore } from "pinia";
import * as THREE from "three";
import { Pane } from "tweakpane";
import { MaxModelLength } from "../constants";
import {
  CutHeadBoundingBoxHeight,
  CutHeadDebugProps,
  ModelPaths,
  OBJLoaderInstance,
} from "../three/constants";
import { addTransformDebug } from "../three/gui";
import {
  applyPBRMaterialAndSRGBColorSpace,
  applyTextures2LoadedHeadModelAsync,
  getObject3DHeight,
  disposeHairBodyFromSplicingGroupGlobal,
  removeAndAddModel,
} from "../three/meshOps/index.ts";
import { getCutHead } from "../three/utils/csgCutHeadV3.ts";

// const ObjLoader = new OBJLoader();
const TweakPane = new Pane({ title: "Global Settings" });

// Load the default head

// Cutters Model
const LoadedCuttersModel: THREE.Group<THREE.Object3DEventMap> =
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
  const cutHeadDefault = await getCutHead(loadedHeadModel, LoadedCuttersModel);
  // Apply PBR Material and SRGB Color Space
  // applyPBRMaterialAndSRGBColorSpace(cutHeadDefault, false);
  // Set Scale
  // cutHeadDefault.scale.setScalar(CutHeadDebugProps.ScalarSplicing);
  // Add to GUI
  addTransformDebug("Cut Head", TweakPane, cutHeadDefault, {
    showScale: true,
  });
  // Compute the bounding box of the cut head and get the height and log it
  getObject3DHeight(cutHeadDefault, "Cut Head");
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
      LoadedCuttersModel as THREE.Group<THREE.Object3DEventMap>,
    // GUI
    guiGlobal: TweakPane as Pane,
  }),

  getters: {
    splicingGroupLen: (state): number =>
      state.splicingGroupGlobal.children.length,
  },

  actions: {
    addChild(child: THREE.Object3D) {
      this.splicingGroupGlobal.add(child);
    },

    clear(filteredSubGroups: THREE.Group<THREE.Object3DEventMap>[]) {
      disposeHairBodyFromSplicingGroupGlobal(
        this.splicingGroupGlobal,
        filteredSubGroups
      );
    },

    async importObj(file: File) {
      // if (this.splicingGroupGlobal.children.length >= MaxModelLength) return;
      const text = await file.text();
      const object = OBJLoaderInstance.parse(text);

      /**
       * TODO: Check if the imported object is hair or body by using the @see {getObject3DHeight} fn.
       * if it is hair, remove the current hair model from the splicing group and add the new hair model to the splicing group if the splicing group has the corresponding model in it.
       * if it is body, remove the current body model from the splicing group and add the new body model to the splicing group if the splicing group has the corresponding model in it.
       */

      // Log the height of the imported model first
      console.log(
        "\n Imported Model Height ->",
        getObject3DHeight(object, "Imported Model")
      );

      /**
       * Checked! Now we can check if the imported model is hair or body based on the height of the head.
       * hair -> height < @see {CutHeadBoundingBoxHeight}
       * body -> height > @see {CutHeadBoundingBoxHeight}
       */
      const isHair =
        getObject3DHeight(object, "Imported Model") < CutHeadBoundingBoxHeight;
      console.log("\n isHair imported model ->", isHair);

      /**
       * Create a function in meshOps/index.ts to remove the corresponding model from the splicing group by passing the isHair boolean to it.
       */
      removeAndAddModel(this.splicingGroupGlobal, object, isHair);
    },
  },
});
