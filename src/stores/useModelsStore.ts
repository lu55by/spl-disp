import { defineStore } from "pinia";
import * as THREE from "three/webgpu";
import { markRaw } from "vue";
import { modelService } from "../api/models";
import { ToastContents } from "../constants/index.ts";
import {
  CutHeadBoundingBoxHeight,
  CutHeadEyesNodeCombinedGroupName,
  getHeadModelPaths,
  ModelPaths,
  NodeNames,
  OBJLoaderInstance,
  type PhongMesh,
} from "../three/constants";
import { loadSTLFile } from "../three/loaders/ModelLoader.ts";
import { loadTexture } from "../three/loaders/TextureLoader";
import {
  adjustPivotPointsForMesh,
  applyDoubleSide,
  applyPBRMaterialAndSRGBColorSpace,
  applyTextures2LoadedHeadModelAsync,
  disposeAndRemoveCurrentCutHead,
  disposeHairBodyFromSplicingGroupGlobal,
  getObject3DHeight,
  removeAndAddModelWithModelHeight,
  removeAndAddModelWithNodeNames,
  replaceCurrentHeadWithCutHead,
} from "../three/meshOps/index.ts";
import { csgSubtract } from "../three/utils/csgCutHeadV3.ts";
import type { UploadModelInputFields } from "../types/index.ts";

/*
  Loaded Cutters Model
 */
export const LoadedCuttersModel: THREE.Group<THREE.Object3DEventMap> =
  await OBJLoaderInstance.loadAsync(
    ModelPaths.Cutters.OralSphereCylinderCombined,
  );

/*
  Sphere Cutter
 */
const SphereCutter = LoadedCuttersModel.getObjectByName(
  "cutting02",
) as THREE.Mesh;

/*
  Box3 instance for calculating the sph cut head height
 */
const SphCutHeadBox3 = new THREE.Box3();

/*
  Available Head Models
 */
export const AvailableHeadModels = {
  female: [
    { name: "女头模-01", subPath: "/default/prev" },
    { name: "女头模-02", subPath: "/default/new" },
    { name: "女头模-03", subPath: "/ellie01" },
    { name: "女头模-04", subPath: "/ukn02-issue01" },
  ],
  male: [
    { name: "男头模-01", subPath: "/isspd-01" },
    { name: "男头模-02", subPath: "/big-one-01" },
    { name: "男头模-03", subPath: "/sasha-01" },
    { name: "男头模-04", subPath: "/seki-01" },
    { name: "男头模-05", subPath: "/ukn-01" },
    { name: "男头模-06", subPath: "/ukn-02" },
    { name: "男头模-07", subPath: "/default" },
  ],
};

/*
  Head Models Cache
 */
const HeadModelsCache = new Map<string, THREE.Group<THREE.Object3DEventMap>>();

/**
 * Load and prepare a head model.
 * @param isFemale boolean
 * @param subPath string
 * @returns Promise<THREE.Group>
 */
const loadHeadModelAsync = async (isFemale: boolean, subPath?: string) => {
  const cacheKey = `${isFemale ? "female" : "male"}_${subPath || "default"}`;
  if (HeadModelsCache.has(cacheKey)) {
    return HeadModelsCache.get(cacheKey)!;
  }

  const paths = getHeadModelPaths(isFemale, subPath);
  const loadedHeadModel: THREE.Group<THREE.Object3DEventMap> =
    await OBJLoaderInstance.loadAsync(paths.Model);
  console.log(
    "\n -- loadHeadModelAsync -- loadedHeadModel ->",
    loadedHeadModel,
  );

  // Apply textures
  await applyTextures2LoadedHeadModelAsync(
    loadedHeadModel,
    isFemale,
    paths.Texture,
  );

  // THE ORIGINAL LOADED HEAD MODEL
  const headModel = loadedHeadModel;

  /*
    !!! DEBUG FOR NEW HEAD MODEL
   */
  // Set name
  // headModel.name =
  //   CutHeadEyesNodeCombinedGroupName + (isFemale ? "Female" : "Male");
  // // Cache it
  // HeadModelsCache.set(cacheKey, markRaw(headModel));
  // return markRaw(headModel);

  // Calculate the minYSphCutHead, maxYSphCutHead and sphCutHeadHeight and store it to the userData of the loadedHeadModel
  const headNode = (headModel.getObjectByName(NodeNames.HeadNames.Head) ||
    headModel.getObjectByName("CutHeadNode")) as THREE.Mesh;
  const sphCutHead = csgSubtract(
    headNode,
    SphereCutter,
    true,
    ["position"],
    null,
  );
  const sphCutHeadBoundingBox = SphCutHeadBox3.setFromObject(sphCutHead);
  const minYSphCutHead = sphCutHeadBoundingBox.min.y;
  const maxYSphCutHead = sphCutHeadBoundingBox.max.y;
  const sphCutHeadHeight = maxYSphCutHead - minYSphCutHead;

  loadedHeadModel.userData.minYSphCutHead = minYSphCutHead;
  loadedHeadModel.userData.maxYSphCutHead = maxYSphCutHead;
  loadedHeadModel.userData.sphCutHeadHeight = sphCutHeadHeight;

  // Get the eye nodes
  const eyeLNode = (headModel.getObjectByName(NodeNames.HeadNames.EyeL) ||
    headModel.getObjectByName("EyeLNode")) as THREE.Mesh;
  const eyeRNode = (headModel.getObjectByName(NodeNames.HeadNames.EyeR) ||
    headModel.getObjectByName("EyeRNode")) as THREE.Mesh;

  /*
    Apply PBR Material and SRGB Color Space
    Apply Double Side
    Adjust the Pivot Points of the Eye Nodes
   */
  applyPBRMaterialAndSRGBColorSpace(headModel, true);
  applyDoubleSide(headModel);
  adjustPivotPointsForMesh(eyeLNode);
  adjustPivotPointsForMesh(eyeRNode);

  // Set name
  headModel.name =
    CutHeadEyesNodeCombinedGroupName + (isFemale ? "Female" : "Male");

  // Cache it
  HeadModelsCache.set(cacheKey, markRaw(headModel));

  return markRaw(headModel);
};

/*
  Default Original Head Female
 */
const DefaultOriginalHeadFemale = await loadHeadModelAsync(true);

/*
  Default Original Head Male
 */
const DefaultOriginalHeadMale = await loadHeadModelAsync(false);
// !!! PROPS CHANGE TST FOR NEW HEAD MODEL
// DefaultOriginalHeadMale.position.y = 148.05;
// DefaultOriginalHeadMale.scale.setScalar(9.5);

/*
  Splicing Group
 */
const SplicingGroupGlobal = markRaw(
  new THREE.Group().add(DefaultOriginalHeadMale.clone()),
) as THREE.Group<THREE.Object3DEventMap>;
SplicingGroupGlobal.name = "SplicingGroupGlobal";

/**
 * Model Store
 */
export const useModelsStore = defineStore("models", {
  state: () => ({
    // Global Splicing Group
    splicingGroupGlobal: SplicingGroupGlobal,
    // Default Original Head
    defaultOriginalHead: DefaultOriginalHeadMale,
    // isDefaultHeadFemale state to toggle the gender of the default original head
    isDefaultHeadFemale: false,
    // Current Head Model SubPath
    currentHeadModelSubPath: AvailableHeadModels.male[0].subPath,
    // Splicing Group Length State
    splicingGroupLengthState: 1,
    // Drag and Drop Hovered Object
    dragHoveredObject: null as THREE.Mesh | null,
    // Selected Object by mouse click
    selectedObject: null as THREE.Object3D | null,
    // isShowMap state to toggle the uIsShowMap uniform (0 or 1) of the MeshStandardNodeMaterial
    isShowMap: true,
    // isUploadModalVisible state to toggle the visibility of the upload modal
    isUploadModalVisible: false,
    // isManualMorphGenerationMode state to toggle the manual morph generation mode
    isManualMorphGenerationMode: false,
    // manualMorphSelectionStage state to track the current selection stage (jaw, eyebrow, mouse)
    manualMorphSelectionStage: null as
      | "jaw"
      | "eyeBrow"
      | "mouseCornersWidth"
      | "zygomaticArchWidth"
      | null,
    // Manual tips vectors
    manualJawTipL: null as THREE.Vector3 | null,
    manualJawTipR: null as THREE.Vector3 | null,
    manualEyeBrowTipL: null as THREE.Vector3 | null,
    manualEyeBrowTipR: null as THREE.Vector3 | null,
    manualMouseCornerTipL: null as THREE.Vector3 | null,
    manualMouseCornerTipR: null as THREE.Vector3 | null,
    manualZygomaticArchTipL: null as THREE.Vector3 | null,
    manualZygomaticArchTipR: null as THREE.Vector3 | null,
    // manualMorphReadyTimestamp state to trigger the manual morph generation in SplicingModelsV2
    manualMorphReadyTimestamp: 0,
    // isMorphTargetReady state to trigger the SplicingModelsV2 to update the head node
    isMorphTargetReady: false,
  }),

  getters: {
    splicingGroupLen: (state): number => state.splicingGroupLengthState,
  },

  actions: {
    /**
     * Set the isMorphTargetReady state.
     * @param isReady The isMorphTargetReady state
     */
    setIsMorphTargetReady(isReady: boolean) {
      this.isMorphTargetReady = isReady;
    },

    /**
     * Set the default original head (shorthand for gender toggle).
     * @param isFemale The gender of the default original head
     */
    async setDefaultOriginalHead(isFemale: boolean) {
      const subPath = isFemale
        ? AvailableHeadModels.female[0].subPath
        : AvailableHeadModels.male[0].subPath;
      await this.setHeadModel(isFemale, subPath);
    },

    /**
     * Set the head model by gender and subpath.
     * @param isFemale boolean
     * @param subPath string
     */
    async setHeadModel(isFemale: boolean, subPath: string) {
      const headModel = await loadHeadModelAsync(isFemale, subPath);

      this.defaultOriginalHead = headModel;
      this.isDefaultHeadFemale = isFemale;
      this.currentHeadModelSubPath = subPath;

      disposeAndRemoveCurrentCutHead(this.splicingGroupGlobal);
      this.splicingGroupGlobal.add(this.defaultOriginalHead.clone());

      // Update state to trigger watchers
      this.syncSplicingGroupLength();
    },

    /**
     * Set the selected object by mouse click.
     * @param object The object being selected by mouse click
     */
    setSelectedObject(object: THREE.Object3D | null) {
      this.selectedObject = object ? markRaw(object) : null;
    },

    /**
     * Set the drag hovered object.
     * @param object The object being hovered
     */
    setDragHoveredObject(object: THREE.Mesh | null) {
      this.dragHoveredObject = object ? markRaw(object) : null;
    },

    /**
     * Apply texture to the currently hovered object.
     * @param texImgFile The image file to apply
     * @returns Promise<void>
     */
    async applyTextureToHoveredObject(texImgFile: File): Promise<void> {
      if (!this.dragHoveredObject) throw new Error("No hovered object found!");

      const texUrl = URL.createObjectURL(texImgFile);
      const texture = await loadTexture(texUrl);
      texture.colorSpace = THREE.SRGBColorSpace;

      // Ensure the object has a material that supports maps
      // Check if material has a map property
      if (
        !this.dragHoveredObject.material ||
        !("map" in this.dragHoveredObject.material)
      )
        throw new Error("Hovered object does not have a material!");

      let previousMap = (this.dragHoveredObject.material as any)
        .map as THREE.Texture;
      (this.dragHoveredObject.material as any).map = texture;
      (this.dragHoveredObject.material as any).needsUpdate = true;
      // Dispose the previous map
      previousMap?.dispose();
      previousMap = null;
    },

    /**
     * Bind the thumbnail to the hovered object in the userData.
     * @param thumbnailImgFile The thumbnail image file
     * @returns Promise<void>
     */
    async bindThumbnailToDragHoveredObject(
      thumbnailImgFile: File,
    ): Promise<void> {
      if (!this.dragHoveredObject) throw new Error("No hovered object found!");

      this.dragHoveredObject.userData.thumbnail = thumbnailImgFile;
    },

    /**
     * Bind the cutting model to the hovered object in the userData.
     * @param cuttingModelBlob The cutting model blob
     * @returns Promise<void>
     */
    async bindCuttingModelToDragHoveredObject(
      cuttingModelBlob: Blob,
    ): Promise<void> {
      if (!this.dragHoveredObject) throw new Error("No hovered object found!");

      this.dragHoveredObject.userData.cuttingModel = cuttingModelBlob;
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
        filteredSubGroups,
      );
      this.syncSplicingGroupLength();
    },

    /**
     * Import .obj file and texture file based on the height of the imported model.
     * @param files Files to import
     * @returns void
     */
    async importObjStlModelWithHeight(files: FileList) {
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
        // Set the texFile to null as the stlFile is not supporting uv texture mapping
        texFile = null;

        // Get the STL Mesh
        const stlMesh: THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshStandardNodeMaterial
        > = await loadSTLFile(stlFile);

        // !! REMOVE AND ADD THE IMPORTED MODEL TO THE Splicing GROUP !!

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
          isHair,
        );

        // Sync the splicing group length
        this.syncSplicingGroupLength();

        // Return if it is stl file
        return;
      }

      // ! OBJ File Import
      const text = await objFile.text();
      const importedParsedObj = markRaw(OBJLoaderInstance.parse(text));

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
       * !! REMOVE AND ADD THE IMPORTED MODEL TO THE Splicing GROUP !!
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
        isHairImported,
      );
      this.syncSplicingGroupLength();
    },

    /**
     * Import .obj file and texture file based on the node name validation.
     * @param files Files to import
     * @returns void
     */
    async importObjStlWithNodeNames(
      files: FileList,
      parsedObjGroupFromValidators?: THREE.Group<THREE.Object3DEventMap>,
    ): Promise<boolean> {
      // Log the files to import

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
        return false;
      }

      /**
       * ! STL File Import
       */
      if (stlFile) {
        // Set the texFile to null as the stlFile is not supporting uv texture mapping
        texFile = null;

        // Get the STL Mesh
        const stlMesh: THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshStandardNodeMaterial
        > = await loadSTLFile(stlFile);

        // !! REMOVE AND ADD THE IMPORTED MODEL TO THE SPlicing GROUP !!

        // Create a Group
        const stlModelGroup = new THREE.Group().add(stlMesh);

        // Cache the original stl file to userData for later upload reuse
        stlModelGroup.userData.originalModelFile = stlFile;
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
          isHair,
        );

        // Sync the splicing group length
        this.syncSplicingGroupLength();

        // Return if it is stl file
        return true;
      }

      /**
       * ! OBJ File Import
       */

      // Initialize the importedParsedObject first to the objGroupFromValidators
      let parsedObjGroup: THREE.Group<THREE.Object3DEventMap> | null =
        parsedObjGroupFromValidators;

      // If the objGroupFromValidators is null, which means the objGroupFromValidators is not passed from the validators, so we parse the .obj file text content with the OBJLoaderInstance
      if (!parsedObjGroup) {
        const text = await objFile.text();
        // Parse the .obj file text content with the OBJLoaderInstance
        parsedObjGroup = markRaw(OBJLoaderInstance.parse(text));
      } else {
        parsedObjGroup = markRaw(parsedObjGroup);
      }

      // Cache the original obj file to userData for later upload reuse
      parsedObjGroup.userData.originalModelFile = objFile;

      /**
       * Cutter Import
       */
      const isCutterImported =
        parsedObjGroup.children.find((child) => {
          return child.name
            .toLocaleLowerCase()
            .startsWith(NodeNames.CuttersNames.Single.toLocaleLowerCase());
        }) !== undefined;

      console.log("\nisCutterImported ->", isCutterImported);
      if (isCutterImported) {
        // Do the getCutHead operation
        if (
          parsedObjGroup.children.length === 1 &&
          parsedObjGroup.children[0].name.toLocaleLowerCase() ===
            NodeNames.CuttersNames.Single.toLocaleLowerCase()
        )
          replaceCurrentHeadWithCutHead(
            this.splicingGroupGlobal,
            this.defaultOriginalHead,
            parsedObjGroup,
          );
        else
          console.warn(
            "Invalid cutter single model name ->",
            parsedObjGroup.children[0].name,
          );

        // Return the function immediately to prevent the cutter single model from being added to the splicing group
        return true;
      }

      /**
       * Texture Import
       */
      if (texFile) {
        const texUrl = URL.createObjectURL(texFile);
        console.log("\ntexUrl ->", texUrl);
        const texture = await loadTexture(texUrl);
        // Retrieve the first node (child) of the object and apply the texture to it
        const node = parsedObjGroup.children[0] as THREE.Mesh<
          THREE.BufferGeometry,
          THREE.MeshPhongMaterial
        >;
        node.material.map = texture;
        node.material.needsUpdate = true;
      }
      // Apply PBR Material and SRGB Color Space
      applyPBRMaterialAndSRGBColorSpace(parsedObjGroup, true, {
        roughness: 0.4,
      });
      // Apply Double Side to the imported model
      applyDoubleSide(parsedObjGroup);

      /**
       * !! REMOVE AND ADD THE IMPORTED MODEL TO THE Splicing GROUP !!
       * Check if the imported object is hair or body by getting the name of the imported model first node.
       * if it is hair, remove the current hair model from the splicing group and add the new hair model to the splicing group if the splicing group has the corresponding model in it.
       * if it is body, it's the same logic as the hair.
       */
      const isHairImported = parsedObjGroup.children[0].name
        .toLocaleLowerCase()
        .includes(NodeNames.HairNames.Hair.toLocaleLowerCase());
      console.log("\nisHair imported model ->", isHairImported);
      parsedObjGroup.name = isHairImported ? "hairGrp" : "bodyGrp";
      console.log("\nimportedParsedObject name set ->", parsedObjGroup.name);

      // Call the removeAndAddModel fn to remove the current hair model from the splicing group and add the new hair model to the splicing group if the splicing group has the corresponding model in it.
      removeAndAddModelWithNodeNames(
        this.splicingGroupGlobal,
        parsedObjGroup,
        isHairImported,
      );
      this.syncSplicingGroupLength();
      return true;
    },

    /**
     * Export the splicing group to a .obj, .mtl and texture png files.
     * @returns Promise<boolean> - true if the export was successful, false otherwise
     */
    async exportSplicingModels(): Promise<boolean> {
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

    /**
     * Toggle the visibility of the upload modal.
     * @param visible The visibility of the upload modal
     */
    setUploadModalVisible(visible: boolean) {
      this.isUploadModalVisible = visible;
    },

    /**
     * Set the manual morph generation mode.
     * @param active boolean
     */
    setIsManualMorphGenerationMode(active: boolean) {
      this.isManualMorphGenerationMode = active;
      if (!active) {
        this.resetManualMorphTips();
      }
    },

    /**
     * Set the current manual morph selection stage.
     * @param stage 'jaw' | 'eyeBrow' | 'mouseCornersWidth' | 'zygomaticArchWidth' | null
     */
    setManualMorphSelectionStage(
      stage:
        | "jaw"
        | "eyeBrow"
        | "mouseCornersWidth"
        | "zygomaticArchWidth"
        | null,
    ) {
      this.manualMorphSelectionStage = stage;
    },

    /**
     * Set the manual tips for a specific stage.
     * @param stage 'jaw' | 'eyeBrow' | 'mouseCornersWidth' | 'zygomaticArchWidth'
     * @param pointL THREE.Vector3
     * @param pointR THREE.Vector3
     */
    setManualMorphTips(
      stage: "jaw" | "eyeBrow" | "mouseCornersWidth" | "zygomaticArchWidth",
      pointL: THREE.Vector3,
      pointR: THREE.Vector3,
    ) {
      if (stage === "jaw") {
        this.manualJawTipL = pointL;
        this.manualJawTipR = pointR;
      } else if (stage === "eyeBrow") {
        this.manualEyeBrowTipL = pointL;
        this.manualEyeBrowTipR = pointR;
      } else if (stage === "mouseCornersWidth") {
        this.manualMouseCornerTipL = pointL;
        this.manualMouseCornerTipR = pointR;
      } else if (stage === "zygomaticArchWidth") {
        this.manualZygomaticArchTipL = pointL;
        this.manualZygomaticArchTipR = pointR;
      }
    },

    /**
     * Reset all manual morph tips and selection stage.
     */
    resetManualMorphTips() {
      this.manualMorphSelectionStage = null;
      this.manualJawTipL = null;
      this.manualJawTipR = null;
      this.manualEyeBrowTipL = null;
      this.manualEyeBrowTipR = null;
      this.manualMouseCornerTipL = null;
      this.manualMouseCornerTipR = null;
      this.manualZygomaticArchTipL = null;
      this.manualZygomaticArchTipR = null;
    },

    /**
     * Upload the selected object to the database (either a hair or body).
     * @param outfitType The outfit type for the uploaded model
     */
    async uploadSelectedObject(
      outfitType: "Default" | "Normal Outfit" | "IP Outfit",
      uploadModelInputFields: UploadModelInputFields,
    ): Promise<boolean> {
      if (!this.selectedObject) {
        console.warn("No object selected for upload.");
        return false;
      }

      // Make sure the name is not empty
      if (!uploadModelInputFields.name.length)
        throw new Error(ToastContents.UploadModelNameRequiredZH);

      console.log(
        "-- uploadSelectedObject -- selected object to be uploaded ->",
        this.selectedObject,
      );

      // 1. Get the model blob. Reuse the original file if it exists to preserve optimization and reduce size.
      const { mapTexToBlob } = await import("../three/exporters");
      let modelBlob: Blob | File | null =
        this.selectedObject.userData.originalModelFile;

      if (!modelBlob) {
        const { exportObjectToBlob } = await import("../three/exporters");
        modelBlob = exportObjectToBlob(this.selectedObject);
      } else {
      }

      console.log("\n3D Object Blob (mold) ->", modelBlob);

      // Get the first model node
      const firstModelNode = this.selectedObject.children[0] as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshStandardNodeMaterial
      >;

      /*
        Distinguish the model type (hair or body) by the name of the first node of the selectedObject and send the proper boolean param of the second argument to the uploadModel function.
       */
      const isHairSelected = this.selectedObject.children[0].name
        .toLocaleLowerCase()
        .includes(NodeNames.HairNames.Hair.toLocaleLowerCase());
      // return;

      // 2. Prepare Form Data with the Blob and the outfitType
      const formData = new FormData();

      /*
        Request fields
       */
      // 1. name
      formData.append("name", uploadModelInputFields.name);

      // 2. description (user input maybe?)
      formData.append("description", uploadModelInputFields.description);

      // 3. sex (user input maybe?)
      formData.append("sex", uploadModelInputFields.sex);

      // 4. is_default (user input maybe?)
      formData.append("is_default", uploadModelInputFields.is_default);

      // 5. mold (the modelBlob)
      formData.append(
        "mold",
        modelBlob,
        `${this.selectedObject.name || "model"}.obj`,
      );
      console.log(
        `\nForm Data of ${firstModelNode.name} model (mold) attached!`,
      );

      // 6. map (the textureBlob)
      const firstModelNodeMat = firstModelNode.material;
      // map property validation
      if (!firstModelNodeMat.map)
        throw new Error(ToastContents.UploadModelMapTexNotFoundZH);
      // Get the map texture blob
      const mapTexBlob = await mapTexToBlob(firstModelNodeMat.map);
      formData.append("map", mapTexBlob, `${firstModelNode.name}_texture.png`);
      console.log(`\nForm Data of ${firstModelNode.name} map attached!`);

      // 7. thumbnail (the thumbnailBlob)
      // Get the binded thumbnail blob from the userData of the firstModelNode
      const userDataThumbnail = firstModelNode.userData.thumbnail;
      // thumbnail validation
      if (!userDataThumbnail)
        throw new Error(ToastContents.UploadModelThumbNotBoundZH);
      // Append the thumbnail from the userData to the formData as it is a file already
      formData.append(
        "thumbnail",
        userDataThumbnail,
        `${firstModelNode.name}_thumbnail.png`,
      );
      console.log(`\nForm Data of ${firstModelNode.name} thumbnail attached!`);

      // 8. cutting_model (the cuttingModelBlob)
      if (!isHairSelected) {
        const cutterSingleBlob = firstModelNode.userData.cuttingModel;
        // cutting_model validation
        // if (!cutterSingleBlob)
        //   throw new Error(ToastContents.UploadModelCuttingModelNotBoundZH);
        if (cutterSingleBlob) {
          // Append the cutting_model from the userData to the formData as it is a file already
          formData.append(
            "cutting_model",
            cutterSingleBlob,
            `${firstModelNode.name}_cutter_single_model.obj`,
          );
        }
        console.log(
          `\nForm Data of ${firstModelNode.name} cutting_model attached!`,
        );
      }

      // ! Deactivate the outfitType for now
      // formData.append("outfitType", outfitType);

      // Fixed: The OBJ file size was large due to de-indexed geometry and high floating-point precision.
      // Optimized during export in three/exporters/index.ts.
      console.log("\nForm Data entry value of mold ->", formData.get("mold"));
      console.log("\nForm Data entry value of map ->", formData.get("map"));
      console.log(
        "\nForm Data entry value of thumbnail ->",
        formData.get("thumbnail"),
      );
      console.log(
        "\nForm Data entry value of cutting_model ->",
        formData.get("cutting_model"),
      );
      // return true;

      // 3. Send a POST request to the backend API

      /*
        Refactored: Request to the backend API with the new modelService
      */
      try {
        console.log(
          `Uploading model ${this.selectedObject.name} to the backend...`,
        );
        const response = await modelService.uploadModel(
          formData,
          isHairSelected,
          (progress) => {
            console.log(
              `\nModel ${this.selectedObject.name} Upload progress -> ${progress}%`,
            );
          },
        );

        const resCode: number = response.data.code;

        if (resCode === 200) {
          console.log(
            `\nModel ${this.selectedObject.name} Upload successful! Response data ->`,
            response.data,
          );
          this.setUploadModalVisible(false);
          return true;
        } else {
          console.error(
            `\nError during model ${this.selectedObject.name} upload process ->`,
            response.data,
          );
          return false;
        }
      } catch (error) {
        console.error(
          `\nError during model ${this.selectedObject.name} upload process ->`,
          error,
        );
        return false;
      }
    },
  },
});
