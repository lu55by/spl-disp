<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { TransformControls } from "three/examples/jsm/Addons.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Inspector } from "three/examples/jsm/inspector/Inspector.js";
import { color, materialColor, mix, uniform, vec2 } from "three/tsl";
import * as THREE from "three/webgpu";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CameraProps, NodeNames } from "../../three/constants";
import {
  generateFacialMorphs,
  getObject3DBoundingBoxCenter,
} from "../../three/meshOps";
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
  // console.log("\nadjustPivots called...");
  // console.log("\n -- adjustPivots -- group ->", group);
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
      // console.log(
      //   `\n -- adjustPivots -- vec to be add to ${childName} position ->`,
      //   vec
      // );
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
  raycasterIntersectionObject: THREE.Object3D | null;

let postProcessing: THREE.PostProcessing;

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
    CameraProps.Far,
  );
  camera.position.set(CameraProps.Pos.x, CameraProps.Pos.y, CameraProps.Pos.z);
  // camera.position.set(0, CameraProps.Pos.y * 0.65, CameraProps.Pos.z * 1.1);
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
  renderer.inspector = new Inspector();

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
  uOutlinePatternFactor = uniform(vec2(0.91, 0.92));

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
  const generateFacialMorphsAndVisualizers = () => {
    const headNode =
      (splicingGroupGlobal.getObjectByName(
        NodeNames.HeadNames.Head,
      ) as THREE.Mesh) ||
      (splicingGroupGlobal.getObjectByName("CutHeadNode") as THREE.Mesh);
    const {
      visualizerNoseTip, // Vector3
      visualizerNostrilTipL, // Vector3
      visualizerNostrilTipR, // Vector3
      visualizerjawTipL, // Vector3
      visualizerjawTipR, // Vector3
      visualizerByNoseTipsDetection,
      visualizerByNostrilTipsDetection, // Vector3[]
      visualizerByJawTipsDetection, // Vector3[]
      visualizerByNoseMorph, // Vector3[]
      visualizerByJawMorph, // Vector3[]
      visualizerByNostrilMorph, // Vector3[]
    } = generateFacialMorphs(headNode, {
      noseRadius: 7,
    });

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
        Set positions
      */
      noseTipVisMesh.position.copy(visualizerNoseTip);
      nostrilLTipVisMesh.position.copy(visualizerNostrilTipL);
      nostrilRTipVisMesh.position.copy(visualizerNostrilTipR);
      jawLTipVisMesh.position.copy(visualizerjawTipL);
      jawRTipVisMesh.position.copy(visualizerjawTipR);
      /*
        Add to scene
      */
      if (selection === "all") {
        scene.add(noseTipVisMesh);
        scene.add(nostrilLTipVisMesh);
        scene.add(nostrilRTipVisMesh);
        scene.add(jawLTipVisMesh);
        scene.add(jawRTipVisMesh);
      } else if (selection === "nose") {
        scene.add(noseTipVisMesh);
      } else if (selection === "nostril") {
        scene.add(nostrilLTipVisMesh);
        scene.add(nostrilRTipVisMesh);
      } else if (selection === "jaw") {
        scene.add(jawLTipVisMesh);
        scene.add(jawRTipVisMesh);
      }
    };
    // visualizeTips("nostril");

    /**
     * Morphing Vertices Detection Visualizers
     */
    const visualizeMorphingDetectionVertices = (selection: string = "all") => {
      /*
        Create geometries from the corresponding vertices
      */
      // Nose tip geometry from detection vertices
      const visualizerByNoseTipsDetectionGeo =
        new THREE.BufferGeometry().setFromPoints(visualizerByNoseTipsDetection);
      // Nostril tip geometry from detection vertices
      const visualizerByNostrilTipsDetectionGeo =
        new THREE.BufferGeometry().setFromPoints(
          visualizerByNostrilTipsDetection,
        );
      // Jaw tip geometry from detection vertices
      const visualizerByJawTipsDetectionGeo =
        new THREE.BufferGeometry().setFromPoints(visualizerByJawTipsDetection);
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
      /*
        Add to scene
      */
      if (selection === "all") {
        scene.add(noseTipsDetectionPoints);
        scene.add(nostrilTipsDetectionPoints);
        scene.add(jawTipsDetectionPoints);
      } else if (selection === "nose") {
        scene.add(noseTipsDetectionPoints);
      } else if (selection === "nostril") {
        scene.add(nostrilTipsDetectionPoints);
      } else if (selection === "jaw") {
        scene.add(jawTipsDetectionPoints);
      }
    };
    // visualizeMorphingDetectionVertices("nostril");

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
      /*
        Add to scene
      */
      if (selection === "all") {
        scene.add(noseMorphPoints);
        scene.add(nostrilMorphPoints);
        scene.add(jawMorphPoints);
      } else if (selection === "nose") {
        scene.add(noseMorphPoints);
      } else if (selection === "nostril") {
        scene.add(nostrilMorphPoints);
      } else if (selection === "jaw") {
        scene.add(jawMorphPoints);
      }
    };
    visualizeMorphingVertices("nostril");
  };
  generateFacialMorphsAndVisualizers();

  /**
   * Add the global group
   */
  // splicingGroupGlobal.add(new THREE.AxesHelper(10));
  scene.add(splicingGroupGlobal);

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

  // Reapply the mixed colorNode if isDefaultHeadFemale state changes
  watch(isDefaultHeadFemale, () => {
    applyMixedColorNode(splicingGroupGlobal);
    generateFacialMorphsAndVisualizers();
  });

  // Update the uniformIsShowMap based on the global isShowMap boolean
  watch(isShowMap, (newVal) => {
    uIsShowMap.value = newVal ? 1 : 0;
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
  const intersects = raycaster.intersectObject(splicingGroupGlobal);

  // Check if the intersected objects are the length greater than 0
  if (intersects.length > 0) {
    // Get the first intersection
    const firstIntersection = intersects.filter((intersect) => {
      return intersect && intersect.object;
    })[0];

    // Check if the first intersected object is valid
    if (firstIntersection && firstIntersection.object) {
      // Get the Parent Group of the first intersected object
      const intersectionParent = firstIntersection.object
        .parent as THREE.Group<THREE.Object3DEventMap>;

      /*
        Attach the transform to the intersectedParentGroup
       */
      // if (intersectionParent.name !== CutHeadEyesNodeCombinedGroupName)
      //   transform.attach(intersectionParent);

      /*
        Set the global selected object in modelsStore to the intersectedParentGroup
       */
      modelsStore.setSelectedObject(intersectionParent);
      // console.log(
      //   "\n -- onMouseClick -- setSelectedObject ->",
      //   modelsStore.selectedObject,
      // );

      /*
        Set the outline effect to be visible
       */
      setOutlineEffectVisibility(intersectionParent, true);
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
