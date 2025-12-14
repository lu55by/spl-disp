<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>

<script setup lang="ts">
import { UltraHDRLoader } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three/webgpu";
import type { Pane } from "tweakpane";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CameraProps, HDRPath } from "../../three/constants";
import { addTransformDebug } from "../../three/gui";
import { GlobalLoadingManager } from "../../three/managers/GlobalLoadingManager";
import { getObject3DBoundingBoxCenter } from "../../three/meshOps";

// Canvas Element
const canvasEle = ref<HTMLCanvasElement | null>(null);

const modelsStore = useModelsStore();
const { splicingGroupGlobal, guiGlobal } = modelsStore;
console.log("Global Group ->", splicingGroupGlobal);

const targetCenter = new THREE.Vector3();

const updateTargetCenter = () => {
  console.log("\nupdateTargetCenter called...");
  targetCenter.copy(getObject3DBoundingBoxCenter(splicingGroupGlobal));
};

updateTargetCenter();

const unsubscribe = modelsStore.$onAction(({ name, after }) => {
  const relevantActions = ["addChild", "clear", "importObj"];
  if (relevantActions.includes(name)) {
    after(() => {
      updateTargetCenter();
    });
  }
});

let camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGPURenderer,
  controls: OrbitControls;
// clock: THREE.Clock;

const width = window.innerWidth;
const height = window.innerHeight;

// Init scene fn
const init = async () => {
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
  addTransformDebug("Camera", guiGlobal as Pane, camera, {
    posMin: -300,
    posMax: 300,
  });

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

  /**
   * Controls
   */
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  // controls.target.set(
  //   splicingGroupGlobal.position.x,
  //   splicingGroupGlobal.position.y,
  //   splicingGroupGlobal.position.z
  // );
  controls.minDistance = 0.1;
  controls.maxDistance = 170;

  /**
   * Axes Helper
   */
  // scene.add(new AxesHelper(20));

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
  scene.add(splicingGroupGlobal);
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
  // const time = clock.getElapsedTime();

  /*
    Update controls
   */
  controls.target.lerp(targetCenter, 0.1);
  controls.update();

  /*
    Update renderer
   */
  await renderer.init();
  renderer.render(scene, camera);
};

onMounted(async () => {
  init();
  animate();
  window.addEventListener("resize", onWindowResize);
});

onBeforeUnmount(() => {
  unsubscribe();
  console.log("\nReady to dispose the SplicingModels Component...");
  // Dispose operations
  controls.dispose();
  renderer.dispose();

  // Remove resize listener
  window.removeEventListener("resize", onWindowResize);
});
</script>
