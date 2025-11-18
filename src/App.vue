<script setup lang="ts">
import ThreeScene from "./components/ThreeScene.vue";
</script>

<template>
<!--  <div class="w-full h-full">-->
<!--    <ThreeScene />-->
<!--  </div>-->
  <div class="w-full h-full grid grid-cols-[auto_1fr]">
    <div class="p-3">
      <button class="exporter bg-stone-800 text-stone-100 p-2 rounded-md">Export</button>
    </div>
    <ThreeScene />
  </div>
</template>


