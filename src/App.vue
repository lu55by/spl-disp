<script setup lang="ts">
import MainUI from "./components/ui/MainUI.vue";
import LoadingOverlay from "./components/ui/LoadingOverlay.vue";
import SplicingModels from "./components/three/SplicingModels.vue";

// import ThreeScene from "./components/three/ThreeScene.vue";
</script>

<template>
  <!--  <div class="w-full h-full grid grid-cols-[auto_1fr]">-->
  <div
    class="w-full h-svh bg-[linear-gradient(90deg,rgb(27,27,37),rgb(54,54,72),rgb(27,27,37))]"
  >
    <MainUI />
    <LoadingOverlay />
    <SplicingModels />
    <!-- <ThreeScene /> -->
  </div>
</template>
