import { defineStore } from "pinia";
import * as THREE from "three/webgpu";
import { markRaw } from "vue";
import {
  CutHeadBoundingBoxHeight,
  CutHeadEyesNodeCombinedGroupName,
  ModelPaths,
  NodeNames,
  OBJLoaderInstance,
  type PhongMesh,
} from "../three/constants";
import { loadSTLFile } from "../three/loaders/ModelLoader.ts";
import { loadTexture } from "../three/loaders/TextureLoader";
import {
  applyDoubleSide,
  applyPBRMaterialAndSRGBColorSpace,
  applyTextures2LoadedHeadModelAsync,
  disposeHairBodyFromSplicingGroupGlobal,
  getObject3DHeight,
  removeAndAddModelWithModelHeight,
  removeAndAddModelWithNodeNames,
  replaceCurrentHeadWithCutHead,
} from "../three/meshOps/index.ts";

/*
  Loaded Cutters Model
 */
const LoadedCuttersModel: THREE.Group<THREE.Object3DEventMap> =
  await OBJLoaderInstance.loadAsync(
    ModelPaths.Cutters.OralSphereCylinderCombined
  );

/*
  Load Default Cut Head
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
  // const cutHeadDefault = await getCutHead(loadedHeadModel, LoadedCuttersModel);
  /*
    ! Set the cutHeadDefault to the original loadedHeadModel as we are about to add the 
    ! feature of letting the user import the cutters model and cut the loadedHeadModel dynamically
   */
  const cutHeadDefault = loadedHeadModel;
  cutHeadDefault.name = CutHeadEyesNodeCombinedGroupName;
  // Apply PBR Material and SRGB Color Space
  applyPBRMaterialAndSRGBColorSpace(cutHeadDefault, true);
  // Apply Double Side
  applyDoubleSide(cutHeadDefault);
  // Set Scale
  // cutHeadDefault.scale.setScalar(CutHeadDebugProps.ScalarSplicing);
  // Add to GUI
  // addTransformDebug("Cut Head", GUIGlobal, cutHeadDefault, {
  //   showScale: true,
  // });
  // Compute the bounding box of the cut head and get the height and log it
  // getObject3DHeight(cutHeadDefault);
  return cutHeadDefault;
};
const CutHeadDefault = await loadDefaultCutHeadAsync();
console.log("\n CutHeadDefault ->", CutHeadDefault);

/*
  Splicing Group
 */
const SplicingGroupGlobal = markRaw(
  new THREE.Group().add(CutHeadDefault.clone())
) as THREE.Group<THREE.Object3DEventMap>;
SplicingGroupGlobal.name = "SplicingGroupGlobal";

/*
  Cutters Model
 */
const CuttersModelGlobal = markRaw(
  LoadedCuttersModel
) as THREE.Group<THREE.Object3DEventMap>;
CuttersModelGlobal.name = "CuttersModelGlobal";

/**
 * Model Store
 */
export const useModelsStore = defineStore("models", {
  state: () => ({
    // Global Splicing Group
    splicingGroupGlobal: SplicingGroupGlobal,
    // Default Original Head
    defaultOriginalHead: CutHeadDefault,
    // Splicing Group Length State
    splicingGroupLengthState: 1,
    // Global Cutters Model
    cuttersModelGlobal: CuttersModelGlobal,
    // Drag and Drop Hovered Object
    dragHoveredObject: null as THREE.Mesh | null,
    // Selected Object by mouse click
    selectedObject: null as THREE.Object3D | null,
    // isShowMap state to toggle the uIsShowMap uniform (0 or 1) of the MeshStandardNodeMaterial
    isShowMap: true,
  }),

  getters: {
    splicingGroupLen: (state): number => state.splicingGroupLengthState,
  },

  actions: {
    /**
     * Set the selected object by mouse click.
     * @param object The object being selected by mouse click
     */
    setSelectedObject(object: THREE.Object3D | null) {
      this.selectedObject = object;
    },

    /**
     * Set the drag hovered object.
     * @param object The object being hovered
     */
    setDragHoveredObject(object: THREE.Mesh | null) {
      this.dragHoveredObject = object;
    },

    /**
     * Apply texture to the currently hovered object.
     * @param file The image file to apply
     */
    async applyTextureToHoveredObject(file: File) {
      if (!this.dragHoveredObject) return;

      const texUrl = URL.createObjectURL(file);
      const texture = await loadTexture(texUrl);
      texture.colorSpace = THREE.SRGBColorSpace;

      // Ensure the object has a material that supports maps
      if (this.dragHoveredObject.material) {
        // Check if material has a map property
        if ("map" in this.dragHoveredObject.material) {
          let previousMap = (this.dragHoveredObject.material as any)
            .map as THREE.Texture;
          (this.dragHoveredObject.material as any).map = texture;
          (this.dragHoveredObject.material as any).needsUpdate = true;
          // Dispose the privious map
          previousMap?.dispose();
          previousMap = null;
        }
      }
    },

    /**
     * Sync the splicing group length.
     * @param length The length of the splicing group (optional)
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
    async imoprtObjStlModelWithHeight(files: FileList) {
      console.log("\nfiles to import ->", files);

      let objFile: File | null = null;
      let stlFile: File | null = null;
      let texFile: File | null = null;

      // Iterate over the files to find the .obj, .stl and texture files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.toLocaleLowerCase().endsWith(".obj")) {
          objFile = file;
        } else if (file.name.toLocaleLowerCase().endsWith(".stl")) {
          stlFile = file;
        } else if (file.type.startsWith("image/")) {
          texFile = file;
        }
      }

      // Check if the .obj or .stl file exists
      if (!objFile && !stlFile) {
        console.warn("No .obj or .stl file found.");
        return;
      }

      // ! STL File Import
      if (stlFile) {
        // Set the textFile to null as the stlFile is not supporting uv texture mapping
        texFile = null;

        // Get the STL Mesh
        const stlMesh: THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshStandardNodeMaterial
        > = await loadSTLFile(stlFile);

        // !! REMOVE AND ADD THE IMPORTED MODEL TO THE SPlicing GROUP !!

        // Create a Group
        const stlModelGroup = new THREE.Group().add(stlMesh);

        // Check if it is hair or body
        const isHair =
          getObject3DHeight(stlModelGroup) < CutHeadBoundingBoxHeight;
        console.log("\nis Hair imported model ->", isHair);

        // Call the removeAndAddModelWithModelHeight fn
        removeAndAddModelWithModelHeight(
          this.splicingGroupGlobal,
          stlModelGroup,
          isHair
        );

        // Sync the splicing group length
        this.syncSplicingGroupLength();

        // Return if it is stl file
        return;
      }

      // ! OBJ File Import
      const text = await objFile.text();
      const importedParsedObj = OBJLoaderInstance.parse(text);

      // If texture file exists, load and apply it
      if (texFile) {
        const texUrl = URL.createObjectURL(texFile);
        console.log("\ntexUrl ->", texUrl);
        const texture = await loadTexture(texUrl);
        // Retrieve the first node (child) of the object and apply the texture to it
        const node = importedParsedObj.children[0] as THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshPhongMaterial
        >;
        node.material.map = texture;
        node.material.needsUpdate = true;
      }
      // Apply PBR Material and SRGB Color Space
      applyPBRMaterialAndSRGBColorSpace(importedParsedObj, true);
      applyDoubleSide(importedParsedObj);

      /**
       * !! REMOVE AND ADD THE IMPORTED MODEL TO THE SPlicing GROUP !!
       * Check if the imported object is hair or body by using the @see {getObject3DHeight} fn.
       * if it is hair, remove the current hair model from the splicing group and add the new hair model to the splicing group if the splicing group has the corresponding model in it.
       * if it is body, remove the current body model from the splicing group and add the new body model to the splicing group if the splicing group has the corresponding model in it.
       */

      // Log the height of the imported model first
      const importedParsedObjectHeight = getObject3DHeight(importedParsedObj);
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
      importedParsedObj.name = isHairImported ? "HairGrp" : "BodyGrp";
      const importedParsedObjectChild = importedParsedObj
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
        importedParsedObj,
        isHairImported
      );
      this.syncSplicingGroupLength();
    },

    /**
     * Import .obj file and texture file based on the node name validation.
     * @param files Files to import
     * @returns void
     */
    async imoprtObjStlWithNodeNames(files: FileList) {
      // Log the files to import
      console.log("\n -- imoprtObjStlWithNodeNames -- files ->", files);

      // Create variables to store the .obj and texture files
      let objFile: File | null = null;
      let stlFile: File | null = null;
      let texFile: File | null = null;

      // Iterate over the files to find the .obj, .stl and texture files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.toLocaleLowerCase().endsWith(".obj")) {
          objFile = file;
        } else if (file.name.toLocaleLowerCase().endsWith(".stl")) {
          stlFile = file;
        } else if (file.type.startsWith("image/")) {
          texFile = file;
        }
      }

      // Check if the .obj or .stl file exists
      if (!objFile && !stlFile) {
        console.warn("No .obj or .stl file found.");
        return;
      }

      // ! STL File Import
      if (stlFile) {
        // Set the textFile to null as the stlFile is not supporting uv texture mapping
        texFile = null;

        // Get the STL Mesh
        const stlMesh: THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshStandardNodeMaterial
        > = await loadSTLFile(stlFile);

        // !! REMOVE AND ADD THE IMPORTED MODEL TO THE SPlicing GROUP !!

        // Create a Group
        const stlModelGroup = new THREE.Group().add(stlMesh);
        const isHair = stlFile.name
          .toLocaleLowerCase()
          .includes(NodeNames.HairNames.Hair.toLocaleLowerCase());
        // Check if it is hair or body
        console.log("\nis imported Hair stl model ->", isHair);
        stlModelGroup.name = isHair ? "hairGrp" : "bodyGrp";
        console.log("\nstlModelGroup name set ->", stlModelGroup.name);

        // Call the removeAndAddModelWithNodeNames fn
        removeAndAddModelWithNodeNames(
          this.splicingGroupGlobal,
          stlModelGroup,
          isHair
        );

        // Sync the splicing group length
        this.syncSplicingGroupLength();

        // Return if it is stl file
        return;
      }

      // ! OBJ File Import
      const text = await objFile.text();
      // Parse the .obj file text content with the OBJLoaderInstance
      // TODO: Add a loading bar ui to show the progress of parsing the obj text content as there might be some obj file with large number of vertices.
      const importedParsedObject = OBJLoaderInstance.parse(text);

      // Check if it is the cutter single model being imported
      const isCutterImported =
        importedParsedObject.children.find((child) => {
          return child.name
            .toLocaleLowerCase()
            .startsWith(NodeNames.CuttersNames.Single.toLocaleLowerCase());
        }) !== undefined;

      console.log("\nisCutterImported ->", isCutterImported);
      if (isCutterImported) {
        // Do the getCutHead operation
        if (
          importedParsedObject.children.length === 1 &&
          importedParsedObject.children[0].name.toLocaleLowerCase() ===
            NodeNames.CuttersNames.Single.toLocaleLowerCase()
        )
          replaceCurrentHeadWithCutHead(
            this.splicingGroupGlobal,
            this.defaultOriginalHead,
            importedParsedObject
          );
        else
          console.warn(
            "Invalid cutter single model name ->",
            importedParsedObject.children[0].name
          );
        // Return the function immediately to prevent the cutter single model from being added to the splicing group
        return;
      }

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
       * !! REMOVE AND ADD THE IMPORTED MODEL TO THE SPlicing GROUP !!
       * Check if the imported object is hair or body by getting the name of the imported model single node.
       * if it is hair, remove the current hair model from the splicing group and add the new hair model to the splicing group if the splicing group has the corresponding model in it.
       * if it is body, it's the same logic as the hair.
       */
      const isHairImported = importedParsedObject.children[0].name
        .toLocaleLowerCase()
        .includes(NodeNames.HairNames.Hair.toLocaleLowerCase());
      console.log("\nisHair imported model ->", isHairImported);
      importedParsedObject.name = isHairImported ? "hairGrp" : "bodyGrp";
      console.log(
        "\nimportedParsedObject name set ->",
        importedParsedObject.name
      );

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
