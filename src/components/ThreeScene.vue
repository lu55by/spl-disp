<script setup lang="ts">
import * as THREE from 'three/webgpu'
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {onBeforeUnmount, onMounted, ref} from "vue";
import {loadObj} from "../three/loaders/ModelLoader.ts";
import {loadTexture} from "../three/loaders/TextureLoader.ts";
import {
  CameraPos,
  DirectionalLightIntensity,
  HeadNodeNames,
  HeadScalar,
  ModelPaths,
  type PhongMesh
} from "../three/constants";
import {AxesHelper} from "three";
import GUI from "lil-gui";
import {addTransformDebug} from "../three/gui";

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

  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 600);
  camera.position.set(CameraPos.x, CameraPos.y, CameraPos.z);
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
    const loadedHairModel = await loadObj(ModelPaths.Hair.Model);
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
    const loadedHeadModel = await loadObj(ModelPaths.Head.Model);
    console.log('loadedHeadModel -> ', loadedHeadModel);

    // Load Textures
    const headColTex = await loadTexture(ModelPaths.Head.Texture.HeadColTex);
    const teethColTex = await loadTexture(ModelPaths.Head.Texture.TeethColTex);
    const eyeLColTex = await loadTexture(ModelPaths.Head.Texture.EyeLColTex);
    const eyeRColTex = await loadTexture(ModelPaths.Head.Texture.EyeRColTex);

    // Retrieve Nodes
    const headNode = loadedHeadModel.getObjectByName(HeadNodeNames.Head) as PhongMesh
    const teethNode = loadedHeadModel.getObjectByName(HeadNodeNames.Teeth) as PhongMesh
    const eyeLNode = loadedHeadModel.getObjectByName(HeadNodeNames.EyeL) as PhongMesh
    const eyeRNode = loadedHeadModel.getObjectByName(HeadNodeNames.EyeR) as PhongMesh

    // Map the texture
    headNode.material.map = headColTex;
    teethNode.material.map = teethColTex;
    eyeLNode.material.map = eyeLColTex;
    eyeRNode.material.map = eyeRColTex;
    loadedHeadModel.scale.setScalar(HeadScalar);
    // loadedHeadModel.position.set(4, -150, 0);
    scene.add(loadedHeadModel);

    // Debug GUI
    addTransformDebug('Head', gui, loadedHeadModel, {showScale: true});
  }

  const loadBodyTst = async () => {
    const loadedBodyModel = await loadObj(ModelPaths.Body.Model);
    // console.log('loadedBody -> ', loadedBodyModel);
    const bodyTex = await loadTexture(ModelPaths.Body.Texture.ColorTex);
    // console.log('bodyTex -> ', bodyTex);
    // Map the texture
    loadedBodyModel.traverse((m) => {
      if (m instanceof THREE.Mesh) m.material.map = bodyTex;
    })
    scene.add(loadedBodyModel);
  }

  loadHairTst();

  loadHeadTst();

  loadBodyTst();


  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = .1
  controls.maxDistance = 50

  // Axes Helper
  scene.add(new AxesHelper(20))

  window.addEventListener('resize', onWindowResize)
}

// Resize fn
const onWindowResize = () => {
  // console.log('Resizing...')

  // if (!canvasEle.value) return
  // const width = canvasEle.value.clientWidth
  // const height = canvasEle.value.clientHeight


  const width = window.innerWidth;
  const height = window.innerHeight;

  // Update camera
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
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
})

onBeforeUnmount(() => {
  // Dispose operations
  controls.dispose()
  renderer.dispose()

  // Remove resize listener
  window.removeEventListener('resize', onWindowResize)
})

</script>

<template>
  <canvas class="h-full w-full" ref="canvasEle"/>
</template>