<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";
import ButtonContainer from "./ButtonContainer.vue";
// import Selected3dObjectPropsIndicator from "./Selected3dObjectPropsIndicator.vue";
import DragAndDropOverlay from "./DragAndDropOverlay.vue";
import LoadingOverlay from "./LoadingOverlay.vue";
import ManualMorphUI from "./ManualMorphUI.vue";
import MorphStageVisualizer from "./MorphStageVisualizer.vue";
import MorphTargetController from "./MorphTargetController.vue";
import ThumbnailVisualizer from "./ThumbnailVisualizer.vue";
import UploadManager from "./UploadManager.vue";
import ButtonContainerMorph from "./ButtonContainerMorph.vue";

const route = useRoute();
// Check if the current mode is morph based on the URL path parameter -> /mode/morph
const isMorphMode = computed(() => route.params.mode === "morph");
</script>

<template>
  <div
    class="fixed max-lg:pt-9 top-0 left-0 right-0 bottom-0 z-10 p-3 pointer-events-none flex flex-col items-start"
  >
    <template v-if="isMorphMode">
      <ManualMorphUI />
      <MorphTargetController />
      <MorphStageVisualizer />
      <ButtonContainerMorph />
    </template>
    <template v-else>
      <ButtonContainer />
      <!-- <Selected3dObjectPropsIndicator /> -->
      <LoadingOverlay />
      <DragAndDropOverlay />
      <ThumbnailVisualizer />
      <UploadManager />
    </template>
  </div>
</template>
