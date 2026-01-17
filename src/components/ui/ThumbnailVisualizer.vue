<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onUnmounted, ref, watch } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { CutHeadEyesNodeCombinedGroupName } from "../../three/constants";

const modelsStore = useModelsStore();
const { selectedObject } = storeToRefs(modelsStore);

const thumbnailUrl = ref<string | null>(null);

// Watch for changes in the selected object or its thumbnail data
watch(
  () => (selectedObject.value?.children?.[0] as any)?.userData?.thumbnail,
  (newThumbnail) => {
    // Revoke old URL to avoid memory leaks
    if (thumbnailUrl.value) {
      URL.revokeObjectURL(thumbnailUrl.value);
      thumbnailUrl.value = null;
    }

    if (newThumbnail instanceof File || newThumbnail instanceof Blob) {
      thumbnailUrl.value = URL.createObjectURL(newThumbnail);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (thumbnailUrl.value) {
    URL.revokeObjectURL(thumbnailUrl.value);
  }
});
</script>

<template>
  <Transition name="slide-fade">
    <div
      v-if="
        selectedObject &&
        !selectedObject.name
          .toLocaleLowerCase()
          .includes(CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase())
      "
      class="mt-1 ml-4 pointer-events-auto flex flex-col gap-3 p-4 bg-slate-900/40 backdrop-blur-md border border-cyan-500/40 rounded-sm w-64 shadow-2xl overflow-hidden group hover:border-cyan-400 transition-all duration-300"
    >
      <div class="flex flex-col gap-1 w-full">
        <div class="flex justify-between items-center">
          <h3
            class="text-cyan-500 font-futuristic tracking-[0.2em] text-xs uppercase drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]"
          >
            缩略图预览
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
        class="relative aspect-square w-full rounded-sm overflow-hidden bg-slate-800/30 border border-slate-700/50 flex items-center justify-center"
      >
        <template v-if="thumbnailUrl">
          <img
            :src="thumbnailUrl"
            alt="Thumbnail"
            class="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        </template>
        <div v-else class="flex flex-col items-center gap-2 opacity-50">
          <svg
            class="w-8 h-8 text-cyan-500/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span class="text-[8px] text-cyan-500/70 uppercase tracking-[0.2em]"
            >未绑定缩略图</span
          >
        </div>

        <div
          class="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent opacity-40 pointer-events-none"
        ></div>

        <!-- Scanline detail for futuristic look -->
        <div
          class="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_2px,3px_100%]"
        ></div>
      </div>

      <!-- Tag Detail -->
      <div class="flex justify-between items-center opacity-40">
        <span class="text-[7px] text-cyan-500 uppercase tracking-[0.2em]"
          >Type: {{ (selectedObject as any).name || "Unknown" }}</span
        >
        <span class="text-[7px] text-cyan-500 uppercase tracking-[0.2em]"
          >ID:
          {{
            selectedObject ? selectedObject.uuid.slice(0, 8) : "00000000"
          }}</span
        >
      </div>
    </div>
  </Transition>
</template>

<style scoped>
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
