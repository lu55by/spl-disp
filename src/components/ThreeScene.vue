<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>

<script setup lang="ts">
import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { loadObj } from "../three/loaders/ModelLoader.ts";
import { loadTexture } from "../three/loaders/TextureLoader.ts";
import {
  BasicMat,
  CameraProps,
  Colors,
  DirectionalLightIntensity,
  ModelPaths,
  NodeNames,
  OffsetPosNegPercentages,
  type PhongMesh,
} from "../three/constants";
import { AxesHelper } from "three";
import GUI from "lil-gui";
import { addTransformDebug } from "../three/gui";
import { csgSubtract } from "../three/csg";
import { type Brush } from "three-bvh-csg";
import {
  applyDebugTransformation,
  applyGeometryScaling,
  applyMaterialWireframe,
  combineMeshesToGroup,
  modifyNewVerticesUv,
  scaleGroupToHeight,
} from "../three/meshOps";
import { exportObjectToOBJ } from "../three/exporters";
import { getCutHead } from "../three/utils/csgCutHead.ts";
import { HDRLoader, UltraHDRLoader } from "three/examples/jsm/Addons.js";

// Canvas Element
const canvasEle = ref<HTMLCanvasElement | null>(null);

let camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGPURenderer,
  controls: OrbitControls,
  clock: THREE.Clock,
  gui: GUI;

const width = window.innerWidth;
const height = window.innerHeight;

// Init scene fn
const init = () => {
  gui = new GUI();

  // const width = canvasEle.value!.clientWidth
  // const height = canvasEle.value!.clientHeight

  camera = new THREE.PerspectiveCamera(
    CameraProps.Fov,
    width / height,
    CameraProps.Near,
    CameraProps.Far
  );
  camera.position.set(CameraProps.Pos.x, CameraProps.Pos.y, CameraProps.Pos.z);
  addTransformDebug("Camera", gui, camera);

  scene = new THREE.Scene();

  clock = new THREE.Clock();

  // Renderer
  renderer = new THREE.WebGPURenderer({
    canvas: canvasEle.value!,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setAnimationLoop(animate);
  renderer.setClearColor("#000");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  // Inspector/GUI
  // renderer.inspector = new Inspector()
  // const gui = renderer.inspector.createParameters("Parameters")

  // Lights
  const ambientLight = new THREE.AmbientLight("#fff", 3);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    "#fff",
    DirectionalLightIntensity
  );
  directionalLight.position.set(4, 3, 1);
  scene.add(directionalLight);

  // default material
  const defaultMat = new THREE.MeshStandardNodeMaterial({ color: "#ff622e" });

  // Test Objects
  const tstObjectsFn = () => {
    const torusKnot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.6, 0.25, 128, 32),
      defaultMat
    );
    torusKnot.position.set(3, 0, 0);
    scene.add(torusKnot);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      defaultMat
    );
    sphere.position.set(0, 0, 0);
    scene.add(sphere);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1, 16, 16),
      defaultMat
    );
    box.position.set(-3, 0, 0);
    scene.add(box);
  };
  // tstObjectsFn();

  /**
   * Load Hdr
   */
  const ultraHDRLoader = new UltraHDRLoader();
  ultraHDRLoader.setDataType(THREE.FloatType);

  const loadEnvironment = () => {
    ultraHDRLoader.setDataType(THREE.HalfFloatType);

    ultraHDRLoader.load(`hdrs/spruit_sunrise_2k.hdr.jpg`, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.needsUpdate = true;

      scene.background = texture;
      scene.environment = texture;
    });
  };

  loadEnvironment();

  /*
    Load Models
  */
  // Test Fn
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
    // TODO: Try to pass the cutHead as the first arg of modifyNewVerticesUv.
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
      "cutHeadEyesCombinedGrp",
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

  const csgCutHeadFnTst = async () => {
    const loadedHeadModel: THREE.Object3D = await loadObj(
      // ModelPaths.HeadMaleLs.Model
      ModelPaths.HeadFemale.Model
    );
    console.log("loadedHeadModel -> ", loadedHeadModel);
    const headNode = loadedHeadModel.children[0] as PhongMesh;
    // const cutHeadTst1 = csgSubtract(headNode);
    applyDebugTransformation(cutHeadTst1);
    applyMaterialWireframe(cutHeadTst1, Colors.Cyan);
    scene.add(cutHeadTst1);
    // return;

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

    const headMaleNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.Head
    ) as PhongMesh;
    const eyeLMaleNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeL
    ) as PhongMesh;
    const eyeRMaleNode = loadedHeadModel.getObjectByName(
      NodeNames.HeadNames.EyeR
    ) as PhongMesh;

    const applyTexturesToLoadedHeadMaleLs = () => {
      headMaleNode.material.map = headMaleColTex;
      eyeLMaleNode.material.map = eyeLMaleColTex;
      eyeRMaleNode.material.map = eyeRMaleColTex;
    };
    applyTexturesToLoadedHeadMaleLs();

    const debugCutterOralCavity = async () => {
      const headNode = loadedHeadModel.getObjectByName(
        "head_lod0_mesh"
      ) as THREE.Mesh;
      // applyDebugTransformation(headNode);
      // loadedHeadModel.updateMatrixWorld(true);
      // headNode.geometry.applyMatrix4(loadedHeadModel.matrixWorld);
      // applyMaterialWireframe(headNode, new THREE.Color("#0ff"));
      // scene.add(headNode);

      // Add the cutter oral cavity to the scene
      const cutterOralCavityModel: THREE.Object3D = await loadObj(
        ModelPaths.Cutters.OralCavity
      );
      // console.log("cutterOralCavityModel -> ", cutterOralCavityModel);
      const cutterOralCavityNode = cutterOralCavityModel
        .children[0] as THREE.Mesh;
      // applyDebugTransformation(cutterOralCavityNode, new THREE.Vector3(0, 0, -.01));
      // cutterOralCavityModel.updateMatrixWorld(true);
      // cutterOralCavityNode.geometry.applyMatrix4(cutterOralCavityModel.matrixWorld);
      // applyMaterialWireframe(cutterOralCavityNode, Colors.Yellow);
      // scene.add(cutterOralCavityNode);

      // Perform CSG Subtract
      let cutHeadObj = csgSubtract(headNode, cutterOralCavityNode, true);
      // applyDebugTransformation(cutHeadObj, new THREE.Vector3(5, 0, 0));
      // applyDebugTransformation(cutHeadObj);
      // applyMaterialWireframe(cutHeadObj, Colors.White);
      // addTransformDebug("CutHead_OralCavity", gui, cutHeadObj, {
      //   showScale: true,
      // });
      // scene.add(cutHeadObj);
      // return;

      // 加载切割模型
      const loadedCuttersModel: THREE.Object3D = await loadObj(
        ModelPaths.Cutters.ClyinderStrcLinesRmvd
      );
      // const loadedCutterCylStrcLineRmvdModel: THREE.Object3D = await loadObj(
      //   // ModelPaths.Cutters.CylinderMod
      //   // ModelPaths.Cutters.CylinderStrLineRmvdMod
      //   ModelPaths.Cutters.CylinderStrCloseLineRmvdMod
      // );
      const sphereCutterNode = loadedCuttersModel.children[0] as THREE.Mesh;
      const cylinderCutterNode = loadedCuttersModel.children[1] as THREE.Mesh;
      // const cylinderCutterNode = loadedCutterCylStrcLineRmvdModel
      //   .children[0] as THREE.Mesh;
      // cylinderCutterNode.geometry.translate(0, 0, .7);

      // Debug - only show cutters

      // applyDebugTransformation(sphereCutterNode);
      // applyMaterialWireframe(sphereCutterNode, new THREE.Color("#f00"));
      // // scene.add(sphereCutterNode);

      // addTransformDebug("Cutter_Cylinder", gui, cylinderCutterNode, {
      //   showScale: true,
      // });
      // applyDebugTransformation(cylinderCutterNode);
      // applyMaterialWireframe(cylinderCutterNode, new THREE.Color("#0ff"));
      // scene.add(cylinderCutterNode);
      // return;

      // 切割操作

      const beforeCylCutHeadCloneObjGeo0 = cutHeadObj.geometry.clone();

      cutHeadObj = csgSubtract(cutHeadObj, sphereCutterNode, false);
      modifyNewVerticesUv(
        new THREE.Mesh(
          beforeCylCutHeadCloneObjGeo0,
          new THREE.MeshBasicMaterial()
        ),
        cutHeadObj,
        0,
        0.08
      );

      // applyDebugTransformation(cutHeadObj);
      // applyMaterialWireframe(cutHeadObj, Colors.White);
      // addTransformDebug("CutHead_Sphere", gui, cutHeadObj, {
      //   showScale: true,
      // });
      // scene.add(cutHeadObj);

      const beforeCylCutHeadCloneObjGeo1 = cutHeadObj.geometry.clone();

      cutHeadObj = csgSubtract(cutHeadObj, cylinderCutterNode, false);
      const ofssetNegativeFemale = 0.046;
      const ofssetNegativeMale = 0.044;
      modifyNewVerticesUv(
        new THREE.Mesh(
          beforeCylCutHeadCloneObjGeo1,
          new THREE.MeshBasicMaterial()
        ),
        // headNode,
        cutHeadObj,
        0,
        // ofssetNegativeFemale,
        ofssetNegativeMale
      );

      // applyDebugTransformation(cylinderCutterNode);
      // applyMaterialWireframe(cylinderCutterNode, new THREE.Color("#fff"));
      // scene.add(cylinderCutterNode);

      applyDebugTransformation(cutHeadObj);
      applyMaterialWireframe(cutHeadObj, Colors.Cyan);

      scene.add(cutHeadObj);
    };
    await debugCutterOralCavity();

    return;

    // getCutHead Fn Tst

    const cutHead = await getCutHead(
      loadedHeadModel,
      ModelPaths.Cutters.OralCavity,
      ModelPaths.Cutters.CylinderMod
    );

    console.log("Cut Head -> ", cutHead);
    applyDebugTransformation(cutHead);
    applyMaterialWireframe(cutHead, new THREE.Color("#ff0"));
    scene.add(cutHead);
  };

  const csgCutHeadFnTst2 = async () => {
    const isModelFeMale = true;
    const headModelPath = isModelFeMale
      ? ModelPaths.HeadFemale.Model
      : ModelPaths.HeadMale.Model;

    const loadedHeadModel: THREE.Object3D = await loadObj(headModelPath);
    console.log("loadedHeadModel -> ", loadedHeadModel);

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
        ? ModelPaths.HeadFemale.Texture.HeadColTex
        : ModelPaths.HeadMale.Texture.HeadColorTex;
      const eyeLColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeLColTex
        : ModelPaths.HeadMale.Texture.EyeLColTex;
      const eyeRColTexPath = isModelFeMale
        ? ModelPaths.HeadFemale.Texture.EyeRColTex
        : ModelPaths.HeadMale.Texture.EyeRColTex;
      const headColTex = await loadTexture(headColTexPath);
      headColTex.colorSpace = THREE.SRGBColorSpace;
      const eyeLColTex = await loadTexture(eyeLColTexPath);
      eyeLColTex.colorSpace = THREE.SRGBColorSpace;
      const eyeRColTex = await loadTexture(eyeRColTexPath);
      eyeRColTex.colorSpace = THREE.SRGBColorSpace;

      headNode.material.map = headColTex;
      eyeLNode.material.map = eyeLColTex;
      eyeRNode.material.map = eyeRColTex;
    };
    await applyTexture();

    const cutHeadtst0 = await getCutHead(
      loadedHeadModel,
      ModelPaths.Cutters.OralCavity,
      ModelPaths.Cutters.ClyinderStrcLinesRmvd
    );
    applyDebugTransformation(cutHeadtst0);

    // Adjust the metalness and roughness
    cutHeadtst0.traverse((m) => {
      if (m instanceof THREE.Mesh) {
        const mesh = m as any;
        const map = mesh.material.map;
        mesh.material = new THREE.MeshStandardMaterial({roughness: .8, metalness: .2});
        mesh.material.map = map;
      }
    });

    scene.add(cutHeadtst0);
    return;

    // The cutter oral cavity
    const cutterOralCavityModel: THREE.Object3D = await loadObj(
      ModelPaths.Cutters.OralCavity
    );
    // console.log("cutterOralCavityModel -> ", cutterOralCavityModel);

    const cuttersSphCylModel: THREE.Object3D = await loadObj(
      ModelPaths.Cutters.ClyinderStrcLinesRmvd
    );

    const cutterOralCavityNode = cutterOralCavityModel
      .children[0] as THREE.Mesh;
    const cutterSphereNode = cuttersSphCylModel.children[0] as THREE.Mesh;
    const cutterCylinderNode = cuttersSphCylModel.children[1] as THREE.Mesh;

    // Perform CSG Subtract
    const { PostSphere, PostCylinder } = OffsetPosNegPercentages;
    const { pos: sphereOffsetPosPercentage, neg: sphereOffsetNegPercentage } =
      PostSphere;
    const { Female, Male } = PostCylinder;
    const {
      pos: cylOffsetPosPercentageFemale,
      neg: cylOffsetNegPercentageFemale,
    } = Female;
    const { pos: cylOffsetPosPercentageMale, neg: cylOffsetNegPercentageMale } =
      Male;

    let cutHeadObj = csgSubtract(headNode, cutterOralCavityNode, true);
    const beforeCylCutHeadGeoCloned0 = cutHeadObj.geometry.clone();
    cutHeadObj = csgSubtract(cutHeadObj, cutterSphereNode, false);
    modifyNewVerticesUv(
      new THREE.Mesh(beforeCylCutHeadGeoCloned0, BasicMat),
      cutHeadObj,
      sphereOffsetPosPercentage,
      sphereOffsetNegPercentage
    );
    const beforeCylCutHeadGeoCloned1 = cutHeadObj.geometry.clone();
    cutHeadObj = csgSubtract(cutHeadObj, cutterCylinderNode, false);
    const isFemale = isModelFeMale;
    const ofsset = isFemale
      ? { pos: cylOffsetPosPercentageFemale, neg: cylOffsetNegPercentageFemale }
      : { pos: cylOffsetPosPercentageMale, neg: cylOffsetNegPercentageMale };
    modifyNewVerticesUv(
      new THREE.Mesh(beforeCylCutHeadGeoCloned1, BasicMat),
      cutHeadObj,
      ofsset.pos,
      ofsset.neg
    );
    applyDebugTransformation(cutHeadObj);
    // applyMaterialWireframe(cutHeadObj, Colors.Cyan);
    scene.add(cutHeadObj);
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

  // csgCutHeadFnTst();

  csgCutHeadFnTst2();

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  // controls.minDistance = .1
  // controls.maxDistance = 50

  // Axes Helper
  scene.add(new AxesHelper(20));

  // window.addEventListener('resize', onWindowResize)
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

onMounted(() => {
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
