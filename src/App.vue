<script setup lang="ts">
import LoadingOverlay from "./components/ui/LoadingOverlay.vue";
// import ThreeSceneTst from "./components/three/ThreeSceneTst.vue";
import SplicingModelsMainUIContainer from "./components/SplicingModelsMainUIContainer.vue";
</script>

<template>
  <!--  <div class="w-full h-full grid grid-cols-[auto_1fr]">-->
  <div
    class="w-full h-svh bg-[linear-gradient(90deg,rgb(27,27,37),rgb(54,54,72),rgb(27,27,37))]"
  >
    <LoadingOverlay />
    <!-- <ThreeSceneTst /> -->
    <!-- TODO: Optimize the code and make it cleaner. -->
    <SplicingModelsMainUIContainer />
  </div>
</template>
