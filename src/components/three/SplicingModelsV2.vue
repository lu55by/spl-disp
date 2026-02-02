<template>
  <div class="relative h-full w-full overflow-hidden">
    <canvas class="h-full w-full relative" ref="canvasEle"></canvas>

    <!-- Focus Indicator -->
    <Transition name="fade">
      <div
        v-if="
          selectedObject &&
          !selectedObject.name.includes(CutHeadEyesNodeCombinedGroupName) &&
          showFocusIndicator &&
          !isFocusedOnPoint
        "
        class="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full mb-4 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-full shadow-2xl flex items-center gap-2 group transition-all duration-300"
        :style="{ left: indicatorPos.x + 'px', top: indicatorPos.y + 'px' }"
      >
        <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
        <span
          class="text-white text-xs font-medium tracking-wide whitespace-nowrap"
        >
          按下
          <span
            class="bg-white/20 px-1.5 py-0.5 rounded text-[10px] border border-white/30 font-mono"
            >.</span
          >
          以聚焦
        </span>
      </div>
    </Transition>

    <!-- Reset Focus Button -->
    <Transition name="slide-up">
      <button
        v-if="isFocusedOnPoint"
        @click="resetFocusToCenter"
        class="absolute bottom-10 right-10 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 hover:border-white/30 rounded-2xl shadow-2xl group flex items-center gap-3 transition-all duration-500 hover:scale-105 active:scale-95 cursor-pointer"
      >
        <div
          class="p-2 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/40 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5 text-cyan-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 3h6v6"></path>
            <path d="M9 21H3v-6"></path>
            <path d="M21 3l-7 7"></path>
            <path d="M3 21l7-7"></path>
          </svg>
        </div>
        <div class="text-left">
          <div
            class="text-[10px] text-white/40 uppercase tracking-widest font-bold"
          >
            视口
          </div>
          <div class="text-sm text-white font-semibold">重置聚焦</div>
        </div>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -80%) scale(0.9);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { TransformControls } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { color, materialColor, mix, uniform, vec2 } from "three/tsl";
import * as THREE from "three/webgpu";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import {
  CameraProps,
  CutHeadEyesNodeCombinedGroupName,
} from "../../three/constants";
import {
  adjustPivotPointsForMesh,
  generateFacialMorphs,
  getObject3DBoundingBoxCenter,
} from "../../three/meshOps";
import { getOutlinePattern } from "../../three/shaders/tsl";

import { getProject, types } from "@theatre/core";
import studio from "@theatre/studio";
import theatreState from "@/assets/animations/Three x Theatre.theatre-project-state-1.json";

/**
 * Theatre.js Setup
 */
if (import.meta.env.DEV) {
  studio.initialize();
}

const theatreProject = getProject("Three x Theatre", { state: theatreState });
const theatreSheet = theatreProject.sheet("Theatre Sheet 1");

/**
 * Canvas Element
 */
const canvasEle = ref<HTMLCanvasElement | null>(null);

/**
 * Models Store
 */
const modelsStore = useModelsStore();
const { splicingGroupGlobal } = modelsStore;
const {
  splicingGroupLen,
  selectedObject,
  isShowMap,
  isDefaultHeadFemale,
  currentHeadModelSubPath,
  isManualMorphGenerationMode,
  manualMorphSelectionStage,
  manualJawTipL,
  manualJawTipR,
  manualEyeBrowTipL,
  manualEyeBrowTipR,
  manualMouseCornerTipL,
  manualMouseCornerTipR,
  manualMorphReadyTimestamp,
} = storeToRefs(modelsStore);

/**
 * Focus Point State
 */
const clickedPoint = ref<THREE.Vector3 | null>(null);
const showFocusIndicator = ref(false);
const indicatorPos = ref({ x: 0, y: 0 });
const isFocusedOnPoint = ref(false);

const resetFocusToCenter = () => {
  updateOrbitControlsTargetCenter();
  isFocusedOnPoint.value = false;
  showFocusIndicator.value = false;
  clickedPoint.value = null;
};

/*
  Orbit Controls Target Center Update Logic
 */
/**
 * Adjust the pivot point of each object in the group to its bounding box center
 * @param group THREE.Group
 */
const adjustPivots = (group: THREE.Group) => {
  // console.log("\nadjustPivots called...");
  // console.log("\n -- adjustPivots -- group ->", group);
  group.updateMatrixWorld();
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      adjustPivotPointsForMesh(child);
    } else if (child instanceof THREE.Group) {
      // child -> HeadGrp, HairGrp or BodyGrp
      const box = new THREE.Box3().setFromObject(child);
      const center = box.getCenter(new THREE.Vector3());

      // Calculate the offset in the parent's coordinate system
      // child.parent is group
      if (child.parent) {
        const centerInParent = center.clone();
        child.parent.worldToLocal(centerInParent);
        const offset = centerInParent.clone().sub(child.position);

        // Move the child group to the center
        child.position.add(offset);

        // Move children inversely to keep them in the same visual place
        child.children.forEach((c) => {
          const localOffset = offset
            .clone()
            .applyQuaternion(child.quaternion.clone().invert())
            .divide(child.scale);
          c.position.sub(localOffset);
        });
      }
    }
  });
};

const orbitControlsTargetCenter = new THREE.Vector3();
const updateOrbitControlsTargetCenter = () => {
  console.log("\nupdateOrbitControlsTargetCenter called...");

  // Adjust the pivot point of each object in the group to its bounding box center
  adjustPivots(splicingGroupGlobal);

  const boundingBoxCenter = getObject3DBoundingBoxCenter(splicingGroupGlobal);
  orbitControlsTargetCenter.copy(boundingBoxCenter);
};

updateOrbitControlsTargetCenter();

const unsubscribeModelsStoreActions = modelsStore.$onAction(
  ({ name, after }) => {
    const relevantActions = [
      "addChild",
      "importObjStlWithNodeNames",
      // "setDefaultOriginalHead",
      "clear",
    ];
    if (relevantActions.includes(name)) {
      after(() => {
        updateOrbitControlsTargetCenter();
      });
    }
  },
);

/**
 * Objects of three definition
 */
let camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGPURenderer,
  orbit: OrbitControls,
  transform: TransformControls,
  raycaster: THREE.Raycaster,
  timer: THREE.Timer,
  // Lights
  rotatingLight: THREE.DirectionalLight,
  // uniforms
  uBaseColor: THREE.UniformNode<THREE.Color>,
  uIsShowMap: THREE.UniformNode<number>,
  uOutlinePatternFactor: THREE.UniformNode<THREE.Vector2>,
  uOutlineColor: THREE.UniformNode<THREE.Color>,
  // uToggleOutline: THREE.UniformNode<number>,
  // raycaster intersection object
  raycasterIntersectionObject: THREE.Object3D | null,
  // Group for the facial morph visualizers
  visualizerGroup: THREE.Group | null;

let postProcessing: THREE.PostProcessing;

const width = window.innerWidth;
const height = window.innerHeight;

/**
 * Top Level Normal Fns
 */
// Clear the visualizers by stage prefix in the visualizer group
const clearMorphVisualizerByStage = (stage: string) => {
  if (!visualizerGroup) return;
  console.log(
    "\n -- clearMorphVisualizerByStage -- visualizerGroup ->",
    visualizerGroup,
  );
  // Iterate over a copy of the children array to avoid skipping elements while removing them from the group -> fixes the issue where meshes with the same stage prefix were not removed properly.
  [...visualizerGroup.children].forEach((child) => {
    console.log("\n -- clearMorphVisualizerByStage -- child ->", child);
    if (child instanceof THREE.Mesh && child.name.startsWith(stage)) {
      console.log(
        "\n -- clearMorphVisualizerByStage -- child same stage ->",
        child,
      );
      child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: any) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      visualizerGroup.remove(child);
    }
  });
};

// Clear all the visualizers in the visualizer group
const clearVisualizerGroup = () => {
  if (!visualizerGroup) return;
  // Iterate over a copy of the children array and dispose before removing -> solves the issue of children not being disposed and ensures proper cleanup.
  [...visualizerGroup.children].forEach((child: any) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m: any) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
    visualizerGroup.remove(child);
  });
};

// Init scene fn
const init = async () => {
  /**
   * Camera
   */
  camera = new THREE.PerspectiveCamera(
    CameraProps.Fov,
    width / height,
    CameraProps.Near,
    CameraProps.Far,
  );
  // camera.position.set(CameraProps.Pos.x, CameraProps.Pos.y, CameraProps.Pos.z);
  camera.position.set(0, CameraProps.Pos.y * 0.65, CameraProps.Pos.z * 1.1);
  // camera.position.set(
  //   CameraProps.PosNormal.x,
  //   CameraProps.PosNormal.y,
  //   CameraProps.PosNormal.z
  // );
  // addTransformDebug("Camera", GUIGlobal, camera, {
  //   posMin: -300,
  //   posMax: 300,
  // });

  /**
   * Scene
   */
  scene = new THREE.Scene();
  // scene.fogNode = getFogNode();

  /**
   * Raycaster
   */
  raycaster = new THREE.Raycaster();

  /**
   * Timer
   */
  timer = new THREE.Timer();

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
  // renderer.inspector = new Inspector();

  /**
   * Controls
   */

  // Orbit Controls
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.minDistance = 0.1;
  orbit.maxDistance = 270;

  // Transform Controls
  transform = new TransformControls(camera, renderer.domElement);
  // Render the scene when transform controls changes
  transform.addEventListener("change", async () => {
    await renderer.init();
    renderer.render(scene, camera);
  });
  // Disable the orbit controls when transform controls is active
  transform.addEventListener("dragging-changed", (e) => {
    orbit.enabled = !e.value;
  });
  // Attach the splicingGroupGlobal to the transform controls (pivot point is wrong!)
  // transform.attach(splicingGroupGlobal);
  // Add the gizmo of the transform controls to the scene
  const transformGizmo = transform.getHelper();
  scene.add(transformGizmo);

  /**
   * Visualizer Group
   */
  visualizerGroup = new THREE.Group();
  visualizerGroup.name = "visualizerGroup";
  scene.add(visualizerGroup);

  /**
   * Axes Helper
   */
  scene.add(new THREE.AxesHelper(20));

  /**
   * Load HDR(IBL(Image-Based Lighting))
   */
  // const ultraHDRLoader = new UltraHDRLoader(GlobalLoadingManager);
  // ultraHDRLoader.setDataType(THREE.FloatType);

  // const loadEnvironment = () => {
  //   ultraHDRLoader.setDataType(THREE.HalfFloatType);

  //   ultraHDRLoader.load(HDRPath, (texture) => {
  //     texture.mapping = THREE.EquirectangularReflectionMapping;
  //     texture.needsUpdate = true;

  //     // scene.background = texture;
  //     scene.environment = texture;
  //   });
  // };
  // loadEnvironment();

  /**
   * Lights From AiBus
   */
  const applyLightsAiBus = () => {
    // === 改进的光源设置，更适合人头模型 ===
    // 主光（可旋转）
    rotatingLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rotatingLight.position.set(5, 10, 7);
    rotatingLight.castShadow = true;
    rotatingLight.name = "rotatingLight";
    scene.add(rotatingLight);

    // 补光 - 软化阴影
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-5, 3, 5);
    fillLight.name = "fillLight";
    scene.add(fillLight);

    // 背光 - 增强轮廓
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(0, 3, -10);
    rimLight.name = "rimLight";
    scene.add(rimLight);

    // 顶部环境光 - 确保头顶有足够的光线
    const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
    topLight.position.set(0, 10, 0);
    topLight.name = "topLight";
    scene.add(topLight);

    // 环境光 - 提供基础照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    ambientLight.name = "ambientLight";
    scene.add(ambientLight);

    // 半球光 - 提供更自然的环境照明
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.4);
    hemisphereLight.name = "hemisphereLight";
    scene.add(hemisphereLight);
  };
  applyLightsAiBus();

  /**
   * Load Models
   */

  // Uniforms used for TSL
  uBaseColor = uniform(color("#fff"));
  uIsShowMap = uniform(isShowMap.value ? 1 : 0);
  uOutlineColor = uniform(color("#0ff"));
  // Increase the value to make the outline thinner
  uOutlinePatternFactor = uniform(vec2(0.88, 0.9));

  // Toggle the map by using TSL.
  const applyMixedColorNode = (splicingGroupGlobal: THREE.Group) => {
    if (!splicingGroupGlobal || splicingGroupGlobal.children.length === 0)
      return;
    splicingGroupGlobal.children.forEach((groupChild) => {
      if (groupChild instanceof THREE.Group) {
        const uLocalToggleOutline = uniform(0);
        uLocalToggleOutline.name = `uLocalToggleOutline_${groupChild.name}`;
        // Set the old uLocalToggleOutline in the userData to null if it exists
        if (groupChild.userData.uLocalToggleOutline) {
          groupChild.userData.uLocalToggleOutline = null;
        }
        // Set the uLocalToggleOutline to the group's userData, not a mesh
        groupChild.userData.uLocalToggleOutline = uLocalToggleOutline;
        // Apply the mixed colorNode
        groupChild.children.forEach((child) => {
          if (
            child instanceof THREE.Mesh &&
            child.material instanceof THREE.MeshStandardNodeMaterial
          ) {
            child.material.colorNode = mix(
              mix(uBaseColor, materialColor, uIsShowMap),
              uOutlineColor,
              getOutlinePattern(uOutlinePatternFactor).mul(
                child.parent.userData.uLocalToggleOutline,
              ),
            );

            // child.material.colorNode = adjustAndManipulateColorNode();

            // child.material.colorNode = simplexNoise({
            //   scale: 2,
            //   balance: 0,
            //   contrast: 0,
            //   color: new THREE.Color(16777215),
            //   background: new THREE.Color(0),
            //   seed: 0,
            // });

            // child.material.colorNode = polkaDots({
            //   count: 2,
            //   size: 0.6,
            //   blur: 0.22,
            //   color: new THREE.Color(0),
            //   background: new THREE.Color(16777215),
            // });

            // Works if we indicate to the engine the material needs to be recompiled
            child.material.needsUpdate = true;
          }
        });
      }
    });
  };
  applyMixedColorNode(splicingGroupGlobal);

  /**
   * Post-Processing
   */
  // postProcessing = new THREE.PostProcessing(renderer);
  // const scenePass = pass(scene, camera);
  // const scenePassColor = scenePass.getTextureNode("output");

  // postProcessing.outputNode = scenePassColor.add(
  //   getPostProcessingNode(scenePassColor)
  // );

  /**
   * Inspector
   */
  // const guiInspector = (renderer.inspector as Inspector).createParameters(
  //   "Settings",
  // );
  // Add Debug for the camera
  // const guiInsCam = guiInspector.addFolder("Camera");
  // Near
  // guiInsCam
  //   .add(camera, "near", 0.001, 2)
  //   .name("Near")
  //   .onChange(() => {
  //     camera.updateProjectionMatrix();
  //   });
  // Far
  // guiInsCam
  //   .add(camera, "far", 500, 1000)
  //   .name("Far")
  //   .onChange(() => {
  //     camera.updateProjectionMatrix();
  //   });

  /**
   * Generate Facial Morphs
   */
  const generateFacialMorphsAndVisualizers = (
    isVisualizerDisabled: boolean = false,
    visualizer: string = "none",
  ) => {
    // console.log("\ngenerateFacialMorphsAndVisualizers called...");

    const hasManualTips =
      manualJawTipL.value ||
      manualJawTipR.value ||
      manualEyeBrowTipL.value ||
      manualEyeBrowTipR.value ||
      manualMouseCornerTipL.value ||
      manualMouseCornerTipR.value;

    const {
      visualizerNoseTip, // Vector3
      visualizerNostrilTipL, // Vector3
      visualizerNostrilTipR, // Vector3
      visualizerjawTipL, // Vector3
      visualizerjawTipR, // Vector3
      visualizerEyeBrowTipL, // Vector3
      visualizerEyeBrowTipR, // Vector3
      visualizerMouseCornerTipL, // Vector3
      visualizerMouseCornerTipR, // Vector3
      visualizerEarTipL, // Vector3
      visualizerEarTipR, // Vector3
      visualizerByNoseTipDetection, // Vector3[]
      visualizerByNostrilTipsDetection, // Vector3[]
      visualizerByJawTipsDetection, // Vector3[]
      visualizerByEyeBrowTipsDetection, // Vector3[]
      visualizerByMouseCornerTipsDetection, // Vector3[]
      visualizerByEarTipsDetection, // Vector3[]
      visualizerByNoseMorph, // Vector3[]
      visualizerByJawMorph, // Vector3[]
      visualizerByNostrilMorph, // Vector3[]
      visualizerByEyeBrowMorph, // Vector3[]
      visualizerByMouseCornersWidthMorph, // Vector3[]
      visualizerByEarMorph, // Vector3[]
    } = generateFacialMorphs(
      splicingGroupGlobal,
      hasManualTips
        ? {
            jawTipL: manualJawTipL.value || undefined,
            jawTipR: manualJawTipR.value || undefined,
            eyeBrowTipL: manualEyeBrowTipL.value || undefined,
            eyeBrowTipR: manualEyeBrowTipR.value || undefined,
            mouseCornerTipL: manualMouseCornerTipL.value || undefined,
            mouseCornerTipR: manualMouseCornerTipR.value || undefined,
          }
        : undefined,
    );

    if (isVisualizerDisabled || visualizer === "none") {
      clearVisualizerGroup();
      return;
    }

    // Remove the previous visualizers -> Clear the visualizerGroup
    clearVisualizerGroup();

    /**
     * Tips Visualizers
     */
    const visualizeTips = (selection: string = "all") => {
      const sharedBoxGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      /*
        Nose Tip Visualizer
      */
      const noseTipVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#f00", transparent: true }),
      );
      /*
        Nostril Tip Left Visualizer
      */
      const nostrilLTipVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#00f", transparent: true }),
      );
      /*
        Nostril Tip Right Visualizer
      */
      const nostrilRTipVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#00f", transparent: true }),
      );
      /*
        Jaw Tip Left Visualizer
      */
      const jawLTipVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#0ff", transparent: true }),
      );
      /*
        Jaw Tip Right Visualizer
      */
      const jawRTipVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#0ff", transparent: true }),
      );
      /*
        Eye Brow Tip Left Visualizer
      */
      const eyeBrowLTipVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#ff0", transparent: true }),
      );
      /*
        Eye Brow Tip Right Visualizer
      */
      const eyeBrowRTipVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#ff0", transparent: true }),
      );
      /*
        Mouse Tip Left Visualizer
      */
      const mouseTipLVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#0f0", transparent: true }),
      );
      /*
        Mouse Tip Right Visualizer
      */
      const mouseTipRVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#0f0", transparent: true }),
      );
      /*
        Ear Tip Left Visualizer
      */
      const earTipLVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#f0f", transparent: true }),
      );
      /*
        Ear Tip Right Visualizer
      */
      const earTipRVisMesh = new THREE.Mesh(
        sharedBoxGeo,
        new THREE.MeshBasicMaterial({ color: "#f0f", transparent: true }),
      );
      /*
        Set positions
      */
      noseTipVisMesh.position.copy(visualizerNoseTip);
      nostrilLTipVisMesh.position.copy(visualizerNostrilTipL);
      nostrilRTipVisMesh.position.copy(visualizerNostrilTipR);
      jawLTipVisMesh.position.copy(visualizerjawTipL);
      jawRTipVisMesh.position.copy(visualizerjawTipR);
      eyeBrowLTipVisMesh.position.copy(visualizerEyeBrowTipL);
      eyeBrowRTipVisMesh.position.copy(visualizerEyeBrowTipR);
      mouseTipLVisMesh.position.copy(visualizerMouseCornerTipL);
      mouseTipRVisMesh.position.copy(visualizerMouseCornerTipR);
      earTipLVisMesh.position.copy(visualizerEarTipL);
      earTipRVisMesh.position.copy(visualizerEarTipR);
      /*
        Add to scene
      */
      if (selection === "all") {
        visualizerGroup.add(noseTipVisMesh);
        visualizerGroup.add(nostrilLTipVisMesh);
        visualizerGroup.add(nostrilRTipVisMesh);
        visualizerGroup.add(jawLTipVisMesh);
        visualizerGroup.add(jawRTipVisMesh);
      } else if (selection === "nose") {
        visualizerGroup.add(noseTipVisMesh);
      } else if (selection === "nostril") {
        visualizerGroup.add(nostrilLTipVisMesh);
        visualizerGroup.add(nostrilRTipVisMesh);
      } else if (selection === "jaw") {
        visualizerGroup.add(jawLTipVisMesh);
        visualizerGroup.add(jawRTipVisMesh);
      } else if (selection === "eyeBrow") {
        visualizerGroup.add(eyeBrowLTipVisMesh);
        visualizerGroup.add(eyeBrowRTipVisMesh);
      } else if (selection === "mouseCornersWidth") {
        visualizerGroup.add(mouseTipLVisMesh);
        visualizerGroup.add(mouseTipRVisMesh);
      } else if (selection === "ear") {
        visualizerGroup.add(earTipLVisMesh);
        visualizerGroup.add(earTipRVisMesh);
      }
    };
    visualizeTips(visualizer);

    /**
     * Morphing Vertices Detection Visualizers
     */
    const visualizeMorphingDetectionVertices = (selection: string = "all") => {
      /*
        Create geometries from the corresponding vertices
      */
      // Nose tip geometry from detection vertices
      const visualizerByNoseTipsDetectionGeo =
        new THREE.BufferGeometry().setFromPoints(visualizerByNoseTipDetection);
      // Nostril tips geometry from detection vertices
      const visualizerByNostrilTipsDetectionGeo =
        new THREE.BufferGeometry().setFromPoints(
          visualizerByNostrilTipsDetection,
        );
      // Jaw tips geometry from detection vertices
      const visualizerByJawTipsDetectionGeo =
        new THREE.BufferGeometry().setFromPoints(visualizerByJawTipsDetection);
      // Eye brow tips geometry from detection vertices
      let visualizerByEyeBrowTipsDetectionGeo: THREE.BufferGeometry | null =
        null;
      if (visualizerByEyeBrowTipsDetection.length > 0) {
        visualizerByEyeBrowTipsDetectionGeo =
          new THREE.BufferGeometry().setFromPoints(
            visualizerByEyeBrowTipsDetection,
          );
      }
      // Mouse corner tips geometry from detection vertices
      let visualizerByMouseCornerTipsDetectionGeo: THREE.BufferGeometry | null =
        null;
      if (visualizerByMouseCornerTipsDetection.length > 0) {
        visualizerByMouseCornerTipsDetectionGeo =
          new THREE.BufferGeometry().setFromPoints(
            visualizerByMouseCornerTipsDetection,
          );
      }
      // Ear tips geometry from detection vertices
      const visualizerByEarTipsDetectionGeo =
        new THREE.BufferGeometry().setFromPoints(visualizerByEarTipsDetection);
      /*
        Create points from the corresponding geometries
      */
      // Nose tip detection points (Red)
      const noseTipsDetectionPoints = new THREE.Points(
        visualizerByNoseTipsDetectionGeo,
        new THREE.PointsMaterial({ color: "#f00", size: 0.15 }),
      );
      // Nostril tip detection points (Blue)
      const nostrilTipsDetectionPoints = new THREE.Points(
        visualizerByNostrilTipsDetectionGeo,
        new THREE.PointsMaterial({ color: "#00f", size: 0.15 }),
      );
      // Jaw tip detection points (Cyan)
      const jawTipsDetectionPoints = new THREE.Points(
        visualizerByJawTipsDetectionGeo,
        new THREE.PointsMaterial({ color: "#0ff", size: 0.15 }),
      );

      // Eye brow tip detection points (Yellow)
      let eyeBrowTipsDetectionPoints: THREE.Points | null = null;
      if (visualizerByEyeBrowTipsDetectionGeo) {
        eyeBrowTipsDetectionPoints = new THREE.Points(
          visualizerByEyeBrowTipsDetectionGeo,
          new THREE.PointsMaterial({ color: "#ff0", size: 0.15 }),
        );
      }
      // Mouse tip detection points (Green)
      let mouseCornerTipsDetectionPoints: THREE.Points | null = null;
      if (visualizerByMouseCornerTipsDetectionGeo) {
        mouseCornerTipsDetectionPoints = new THREE.Points(
          visualizerByMouseCornerTipsDetectionGeo,
          new THREE.PointsMaterial({ color: "#0f0", size: 0.15 }),
        );
      }
      // Ear tip detection points (Purple)
      const earTipsDetectionPoints = new THREE.Points(
        visualizerByEarTipsDetectionGeo,
        new THREE.PointsMaterial({ color: "#f0f", size: 0.15 }),
      );
      /*
        Add to scene
      */
      if (selection === "all") {
        visualizerGroup.add(noseTipsDetectionPoints);
        visualizerGroup.add(nostrilTipsDetectionPoints);
        visualizerGroup.add(jawTipsDetectionPoints);
        eyeBrowTipsDetectionPoints &&
          visualizerGroup.add(eyeBrowTipsDetectionPoints);
        mouseCornerTipsDetectionPoints &&
          visualizerGroup.add(mouseCornerTipsDetectionPoints);
      } else if (selection === "nose") {
        visualizerGroup.add(noseTipsDetectionPoints);
      } else if (selection === "nostril") {
        visualizerGroup.add(nostrilTipsDetectionPoints);
      } else if (selection === "jaw") {
        visualizerGroup.add(jawTipsDetectionPoints);
      } else if (eyeBrowTipsDetectionPoints && selection === "eyeBrow") {
        visualizerGroup.add(eyeBrowTipsDetectionPoints);
      } else if (
        mouseCornerTipsDetectionPoints &&
        selection === "mouseCornersWidth"
      ) {
        visualizerGroup.add(mouseCornerTipsDetectionPoints);
      } else if (selection === "ear") {
        visualizerGroup.add(earTipsDetectionPoints);
      }
    };
    // visualizeMorphingDetectionVertices(visualizer);

    /**
     * Morphing Vertices Visualizers
     */
    const visualizeMorphingVertices = (selection: string = "all") => {
      /*
        Create geometries from the corresponding vertices
      */
      // Nose morph geometry from morph vertices
      const visualizerByNoseMorphGeo = new THREE.BufferGeometry().setFromPoints(
        visualizerByNoseMorph,
      );
      // Nostril morph geometry from morph vertices
      const visualizerByNostrilMorphGeo =
        new THREE.BufferGeometry().setFromPoints(visualizerByNostrilMorph);
      // Jaw morph geometry from morph vertices
      const visualizerByJawMorphGeo = new THREE.BufferGeometry().setFromPoints(
        visualizerByJawMorph,
      );
      // Eye brow morph geometry from morph vertices
      const visualizerByEyeBrowMorphGeo =
        new THREE.BufferGeometry().setFromPoints(visualizerByEyeBrowMorph);
      // Mouse corners width morph geometry from morph vertices
      const visualizerByMouseCornersWidthMorphGeo =
        new THREE.BufferGeometry().setFromPoints(
          visualizerByMouseCornersWidthMorph,
        );
      // Ear morph geometry from morph vertices
      const visualizerByEarMorphGeo = new THREE.BufferGeometry().setFromPoints(
        visualizerByEarMorph,
      );
      /*
        Create points from the corresponding geometries
      */
      // Nose morph points (Red)
      const noseMorphPoints = new THREE.Points(
        visualizerByNoseMorphGeo,
        new THREE.PointsMaterial({ color: "#f00", size: 5 }),
      );
      // Nostril morph points (Blue)
      const nostrilMorphPoints = new THREE.Points(
        visualizerByNostrilMorphGeo,
        new THREE.PointsMaterial({ color: "#00f", size: 0.15 }),
      );
      // Jaw morph points (Cyan)
      const jawMorphPoints = new THREE.Points(
        visualizerByJawMorphGeo,
        new THREE.PointsMaterial({ color: "#0ff", size: 0.15 }),
      );
      // Eye brow morph points (Yellow)
      const eyeBrowMorphPoints = new THREE.Points(
        visualizerByEyeBrowMorphGeo,
        new THREE.PointsMaterial({ color: "#ff0", size: 0.15 }),
      );
      // Mouse corners width morph points (Green)
      const mouseCornersWidthMorphPoints = new THREE.Points(
        visualizerByMouseCornersWidthMorphGeo,
        new THREE.PointsMaterial({ color: "#0f0", size: 0.15 }),
      );
      // Ear morph points (Purple)
      const earMorphPoints = new THREE.Points(
        visualizerByEarMorphGeo,
        new THREE.PointsMaterial({ color: "#f0f", size: 0.15 }),
      );
      /*
        Add to scene
      */
      if (selection === "all") {
        visualizerGroup.add(noseMorphPoints);
        visualizerGroup.add(nostrilMorphPoints);
        visualizerGroup.add(jawMorphPoints);
        visualizerGroup.add(eyeBrowMorphPoints);
        visualizerGroup.add(mouseCornersWidthMorphPoints);
        visualizerGroup.add(earMorphPoints);
      } else if (selection === "nose") {
        visualizerGroup.add(noseMorphPoints);
      } else if (selection === "nostril") {
        visualizerGroup.add(nostrilMorphPoints);
      } else if (selection === "jaw") {
        visualizerGroup.add(jawMorphPoints);
      } else if (selection === "eyeBrow") {
        visualizerGroup.add(eyeBrowMorphPoints);
      } else if (selection === "mouseCornersWidth") {
        visualizerGroup.add(mouseCornersWidthMorphPoints);
      } else if (selection === "ear") {
        visualizerGroup.add(earMorphPoints);
      }
    };
    visualizeMorphingVertices(visualizer);
  };
  // Disable the visualizers if it is for production
  const isVisualizerDisabled = import.meta.env.PROD;
  /*
    nose
    nostril
    jaw
    eyeBrow
    mouseCornersWidth
    ear
   */
  const selectedVisualizer = "none";
  // generateFacialMorphsAndVisualizers(isVisualizerDisabled, selectedVisualizer);

  /**
   * Add the global group
   */
  // splicingGroupGlobal.add(new THREE.AxesHelper(10));
  scene.add(splicingGroupGlobal);

  /**
   * Theatre Animation Setup
   */
  const splicingGroupGlobalSheetObj = theatreSheet.object(
    "Splicing Group Global / Transformation",
    {
      rotation: types.compound({
        x: types.number(splicingGroupGlobal.rotation.x, {
          range: [-2 * Math.PI, 2 * Math.PI],
        }),
        y: types.number(splicingGroupGlobal.rotation.y, {
          range: [-2 * Math.PI, 2 * Math.PI],
        }),
        z: types.number(splicingGroupGlobal.rotation.z, {
          range: [-2 * Math.PI, 2 * Math.PI],
        }),
      }),
      position: types.compound({
        x: types.number(splicingGroupGlobal.position.x, { range: [-10, 10] }),
        y: types.number(splicingGroupGlobal.position.y, { range: [-10, 10] }),
        z: types.number(splicingGroupGlobal.position.z, { range: [-10, 10] }),
      }),
      scale: types.compound({
        x: types.number(splicingGroupGlobal.scale.x, { range: [0, 10] }),
        y: types.number(splicingGroupGlobal.scale.y, { range: [0, 10] }),
        z: types.number(splicingGroupGlobal.scale.z, { range: [0, 10] }),
      }),
    },
  );

  splicingGroupGlobalSheetObj.onValuesChange((values) => {
    const { x: rotX, y: rotY, z: rotZ } = values.rotation;
    const { x: posX, y: posY, z: posZ } = values.position;
    const { x: scaleX, y: scaleY, z: scaleZ } = values.scale;
    splicingGroupGlobal.rotation.set(rotX, rotY, rotZ);
    splicingGroupGlobal.position.set(posX, posY, posZ);
    splicingGroupGlobal.scale.set(scaleX, scaleY, scaleZ);
  });

  // theatreProject.ready.then(() =>
  //   theatreSheet.sequence.play({ iterationCount: Infinity }),
  // );

  /**
   * Water based on THREE.WaterMesh
   */
  // const waterGeo = new THREE.PlaneGeometry(10000, 10000);
  // const waterNormals = await TextureLoaderInstance.loadAsync(
  //   "textures/official/waternormals.jpg"
  // );
  // waterNormals.colorSpace = THREE.SRGBColorSpace;
  // waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

  // const water = new WaterMesh(waterGeo, {
  //   waterNormals: waterNormals,
  //   sunDirection: new THREE.Vector3(0, 0, 0),
  //   sunColor: 0xffffff,
  //   waterColor: 0x001e0f,
  //   distortionScale: 3.7,
  // });

  // water.rotation.x = -Math.PI / 2;
  // water.position.y = 122;
  // scene.add(water);

  /**
   * Watchers from vue
   */
  // Re-traverse the splicingGroupGlobal and reapply the mixed colorNode to all the materials of meshes by using `watch` from vue on splicingGroupLen state to solve the issue of the map not being toggled when the models are loaded.
  watch(splicingGroupLen, () => {
    applyMixedColorNode(splicingGroupGlobal);
  });

  // Reapply the mixed colorNode and the visualizers if head model changes (gender or subpath)
  watch([isDefaultHeadFemale, currentHeadModelSubPath], () => {
    applyMixedColorNode(splicingGroupGlobal);
    clearVisualizerGroup();
    modelsStore.setIsManualMorphGenerationMode(false);
    modelsStore.setManualMorphSelectionStage(null);
  });

  // Update the uniformIsShowMap based on the global isShowMap boolean
  watch(isShowMap, (newVal) => {
    uIsShowMap.value = newVal ? 1 : 0;
  });

  /*
    Manual Morph Generation Trigger Watcher
   */
  watch(manualMorphReadyTimestamp, (newVal) => {
    if (newVal > 0) {
      console.log(
        "\nmanualMorphReadyTimestamp changed -> triggering facial morph generation...",
      );
      generateFacialMorphsAndVisualizers(
        isVisualizerDisabled,
        selectedVisualizer,
      );

      // Set the isMorphTargetReady state to true
      modelsStore.setIsMorphTargetReady(true);

      // Auto disable manual mode after success
      modelsStore.setIsManualMorphGenerationMode(false);
    }
  });

  /**
   * Clear All the Visualizers Watcher
   */
  watch(isManualMorphGenerationMode, (newVal) => {
    // Clear the visualizers if manual morph generation mode is disabled
    if (!newVal) clearVisualizerGroup();
    else {
      /*
        We get the head node from the selected object with the index 0 as the selectedObject is currently the Head Group only, and we can get the head mesh from the children of the head group
       */
      const headNode = selectedObject.value?.children[0] as THREE.Mesh;

      /*
        The morphTargetDictionary is automatically generated by Three.js
        based on the .name property of each BufferAttribute in geometry.morphAttributes.position.
        Instead of manually resetting the dictionary after updateMorphTargets(), we name the 
        attributes correctly in the source (meshOps/index.ts).
       */
      headNode.updateMorphTargets();

      console.log(
        "\n-- Global State [isManualMorphGenerationMode] changed to true -- headNode after updateMorphTargets -> ",
        headNode,
      );
    }
  });
};

/**
 * On Window Resize fn
 */
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

/**
 * Mouse position vector to be used for raycasting
 */
const mouse = new THREE.Vector2();

/**
 * Toggle the outline visibility for the object by setting the userData.uLocalToggleOutline uniform in the parent group or mesh.
 * @param object THREE.Object3D
 * @param isVisible boolean
 */
const setOutlineEffectVisibility = (
  object: THREE.Object3D | null,
  isVisible: boolean,
) => {
  if (!object) return;
  const value = isVisible ? 1 : 0;
  if (object instanceof THREE.Mesh) {
    if (object.parent?.userData.uLocalToggleOutline)
      object.parent.userData.uLocalToggleOutline.value = value;
  } else if (object instanceof THREE.Group) {
    object.userData.uLocalToggleOutline.value = value;
  }
};

/**
 * On Pointer Move fn
 * @param event PointerEvent
 */
const onPointerMove = (event: PointerEvent) => {
  if (raycasterIntersectionObject) {
    // raycasterIntersectionObject.children.forEach((child) => {
    //   if (child instanceof THREE.Mesh) {
    //     child.material.color.set("#fff");
    //   }
    // });
    setOutlineEffectVisibility(raycasterIntersectionObject, false);
    raycasterIntersectionObject = null;
    // if (uOutlinePatternFactor) uOutlinePatternFactor.value.set(0.99, 0.999);
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the raycaster
  raycaster.setFromCamera(mouse, camera);

  // Intersect objects
  const intersects = raycaster.intersectObject(splicingGroupGlobal, true);

  if (intersects.length > 0) {
    const firstIntersectedObject = intersects.filter(
      (intersection: THREE.Intersection<THREE.Object3D>) => {
        return intersection && intersection.object;
      },
    )[0];
    if (firstIntersectedObject && firstIntersectedObject.object) {
      // console.log("\nfirstIntersectedObject ->", firstIntersectedObject.object);
      // Get the Parent Group
      const parentGroup = firstIntersectedObject.object.parent;
      console.log(
        "\nintersected parent Group while mouse moving ->",
        parentGroup,
      );
      // Set raycasterIntersectionObject
      raycasterIntersectionObject = parentGroup;
      setOutlineEffectVisibility(raycasterIntersectionObject, true);
    }
  }
};

/**
 * On Window Drag Over fn, handle the event of object been intersected by the raycaster.
 * Including:
 * 1. Set the global dragHoveredObject to the firstIntersection casted by ray.
 * 2. Set the global selectedObject to the firstIntersection casted by ray.
 * 3. Toggle the visibility of the outline effect.
 * @param e DragEvent
 */
const onWindowDragOver = (e: DragEvent) => {
  e.preventDefault();

  // Check if there's a previous dragHoveredObject in the modelsStore
  if (modelsStore.dragHoveredObject) {
    /*
      Set the outline effect to be invisible
     */
    setOutlineEffectVisibility(modelsStore.dragHoveredObject, false);
    /*
      Set the global dragHoveredObject in modelsStore to null
     */
    modelsStore.setDragHoveredObject(null);
  }

  // Calculate mouse position for raycasting
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  // Updates the ray with the camera origin and direction based on the mouse
  raycaster.setFromCamera(mouse, camera);
  // Get the intersected objects that are casted by the ray (closest first)
  const intersects = raycaster.intersectObject(splicingGroupGlobal, true);

  // Check if the intersected objects are the length greater than 0
  if (intersects.length > 0) {
    // Get the first intersection
    const firstIntersection = intersects.filter((intersect) => {
      return intersect && intersect.object;
    })[0];

    // Check if the firstIntersection is valid and is a mesh.
    if (firstIntersection && firstIntersection.object instanceof THREE.Mesh) {
      if (modelsStore.dragHoveredObject !== firstIntersection.object) {
        /*
          Set the global dragHoveredObject to the firstIntersection
         */
        modelsStore.setDragHoveredObject(firstIntersection.object);

        /*
          Set the raycasterIntersectionObject to the firstIntersection so we
          can set the outline effect to be invisible by clicking
          outside of the 3D Objects
         */
        raycasterIntersectionObject = firstIntersection.object;

        /*
          Set the outline effect to be visible
        */
        setOutlineEffectVisibility(modelsStore.dragHoveredObject, true);
      }
    }
  }
};

/**
 * On mouse click fn, handle the event of object been intersected by the raycaster.
 * Including:
 * 1. Attach the transform control to the parent group of the casted mesh by the ray.
 * 2. Set the global selected object in modelsStore to the parent group.
 * 3. Toggle the visibility of the outline effect.
 * @param e MouseEvent
 */
const onMouseClick = (e: MouseEvent) => {
  // Check if there's a previous selected raycasterIntersectionObject
  if (raycasterIntersectionObject) {
    /*
      Set the outline effect to be invisible
     */
    setOutlineEffectVisibility(raycasterIntersectionObject, false);
    /*
      Set the raycasterIntersectionObject to null
     */
    raycasterIntersectionObject = null;
  }

  // Check if there is a previous selected object in modelsStore
  if (modelsStore.selectedObject) {
    /*
      Set the outline effect to be invisible
     */
    setOutlineEffectVisibility(modelsStore.selectedObject, false);
    /*
      Set the global selected object in modelsStore to null
     */
    modelsStore.setSelectedObject(null);
  }

  // Calculate mouse position for raycasting
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  // Updates the ray with camera origin and direction based on the mouse
  raycaster.setFromCamera(mouse, camera);
  // Get the intersected objects that are casted by the ray (closest first)
  const intersects = raycaster.intersectObject(splicingGroupGlobal, true);

  // Check if the intersected objects are the length greater than 0
  if (intersects.length > 0) {
    // Get the first intersection
    const firstIntersection = intersects.filter((intersect) => {
      return intersect && intersect.object;
    })[0];

    // Check if the first intersected object is valid
    if (firstIntersection && firstIntersection.object) {
      console.log(
        "\n -- onMouseClick -- firstIntersection ->",
        firstIntersection,
      );

      // Get the Parent Group of the first intersected object
      const intersectionParent = firstIntersection.object
        .parent as THREE.Group<THREE.Object3DEventMap>;

      // Clicked outside of head model? -> exit manual morph mode
      const isHeadModel = intersectionParent.name
        .toLocaleLowerCase()
        .includes(CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase());

      if (isManualMorphGenerationMode.value && !isHeadModel) {
        modelsStore.setIsManualMorphGenerationMode(false);
      }

      // Handle Manual Morph Tip Selection
      if (
        isManualMorphGenerationMode.value &&
        manualMorphSelectionStage.value &&
        isHeadModel
      ) {
        console.log(
          "\n ---- onMouseClick -- Ready to do manual morph tip selection ---- ",
        );

        const intersectionPoint = firstIntersection.point;

        // Mirrored point calculation
        const mirroredPoint = new THREE.Vector3(
          intersectionPoint.x * -1,
          intersectionPoint.y,
          intersectionPoint.z,
        );

        // Determine L and R tips based on X value
        // User stated: "The corresponding L tip is the intersected point with the negative value on the X axis, and positive value for the R tip."
        const pointL =
          intersectionPoint.x < 0 ? intersectionPoint.clone() : mirroredPoint;
        const pointR =
          intersectionPoint.x >= 0 ? intersectionPoint.clone() : mirroredPoint;

        // Set the tips in the store
        modelsStore.setManualMorphTips(
          manualMorphSelectionStage.value,
          pointL,
          pointR,
        );

        // Clear the previous visualizer with the same stage
        clearMorphVisualizerByStage(manualMorphSelectionStage.value + "_");

        // Visual feedback (optional: we can add small temporary spheres or boxes)
        const sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
        const pointVisualizer = new THREE.Mesh(
          sphereGeometry,
          new THREE.MeshBasicMaterial({ color: "#ff0" }),
        );
        const pointVisualizerMirrored = new THREE.Mesh(
          sphereGeometry,
          new THREE.MeshBasicMaterial({ color: "#00f" }),
        );
        pointVisualizer.name = `${manualMorphSelectionStage.value}_pointVisualizer`;
        pointVisualizerMirrored.name = `${manualMorphSelectionStage.value}_pointVisualizerMirrored`;
        pointVisualizer.position.copy(pointL);
        pointVisualizerMirrored.position.copy(pointR);
        visualizerGroup.add(pointVisualizer);
        visualizerGroup.add(pointVisualizerMirrored);

        console.log(
          `\n -- onMouseClick -- Specified tips for ${manualMorphSelectionStage.value} -> \nL:`,
          pointL,
          "\n",
          "R:",
          pointR,
        );
        // return; // Skip normal selection if in tip selection mode
      }

      /*
        Attach the transform to the intersectedParentGroup
       */
      // if (intersectionParent.name !== CutHeadEyesNodeCombinedGroupName)
      //   transform.attach(intersectionParent);

      /*
        Set the global selected object in modelsStore to the intersectedParentGroup
       */
      modelsStore.setSelectedObject(intersectionParent);
      console.log(
        "\n -- onMouseClick -- setSelectedObject ->",
        modelsStore.selectedObject,
      );

      /*
        Set the outline effect to be visible
       */
      setOutlineEffectVisibility(intersectionParent, true);

      // --- Focus Point Implementation ---
      const intersectionPoint = firstIntersection.point;
      clickedPoint.value = intersectionPoint.clone();

      // Update screen position for the UI indicator
      const vector = intersectionPoint.clone().project(camera);
      indicatorPos.value = {
        x: (vector.x * 0.5 + 0.5) * window.innerWidth,
        y: (-(vector.y * 0.5) + 0.5) * window.innerHeight,
      };

      showFocusIndicator.value = true;
      // We don't reset isFocusedOnPoint here yet,
      // because we might just be clicking a new point while already focused.
      // But if we click a new point, we want the "Press . to focus" to reappear.
      isFocusedOnPoint.value = false;
    }
  } else {
    // If the user clicked outside of the head model (background)
    if (isManualMorphGenerationMode.value) {
      modelsStore.setIsManualMorphGenerationMode(false);
    }
    // Hide focus indicator when clicking background? Blender usually keeps it until next click.
    // Let's hide it for clarity if we miss.
    showFocusIndicator.value = false;
  }
};

/**
 * Key down event handler
 * @param event KeyboardEvent
 */
const onKeyDown = (event: KeyboardEvent) => {
  const code = event.code;
  // console.log("\Key down code ->", code);

  switch (code.toLocaleLowerCase()) {
    case "keyq":
      transform?.setSpace(transform?.space === "local" ? "world" : "local");
      break;
    case "keyw":
      transform?.setMode("translate");
      break;
    case "keye":
      transform?.setMode("rotate");
      break;
    case "keyr":
      transform?.setMode("scale");
      break;
    case "minus":
      transform?.setSize(transform?.size - 0.1);
      break;
    case "equal":
      transform?.setSize(transform?.size + 0.1);
      break;
    case "space":
      transform && (transform.enabled = !transform.enabled);
      break;
    case "shiftleft":
    case "shiftright":
      transform?.setTranslationSnap(1);
      transform?.setRotationSnap(THREE.MathUtils.degToRad(15));
      transform?.setScaleSnap(0.08);
      break;
    case "keyx":
      transform && (transform.showX = !transform.showX);
      break;
    case "keyy":
      transform && (transform.showY = !transform.showY);
      break;
    case "keyz":
      transform && (transform.showZ = !transform.showZ);
      break;
    case "numpaddecimal":
    case "period":
      if (clickedPoint.value) {
        orbitControlsTargetCenter.copy(clickedPoint.value);
        isFocusedOnPoint.value = true;
        showFocusIndicator.value = false;
      }
      break;
    default:
      break;
  }
};

/**
 * Key up event handler
 * @param event KeyboardEvent
 */
const onKeyUp = (event: KeyboardEvent) => {
  const code = event.code;
  // console.log("\nKey up code ->", code);

  switch (code.toLocaleLowerCase()) {
    case "shiftleft":
    case "shiftright":
      transform?.setTranslationSnap(null);
      transform?.setRotationSnap(null);
      transform?.setScaleSnap(null);
      break;
    default:
      break;
  }
};

/**
 * Animation fn used for renderer
 */
let t: number;
const animate = async () => {
  // Elapsed Time
  timer.update();
  t = timer.getElapsed();
  // console.log("\ntime ->", time);

  /*
    Update controls
   */
  orbit.target.lerp(orbitControlsTargetCenter, 0.1);
  orbit.update();

  /*
    Update focus indicator position (keep it pinned to the 3D point)
   */
  if (showFocusIndicator.value && clickedPoint.value) {
    const vector = clickedPoint.value.clone().project(camera);
    indicatorPos.value = {
      x: (vector.x * 0.5 + 0.5) * window.innerWidth,
      y: (-(vector.y * 0.5) + 0.5) * window.innerHeight,
    };
  }

  /*
    Update Light
   */
  // 主光旋转
  if (rotatingLight) {
    rotatingLight.position.x = Math.cos(t) * 15;
    rotatingLight.position.z = Math.sin(t) * 15;
  }

  /*
    Update renderer
   */
  await renderer.init();
  renderer.render(scene, camera);

  /*
    Post-Processing
   */
  // await postProcessing.renderer.init();
  // postProcessing.render();
};

/**
 * Component on mounted fn
 */
onMounted(async () => {
  init();
  animate();
  window.addEventListener("resize", onWindowResize);
  // document.addEventListener("pointermove", onPointerMove);
  window.addEventListener("click", onMouseClick);
  // Drag over listener for raycasting
  window.addEventListener("dragover", onWindowDragOver);
  // Key down listener for transform
  window.addEventListener("keydown", onKeyDown);
  // Key up listener for transform
  window.addEventListener("keyup", onKeyUp);
});

/**
 * Component on before unmounted fn
 */
onBeforeUnmount(() => {
  console.log("\nReady to dispose the SplicingModels Component...");
  // Unsubscribe the callback fn is called based on the actions in the modelsStore
  unsubscribeModelsStoreActions();

  // Dispose timer
  timer.dispose();

  // Dispose operations
  orbit.dispose();
  renderer.dispose();

  // Remove resize listener
  window.removeEventListener("resize", onWindowResize);

  // Remove pointer move listener
  // document.removeEventListener("pointermove", onPointerMove);

  // Remove pointer down listener
  window.removeEventListener("click", onMouseClick);

  // Remove drag over listener
  window.removeEventListener("dragover", onWindowDragOver);

  // Remove key down listener
  window.removeEventListener("keydown", onKeyDown);

  // Remove key up listener
  window.removeEventListener("keyup", onKeyUp);
});
</script>
