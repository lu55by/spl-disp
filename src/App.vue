<script setup lang="ts">
import ThreeScene from "./components/three/ThreeScene.vue";
import MainUI from "./components/ui/MainUI.vue";
</script>

<template>
<!--  <div class="w-full h-full grid grid-cols-[auto_1fr]">-->
  <div class="w-full h-[100svh] bg-[linear-gradient(90deg,rgb(27,27,37),rgb(54,54,72),rgb(27,27,37))]">
    <MainUI />
    <ThreeScene />
  </div>
</template>


