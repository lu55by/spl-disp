<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>

<script setup lang="ts">
import { AxesHelper } from "three";
import { UltraHDRLoader } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three/webgpu";
import type { Pane } from "tweakpane";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CameraProps, HDRPath } from "../../three/constants";
import { GlobalLoadingManager } from "../../three/managers/GlobalLoadingManager";

// Canvas Element
const canvasEle = ref<HTMLCanvasElement | null>(null);

const { group: globalGroup, guiGlobal, cuttersModelGlobal } = useModelsStore();
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
  scene.add(globalGroup);
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
