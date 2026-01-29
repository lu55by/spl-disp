<script setup lang="ts">
import ButtonContainer from "./ButtonContainer.vue";
// import Selected3dObjectPropsIndicator from "./Selected3dObjectPropsIndicator.vue";
import ThumbnailVisualizer from "./ThumbnailVisualizer.vue";
import MorphStageVisualizer from "./MorphStageVisualizer.vue";
import UploadManager from "./UploadManager.vue";
import ManualMorphUI from "./ManualMorphUI.vue";
</script>

<template>
  <div
    class="fixed max-lg:pt-9 top-0 left-0 right-0 bottom-0 z-10 p-3 pointer-events-none flex flex-col items-start"
  >
    <ButtonContainer />
    <!-- <Selected3dObjectPropsIndicator /> -->
    <ThumbnailVisualizer />
    <MorphStageVisualizer />
    <UploadManager />
    <ManualMorphUI />
  </div>
</template>
