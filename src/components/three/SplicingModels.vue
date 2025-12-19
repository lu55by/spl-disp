<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { UltraHDRLoader } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three/webgpu";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CameraProps, HDRPath } from "../../three/constants";
import { addTransformDebug } from "../../three/gui";
import { GUIGlobal } from "../../three/gui/global";
import { GlobalLoadingManager } from "../../three/managers/GlobalLoadingManager";
import { getObject3DBoundingBoxCenter } from "../../three/meshOps";
import { color, materialColor, mix, uniform } from "three/tsl";

/**
 * Canvas Element
 */
const canvasEle = ref<HTMLCanvasElement | null>(null);

/**
 * Models Store
 */
const modelsStore = useModelsStore();
const { splicingGroupGlobal } = modelsStore;
const { isShowMap } = storeToRefs(modelsStore);

/*
  Orbit Controls Target Center Update Logic
 */
const orbitControlsTargetCenter = new THREE.Vector3();
const updateOrbitControlsTargetCenter = () => {
  console.log("\nupdateOrbitControlsTargetCenter called...");
  console.log(
    "\nsplicingGroupGlobal in SplicingModels after updateOrbitControlsTargetCenter ->",
    splicingGroupGlobal
  );
  // Log all the material names
  // splicingGroupGlobal.traverse((object) => {
  //   if (object instanceof THREE.Mesh) {
  //     console.log("\nMaterial Name ->", object.material.name);
  //   }
  // });
  orbitControlsTargetCenter.copy(
    getObject3DBoundingBoxCenter(splicingGroupGlobal)
  );
};

updateOrbitControlsTargetCenter();

const unsubscribeModelsStoreActions = modelsStore.$onAction(
  ({ name, after }) => {
    const relevantActions = ["addChild", "clear", "importObj"];
    if (relevantActions.includes(name)) {
      after(() => {
        updateOrbitControlsTargetCenter();
      });
    }
  }
);

/**
 * Objects of three definition
 */
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
  addTransformDebug("Camera", GUIGlobal, camera, {
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
   * Load HDR(IBL(Image-Based Lighting))
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
  const uniformBaseColor = uniform(color("#fff"));
  const uniformIsShowMap = uniform(isShowMap.value ? 1 : 0);

  // Toggle the map by using TSL.
  splicingGroupGlobal.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof THREE.MeshStandardNodeMaterial
    ) {
      // console.log(`\nChild ${child.name} to be mixed ->`, child);
      child.material.colorNode = mix(
        uniformBaseColor,
        materialColor,
        uniformIsShowMap
      );
    }
  });

  // Update the uniformIsShowMap based on the global isShowMap boolean
  // uniformIsShowMap.value = isShowMap.value ? 1 : 0;

  watch(isShowMap, (newVal) => {
    console.log("\nisShowMap changed to ->", newVal);
    uniformIsShowMap.value = newVal ? 1 : 0;
  });

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
  controls.target.lerp(orbitControlsTargetCenter, 0.1);
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
  console.log("\nReady to dispose the SplicingModels Component...");
  // Unsubscribe the callback fn is called based on the actions in the modelsStore
  unsubscribeModelsStoreActions();

  // Dispose operations
  controls.dispose();
  renderer.dispose();

  // Remove resize listener
  window.removeEventListener("resize", onWindowResize);
});
</script>
