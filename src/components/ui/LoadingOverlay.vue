<script setup lang="ts">
import { useLoadingStore } from "../../stores/useLoadingStore";
import { storeToRefs } from "pinia";

const loadingStore = useLoadingStore();
const { isLoading, progress } = storeToRefs(loadingStore);
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isLoading"
      class="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center pointer-events-none"
    >
      <div class="text-white text-2xl font-bold mb-4 tracking-widest uppercase">
        Loading...
      </div>
      <div class="w-64 h-1 bg-gray-800 rounded overflow-hidden">
        <div
          class="h-full bg-white transition-all duration-300 ease-out"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
      <div class="mt-2 text-gray-500 text-sm font-mono">
        {{ Math.round(progress) }}%
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
