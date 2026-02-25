<template>
  <div class="relative h-full w-full overflow-hidden">
    <canvas class="h-full w-full" ref="canvasEle"></canvas>

    <!-- Futuristic Export Button -->
    <div class="fixed top-10 left-10 z-100 flex flex-col items-end gap-4">
      <button @click="handleExport" class="futuristic-export-btn">
        <div class="btn-content">
          <span class="btn-glitch-text" data-text="EXPORT_MODEL">EXPORT_MODEL</span>
          <div class="btn-decor-line"></div>
        </div>
        <div class="btn-corner top-left"></div>
        <div class="btn-corner bottom-right"></div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AxesHelper } from "three";
import { type Brush } from "three-bvh-csg";
import { UltraHDRLoader } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Inspector } from "three/examples/jsm/inspector/Inspector.js";
import {
  color,
  HALF_PI,
  mx_rotate2d,
  positionLocal,
  sin,
  time,
  vec3,
} from "three/tsl";
import * as THREE from "three/webgpu";
import type { Pane } from "tweakpane";
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  LoadedCuttersModel,
  useModelsStore,
} from "../../stores/useModelsStore";
import {
  CameraProps,
  CutHeadEyesNodeCombinedGroupName,
  DefaultHeadFeMaleSubPath,
  DefaultHeadMaleSubPath,
  HDRPath,
  ModelPaths,
  NodeNames,
  OBJLoaderInstance,
  STLLoaderInstance,
  type CutHeadInspectorDebugProps,
  type PhongMesh,
  type StandardMesh,
} from "../../three/constants";
import { csgSubtract } from "../../three/csg";
import {
  exportObjectToOBJ,
  exportSplicingGroup,
} from "../../three/exporters";
import { addTransformDebug, addTransformDebugInspector } from "../../three/gui";
import { GUIGlobal } from "../../three/gui/global";
import { loadObj } from "../../three/loaders/ModelLoader";
import { loadTexture } from "../../three/loaders/TextureLoader";
import { GlobalLoadingManager } from "../../three/managers/GlobalLoadingManager";
import {
  applyDebugTransformation,
  applyDoubleSide,
  applyPBRMaterialAndSRGBColorSpace,
  applyTextures2LoadedHeadModelAsync,
  combineMeshesToGroup,
  generateFacialMorphs,
  generateFacialMorphsTst,
  modifyNewVerticesUv,
  scaleGroupToHeight,
} from "../../three/meshOps";
import { getCutHeadV3, getCutHeadV4 } from "../../three/utils/csgCutHead";
import { getCutHead } from "../../three/utils/csgCutHeadV3";

// Canvas Element
const canvasEle = ref<HTMLCanvasElement | null>(null);

// Reference for the head model to be exported
const headModelRef = ref<THREE.Group | null>(null);

/**
 * Handles the export of the splicing group (Head Model)
 */
const handleExport = async () => {
  if (headModelRef.value) {
    console.log(
      "\n -- handleExport -- preparing to export splicing group ->",
      headModelRef.value,
    );
    // Export the group with textures bundled in a ZIP
    await exportSplicingGroup(headModelRef.value);
  } else {
    console.warn(
      "\n -- handleExport -- headModel is not loaded yet ->",
      headModelRef.value,
    );
  }
};

const { splicingGroupGlobal: globalGroup } = useModelsStore();
console.log("Global Group ->", globalGroup);

let camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGPURenderer,
  controls: OrbitControls,
  // clock: THREE.Clock,
  gui: Pane;

const width = window.innerWidth;
const height = window.innerHeight;

// Init scene fn
const init = async () => {
  // const width = canvasEle.value!.clientWidth
  // const height = canvasEle.value!.clientHeight

  /**
   * Camera
   */
  camera = new THREE.PerspectiveCamera(
    CameraProps.Fov,
    width / height,
    CameraProps.Near,
    CameraProps.Far,
  );
  camera.position.set(
    CameraProps.PosNormal.x,
    CameraProps.PosNormal.y,
    CameraProps.PosNormal.z,
  );
  // addTransformDebug("Camera", gui, camera);

  /**
   * Scene
   */
  scene = new THREE.Scene();

  /**
   * Clock
   */
  // clock = new THREE.Clock();

  /**
   * Renderer
   */
  renderer = new THREE.WebGPURenderer({
    canvas: canvasEle.value!,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setAnimationLoop(animate);
  // renderer.setClearColor("#000", 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.inspector = new Inspector();
  console.log(
    "\nWebGPU Renderer getMaxAnisotropy() -> ",
    renderer.getMaxAnisotropy(),
  );

  /**
   * GUI
   */
  gui = GUIGlobal;
  gui.hidden = true;
  const guiInspector = (renderer.inspector as Inspector).createParameters(
    "Settings",
  );
  const guiInspectorFolderCutHead = guiInspector.addFolder("Cut Head");

  /**
   * Lights
   */
  // const ambientLight = new THREE.AmbientLight("#fff", 3);
  // scene.add(ambientLight);

  // const directionalLight = new THREE.DirectionalLight("#fff", 2);
  // directionalLight.position.set(4, 3, 1);
  // scene.add(directionalLight);

  /**
   * Controls
   */
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  // controls.minDistance = .1
  // controls.maxDistance = 50

  /**
   * Axes Helper
   */
  scene.add(new AxesHelper(20));

  /**
   * Load Hdr
   */
  const ultraHDRLoader = new UltraHDRLoader(GlobalLoadingManager);
  ultraHDRLoader.setDataType(THREE.FloatType);

  const loadEnvironment = () => {
    ultraHDRLoader.setDataType(THREE.HalfFloatType);

    ultraHDRLoader.load(HDRPath, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.needsUpdate = true;

      // scene.background = texture;
      scene.environment = texture;
    });
  };

  loadEnvironment();

  /*
    Load Models
  */

  // Add the global group
  // scene.add(globalGroup);

  // Test Fns
  const loadHairTst = async () => {
    const loadedHairModel: THREE.Object3D = await loadObj(
      ModelPaths.Hair.Model,
    );
    // console.log('loadedHairModel -> ', loadedHairModel);
    const hairTex = await loadTexture(ModelPaths.Hair.Texture.ColorTex);
    // console.log('hairTex -> ', hairTex);
    // Map the texture
    loadedHairModel.traverse((m) => {
      if (m instanceof THREE.Mesh) m.material.map = hairTex;
    });
    scene.add(loadedHairModel);
  };

  const loadHeadTst = async () => {
    const loadedFemaleHeadModel: THREE.Object3D = await loadObj(
      ModelPaths.HeadFemale.Model,
    );
    const loadedMaleHeadModel: THREE.Object3D = await loadObj(
      ModelPaths.HeadMale.Model,
    );
    const loadedCuttersModel: THREE.Object3D = await loadObj(
      ModelPaths.Cutters.OralSphereCylinderCombined,
    );

    // Load Textures

    // Female
    const headFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.HeadColTex,
    );
    const teethFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.TeethColTex,
    );
    const eyeLFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.EyeLColTex,
    );
    const eyeRFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.EyeRColTex,
    );

    // Male
    const headMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.HeadColTex,
    );
    const eyeLMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.EyeLColTex,
    );
    const eyeRMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.EyeRColTex,
    );

    // Retrieve Nodes

    // Female
    const headFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Head,
    ) as PhongMesh;
    const teethFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Teeth,
    ) as PhongMesh;
    const eyeLFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL,
    ) as PhongMesh;
    const eyeRFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR,
    ) as PhongMesh;

    // Male
    const headMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Head,
    ) as PhongMesh;
    const eyeLMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL,
    ) as PhongMesh;
    const eyeRMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR,
    ) as PhongMesh;

    // Cutters
    // Sphere Cutter
    const sphereCutterNode = loadedCuttersModel.getObjectByName(
      NodeNames.CuttersNames.Sphere,
    ) as PhongMesh;
    // sphereCutterNode.position.y -= 1;
    // sphereCutterNode.updateMatrixWorld(true);
    // sphereCutterNode.geometry.applyMatrix4(sphereCutterNode.matrixWorld);

    // Cylinder Cutter
    const cylinderCutterNode = loadedCuttersModel.getObjectByName(
      NodeNames.CuttersNames.Cylinder,
    ) as PhongMesh;

    // Map the texture

    // Female
    headFemaleNode.material.map = headFemaleColTex;
    teethFemaleNode.material.map = teethFemaleColTex;
    eyeLFemaleNode.material.map = eyeLFemaleColTex;
    eyeRFemaleNode.material.map = eyeRFemaleColTex;

    // Male
    headMaleNode.material.map = headMaleColTex;
    eyeLMaleNode.material.map = eyeLMaleColTex;
    eyeRMaleNode.material.map = eyeRMaleColTex;

    // loadedFemaleHeadModel.scale.setScalar(HeadScalar);
    // loadedFemaleHeadModel.position.set(4, -150, 0);
    // scene.add(loadedFemaleHeadModel);
    // addTransformDebug('Head', gui, loadedFemaleHeadModel, {showScale: true});

    // console.log('cuttersModel -> ', cuttersModel);
    // addTransformDebug('Cutters', gui, cuttersModel, {showScale: true});
    // cuttersModel.position.set(CutHeadDebugProps.Pos.x, CutHeadDebugProps.Pos.y, CutHeadDebugProps.Pos.z);
    // cuttersModel.scale.setScalar(CutHeadDebugProps.Scalar);
    // applyMaterialWireframe(cuttersModel, Colors.Cyan);
    // scene.add(cuttersModel);

    // Try to cut the head node first

    let cutHead: Brush | PhongMesh;
    // cutHead = headFemaleNode;
    // cutHead = headMaleNode;
    cutHead = csgSubtract(headMaleNode, sphereCutterNode, false);
    modifyNewVerticesUv(headFemaleNode, cutHead, 0, 0.07033);

    cutHead = csgSubtract(cutHead, cylinderCutterNode, false);
    modifyNewVerticesUv(headFemaleNode, cutHead, 0.11, 0);
    console.log("cutHead -> ", cutHead);

    // Cloned Cut Head to compare
    // const cutHeadGeoClone = cutHead.geometry.clone();
    // const cutHeadClone = new THREE.Mesh(cutHeadGeoClone, cutHead.material);
    // applyDebugTransformation(cutHeadClone, new Vector3(-.4, 0, 0));
    // addTransformDebug('CutHeadClone', gui, cutHeadClone, {showScale: true});
    // scene.add(cutHeadClone);

    // cutHead.material.wireframe = true;
    applyDebugTransformation(cutHead);
    applyDebugTransformation(eyeLMaleNode);
    applyDebugTransformation(eyeRMaleNode);

    // scene.add(cutHead);
    scene.add(cutHead, eyeLMaleNode, eyeRMaleNode);
    addTransformDebug("CutHead", gui, cutHead, { showScale: true });
  };

  const loadExportHeadTst = async () => {
    const loadedFemaleHeadModel: THREE.Object3D = await loadObj(
      ModelPaths.HeadFemale.Model,
    );
    console.log("loadedFemaleHeadModel ->", loadedFemaleHeadModel);
    const loadedMaleHeadModel: THREE.Object3D = await loadObj(
      ModelPaths.HeadMale.Model,
    );
    const loadedCuttersModel: THREE.Object3D = await loadObj(
      ModelPaths.Cutters.OralSphereCylinderCombined,
    );

    // Load Textures

    // Female
    const headFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.HeadColTex,
    );
    const teethFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.TeethColTex,
    );
    const eyeLFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.EyeLColTex,
    );
    const eyeRFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.EyeRColTex,
    );

    // Male
    const headMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.HeadColTex,
    );
    const eyeLMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.EyeLColTex,
    );
    const eyeRMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.EyeRColTex,
    );

    // Retrieve Nodes

    // Female
    const headFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Head,
    ) as PhongMesh;
    const teethFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Teeth,
    ) as PhongMesh;
    const eyeLFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL,
    ) as PhongMesh;
    const eyeRFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR,
    ) as PhongMesh;

    // Male
    const headMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Head,
    ) as PhongMesh;
    const eyeLMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL,
    ) as PhongMesh;
    const eyeRMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR,
    ) as PhongMesh;

    // Cutters
    // Sphere Cutter
    const sphereCutterNode = loadedCuttersModel.getObjectByName(
      NodeNames.CuttersNames.Sphere,
    ) as PhongMesh;
    // sphereCutterNode.position.y -= 1;
    // sphereCutterNode.updateMatrixWorld(true);
    // sphereCutterNode.geometry.applyMatrix4(sphereCutterNode.matrixWorld);

    // Cylinder Cutter
    const cylinderCutterNode = loadedCuttersModel.getObjectByName(
      NodeNames.CuttersNames.Cylinder,
    ) as PhongMesh;

    // Map the texture

    // Female
    headFemaleNode.material.map = headFemaleColTex;
    teethFemaleNode.material.map = teethFemaleColTex;
    eyeLFemaleNode.material.map = eyeLFemaleColTex;
    eyeRFemaleNode.material.map = eyeRFemaleColTex;

    // Male
    headMaleNode.material.map = headMaleColTex;
    eyeLMaleNode.material.map = eyeLMaleColTex;
    eyeRMaleNode.material.map = eyeRMaleColTex;

    // loadedFemaleHeadModel.scale.setScalar(HeadScalar);
    // loadedFemaleHeadModel.position.set(4, -150, 0);
    // scene.add(loadedFemaleHeadModel);
    // addTransformDebug('Head', gui, loadedFemaleHeadModel, {showScale: true});

    // console.log('cuttersModel -> ', cuttersModel);
    // addTransformDebug('Cutters', gui, cuttersModel, {showScale: true});
    // cuttersModel.position.set(CutHeadDebugProps.Pos.x, CutHeadDebugProps.Pos.y, CutHeadDebugProps.Pos.z);
    // cuttersModel.scale.setScalar(CutHeadDebugProps.Scalar);
    // applyMaterialWireframe(cuttersModel, Colors.Cyan);
    // scene.add(cuttersModel);

    // Try to cut the head node first

    let cutHead: Brush | PhongMesh;
    // cutHead = headFemaleNode;
    // cutHead = headMaleNode;
    cutHead = csgSubtract(headMaleNode, sphereCutterNode, false);
    modifyNewVerticesUv(headFemaleNode, cutHead, 0, 0.07033);

    cutHead = csgSubtract(cutHead, cylinderCutterNode, false);
    modifyNewVerticesUv(headFemaleNode, cutHead, 0.11, 0);
    console.log("cutHead -> ", cutHead);

    // Cloned Cut Head to compare
    // const cutHeadGeoClone = cutHead.geometry.clone();
    // const cutHeadClone = new THREE.Mesh(cutHeadGeoClone, cutHead.material);
    // applyDebugTransformation(cutHeadClone, new Vector3(-.4, 0, 0));
    // addTransformDebug('CutHeadClone', gui, cutHeadClone, {showScale: true});
    // scene.add(cutHeadClone);

    // cutHead.material.wireframe = true;
    // applyDebugTransformation(cutHead);
    // applyDebugTransformation(eyeLMaleNode);
    // applyDebugTransformation(eyeRMaleNode);

    // scene.add(cutHead);
    // scene.add(cutHead, eyeLMaleNode, eyeRMaleNode);
    addTransformDebug("CutHead", gui, cutHead, { showScale: true });

    // Combine meshes to be exported
    // const combinedCutHead2Export = combineMeshes([cutHead, eyeLMaleNode, eyeRMaleNode]);
    // applyDebugTransformation(combinedCutHead2Export);
    // camera.lookAt(combinedCutHead2Export.position);
    // camera.updateMatrixWorld();

    const combinedCutHeadEyesGrp: THREE.Group = combineMeshesToGroup(
      CutHeadEyesNodeCombinedGroupName,
      cutHead,
      eyeLMaleNode,
      eyeRMaleNode,
    );
    console.log("combinedCutHead2Export ->", combinedCutHeadEyesGrp);
    scene.add(combinedCutHeadEyesGrp);
    scaleGroupToHeight(combinedCutHeadEyesGrp);
    // applyDebugTransformation(combinedCutHeadEyesGrp);

    /*
     Exporter
   */
    const exporter = document.querySelector(".exporter");
    // console.log('exporter ele ->', exporter);
    exporter!.addEventListener("click", (e) => {
      e.preventDefault();
      // if (cutHead.isBrush) {
      if (combinedCutHeadEyesGrp.isGroup) {
        // const exportedMesh = exportMeshToOBJ(cutHead);
        // console.log('exportedMesh geometry -> ', getAttributes(exportedMesh));
        // console.log('exportedMesh geometry position -> ', exportedMesh.geometry.attributes.position);
        // console.log('exportedMesh material -> ', exportedMesh.material);
        exportObjectToOBJ(combinedCutHeadEyesGrp);
      }
    });
  };

  const csgCutHeadFnTst = async (
    modelSubPath: string,
    isFamele: boolean = false,
    debugPosOffset: THREE.Vector3 = new THREE.Vector3(),
  ) => {
    const isModelFeMale = isFamele;

    // Head Model Path
    let headModelPath = isModelFeMale
      ? ModelPaths.HeadFemale.Model
      : ModelPaths.HeadMale.Model;
    // const headModelPath = modelPath;
    const subPath2Search = isModelFeMale
      ? DefaultHeadFeMaleSubPath
      : DefaultHeadMaleSubPath;
    headModelPath = headModelPath.replace(subPath2Search, modelSubPath);

    console.log("headModelPath ->", headModelPath);

    // Head mtl Path
    // const headMtlPath = isModelFeMale ? ModelPaths.HeadFemale.MTLPath : undefined;
    const headMtlPath = undefined;

    const loadedHeadModel: THREE.Object3D = await loadObj(headModelPath, {
      mtlPath: headMtlPath,
    });
    loadedHeadModel.name = "female";
    console.log("loadedHeadModel -> ", loadedHeadModel);
    // return;

    // const headNode = loadedHeadModel.children[0] as PhongMesh;
    const headNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.Head,
    ) as PhongMesh;
    const eyeLNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL,
    ) as PhongMesh;
    const eyeRNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR,
    ) as PhongMesh;

    const applyTexture = async (): Promise<void> => {
      const headColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const eyeLColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const eyeRColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const headColTex = await loadTexture(headColTexPath);
      const eyeLColTex = await loadTexture(eyeLColTexPath);
      const eyeRColTex = await loadTexture(eyeRColTexPath);

      headNode.material.map = headColTex;
      eyeLNode.material.map = eyeLColTex;
      eyeRNode.material.map = eyeRColTex;
    };
    await applyTexture();

    const cutHead = await getCutHeadV3(
      loadedHeadModel,
      LoadedCuttersModel,
      isModelFeMale,
    );
    applyDebugTransformation(cutHead, debugPosOffset);
    applyPBRMaterialAndSRGBColorSpace(cutHead, true);
    // applyMaterialWireframe(cutHead, Colors.Yellow);
    scene.add(cutHead);
  };

  const csgCutHeadFnTstV2 = async (
    modelSubPath: string,
    isFamele: boolean = false,
    debugPosOffset: THREE.Vector3 = new THREE.Vector3(),
  ) => {
    const isModelFeMale = isFamele;

    // Head Model Path
    let headModelPath = isModelFeMale
      ? ModelPaths.HeadFemale.Model
      : ModelPaths.HeadMale.Model;
    // const headModelPath = modelPath;
    const subPath2Search = isModelFeMale
      ? DefaultHeadFeMaleSubPath
      : DefaultHeadMaleSubPath;
    headModelPath = headModelPath.replace(subPath2Search, modelSubPath);

    console.log("headModelPath ->", headModelPath);

    // Head mtl Path
    // const headMtlPath = isModelFeMale ? ModelPaths.HeadFemale.MTLPath : undefined;
    const headMtlPath = undefined;

    const loadedHeadModel: THREE.Object3D = await loadObj(headModelPath, {
      mtlPath: headMtlPath,
    });
    loadedHeadModel.name = "female";
    console.log("loadedHeadModel -> ", loadedHeadModel);
    // return;

    // const headNode = loadedHeadModel.children[0] as PhongMesh;
    const headNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.Head,
    ) as PhongMesh;
    const eyeLNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL,
    ) as PhongMesh;
    const eyeRNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR,
    ) as PhongMesh;

    const applyTexture = async (): Promise<void> => {
      const headColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const eyeLColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const eyeRColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const headColTex = await loadTexture(headColTexPath);
      const eyeLColTex = await loadTexture(eyeLColTexPath);
      const eyeRColTex = await loadTexture(eyeRColTexPath);

      headNode.material.map = headColTex;
      eyeLNode.material.map = eyeLColTex;
      eyeRNode.material.map = eyeRColTex;
    };
    await applyTexture();

    const cutHead = await getCutHeadV4(loadedHeadModel, LoadedCuttersModel);
    applyDebugTransformation(cutHead, debugPosOffset);
    applyPBRMaterialAndSRGBColorSpace(cutHead, true);
    applyDoubleSide(cutHead);
    console.log("\n cutHead ->", cutHead);
    // applyMaterialWireframe(cutHead, Colors.White);
    scene.add(cutHead);
  };

  const csgCutHeadFnTstV3 = async (
    modelSubPath: string,
    isFamele: boolean = false,
    debugPosOffset: THREE.Vector3 = new THREE.Vector3(),
  ): Promise<THREE.Group<THREE.Object3DEventMap>> => {
    const isModelFeMale = isFamele;

    // Head Model Path
    let headModelPath = isModelFeMale
      ? ModelPaths.HeadFemale.Model
      : ModelPaths.HeadMale.Model;
    // const headModelPath = modelPath;
    const subPath2Search = isModelFeMale
      ? DefaultHeadFeMaleSubPath
      : DefaultHeadMaleSubPath;
    headModelPath = headModelPath.replace(subPath2Search, modelSubPath);

    console.log("headModelPath ->", headModelPath);

    // Head mtl Path
    // const headMtlPath = isModelFeMale ? ModelPaths.HeadFemale.MTLPath : undefined;
    const headMtlPath = undefined;

    const loadedHeadModel: THREE.Group = await loadObj(headModelPath, {
      mtlPath: headMtlPath,
    });
    loadedHeadModel.name = "female";
    console.log("loadedHeadModel -> ", loadedHeadModel);
    // return;

    // const headNode = loadedHeadModel.children[0] as PhongMesh;
    const headNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.Head,
    ) as PhongMesh;
    const eyeLNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL,
    ) as PhongMesh;
    const eyeRNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR,
    ) as PhongMesh;

    const applyTexture = async (): Promise<void> => {
      const headColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const eyeLColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const eyeRColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath,
          )
        : ModelPaths.HeadMale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath,
          );
      const headColTex = await loadTexture(headColTexPath);
      const eyeLColTex = await loadTexture(eyeLColTexPath);
      const eyeRColTex = await loadTexture(eyeRColTexPath);

      headNode.material.map = headColTex;
      eyeLNode.material.map = eyeLColTex;
      eyeRNode.material.map = eyeRColTex;
    };
    await applyTexture();

    const cutHead = await getCutHead(loadedHeadModel, LoadedCuttersModel);
    applyDebugTransformation(cutHead, debugPosOffset);
    applyPBRMaterialAndSRGBColorSpace(cutHead, true);
    applyDoubleSide(cutHead);
    console.log("\n -- csgCutHeadFnTstV3 -- cutHead ->", cutHead);
    // applyMaterialWireframe(cutHead, Colors.White);
    scene.add(cutHead);
    return cutHead;
  };

  const loadMultipleCutHeads = async () => {
    /**
     * Load multiple heads
     */
    const baseOffsetX = -0.35;

    // Create a THREE.Group to store the loaded heads
    // const headsGroup = new THREE.Group();

    const headMale2CutPaths = [
      // Male Heads
      "/big-one-01",
      "/isspd-01",
      "/sasha-01",
      "/ukn-01",
      // Female Heads
      "/default/prev",
      "/ellie01",
      "/ukn01-issue01",
      "/ukn02-issue01",
    ];
    const femaleHeadStartIdx = 4;
    let isFemale: boolean;

    // boundingBox arr of the cut head
    let cutHeadBoundingBoxArr: { headPath: string; boundingBox: THREE.Box3 }[] =
      [];

    for (let i = 0; i < headMale2CutPaths.length; i++) {
      isFemale = i >= femaleHeadStartIdx;
      const headPath = headMale2CutPaths[i];
      const cutHead = await csgCutHeadFnTstV3(
        headPath,
        isFemale,
        new THREE.Vector3(
          baseOffsetX + (isFemale ? i - femaleHeadStartIdx : i) * 0.3,
          0,
          isFemale ? 0.3 : 0,
        ),
      );
      console.log(
        `\n -- loadMultipleCutHeads -- cutHead of [${headPath}] ->`,
        cutHead,
      );

      // Log the bounding box of each CutHeadNode
      const cutHeadNode = cutHead.getObjectByName("CutHeadNode") as THREE.Mesh;
      console.log(
        `\n -- loadMultipleCutHeads -- cutHeadNode of [${headPath}] ->`,
        cutHeadNode,
      );
      if (cutHeadNode.geometry.boundingBox) {
        console.log(
          `\n -- loadMultipleCutHeads -- cutHeadNode.boundingBox of [${headPath}] ->`,
          cutHeadNode.geometry.boundingBox,
        );
        cutHeadBoundingBoxArr.push({
          headPath,
          boundingBox: cutHeadNode.geometry.boundingBox,
        });
      } else {
        // Compute the bounding box and log it
        cutHeadNode.geometry.computeBoundingBox();
        console.log(
          `\n -- loadMultipleCutHeads -- cutHeadNode.boundingBox of [${headPath}] ->`,
          cutHeadNode.geometry.boundingBox,
        );
        cutHeadBoundingBoxArr.push({
          headPath,
          boundingBox: cutHeadNode.geometry.boundingBox,
        });
      }

      /*
        Wireframe set working at this point only when the wireframe is set to true in the material
       */
      const debugPropsCutHead = {
        // color: "#fff",
        color: (cutHead.children[0] as StandardMesh).material.color,
        isShowMap: true,
        isShowWireframe: false,
        progressBaseColAndTex: 1,
        isShowMapPower: 1,
      } as CutHeadInspectorDebugProps;
      cutHead.children.forEach((child) => {
        if (child instanceof THREE.Mesh && "wireframe" in child.material) {
          child.material.wireframe = debugPropsCutHead.isShowWireframe;
        }
      });

      /*
        GUI
       */
      const cutHeadFolder = guiInspectorFolderCutHead.addFolder(headPath);
      addTransformDebugInspector(cutHeadFolder, cutHead, debugPropsCutHead);
    }

    /*
      Log the height of each cut head beased on the bounding box
     */
    // Sum height of normal heads to calculate the average height
    let sumHeightNormal = 0;
    // Minimum height of normal heads
    let minHeightNormal = Infinity;
    // Minimum height normal head path
    let minHeightNormalHeadPath = "";
    for (let i = 0; i < cutHeadBoundingBoxArr.length; i++) {
      const isNormalHead = i < cutHeadBoundingBoxArr.length - 2;
      const { headPath, boundingBox } = cutHeadBoundingBoxArr[i];
      const height = boundingBox.max.y - boundingBox.min.y;
      if (isNormalHead) sumHeightNormal += height;
      if (isNormalHead && height < minHeightNormal) {
        minHeightNormal = height;
        minHeightNormalHeadPath = headPath;
      }
      console.log(
        `\n -- loadMultipleCutHeads -- height of [${headPath}] ->`,
        height,
      );
    }
    const averageHeightNormal =
      sumHeightNormal / (cutHeadBoundingBoxArr.length - 2);
    console.log(
      `\n -- loadMultipleCutHeads -- average height of cut head with normal height ->`,
      averageHeightNormal,
    );
    console.log(
      `\n -- loadMultipleCutHeads -- minimum height of cut head with normal height (${minHeightNormalHeadPath}) ->`,
      minHeightNormal,
    );

    // scene.add(headsGroup);

    // Add the heads group to be tweakable
    // addTransformDebug(`Cut Head Grp`, gui, headsGroup, {
    //   showRotation: true,
    //   showScale: true,
    //   posMin: -10,
    //   posMax: 10,
    // });
  };

  const loadBodyTst = async () => {
    const loadedBodyModel: THREE.Object3D = await loadObj(
      ModelPaths.Body.Model,
    );
    // console.log('loadedBody -> ', loadedBodyModel);
    const bodyTex = await loadTexture(ModelPaths.Body.Texture.ColorTex);
    // console.log('bodyTex -> ', bodyTex);
    // Map the texture
    loadedBodyModel.traverse((m) => {
      if (m instanceof THREE.Mesh) m.material.map = bodyTex;
    });
    scene.add(loadedBodyModel);
  };

  const loadExportedFullModelsTst = async () => {
    const loadedFullModel = await loadObj("models/full/isspd01/model.obj");
    console.log("loadedFullModel -> ", loadedFullModel);
    // Log the names
    loadedFullModel.traverse((m) => {
      if (m instanceof THREE.Mesh) {
        console.log("\nm.name -> ", m.name);
      }
    });
  };

  const loadStlFileTst = async () => {
    const loadedStlGeo = await STLLoaderInstance.loadAsync(
      "models/stl/swirl.stl",
    );
    console.log("loadedStl -> ", loadedStlGeo);
    const stlMat = new THREE.MeshStandardNodeMaterial();
    stlMat.colorNode = color("#f00");

    /*
      Twisted XZ Effect
     */
    const twistedXZ = mx_rotate2d(
      positionLocal.xz,
      positionLocal.y.mul(sin(time.mul(0.8)).mul(HALF_PI)),
    );
    stlMat.positionNode = vec3(twistedXZ.x, positionLocal.y, twistedXZ.y);

    const stlMesh = new THREE.Mesh(loadedStlGeo, stlMat);
    stlMesh.scale.setScalar(0.01);
    scene.add(stlMesh);
  };

  const manifoldTst = async () => {
    const loadedHeadModel: THREE.Group<THREE.Object3DEventMap> =
      await OBJLoaderInstance.loadAsync(ModelPaths.HeadMale.Model);
    // Apply textures
    await applyTextures2LoadedHeadModelAsync(loadedHeadModel, false);
    // Get Cut Head
    // const cutHeadDefault = await getCutHead(loadedHeadModel, LoadedCuttersModel);

    const cutHeadDefault = await getCutHead(
      loadedHeadModel,
      LoadedCuttersModel,
    );
    cutHeadDefault.name = CutHeadEyesNodeCombinedGroupName;
    // Apply PBR Material and SRGB Color Space
    applyPBRMaterialAndSRGBColorSpace(cutHeadDefault, true);
    // Apply Double Side
    applyDoubleSide(cutHeadDefault);

    applyDebugTransformation(cutHeadDefault, new THREE.Vector3(0, 0, 0));

    console.log("\n -- manifoldTst -- cutHeadDefault ->", cutHeadDefault);

    const cutHeadNode = (
      cutHeadDefault.getObjectByName("CutHeadNode") as Brush
    ).clone();
    console.log("\n -- manifoldTst -- cutHeadNode ->", cutHeadNode);

    applyDebugTransformation(cutHeadNode, new THREE.Vector3(0.4, 0, 0));

    generateFacialMorphs(cutHeadDefault);

    if (cutHeadNode.morphTargetInfluences?.length > 0) {
      // Set the morphTargetInfluences values
      // cutHeadNode.morphTargetInfluences[0] = 0;
      // cutHeadNode.morphTargetInfluences[1] = 0;

      const morphParams = {
        nose: 0,
        mandible: 0,
      };

      const guiFolderMorphs = guiInspector.addFolder("Morphs");
      guiFolderMorphs
        .add(morphParams, "nose", -1, 1, 0.01)
        .onChange((v) => {
          cutHeadNode.morphTargetInfluences[0] = v;
          console.log(
            "\n -- manifoldTst -- cutHeadNode after nose morphing ->",
            cutHeadNode,
          );
        })
        .name("Nose");
      guiFolderMorphs
        .add(morphParams, "mandible", -1, 1, 0.01)
        .onChange((v) => {
          cutHeadNode.morphTargetInfluences[1] = v;
        })
        .name("Mandible");
    }

    console.log(
      "\n -- manifoldTst -- cutHeadNode after generating facial morphs ->",
      cutHeadNode,
    );

    // const manifoldCutHeadNode = await repairMeshV2(cutHeadNode);
    // console.log(
    //   "\n -- manifoldTst -- manifoldCutHeadNode ->",
    //   manifoldCutHeadNode
    // );
    // manifoldCutHeadNode.position.x += 2;

    scene.add(cutHeadDefault, cutHeadNode);
  };

  const oralCutterTst = async () => {
    const isFemale = false;
    const loadedHeadModel: THREE.Group<THREE.Object3DEventMap> =
      await OBJLoaderInstance.loadAsync(
        // Male
        isFemale ? ModelPaths.HeadFemale.Model : ModelPaths.HeadMale.Model,
      );
    console.log(
      "\n -- loadDefaultCutHeadAsync -- loadedHeadModel ->",
      loadedHeadModel,
    );

    // Apply textures
    await applyTextures2LoadedHeadModelAsync(loadedHeadModel, isFemale);

    // Get Cut Head
    const cutHeadDefault = await getCutHead(
      loadedHeadModel,
      LoadedCuttersModel,
    );
    cutHeadDefault.name = CutHeadEyesNodeCombinedGroupName;
    // Apply PBR Material and SRGB Color Space
    applyPBRMaterialAndSRGBColorSpace(cutHeadDefault, true);
    // Apply Double Side
    applyDoubleSide(cutHeadDefault);
    // Apply Transform
    applyDebugTransformation(cutHeadDefault);

    /*
        Wireframe set working at this point only when the wireframe is set to true in the material
       */
    const debugPropsCutHead = {
      // color: "#fff",
      color: (cutHeadDefault.children[0] as StandardMesh).material.color,
      isShowMap: true,
      isShowWireframe: true,
      progressBaseColAndTex: 1,
      isShowMapPower: 1,
    } as CutHeadInspectorDebugProps;
    cutHeadDefault.children.forEach((child) => {
      if (child instanceof THREE.Mesh && "wireframe" in child.material) {
        child.material.wireframe = debugPropsCutHead.isShowWireframe;
      }
    });

    /*
        GUI
       */
    addTransformDebugInspector(
      guiInspectorFolderCutHead,
      cutHeadDefault,
      debugPropsCutHead,
    );

    scene.add(cutHeadDefault);
  };

  const headV2Tst = async () => {
    const headModel = (await OBJLoaderInstance.loadAsync(
      "models/head/v2/new-head-01.obj",
    )) as THREE.Group;

    // Store the reference for exporting
    headModelRef.value = headModel;

    scene.add(headModel);
    const headTex = await loadTexture("models/head/v2/map.png");
    const headNode = headModel.children[0] as PhongMesh;
    headNode.material.map = headTex;
    console.log("\n -- headV2Tst -- headModel ->", headModel);
    applyPBRMaterialAndSRGBColorSpace(headModel, true);
    applyDoubleSide(headModel);

    /*
      Generate facial morphs
    */
    const {
      visualizerEarMiddleTipL, // Vector3
      visualizerEarMiddleTipR, // Vector3
      visualizerEarTopTipL, // Vector3
      visualizerEarTopTipR, // Vector3
      visualizerByEarMiddleWidthMorph, // Vector3[]
      visualizerByEarTopThicknessMorph, // Vector3[]
    } = generateFacialMorphsTst(headModel);

    console.log(
      "\n -- headV2Tst -- headModel after generating facial morphs ->",
      headModel,
    );

    // Add visualizers to the scene
    // Tips
    const earMiddleTipL = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    );
    earMiddleTipL.position.copy(visualizerEarMiddleTipL);
    scene.add(earMiddleTipL);

    const earMiddleTipR = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    );
    earMiddleTipR.position.copy(visualizerEarMiddleTipR);
    scene.add(earMiddleTipR);

    const earTopTipL = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 16, 16),
      new THREE.MeshBasicMaterial({ color: "#0ff" }),
    );
    earTopTipL.position.copy(visualizerEarTopTipL);
    scene.add(earTopTipL);

    const earTopTipR = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 16, 16),
      new THREE.MeshBasicMaterial({ color: "#0ff" }),
    );
    earTopTipR.position.copy(visualizerEarTopTipR);
    scene.add(earTopTipR);

    // Morphs
    const visualizerByEarMiddleMorphGeo =
      new THREE.BufferGeometry().setFromPoints(visualizerByEarMiddleWidthMorph);
    const earMiddleMorphPoints = new THREE.Points(
      visualizerByEarMiddleMorphGeo,
      new THREE.PointsMaterial({ color: 0xff0000, size: 0.01 }),
    );
    // scene.add(earMiddleMorphPoints);

    const visualizerByEarTopMorphGeo = new THREE.BufferGeometry().setFromPoints(
      visualizerByEarTopThicknessMorph,
    );
    const earTopMorphPoints = new THREE.Points(
      visualizerByEarTopMorphGeo,
      new THREE.PointsMaterial({ color: "#0ff", size: 0.01 }),
    );
    scene.add(earTopMorphPoints);

    const morphFolder = guiInspectorFolderCutHead.addFolder("New Head Morphs");
    morphFolder
      .add(headNode.morphTargetInfluences, 0, 0, 1, 0.01)
      .name("Ear Middle Width");
    morphFolder
      .add(headNode.morphTargetInfluences, 1, 0, 1, 0.01)
      .name("Ear Top Thickness");

  };

  // loadHairTst();

  // loadHeadTst();

  // loadExportHeadTst();

  // loadBodyTst();

  // loadMultipleCutHeads();

  // loadExportedFullModelsTst();

  // loadStlFileTst();

  // manifoldTst();

  // oralCutterTst();

  headV2Tst();
};

// Resize fn
const onWindowResize = () => {
  // console.log('Resizing...')

  // if (!canvasEle.value) return;
  // const width = canvasEle.value.clientWidth;
  // const height = canvasEle.value.clientHeight;

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Update camera
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
};

// Animate fn
const animate = async () => {
  // Elapsed Time
  // const time = clock.getElapsedTime()

  // Update controls
  controls.update();

  // Update renderer
  await renderer.init();
  renderer.render(scene, camera);
};

onMounted(async () => {
  init();
  animate();
  window.addEventListener("resize", onWindowResize);
});

onBeforeUnmount(() => {
  // Dispose operations
  controls.dispose();
  renderer.dispose();

  // Remove resize listener
  window.removeEventListener("resize", onWindowResize);
});
</script>

<style scoped>
.futuristic-export-btn {
  position: relative;
  background: rgba(0, 15, 25, 0.7);
  color: #00ffff;
  border: 1px solid rgba(0, 255, 255, 0.3);
  padding: 16px 32px;
  font-family: "Outfit", sans-serif;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow:
    inset 0 0 15px rgba(0, 255, 255, 0.05),
    0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
}

.futuristic-export-btn:hover {
  border-color: #00ffff;
  color: #ffffff;
  background: rgba(0, 30, 45, 0.85);
  box-shadow:
    inset 0 0 25px rgba(0, 255, 255, 0.15),
    0 0 30px rgba(0, 255, 255, 0.4);
  transform: translateY(-4px) scale(1.02);
}

.futuristic-export-btn:active {
  transform: translateY(0px) scale(0.96);
}

.btn-content {
  position: relative;
  z-index: 2;
}

.btn-glitch-text {
  position: relative;
}

.btn-glitch-text::after {
  content: attr(data-text);
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  color: #ff00ff;
  z-index: -1;
}

.futuristic-export-btn:hover .btn-glitch-text::after {
  animation: glitch 0.43s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite;
  opacity: 1;
}

.btn-decor-line {
  position: absolute;
  bottom: -6px;
  left: 0;
  width: 25%;
  height: 2px;
  background: #00ffff;
  transition: width 0.3s ease;
  box-shadow: 0 0 8px #00ffff;
}

.futuristic-export-btn:hover .btn-decor-line {
  width: 100%;
}

.btn-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #00ffff;
  transition: all 0.3s ease;
}

.top-left {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
}

.bottom-right {
  bottom: 0;
  right: 0;
  border-left: none;
  border-top: none;
}

.futuristic-export-btn:hover .btn-corner {
  width: 100%;
  height: 100%;
  opacity: 0.1;
}

@keyframes glitch {
  0% {
    transform: translate(0);
  }
  20% {
    transform: translate(-3px, 3px);
  }
  40% {
    transform: translate(-3px, -3px);
  }
  60% {
    transform: translate(3px, 3px);
  }
  80% {
    transform: translate(3px, -3px);
  }
  100% {
    transform: translate(0);
  }
}
</style>
