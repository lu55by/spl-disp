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
import {
  CameraProps,
  HDRPath
} from "../../three/constants";
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
const { splicingGroupLen, isShowMap, isDefaultHeadFemale } =
  storeToRefs(modelsStore);

/*
  Orbit Controls Target Center Update Logic
 */
/**
 * Adjust the pivot point of each object in the group to its bounding box center
 * @param group THREE.Group
 */
const adjustPivots = (group: THREE.Group) => {
  console.log("\nadjustPivots called...");
  console.log("\n -- adjustPivots -- group ->", group);
  group.updateMatrixWorld();
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      const childName = child.name;

      console.log(`\nReady to adjust the pivots of child ${childName}`);

      if (child.geometry.boundingBox === null)
        child.geometry.computeBoundingBox();
      const center = child.geometry.boundingBox!.getCenter(new THREE.Vector3());

      // Apply the negative offset to the geometry to center it around (0,0,0)
      child.geometry.translate(-center.x, -center.y, -center.z);

      // Apply the positive offset to the object's position to keep it in the same visual place
      const vec = center.clone();
      vec.applyQuaternion(child.quaternion);
      vec.multiply(child.scale);
      console.log(
        `\n -- adjustPivots -- vec to be add to ${childName} position ->`,
        vec
      );
      child.position.add(vec);
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
  console.log(
    "\n-- updateOrbitControlsTargetCenter -- splicingGroupGlobal ->",
    splicingGroupGlobal
  );

  // Adjust the pivot point of each object in the group to its bounding box center
  adjustPivots(splicingGroupGlobal);

  // Move all 3D Objects in splicingGroupGlobal to the world original position vec3(0)
  // splicingGroupGlobal.children.forEach((child) => {
  //   child.position.set(0, 0, 0);
  // });
  // splicingGroupGlobal.position.set(0, 0, 0);

  const boundingBoxCenter = getObject3DBoundingBoxCenter(splicingGroupGlobal);
  orbitControlsTargetCenter.copy(boundingBoxCenter);
};

updateOrbitControlsTargetCenter();

const unsubscribeModelsStoreActions = modelsStore.$onAction(
  ({ name, after }) => {
    const relevantActions = [
      "addChild",
      "imoprtObjStlModelWithHeight",
      "imoprtObjStlWithNodeNames",
      "setDefaultOriginalHead",
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
  raycasterIntersectionObject: THREE.Object3D | null;

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
    scene.add(rotatingLight);

    // 补光 - 软化阴影
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-5, 3, 5);
    scene.add(fillLight);

    // 背光 - 增强轮廓
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(0, 3, -10);
    scene.add(rimLight);

    // 顶部环境光 - 确保头顶有足够的光线
    const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);

    // 环境光 - 提供基础照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 半球光 - 提供更自然的环境照明
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.4);
    scene.add(hemisphereLight);
  };
  applyLightsAiBus();

  /**
   * Load Models
   */

  // Uniforms used for TSL
  uBaseColor = uniform(color("#fff"));
  uIsShowMap = uniform(isShowMap.value ? 1 : 0);
  // uOutlineColor = uniform(color("#ffdbac"));
  uOutlineColor = uniform(color("#0ff"));
  uOutlinePatternFactor = uniform(vec2(0.8, 0.82));
  // uToggleOutline = uniform(0);

  // Toggle the map by using TSL.
  const applyMixedColorNode = (splicingGroupGlobal: THREE.Group) => {
    if (!splicingGroupGlobal || splicingGroupGlobal.children.length === 0)
      return;
    // splicingGroupGlobal.traverse((child) => {
    //   if (
    //     child instanceof THREE.Mesh &&
    //     child.material instanceof THREE.MeshStandardNodeMaterial
    //   ) {
    //     // Individual UniformNode for each mesh
    //     const uLocalToggleOutline = uniform(0);
    //     child.userData.uLocalToggleOutline = uLocalToggleOutline;

    //     /*
    //       Mix the `mixed uBaseColor and materialColor` with outlineColor based on the outlinePat
    //     */
    //     child.material.colorNode = mix(
    //       mix(uBaseColor, materialColor, uIsShowMap),
    //       uOutlineColor,
    //       getOutlinePattern(uOutlinePatternFactor).mul(
    //         child.userData.uLocalToggleOutline
    //       )
    //     );
    //   }
    // });
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
        console.log(
          `\n-- applyMixedColorNode -- userData uLocalToggleOutline set for ${groupChild.name} ->`,
          groupChild
        );
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
                child.parent.userData.uLocalToggleOutline
              )
            );
            // Works if we indicates the engine the material needs to be recompiled
            child.material.needsUpdate = true;
          }
        });
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

  // Reapply the mixed colorNode if isDefaultHeadFemale state changes
  watch(isDefaultHeadFemale, () => {
    applyMixedColorNode(splicingGroupGlobal);
  });

  // Update the uniformIsShowMap based on the global isShowMap boolean
  watch(isShowMap, (newVal) => {
    console.log("\n -- init -- isShowMap changed to ->", newVal);
    uIsShowMap.value = newVal ? 1 : 0;
  });

  /**
   * Post-Processing
   */
  // const postProcessing = new THREE.PostProcessing(renderer);
  // const scenePass = pass(scene, camera);
  // const scenePassColor = scenePass.getTextureNode("output");

  // // const dotScreenPass = dotScreen(scenePassColor);
  // // dotScreenPass.scale.value = 1;

  // const bloomPass = bloom(scenePassColor);

  // postProcessing.outputNode = scenePassColor.add(bloomPass);

  // Add the global group
  // splicingGroupGlobal.add(new THREE.AxesHelper(10));
  scene.add(splicingGroupGlobal);
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
 * Set the outline visibility for the object
 * @param object THREE.Object3D
 * @param isVisible boolean
 */
const setOutlineVisibility = (
  object: THREE.Object3D | null,
  isVisible: boolean
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
    console.log(
      "\n -- onPointerMove -- raycasterIntersectionObject ->",
      raycasterIntersectionObject
    );
    // raycasterIntersectionObject.children.forEach((child) => {
    //   if (child instanceof THREE.Mesh) {
    //     child.material.color.set("#fff");
    //   }
    // });
    setOutlineVisibility(raycasterIntersectionObject, false);
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
      }
    )[0];
    if (firstIntersectedObject && firstIntersectedObject.object) {
      // console.log("\nfirstIntersectedObject ->", firstIntersectedObject.object);
      // Get the Parent Group
      const parentGroup = firstIntersectedObject.object.parent;
      console.log(
        "\nintersected parent Group while mouse moving ->",
        parentGroup
      );
      // Set raycasterIntersectionObject
      raycasterIntersectionObject = parentGroup;
      setOutlineVisibility(raycasterIntersectionObject, true);
    }
  }
};

/**
 * On Window Drag Over of Drag and Drop Logic with Raycaster
 * @param e DragEvent
 */
const onWindowDragOver = (e: DragEvent) => {
  e.preventDefault();

  // Fix the issue of colorNode not being set back to the original colorNode based on uIsShowMap
  if (modelsStore.dragHoveredObject) {
    setOutlineVisibility(modelsStore.dragHoveredObject, false);
  }

  // Calculate mouse position for raycasting
  // We need to use clientX and clientY from the DragEvent
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(splicingGroupGlobal, true);

  if (intersects.length > 0) {
    const firstIntersection = intersects[0];
    if (firstIntersection.object instanceof THREE.Mesh) {
      // Highlight logic or just state update
      if (modelsStore.dragHoveredObject !== firstIntersection.object) {
        console.log(
          "\n -- onWindowDragOver -- modelsStore.dragHoveredObject !== firstIntersection.object"
        );
        // Reset previous if needed, though simple state update handles it
        modelsStore.setDragHoveredObject(firstIntersection.object);
        // console.log(
        //   "\n-- onWindowDragOver -- Hovered Object ->",
        //   firstIntersection.object
        // );

        // Set the raycasterIntersectionObject to the hovered object so that we can change the colorNode back to the original colorNode controlled by uIsShowMap of the hovered object after clicking outside of the hovered object
        raycasterIntersectionObject = firstIntersection.object;

        // Visual Feedback (e.g., outline or color tint)
        if (
          modelsStore.dragHoveredObject.material instanceof
          THREE.MeshStandardNodeMaterial
        ) {
          // modelsStore.dragHoveredObject is a Mesh
          setOutlineVisibility(modelsStore.dragHoveredObject, true);
        }
      }
    }
  } else {
    if (modelsStore.dragHoveredObject) {
      modelsStore.setDragHoveredObject(null);
    }
  }
};

/**
 * On mouse click fn
 * @param event MouseEvent
 */
const onMouseClick = (event: MouseEvent) => {
  // console.log("\n -- onMouseClick -- event ->", event);

  // Check if there is a previous intersection
  if (raycasterIntersectionObject) {
    // Check if the previous raycasterIntersectionObject is a mesh
    if (
      raycasterIntersectionObject instanceof THREE.Mesh &&
      raycasterIntersectionObject.geometry instanceof THREE.BufferGeometry &&
      raycasterIntersectionObject.material instanceof
        THREE.MeshStandardNodeMaterial
    ) {
      console.log(
        "\nPrevious raycasterIntersectionObject is a mesh ->",
        raycasterIntersectionObject
      );
      console.log("\nReady to reset the colorNode controlled by uIsShowMap...");
      setOutlineVisibility(raycasterIntersectionObject, false);
    }

    // Change the colorNode back to the original colorNode controlled by uIsShowMap of each material of each mesh in the raycasterIntersectionObject group
    if (raycasterIntersectionObject instanceof THREE.Group) {
      raycasterIntersectionObject.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.geometry instanceof THREE.BufferGeometry &&
          child.material instanceof THREE.MeshStandardNodeMaterial
        ) {
          setOutlineVisibility(child, false);
        }
      });
    }
    // Set raycasterIntersectionObject to null
    raycasterIntersectionObject = null;
    // Detach the transform
    transform.detach();
  }

  // Check if there is a previous selected object in modelsStore
  if (modelsStore.selectedObject) {
    console.log(
      "\nPrevious selected object in modesStore ->",
      modelsStore.selectedObject
    );
    modelsStore.setSelectedObject(null);
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
      // if (raycasterIntersectionObject.name !== CutHeadEyesNodeCombinedGroupName)
      //   transform.attach(raycasterIntersectionObject);
      // Set the global selected object in modelsStore
      modelsStore.setSelectedObject(parentGroup);
      console.log(
        "\nCurrent selected object in modelsStore ->",
        modelsStore.selectedObject
      );
      // Check if the raycasterIntersectionObject is a mesh
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
        setOutlineVisibility(raycasterIntersectionObject, true);
        return;
      }
      // raycasterIntersectionObject is a group
      raycasterIntersectionObject.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.geometry instanceof THREE.BufferGeometry &&
          child.material instanceof THREE.MeshStandardNodeMaterial
        ) {
          setOutlineVisibility(child, true);
        }
      });
    }
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
let time: number;
const animate = async () => {
  // Elapsed Time
  timer.update();
  time = timer.getElapsed();
  // console.log("\ntime ->", time);

  /*
    Update controls
   */
  orbit.target.lerp(orbitControlsTargetCenter, 0.1);
  orbit.update();

  /*
    Update Light
   */
  // 主光旋转
  if (rotatingLight) {
    rotatingLight.position.x = Math.cos(time) * 15;
    rotatingLight.position.z = Math.sin(time) * 15;
  }

  /*
    Update renderer
   */
  await renderer.init();
  renderer.render(scene, camera);
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
  // Key up listender for transform
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
