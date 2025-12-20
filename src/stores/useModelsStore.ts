import { defineStore } from "pinia";
import * as THREE from "three";
import { markRaw } from "vue";
import {
  CutHeadBoundingBoxHeight,
  ModelPaths,
  NodeNames,
  OBJLoaderInstance,
  type PhongMesh,
} from "../three/constants";
import { addTransformDebug } from "../three/gui";
import { GUIGlobal } from "../three/gui/global";
import { loadTexture } from "../three/loaders/TextureLoader";
import {
  applyDoubleSide,
  applyPBRMaterialAndSRGBColorSpace,
  applyTextures2LoadedHeadModelAsync,
  disposeHairBodyFromSplicingGroupGlobal,
  getObject3DHeight,
  removeAndAddModelWithModelHeight,
  removeAndAddModelWithNodeNames,
} from "../three/meshOps/index.ts";
import { getCutHead } from "../three/utils/csgCutHeadV3.ts";

// const ObjLoader = new OBJLoader();
// const TweakPane = new Pane({ title: "Global Settings" });

/*
  Cutters Model
 */
const LoadedCuttersModel: THREE.Group<THREE.Object3DEventMap> =
  await OBJLoaderInstance.loadAsync(
    ModelPaths.Cutters.OralSphereCylinderCombined
  );

/*
  Default Cut Head
 */
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
  applyPBRMaterialAndSRGBColorSpace(cutHeadDefault, true);
  // Apply Double Side
  applyDoubleSide(cutHeadDefault);
  // Set Scale
  // cutHeadDefault.scale.setScalar(CutHeadDebugProps.ScalarSplicing);
  // Add to GUI
  addTransformDebug("Cut Head", GUIGlobal, cutHeadDefault, {
    showScale: true,
  });
  // Compute the bounding box of the cut head and get the height and log it
  getObject3DHeight(cutHeadDefault);
  return cutHeadDefault;
};
const CutHeadDefault = await loadDefaultCutHeadAsync();
console.log("\n CutHeadDefault ->", CutHeadDefault);

/*
  Splicing Group
 */
const SplicingGroupGlobal = markRaw(
  new THREE.Group().add(CutHeadDefault)
) as THREE.Group<THREE.Object3DEventMap>;
SplicingGroupGlobal.name = "SplicingGroupGlobal";

const CuttersModelGlobal = markRaw(
  LoadedCuttersModel
) as THREE.Group<THREE.Object3DEventMap>;
CuttersModelGlobal.name = "CuttersModelGlobal";

/**
 * Model Store
 */
export const useModelsStore = defineStore("models", {
  state: () => ({
    // Splicing Group
    splicingGroupGlobal: SplicingGroupGlobal,
    splicingGroupLengthState: 1,
    // Hair
    // hairModelGlobal: null as THREE.Object3D | null,
    // Body
    // bodyModelGlobal: null as THREE.Object3D | null,
    // Cutters
    cuttersModelGlobal: CuttersModelGlobal,
    // GUI
    // guiGlobal: TweakPane as Pane,
    isShowMap: true,
  }),

  getters: {
    splicingGroupLen: (state): number => state.splicingGroupLengthState,
  },

  actions: {
    /**
     * Sync the splicing group length.
     */
    syncSplicingGroupLength() {
      this.splicingGroupLengthState = this.splicingGroupGlobal.children.length;
    },

    addChild(child: THREE.Object3D) {
      this.splicingGroupGlobal.add(child);
      this.syncSplicingGroupLength();
    },

    /**
     * Clear the models in the splicing group except the cutHead.
     * @param filteredSubGroups Sub groups to remove
     * @returns void
     */
    clear(filteredSubGroups: THREE.Group<THREE.Object3DEventMap>[]) {
      disposeHairBodyFromSplicingGroupGlobal(
        this.splicingGroupGlobal,
        filteredSubGroups
      );
      this.syncSplicingGroupLength();
    },

    /**
     * Import .obj file and texture file based on the height of the imported model.
     * @param files Files to import
     * @returns void
     */
    async imoprtObjWithModelHeight(files: FileList) {
      console.log("\nfiles to import ->", files);

      let objFile: File | null = null;
      let texFile: File | null = null;

      // Iterate over the files to find the .obj and texture files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith(".obj")) {
          objFile = file;
        } else if (file.type.startsWith("image/")) {
          texFile = file;
        }
      }

      // Check if the .obj file exists
      if (!objFile) {
        console.warn("No .obj file found.");
        return;
      }

      const text = await objFile.text();
      const importedParsedObject = OBJLoaderInstance.parse(text);

      // If texture file exists, load and apply it
      if (texFile) {
        const texUrl = URL.createObjectURL(texFile);
        console.log("\ntexUrl ->", texUrl);
        const texture = await loadTexture(texUrl);
        // Retrieve the first node (child) of the object and apply the texture to it
        const node = importedParsedObject.children[0] as THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshPhongMaterial
        >;
        node.material.map = texture;
        node.material.needsUpdate = true;
      }
      // Apply PBR Material and SRGB Color Space
      applyPBRMaterialAndSRGBColorSpace(importedParsedObject, true);
      applyDoubleSide(importedParsedObject);

      /**
       * Check if the imported object is hair or body by using the @see {getObject3DHeight} fn.
       * if it is hair, remove the current hair model from the splicing group and add the new hair model to the splicing group if the splicing group has the corresponding model in it.
       * if it is body, remove the current body model from the splicing group and add the new body model to the splicing group if the splicing group has the corresponding model in it.
       */

      // Log the height of the imported model first
      const importedParsedObjectHeight =
        getObject3DHeight(importedParsedObject);
      console.log("\nImported Model Height ->", importedParsedObjectHeight);

      /**
       * Checked! Now we can check if the imported model is hair or body based on the height of the head.
       * hair -> height < @see {CutHeadBoundingBoxHeight}
       * body -> height > @see {CutHeadBoundingBoxHeight}
       */
      const isHairImported =
        importedParsedObjectHeight < CutHeadBoundingBoxHeight;
      console.log("\nisHair imported model ->", isHairImported);

      // Set the name of the imported model
      importedParsedObject.name = isHairImported ? "HairGrp" : "BodyGrp";
      const importedParsedObjectChild = importedParsedObject
        .children[0] as PhongMesh;
      // Set the name of the imported model's child
      importedParsedObjectChild.name = isHairImported ? "HairNode" : "BodyNode";
      // Set the name of the imported model's child's material
      importedParsedObjectChild.material.name = isHairImported
        ? "HairNodeMat"
        : "BodyNodeMat";

      /**
       * Create a function in meshOps/index.ts to remove the corresponding model from the splicing group by passing the isHair boolean to it.
       */
      removeAndAddModelWithModelHeight(
        this.splicingGroupGlobal,
        importedParsedObject,
        isHairImported
      );
      this.syncSplicingGroupLength();
    },

    /**
     * Import .obj file and texture file based on the node name validation.
     * @param files Files to import
     * @returns void
     */
    async imoprtObjWithNodeNames(files: FileList) {
      // Log the files to import
      console.log("\nfiles to import ->", files);

      // Create variables to store the .obj and texture files
      let objFile: File | null = null;
      let texFile: File | null = null;

      // Iterate over the files to find the .obj and texture files and assign them to the variables
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith(".obj")) {
          objFile = file;
        } else if (file.type.startsWith("image/")) {
          texFile = file;
        }
      }

      // Check if the .obj file exists
      if (!objFile) {
        console.warn("No .obj file found.");
        return;
      }

      // Get the text content of the .obj file
      const text = await objFile.text();
      // Parse the .obj file text content with the OBJLoaderInstance
      const importedParsedObject = OBJLoaderInstance.parse(text);

      // If texture file exists, load and apply it to the imported model
      if (texFile) {
        const texUrl = URL.createObjectURL(texFile);
        console.log("\ntexUrl ->", texUrl);
        const texture = await loadTexture(texUrl);
        // Retrieve the first node (child) of the object and apply the texture to it
        const node = importedParsedObject.children[0] as THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshPhongMaterial
        >;
        node.material.map = texture;
        node.material.needsUpdate = true;
      }
      // Apply PBR Material and SRGB Color Space
      applyPBRMaterialAndSRGBColorSpace(importedParsedObject, true);
      // Apply Double Side to the imported model
      applyDoubleSide(importedParsedObject);

      /**
       * Check if the imported object is hair or body by getting the name of the imported model single node.
       * if it is hair, remove the current hair model from the splicing group and add the new hair model to the splicing group if the splicing group has the corresponding model in it.
       * if it is body, it's the same logic as the hair.
       */
      const isHairImported =
        importedParsedObject.children[0].name === NodeNames.HairNames.Hair;
      console.log("\nisHair imported model ->", isHairImported);

      // Call the removeAndAddModel fn to remove the current hair model from the splicing group and add the new hair model to the splicing group if the splicing group has the corresponding model in it.
      removeAndAddModelWithNodeNames(
        this.splicingGroupGlobal,
        importedParsedObject,
        isHairImported
      );
      this.syncSplicingGroupLength();
    },

    /**
     * Export the splicing group to a .obj, .mtl and texture png files.
     * @returns Promise<boolean> - true if the export was successful, false otherwise
     */
    async exportModel() {
      // Lazy import to avoid circular dependency issues if any
      const { exportSplicingGroup } = await import("../three/exporters");
      return await exportSplicingGroup(this.splicingGroupGlobal);
    },

    /**
     * Toggle the isShowMap state.
     */
    toggleIsShowMap() {
      this.isShowMap = !this.isShowMap;
    },
  },
});
