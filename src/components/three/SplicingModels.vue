<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { UltraHDRLoader } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  cameraPosition,
  color,
  dot,
  materialColor,
  mix,
  normalLocal,
  positionLocal,
  smoothstep,
  uniform,
  vec2,
} from "three/tsl";
import * as THREE from "three/webgpu";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CameraProps, HDRPath } from "../../three/constants";
import { addTransformDebug } from "../../three/gui";
import { GUIGlobal } from "../../three/gui/global";
import { GlobalLoadingManager } from "../../three/managers/GlobalLoadingManager";
import { getObject3DBoundingBoxCenter } from "../../three/meshOps";

/**
 * Canvas Element
 */
const canvasEle = ref<HTMLCanvasElement | null>(null);

/**
 * Models Store
 */
const modelsStore = useModelsStore();
const { splicingGroupGlobal } = modelsStore;
const { splicingGroupLen, isShowMap } = storeToRefs(modelsStore);

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
  controls: OrbitControls,
  raycaster: THREE.Raycaster,
  // uniforms
  uniformOutlineFactor: THREE.UniformNode<THREE.Vector2>,
  // raycaster intersection object
  raycasterIntersectionObject: THREE.Object3D | null;
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
  // addTransformDebug("Camera", GUIGlobal, camera, {
  //   posMin: -300,
  //   posMax: 300,
  // });

  /**
   * Scene
   */
  scene = new THREE.Scene();

  /**
   * Raycaster
   */
  raycaster = new THREE.Raycaster();

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

  // Uniforms
  const uniformBaseColor = uniform(color("#fff"));
  const uniformIsShowMap = uniform(isShowMap.value ? 1 : 0);
  const uniformOutlineColor = uniform(color("#0ff"));
  uniformOutlineFactor = uniform(vec2(0.98, 0.99));

  // Effect Patterns

  // Outline Effect Pattern
  const outlinePat = smoothstep(
    // TODO: Change the factor values based on the raycastered object
    uniformOutlineFactor.x,
    uniformOutlineFactor.y,
    dot(positionLocal.sub(cameraPosition).normalize(), normalLocal)
      .abs()
      .oneMinus()
  );

  // Toggle the map by using TSL.
  const applyMixedColorNode = (splicingGroupGlobal: THREE.Group) => {
    splicingGroupGlobal.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material instanceof THREE.MeshStandardNodeMaterial
      ) {
        /*
          Mix the mixed baseColor and materialColor with outlineColor based on the outlinePat
        */
        child.material.colorNode = mix(
          mix(uniformBaseColor, materialColor, uniformIsShowMap),
          uniformOutlineColor,
          outlinePat
        );
        /*
          Mix the baseColor and materialColor based on the uniformIsShowMap
        */
        // child.material.colorNode = mix(
        //   uniformBaseColor,
        //   materialColor,
        //   uniformIsShowMap
        // );
      }
    });
  };
  applyMixedColorNode(splicingGroupGlobal);

  // Re-traverse the splicingGroupGlobal and reapply the mixed colorNode to all the materials of meshes by using `watch` from vue on splicingGroupLen state to solve the issue of the map not being toggled when the models are loaded.
  watch(splicingGroupLen, (newLength, oldLength) => {
    console.log(
      `\n -- init -- splicingGroupLen changed from ${oldLength} to ${newLength}`
    );
    applyMixedColorNode(splicingGroupGlobal);
  });

  // Update the uniformIsShowMap based on the global isShowMap boolean
  watch(isShowMap, (newVal) => {
    console.log("\n -- init -- isShowMap changed to ->", newVal);
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

// On Pointer Move fn
const onPointerMove = (event: PointerEvent) => {
  if (raycasterIntersectionObject) {
    console.log(
      "\n -- onPointerMove -- raycasterIntersectionObject ->",
      raycasterIntersectionObject
    );
    // raycasterIntersectionObject.children.forEach((child) => {
    //   if (child instanceof THREE.Mesh) {
    //     child.material.color.set("#fff");
    //   }
    // });
    raycasterIntersectionObject = null;
    if (uniformOutlineFactor) uniformOutlineFactor.value.set(0.98, 0.99);
  }

  const x = event.clientX;
  const y = event.clientY;
  const mouse = new THREE.Vector2();
  mouse.x = (x / window.innerWidth) * 2 - 1;
  mouse.y = -(y / window.innerHeight) * 2 + 1;

  // Update the raycaster
  raycaster.setFromCamera(mouse, camera);

  // Intersect objects
  const intersects = raycaster.intersectObject(splicingGroupGlobal, true);

  if (intersects.length > 0) {
    const firstIntersectedObject = intersects.filter(
      (intersection: THREE.Intersection<THREE.Object3D>) => {
        return intersection && intersection.object;
      }
    )[0];
    if (firstIntersectedObject && firstIntersectedObject.object) {
      // console.log("\nfirstIntersectedObject ->", firstIntersectedObject.object);
      // Get the Parent Group
      const parentGroup = firstIntersectedObject.object.parent;
      console.log("\nparentGroup ->", parentGroup);
      // Set raycasterIntersectionObject
      raycasterIntersectionObject = parentGroup;
      // Change the color of each material of each mesh in the parent group
      // raycasterIntersectionObject.children.forEach((child) => {
      //   if (
      //     child instanceof THREE.Mesh &&
      //     child.material instanceof THREE.MeshStandardNodeMaterial
      //   ) {
      //     console.log("\nchild to be changed in after intersection ->", child);
      //     child.material.color.set("#f00");
      //   }
      // });

      // Change the outline factor
      if (uniformOutlineFactor) {
        console.log(
          "\nuniformOutlineFactor x ->",
          uniformOutlineFactor.value.x
        );
        console.log(
          "\nuniformOutlineFactor y ->",
          uniformOutlineFactor.value.y
        );
        uniformOutlineFactor.value.set(0.8, 0.82);
      }
    }
  }
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
  document.addEventListener("pointermove", onPointerMove);
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

  // Remove pointer move listener
  document.removeEventListener("pointermove", onPointerMove);
});
</script>
