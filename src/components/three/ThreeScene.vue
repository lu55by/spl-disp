<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>

<script setup lang="ts">
import { AxesHelper } from "three";
import { type Brush } from "three-bvh-csg";
import { UltraHDRLoader } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three/webgpu";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import {
  CameraProps,
  CutHeadEyesCombinedGroupName,
  HDRPath,
  HeadFeMaleSubPath,
  HeadMaleSubPath,
  ModelPaths,
  NodeNames,
  type PhongMesh,
} from "../../three/constants";
import { csgSubtract } from "../../three/csg";
import { exportObjectToOBJ } from "../../three/exporters";
import { addTransformDebug } from "../../three/gui";
import { GlobalLoadingManager } from "../../three/managers/GlobalLoadingManager";
import { loadObj } from "../../three/loaders/ModelLoader";
import { loadTexture } from "../../three/loaders/TextureLoader";
import {
  applyDebugTransformation,
  applyDoubleSide,
  applyPBRMaterialAndSRGBColorSpace,
  combineMeshesToGroup,
  modifyNewVerticesUv,
  scaleGroupToHeight,
} from "../../three/meshOps";
import { getCutHeadV3, getCutHeadV4 } from "../../three/utils/csgCutHead";
import { getCutHead } from "../../three/utils/csgCutHeadV3";
import type { Pane } from "tweakpane";

// Canvas Element
const canvasEle = ref<HTMLCanvasElement | null>(null);

const { splicingGroupGlobal: globalGroup, guiGlobal, cuttersModelGlobal } = useModelsStore();
console.log("Global Group ->", globalGroup);

let camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGPURenderer,
  controls: OrbitControls,
  clock: THREE.Clock,
  gui: Pane;

const width = window.innerWidth;
const height = window.innerHeight;

// Init scene fn
const init = async () => {
  // const width = canvasEle.value!.clientWidth
  // const height = canvasEle.value!.clientHeight

  /**
   * GUI
   */
  gui = guiGlobal as Pane;

  /**
   * Camera
   */
  camera = new THREE.PerspectiveCamera(
    CameraProps.Fov,
    width / height,
    CameraProps.Near,
    CameraProps.Far
  );
  camera.position.set(CameraProps.Pos.x, CameraProps.Pos.y, CameraProps.Pos.z);
  // addTransformDebug("Camera", gui, camera);

  /**
   * Scene
   */
  scene = new THREE.Scene();

  /**
   * Clock
   */
  clock = new THREE.Clock();

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

  // Inspector/GUI
  // renderer.inspector = new Inspector()
  // const gui = renderer.inspector.createParameters("Parameters")

  /**
   * Lights
   */
  // const ambientLight = new THREE.AmbientLight("#fff", 3);
  // scene.add(ambientLight);

  // const directionalLight = new THREE.DirectionalLight(
  //   "#fff",
  //   DirectionalLightIntensity
  // );
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
      ModelPaths.Hair.Model
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
      ModelPaths.HeadFemale.Model
    );
    const loadedMaleHeadModel: THREE.Object3D = await loadObj(
      ModelPaths.HeadMale.Model
    );
    const loadedCuttersModel: THREE.Object3D = await loadObj(
      ModelPaths.Cutters.CylinderMod
    );

    // Load Textures

    // Female
    const headFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.HeadColTex
    );
    const teethFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.TeethColTex
    );
    const eyeLFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.EyeLColTex
    );
    const eyeRFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.EyeRColTex
    );

    // Male
    const headMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.HeadColorTex
    );
    const eyeLMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.EyeLColTex
    );
    const eyeRMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.EyeRColTex
    );

    // Retrieve Nodes

    // Female
    const headFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Head
    ) as PhongMesh;
    const teethFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Teeth
    ) as PhongMesh;
    const eyeLFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL
    ) as PhongMesh;
    const eyeRFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR
    ) as PhongMesh;

    // Male
    const headMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Head
    ) as PhongMesh;
    const eyeLMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL
    ) as PhongMesh;
    const eyeRMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR
    ) as PhongMesh;

    // Cutters
    // Sphere Cutter
    const sphereCutterNode = loadedCuttersModel.getObjectByName(
      NodeNames.CuttersNames.Sphere
    ) as PhongMesh;
    // sphereCutterNode.position.y -= 1;
    // sphereCutterNode.updateMatrixWorld(true);
    // sphereCutterNode.geometry.applyMatrix4(sphereCutterNode.matrixWorld);

    // Cylinder Cutter
    const cylinderCutterNode = loadedCuttersModel.getObjectByName(
      NodeNames.CuttersNames.Cylinder
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
      ModelPaths.HeadFemale.Model
    );
    console.log("loadedFemaleHeadModel ->", loadedFemaleHeadModel);
    const loadedMaleHeadModel: THREE.Object3D = await loadObj(
      ModelPaths.HeadMale.Model
    );
    const loadedCuttersModel: THREE.Object3D = await loadObj(
      ModelPaths.Cutters.CylinderMod
    );

    // Load Textures

    // Female
    const headFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.HeadColTex
    );
    const teethFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.TeethColTex
    );
    const eyeLFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.EyeLColTex
    );
    const eyeRFemaleColTex = await loadTexture(
      ModelPaths.HeadFemale.Texture.EyeRColTex
    );

    // Male
    const headMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.HeadColorTex
    );
    const eyeLMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.EyeLColTex
    );
    const eyeRMaleColTex = await loadTexture(
      ModelPaths.HeadMale.Texture.EyeRColTex
    );

    // Retrieve Nodes

    // Female
    const headFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Head
    ) as PhongMesh;
    const teethFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Teeth
    ) as PhongMesh;
    const eyeLFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL
    ) as PhongMesh;
    const eyeRFemaleNode = loadedFemaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR
    ) as PhongMesh;

    // Male
    const headMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.Head
    ) as PhongMesh;
    const eyeLMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL
    ) as PhongMesh;
    const eyeRMaleNode = loadedMaleHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR
    ) as PhongMesh;

    // Cutters
    // Sphere Cutter
    const sphereCutterNode = loadedCuttersModel.getObjectByName(
      NodeNames.CuttersNames.Sphere
    ) as PhongMesh;
    // sphereCutterNode.position.y -= 1;
    // sphereCutterNode.updateMatrixWorld(true);
    // sphereCutterNode.geometry.applyMatrix4(sphereCutterNode.matrixWorld);

    // Cylinder Cutter
    const cylinderCutterNode = loadedCuttersModel.getObjectByName(
      NodeNames.CuttersNames.Cylinder
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
      CutHeadEyesCombinedGroupName,
      cutHead,
      eyeLMaleNode,
      eyeRMaleNode
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
    debugPosOffset: THREE.Vector3 = new THREE.Vector3()
  ) => {
    const isModelFeMale = isFamele;

    // Head Model Path
    let headModelPath = isModelFeMale
      ? ModelPaths.HeadFemale.Model
      : ModelPaths.HeadMale.Model;
    // const headModelPath = modelPath;
    const subPath2Search = isModelFeMale ? HeadFeMaleSubPath : HeadMaleSubPath;
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
      NodeNames.HeadNames.Head
    ) as PhongMesh;
    const eyeLNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL
    ) as PhongMesh;
    const eyeRNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR
    ) as PhongMesh;

    const applyTexture = async (): Promise<void> => {
      const headColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.HeadColorTex.replace(
            subPath2Search,
            modelSubPath
          );
      const eyeLColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath
          );
      const eyeRColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath
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
      cuttersModelGlobal,
      isModelFeMale
    );
    applyDebugTransformation(cutHead, debugPosOffset);
    applyPBRMaterialAndSRGBColorSpace(cutHead, false);
    // applyMaterialWireframe(cutHead, Colors.Yellow);
    scene.add(cutHead);
  };

  const csgCutHeadFnTstV2 = async (
    modelSubPath: string,
    isFamele: boolean = false,
    debugPosOffset: THREE.Vector3 = new THREE.Vector3()
  ) => {
    const isModelFeMale = isFamele;

    // Head Model Path
    let headModelPath = isModelFeMale
      ? ModelPaths.HeadFemale.Model
      : ModelPaths.HeadMale.Model;
    // const headModelPath = modelPath;
    const subPath2Search = isModelFeMale ? HeadFeMaleSubPath : HeadMaleSubPath;
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
      NodeNames.HeadNames.Head
    ) as PhongMesh;
    const eyeLNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL
    ) as PhongMesh;
    const eyeRNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR
    ) as PhongMesh;

    const applyTexture = async (): Promise<void> => {
      const headColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.HeadColorTex.replace(
            subPath2Search,
            modelSubPath
          );
      const eyeLColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath
          );
      const eyeRColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath
          );
      const headColTex = await loadTexture(headColTexPath);
      const eyeLColTex = await loadTexture(eyeLColTexPath);
      const eyeRColTex = await loadTexture(eyeRColTexPath);

      headNode.material.map = headColTex;
      eyeLNode.material.map = eyeLColTex;
      eyeRNode.material.map = eyeRColTex;
    };
    await applyTexture();

    const cutHead = await getCutHeadV4(loadedHeadModel, cuttersModelGlobal);
    applyDebugTransformation(cutHead, debugPosOffset);
    applyPBRMaterialAndSRGBColorSpace(cutHead, false);
    applyDoubleSide(cutHead);
    console.log("\n cutHead ->", cutHead);
    // applyMaterialWireframe(cutHead, Colors.White);
    scene.add(cutHead);
  };

  const csgCutHeadFnTstV3 = async (
    modelSubPath: string,
    isFamele: boolean = false,
    debugPosOffset: THREE.Vector3 = new THREE.Vector3()
  ): Promise<THREE.Group<THREE.Object3DEventMap>> => {
    const isModelFeMale = isFamele;

    // Head Model Path
    let headModelPath = isModelFeMale
      ? ModelPaths.HeadFemale.Model
      : ModelPaths.HeadMale.Model;
    // const headModelPath = modelPath;
    const subPath2Search = isModelFeMale ? HeadFeMaleSubPath : HeadMaleSubPath;
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
      NodeNames.HeadNames.Head
    ) as PhongMesh;
    const eyeLNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL
    ) as PhongMesh;
    const eyeRNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR
    ) as PhongMesh;

    const applyTexture = async (): Promise<void> => {
      const headColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.HeadColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.HeadColorTex.replace(
            subPath2Search,
            modelSubPath
          );
      const eyeLColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.EyeLColTex.replace(
            subPath2Search,
            modelSubPath
          );
      const eyeRColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath
          )
        : ModelPaths.HeadMale.Texture.EyeRColTex.replace(
            subPath2Search,
            modelSubPath
          );
      const headColTex = await loadTexture(headColTexPath);
      const eyeLColTex = await loadTexture(eyeLColTexPath);
      const eyeRColTex = await loadTexture(eyeRColTexPath);

      headNode.material.map = headColTex;
      eyeLNode.material.map = eyeLColTex;
      eyeRNode.material.map = eyeRColTex;
    };
    await applyTexture();

    const cutHead = await getCutHead(loadedHeadModel, cuttersModelGlobal);
    applyDebugTransformation(cutHead, debugPosOffset);
    applyPBRMaterialAndSRGBColorSpace(cutHead, false);
    applyDoubleSide(cutHead);
    console.log("\n cutHead ->", cutHead);
    // applyMaterialWireframe(cutHead, Colors.White);
    scene.add(cutHead);
    return cutHead;
  };

  const loadBodyTst = async () => {
    const loadedBodyModel: THREE.Object3D = await loadObj(
      ModelPaths.Body.Model
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

  // loadHairTst();

  // loadHeadTst();

  // loadExportHeadTst();

  // loadBodyTst();

  const loadMultipleCutHeads = async () => {
    /**
     * Load multiple heads
     */
    const baseOffsetX = -0.35;

    // Create a THREE.Group to store the loaded heads
    // const headsGroup = new THREE.Group();

    const headMale2CutPaths = [
      // Male Heads
      "/bigHead-01",
      "/cutHead-uv-issue-01-isspd01",
      "/cutHead-uv-issue-02-sasha01",
      "/ukn-01",
      // Female Heads
      "/default",
      "/ellie01",
    ];
    const femaleHeadStartIdx = 4;
    let isFemale: boolean;

    for (let i = 0; i < headMale2CutPaths.length; i++) {
      isFemale = i >= femaleHeadStartIdx;
      const cutHead = await csgCutHeadFnTstV3(
        headMale2CutPaths[i],
        isFemale,
        new THREE.Vector3(
          baseOffsetX + (isFemale ? (i - femaleHeadStartIdx) : i) * 0.3,
          0,
          isFemale ? 0.3 : 0
        )
      );
      // headsGroup.add(cutHead);
      addTransformDebug(
        `Cut Head ${isFemale ? "Female" : "Male"}-${i}`,
        gui,
        cutHead,
        {
          showRotation: true,
          showScale: true,
          posMin: -10,
          posMax: 10,
        }
      );
    }

    // scene.add(headsGroup);

    // Add the heads group to be tweakable
    // addTransformDebug(`Cut Head Grp`, gui, headsGroup, {
    //   showRotation: true,
    //   showScale: true,
    //   posMin: -10,
    //   posMax: 10,
    // });
  };

  loadMultipleCutHeads();
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
