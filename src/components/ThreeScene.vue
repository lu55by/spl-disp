<script setup lang="ts">
import * as THREE from 'three/webgpu'
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {onBeforeUnmount, onMounted, ref} from "vue";

// Canvas Element
const canvasEle = ref<HTMLCanvasElement | null>(null);

let camera: THREE.PerspectiveCamera, scene: THREE.Scene, renderer: THREE.WebGPURenderer, controls: OrbitControls,
    clock: THREE.Clock;

// Init scene fn
const init = () => {

  const width = canvasEle.value!.clientWidth
  const height = canvasEle.value!.clientHeight

  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 600);
  camera.position.set(6, 3, 10);

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
  //
  // const gui = renderer.inspector.createParameters("Parameters")

  // Lights
  const ambientLight = new THREE.AmbientLight('#fff', 3)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight('#fff', 8)
  directionalLight.position.set(4, 3, 1)
  scene.add(directionalLight)

  // default material
  const defaultMat = new THREE.MeshStandardNodeMaterial({color: '#ff622e'})

  // Test Objects
  const torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(.6, .25, 128, 32), defaultMat)
  torusKnot.position.set(3, 0, 0)
  scene.add(torusKnot)

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), defaultMat)
  sphere.position.set(0, 0, 0)
  scene.add(sphere)

  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 16, 16), defaultMat)
  box.position.set(-3, 0, 0)
  scene.add(box)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.minDistance = .1
  controls.maxDistance = 50

  window.addEventListener('resize', onWindowResize)
}

// Resize fn
const onWindowResize = () => {
  if (!canvasEle.value) return
  const width = canvasEle.value.clientWidth
  const height = canvasEle.value.clientHeight

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