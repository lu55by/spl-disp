<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import {
  TransformControls,
  UltraHDRLoader,
} from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { color, materialColor, mix, uniform, vec2 } from "three/tsl";
import * as THREE from "three/webgpu";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CameraProps, HDRPath } from "../../three/constants";
import { GlobalLoadingManager } from "../../three/managers/GlobalLoadingManager";
import { getObject3DBoundingBoxCenter } from "../../three/meshOps";
import { getOutlinePattern } from "../../three/shaders/tsl";

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
    const relevantActions = [
      "addChild",
      "imoprtObjStlModelWithHeight",
      "imoprtObjStlWithNodeNames",
      "clear",
    ];
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
  orbit: OrbitControls,
  transform: TransformControls,
  raycaster: THREE.Raycaster,
  // uniforms
  uBaseColor: THREE.UniformNode<THREE.Color>,
  uIsShowMap: THREE.UniformNode<number>,
  uOutlinePatternFactor: THREE.UniformNode<THREE.Vector2>,
  uOutlineColor: THREE.UniformNode<THREE.Color>,
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

  // Orbit Controls
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.minDistance = 0.1;
  orbit.maxDistance = 170;

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
   * Axes Helper
   */
  scene.add(new THREE.AxesHelper(20));

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

  /**
   * Load Models
   */

  // Uniforms
  uBaseColor = uniform(color("#fff"));
  uIsShowMap = uniform(isShowMap.value ? 1 : 0);
  uOutlineColor = uniform(color("#0ff"));
  uOutlinePatternFactor = uniform(vec2(0.99, 0.999));

  // Toggle the map by using TSL.
  const applyMixedColorNode = (splicingGroupGlobal: THREE.Group) => {
    if (!splicingGroupGlobal || splicingGroupGlobal.children.length === 0)
      return;
    splicingGroupGlobal.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material instanceof THREE.MeshStandardNodeMaterial
      ) {
        /*
          Try to Simulate redeclaring the `projectionMatrix * modelMatrix * viewMatrix * vec4(position, 1.)` in glsl
         */
        // const position = cameraProjectionMatrix
        //   .mul(modelWorldMatrix)
        //   .mul(cameraViewMatrix)
        //   .mul(vec4(positionLocal, 1));
        // child.material.positionNode = position;

        /*
          Mix the `mixed uBaseColor and materialColor` with outlineColor based on the outlinePat
        */
        // child.material.colorNode = mix(
        //   mix(uBaseColor, materialColor, uIsShowMap),
        //   uOutlineColor,
        //   getOutlinePattern(uOutlinePatternFactor)
        // );

        /*
          Mix the uBaseColor and materialColor based on the uIsShowMap
        */
        child.material.colorNode = mix(uBaseColor, materialColor, uIsShowMap);
        child.material.colorNode.setName(`${child.name}_colorNode`);

        /*
          Try to deactivate the normal transformation (not working properly)
        */
        // child.material.normalNode = modelViewProjection
        //   .mul(modelViewMatrix)
        //   .mul(normalLocal, 0);
      }
    });
  };
  applyMixedColorNode(splicingGroupGlobal);

  // Re-traverse the splicingGroupGlobal and reapply the mixed colorNode to all the materials of meshes by using `watch` from vue on splicingGroupLen state to solve the issue of the map not being toggled when the models are loaded.
  watch(splicingGroupLen, (newLength, oldLength) => {
    console.log(
      `\n -- SplicingModels -- splicingGroupLen changed from ${oldLength} to ${newLength}`
    );
    applyMixedColorNode(splicingGroupGlobal);
  });

  // Update the uniformIsShowMap based on the global isShowMap boolean
  watch(isShowMap, (newVal) => {
    console.log("\n -- init -- isShowMap changed to ->", newVal);
    uIsShowMap.value = newVal ? 1 : 0;
  });

  // Add the global group
  // splicingGroupGlobal.add(new THREE.AxesHelper(10));
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

const mouse = new THREE.Vector2();

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
    if (uOutlinePatternFactor) uOutlinePatternFactor.value.set(0.98, 0.99);
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
      if (uOutlinePatternFactor) {
        console.log(
          "\nuniformOutlineFactor x ->",
          uOutlinePatternFactor.value.x
        );
        console.log(
          "\nuniformOutlineFactor y ->",
          uOutlinePatternFactor.value.y
        );
        uOutlinePatternFactor.value.set(0.8, 0.82);
      }
    }
  }
};

// On Mouse Click fn
const onMouseClick = (event: MouseEvent) => {
  // console.log("\n -- onMouseClick -- event ->", event);

  // Check if there is a previous intersection
  if (raycasterIntersectionObject) {
    // Change the colorNode back to the original colorNode with uIsShowMap of each material of each mesh in the raycasterIntersectionObject group
    if (raycasterIntersectionObject instanceof THREE.Group) {
      raycasterIntersectionObject.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.geometry instanceof THREE.BufferGeometry &&
          child.material instanceof THREE.MeshStandardNodeMaterial
        ) {
          console.log("\nchild to be changed in after intersection ->", child);
          child.material.colorNode = mix(uBaseColor, materialColor, uIsShowMap);
          child.material.needsUpdate = true;
        }
      });
    }
    // Set raycasterIntersectionObject to null
    raycasterIntersectionObject = null;
    // Detach the transform
    transform.detach();
    // Deactivate the outline effect
    uOutlinePatternFactor.value.set(0.99, 0.999);
  }

  // Update the mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Set raycaster from the mouse and the camera
  raycaster.setFromCamera(mouse, camera);

  // Intersect objects
  const intersects = raycaster.intersectObject(splicingGroupGlobal);

  // Check if there is an intersection
  if (intersects.length > 0) {
    // Get the first intersected object
    const firstIntersectedObject = intersects.filter((intersect) => {
      return intersect && intersect.object;
    })[0];
    console.log("\nfirstIntersectedObject ->", firstIntersectedObject);

    // Check if the first intersected object is valid
    if (firstIntersectedObject && firstIntersectedObject.object) {
      // Get the Parent Group of the first intersected object
      const parentGroup = firstIntersectedObject.object.parent;
      console.log(
        "\nparentGroup of the first intersected object ->",
        parentGroup
      );
      // Set raycasterIntersectionObject
      raycasterIntersectionObject = parentGroup;
      // Attach the transform to the raycasterIntersectionObject
      transform.attach(raycasterIntersectionObject);
      // Activate the outline effect
      uOutlinePatternFactor.value.set(0.8, 0.82);
      // TODO: Add the outline effect only on the intersected model by raycaster.
      if (
        raycasterIntersectionObject instanceof THREE.Mesh &&
        raycasterIntersectionObject.geometry instanceof THREE.BufferGeometry &&
        raycasterIntersectionObject.material instanceof
          THREE.MeshStandardNodeMaterial
      ) {
        console.log(
          "\nraycasterIntersectionObject is mesh ->",
          raycasterIntersectionObject
        );
        raycasterIntersectionObject.material.colorNode = mix(
          mix(uBaseColor, materialColor, uIsShowMap),
          uOutlineColor,
          getOutlinePattern(uOutlinePatternFactor)
        );
        return;
      }
      raycasterIntersectionObject.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.geometry instanceof THREE.BufferGeometry &&
          child.material instanceof THREE.MeshStandardNodeMaterial
        ) {
          child.material.colorNode = mix(
            mix(uBaseColor, materialColor, uIsShowMap),
            uOutlineColor,
            getOutlinePattern(uOutlinePatternFactor)
          );
          child.material.colorNode.setName(`${child.name}_colorNode`);
          // Setting this property to true indicates the engine the material needs to be recompiled.
          child.material.needsUpdate = true;
          // child.material.colorNode.needsUpdate = true;
        }
      });
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
  orbit.target.lerp(orbitControlsTargetCenter, 0.1);
  orbit.update();

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
  // document.addEventListener("pointermove", onPointerMove);
  window.addEventListener("click", onMouseClick);
});

onBeforeUnmount(() => {
  console.log("\nReady to dispose the SplicingModels Component...");
  // Unsubscribe the callback fn is called based on the actions in the modelsStore
  unsubscribeModelsStoreActions();

  // Dispose operations
  orbit.dispose();
  renderer.dispose();

  // Remove resize listener
  window.removeEventListener("resize", onWindowResize);

  // Remove pointer move listener
  // document.removeEventListener("pointermove", onPointerMove);

  // Remove pointer down listener
  window.removeEventListener("click", onMouseClick);
});
</script>
