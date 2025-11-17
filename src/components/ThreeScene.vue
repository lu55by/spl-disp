<template>
  <canvas class="h-full w-full relative" ref="canvasEle"></canvas>
</template>


<script setup lang="ts">
import * as THREE from 'three/webgpu'
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {onBeforeUnmount, onMounted, ref} from "vue";
import {loadObj} from "../three/loaders/ModelLoader.ts";
import {loadTexture} from "../three/loaders/TextureLoader.ts";
import {
  CameraProps,
  CutHeadDebugProps,
  DirectionalLightIntensity,
  ModelPaths,
  NodeNames,
  type PhongMesh
} from "../three/constants";
import {AxesHelper} from "three";
import GUI from "lil-gui";
import {addTransformDebug} from "../three/gui";
import {csgSubtract} from "../three/csg";
import {type Brush} from "three-bvh-csg";

// Canvas Element
const canvasEle = ref<HTMLCanvasElement | null>(null);

let camera: THREE.PerspectiveCamera, scene: THREE.Scene, renderer: THREE.WebGPURenderer, controls: OrbitControls,
    clock: THREE.Clock, gui: GUI;

const width = window.innerWidth;
const height = window.innerHeight;

// Init scene fn
const init = () => {

  gui = new GUI();


  // const width = canvasEle.value!.clientWidth
  // const height = canvasEle.value!.clientHeight

  camera = new THREE.PerspectiveCamera(CameraProps.Fov, width / height, CameraProps.Near, CameraProps.Far);
  camera.position.set(CameraProps.Pos.x, CameraProps.Pos.y, CameraProps.Pos.z);
  addTransformDebug('Camera', gui, camera);

  scene = new THREE.Scene();

  clock = new THREE.Clock()

  // Renderer
  renderer = new THREE.WebGPURenderer({canvas: canvasEle.value!, antialias: true})
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  renderer.setAnimationLoop(animate)
  renderer.setClearColor('#000')

  // Inspector/GUI
  // renderer.inspector = new Inspector()
  // const gui = renderer.inspector.createParameters("Parameters")

  // Lights
  const ambientLight = new THREE.AmbientLight('#fff', 3)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight('#fff', DirectionalLightIntensity)
  directionalLight.position.set(4, 3, 1)
  scene.add(directionalLight)

  // default material
  const defaultMat = new THREE.MeshStandardNodeMaterial({color: '#ff622e'})

  // Test Objects
  const tstObjectsFn = () => {
    const torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(.6, .25, 128, 32), defaultMat)
    torusKnot.position.set(3, 0, 0)
    scene.add(torusKnot)

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), defaultMat)
    sphere.position.set(0, 0, 0)
    scene.add(sphere)

    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 16, 16), defaultMat)
    box.position.set(-3, 0, 0)
    scene.add(box)
  }
  // tstObjectsFn();

  /*
    Load Models
  */
  // Test Fn
  const loadHairTst = async () => {
    const loadedHairModel: THREE.Object3D = await loadObj(ModelPaths.Hair.Model);
    // console.log('loadedHairModel -> ', loadedHairModel);
    const hairTex = await loadTexture(ModelPaths.Hair.Texture.ColorTex);
    // console.log('hairTex -> ', hairTex);
    // Map the texture
    loadedHairModel.traverse((m) => {
      if (m instanceof THREE.Mesh) m.material.map = hairTex;
    })
    scene.add(loadedHairModel);
  }

  const loadHeadTst = async () => {
    const loadedFemaleHeadModel: THREE.Object3D = await loadObj(ModelPaths.HeadFemale.Model);
    const loadedHeadMaleModel: THREE.Object3D = await loadObj(ModelPaths.HeadMale.Model);
    // console.log('loadedFemaleHeadModel -> ', loadedFemaleHeadModel);

    // Load Textures
    const headFemaleColTex = await loadTexture(ModelPaths.HeadFemale.Texture.HeadColTex);
    const teethFemaleColTex = await loadTexture(ModelPaths.HeadFemale.Texture.TeethColTex);
    const eyeLFemaleColTex = await loadTexture(ModelPaths.HeadFemale.Texture.EyeLColTex);
    const eyeRFemaleColTex = await loadTexture(ModelPaths.HeadFemale.Texture.EyeRColTex);
    const headMaleColTex = await loadTexture(ModelPaths.HeadMale.Texture.HeadColorTex);
    const eyeLMaleColTex = await loadTexture(ModelPaths.HeadMale.Texture.EyeLColTex);
    const eyeRMaleColTex = await loadTexture(ModelPaths.HeadMale.Texture.EyeRColTex);

    // Retrieve Nodes
    const headFemaleNode = loadedFemaleHeadModel.getObjectByName(NodeNames.HeadNames.Head) as PhongMesh
    // console.log('headFemaleNode -> ', headFemaleNode);
    const teethFemaleNode = loadedFemaleHeadModel.getObjectByName(NodeNames.HeadNames.Teeth) as PhongMesh
    const eyeLFemaleNode = loadedFemaleHeadModel.getObjectByName(NodeNames.HeadNames.EyeL) as PhongMesh
    const eyeRFemaleNode = loadedFemaleHeadModel.getObjectByName(NodeNames.HeadNames.EyeR) as PhongMesh

    // Head Male
    const headMaleNode = loadedHeadMaleModel.getObjectByName(NodeNames.HeadNames.Head) as PhongMesh

    // Map the texture
    headFemaleNode.material.map = headFemaleColTex;
    teethFemaleNode.material.map = teethFemaleColTex;
    eyeLFemaleNode.material.map = eyeLFemaleColTex;
    eyeRFemaleNode.material.map = eyeRFemaleColTex;
    headMaleNode.material.map = headMaleColTex;
    // loadedFemaleHeadModel.scale.setScalar(HeadScalar);
    // loadedFemaleHeadModel.position.set(4, -150, 0);
    // scene.add(loadedFemaleHeadModel);
    // addTransformDebug('Head', gui, loadedFemaleHeadModel, {showScale: true});

    // Load the Cutters
    const cuttersModel: THREE.Object3D = await loadObj(ModelPaths.Cutters.Model);
    // console.log('cuttersModel -> ', cuttersModel);
    // addTransformDebug('Cutters', gui, cuttersModel, {showScale: true});
    // cuttersModel.position.set(CutHeadDebugProps.Pos.x, CutHeadDebugProps.Pos.y, CutHeadDebugProps.Pos.z);
    // cuttersModel.scale.setScalar(CutHeadDebugProps.Scalar);
    // applyMaterialWireframe(cuttersModel, Colors.Cyan);
    // scene.add(cuttersModel);

    // Sphere Cutter
    const sphereCutterNode = cuttersModel.getObjectByName(NodeNames.CuttersNames.Sphere) as PhongMesh;
    // sphereCutterNode.position.y -= 1;
    // sphereCutterNode.updateMatrixWorld(true);
    // sphereCutterNode.geometry.applyMatrix4(sphereCutterNode.matrixWorld);
    // Cylinder Cutter
    const cylinderCutterNode = cuttersModel.getObjectByName(NodeNames.CuttersNames.Cylinder) as PhongMesh;


    // Try to cut the head node first
    let cutHead: Brush | PhongMesh;
    // cutHead = headFemaleNode;
    // cutHead = headMaleNode;
    cutHead = csgSubtract(headMaleNode, sphereCutterNode, false);
    cutHead = csgSubtract(cutHead, cylinderCutterNode, false);
    console.log('cutHead -> ', cutHead);
    cutHead.position.set(CutHeadDebugProps.Pos.x, CutHeadDebugProps.Pos.y, CutHeadDebugProps.Pos.z);
    cutHead.scale.setScalar(CutHeadDebugProps.Scalar);
    // cutHead.material.wireframe = true;
    scene.add(cutHead);
    addTransformDebug('CutHead', gui, cutHead, {showScale: true});
  }

  const loadBodyTst = async () => {
    const loadedBodyModel: THREE.Object3D = await loadObj(ModelPaths.Body.Model);
    // console.log('loadedBody -> ', loadedBodyModel);
    const bodyTex = await loadTexture(ModelPaths.Body.Texture.ColorTex);
    // console.log('bodyTex -> ', bodyTex);
    // Map the texture
    loadedBodyModel.traverse((m) => {
      if (m instanceof THREE.Mesh) m.material.map = bodyTex;
    })
    scene.add(loadedBodyModel);
  }

  // loadHairTst();

  loadHeadTst();

  // loadBodyTst();


  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  // controls.minDistance = .1
  // controls.maxDistance = 50

  // Axes Helper
  scene.add(new AxesHelper(20))

  // window.addEventListener('resize', onWindowResize)
}

// Resize fn
const onWindowResize = () => {
  // console.log('Resizing...')

  // if (!canvasEle.value) return;
  // const width = canvasEle.value.clientWidth;
  // const height = canvasEle.value.clientHeight;


  const width = window.innerWidth;
  const height = window.innerHeight;

  // Update camera
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

// Animate fn
const animate = async () => {
  // Elapsed Time
  // const time = clock.getElapsedTime()

  // Update controls
  controls.update()

  // Update renderer
  await renderer.init()
  renderer.render(scene, camera)
}

onMounted(() => {
  init();
  animate();
  window.addEventListener('resize', onWindowResize);
})

onBeforeUnmount(() => {
  // Dispose operations
  controls.dispose()
  renderer.dispose()

  // Remove resize listener
  window.removeEventListener('resize', onWindowResize)
})

</script>
