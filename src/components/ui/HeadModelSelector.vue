<template>
  <div class="flex flex-col gap-2 w-full">
    <div class="flex items-center justify-between px-1">
      <span
        class="text-cyan-500/80 font-futuristic text-[10px] tracking-[0.2em] uppercase"
        >头模选择</span
      >
      <div class="flex gap-2">
        <button
          @click="setGender(true)"
          :class="[
            'p-1.5 rounded-full transition-all duration-300 border cursor-pointer',
            isDefaultHeadFemale
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
              : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600',
          ]"
          title="Female"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 15V17" />
            <path
              d="M12 2C8.686 2 6 4.686 6 8c0 2.21 1.2 4.14 3 5.19V15c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1.81c1.8-1.05 3-2.98 3-5.19 0-3.314-2.686-6-6-6z"
            />
            <path d="M9 17h6" />
            <path d="M10 21h4" />
          </svg>
        </button>
        <button
          @click="setGender(false)"
          :class="[
            'p-1.5 rounded-full transition-all duration-300 border cursor-pointer',
            !isDefaultHeadFemale
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
              : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600',
          ]"
          title="Male"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2v10" />
            <path d="m17 7-5-5-5 5" />
            <circle cx="12" cy="17" r="5" />
          </svg>
        </button>
      </div>
    </div>

    <div class="relative w-full group">
      <div
        @click="isDropdownOpen = !isDropdownOpen"
        class="w-full h-10 px-4 flex items-center justify-between bg-slate-900/40 backdrop-blur-md border border-cyan-500/20 rounded-sm cursor-pointer hover:border-cyan-500/50 transition-all duration-300 group"
      >
        <div class="flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-cyan-400"
          >
            <path
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            />
          </svg>
          <span class="text-xs text-stone-300 font-chinese tracking-tight">{{
            currentModelName
          }}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="[
            'text-cyan-500/50 transition-transform duration-300',
            isDropdownOpen ? 'rotate-180' : '',
          ]"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      <!-- Dropdown -->
      <Transition name="dropdown">
        <div
          v-if="isDropdownOpen"
          class="absolute top-full left-0 w-full mt-2 py-1 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-sm shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar"
        >
          <div
            v-for="model in currentModels"
            :key="model.subPath"
            @click="selectModel(model)"
            :class="[
              'px-4 py-2 text-xs font-chinese cursor-pointer transition-colors flex items-center gap-3',
              currentHeadModelSubPath === model.subPath
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-stone-400 hover:bg-slate-800/60 hover:text-cyan-300',
            ]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :class="
                currentHeadModelSubPath === model.subPath
                  ? 'text-cyan-400'
                  : 'text-slate-600'
              "
            >
              <circle cx="12" cy="12" r="10" />
              <circle
                cx="12"
                cy="12"
                r="3"
                v-if="currentHeadModelSubPath === model.subPath"
              />
            </svg>
            {{ model.name }}
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { storeToRefs } from "pinia";
import {
  useModelsStore,
  AvailableHeadModels,
} from "../../stores/useModelsStore";

const modelsStore = useModelsStore();
const { isDefaultHeadFemale, currentHeadModelSubPath } =
  storeToRefs(modelsStore);

const isDropdownOpen = ref(false);

const currentModels = computed(() => {
  return isDefaultHeadFemale.value
    ? AvailableHeadModels.female
    : AvailableHeadModels.male;
});

const currentModelName = computed(() => {
  const model = currentModels.value.find(
    (m) => m.subPath === currentHeadModelSubPath.value,
  );
  return model ? model.name : "Unknown";
});

const setGender = async (isFemale: boolean) => {
  if (isDefaultHeadFemale.value === isFemale) return;
  await modelsStore.setDefaultOriginalHead(isFemale);
};

const selectModel = async (model: { name: string; subPath: string }) => {
  await modelsStore.setHeadModel(isDefaultHeadFemale.value, model.subPath);
  isDropdownOpen.value = false;
};

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest(".group")) {
    isDropdownOpen.value = false;
  }
};

onMounted(() => {
  window.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.1);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(34, 211, 238, 0.2);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(34, 211, 238, 0.4);
}
</style>
