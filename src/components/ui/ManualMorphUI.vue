<template>
  <div
    class="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none"
    @click.stop
  >
    <!-- Entry Button -->
    <Transition name="slide-up">
      <div
        v-if="
          selectedObject &&
          selectedObject.name
            .toLocaleLowerCase()
            .includes(CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase()) &&
          !isManualMorphGenerationMode
        "
        class="mb-4 pointer-events-auto"
      >
        <!-- <Button @click="startManualMorph"> Generate Morph Target </Button> -->
        <Button @click="startManualMorph"> 生成变形目标 </Button>
      </div>
    </Transition>

    <!-- Selection Controls -->
    <Transition name="slide-up">
      <div
        v-if="isManualMorphGenerationMode"
        class="flex flex-col items-center gap-4 p-6 bg-slate-950/80 border border-cyan-500/50 backdrop-blur-md pointer-events-auto shadow-[0_0_30px_rgba(0,0,0,0.5)]"
      >
        <div class="flex flex-col gap-2 items-center mb-2">
          <h3
            class="text-cyan-400 font-futuristic tracking-widest text-sm uppercase"
          >
            <!-- Manual Morph Selection -->
            点位选择
          </h3>
          <div
            class="h-px w-32 bg-linear-to-r from-transparent via-cyan-500/50 to-transparent"
          ></div>
        </div>

        <div class="flex gap-3">
          <Button
            @click="setStage('jaw')"
            :class="{
              'border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]':
                manualMorphSelectionStage === 'jaw',
            }"
          >
            {{ manualJawTipL ? "✅ 下颌" : "下颌" }}
          </Button>
          <Button
            @click="setStage('eyeBrow')"
            :class="{
              'border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]':
                manualMorphSelectionStage === 'eyeBrow',
            }"
          >
            {{ manualEyeBrowTipL ? "✅ 眉毛" : "眉毛" }}
          </Button>
          <Button
            @click="setStage('mouseCornersWidth')"
            :class="{
              'border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]':
                manualMorphSelectionStage === 'mouseCornersWidth',
            }"
          >
            {{ manualMouseCornerTipL ? "✅ 嘴角" : "嘴角" }}
          </Button>
        </div>

        <div class="flex gap-4 mt-2">
          <button
            @click="cancel"
            class="px-6 py-2 border border-cyan-500/20 text-cyan-500/50 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-xs uppercase tracking-widest font-futuristic cursor-pointer"
          >
            取消
          </button>
          <Button v-if="isSelectionComplete" @click="finish"> 完成 </Button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CutHeadEyesNodeCombinedGroupName } from "../../three/constants";
import Button from "./Button.vue";

const modelsStore = useModelsStore();
const {
  selectedObject,
  isManualMorphGenerationMode,
  manualMorphSelectionStage,
  manualJawTipL,
  manualEyeBrowTipL,
  manualMouseCornerTipL,
} = storeToRefs(modelsStore);

const isSelectionComplete = computed(() => {
  return (
    manualJawTipL.value !== null &&
    manualEyeBrowTipL.value !== null &&
    manualMouseCornerTipL.value !== null
  );
});

const startManualMorph = () => {
  modelsStore.setIsManualMorphGenerationMode(true);
};

const setStage = (stage: "jaw" | "eyeBrow" | "mouseCornersWidth") => {
  modelsStore.setManualMorphSelectionStage(stage);
};

const cancel = () => {
  modelsStore.setIsManualMorphGenerationMode(false);
};

const finish = () => {
  // Trigger generation - we can use an event or a direct call if SplicingModelsV2 watches for a state change.
  // Let's add a trigger state or just set stage to null and have SplicingModelsV2 watch for isSelectionComplete or something.
  modelsStore.setManualMorphSelectionStage(null);

  // We'll use a custom action to signal that generation is ready
  modelsStore.$patch({
    // We can use a timestamp to trigger the watcher in SplicingModelsV2
    manualMorphReadyTimestamp: Date.now(),
  });
};
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate3d(0, 30px, 0);
  opacity: 0;
}
</style>
