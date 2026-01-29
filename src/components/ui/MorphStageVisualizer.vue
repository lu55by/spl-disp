<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CutHeadEyesNodeCombinedGroupName } from "../../three/constants";

const modelsStore = useModelsStore();
const {
  selectedObject,
  manualMorphSelectionStage,
  isManualMorphGenerationMode,
} = storeToRefs(modelsStore);

const currentRefImg = computed(() => {
  if (!manualMorphSelectionStage.value) return null;
  return `/imgs/refs/morphs/${manualMorphSelectionStage.value}.jpg`;
});

const stageLabel = computed(() => {
  switch (manualMorphSelectionStage.value) {
    case "jaw":
      return "下颌点位参考";
    case "eyeBrow":
      return "眉毛点位参考";
    case "mouseCornersWidth":
      return "嘴角点位参考";
    default:
      return "参考图";
  }
});
</script>

<template>
  <Transition name="slide-fade-right">
    <div
      v-if="
        selectedObject &&
        selectedObject.name
          .toLocaleLowerCase()
          .includes(CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase()) &&
        isManualMorphGenerationMode &&
        manualMorphSelectionStage
      "
      class="fixed bottom-4 left-4 md:bottom-4 md:left-4 pointer-events-auto flex flex-col gap-2 md:gap-4 p-3 md:p-5 bg-slate-900/60 backdrop-blur-md border border-cyan-500/40 rounded-sm w-48 md:w-96 shadow-2xl overflow-hidden group hover:border-cyan-400 transition-all duration-300 z-50"
    >
      <div class="flex flex-col gap-1 w-full">
        <div class="flex justify-between items-center">
          <h3
            class="text-cyan-500 font-futuristic tracking-[0.2em] text-[10px] md:text-xs uppercase drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]"
          >
            {{ stageLabel }}
          </h3>
          <div
            class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_5px_rgba(34,211,238,0.8)]"
          ></div>
        </div>
        <div
          class="h-px w-full bg-linear-to-r from-cyan-500/50 via-cyan-500/20 to-transparent group-hover:from-cyan-400 transition-all duration-300"
        ></div>
      </div>

      <div
        class="relative aspect-square w-full rounded-sm overflow-hidden bg-slate-800/30 border border-slate-700/50 flex items-center justify-center p-2"
      >
        <img
          v-if="currentRefImg"
          :src="currentRefImg"
          alt="Stage Reference"
          class="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />

        <div
          class="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent opacity-40 pointer-events-none"
        ></div>

        <!-- Scanline detail for futuristic look -->
        <div
          class="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_2px,3px_100%]"
        ></div>
      </div>

      <!-- Footer detail -->
      <div class="flex justify-between items-center opacity-40">
        <span class="text-[7px] text-cyan-500 uppercase tracking-[0.2em]"
          >Protocol: MANUAL_REF</span
        >
        <span class="text-[7px] text-cyan-500 uppercase tracking-[0.2em]"
          >Stage: {{ manualMorphSelectionStage }}</span
        >
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-fade-right-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-right-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-right-enter-from,
.slide-fade-right-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
