<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";
import {
  CutHeadEyesNodeCombinedGroupName,
  NodeNames,
} from "../../three/constants";
import * as THREE from "three";

const modelsStore = useModelsStore();

/**
 * The head node that contains the morph targets.
 */
const headNode = ref<THREE.Mesh | null>(null);

/**
 * Local reactive values for the morph target influences to ensure Vue reactivity.
 */
const influencesValues = ref<number[]>([]);

/**
 * Check if the controller should be visible.
 */
const isVisible = computed(() => {
  const selected = modelsStore.selectedObject;
  return (
    selected !== null && selected.name === CutHeadEyesNodeCombinedGroupName
  );
});

/**
 * Find the head node within the selected object.
 */
const updateHeadNode = () => {
  if (!isVisible.value || !modelsStore.selectedObject) {
    headNode.value = null;
    influencesValues.value = [];
    return;
  }

  // Find the head node (it could be the selected object itself or a child)
  const node =
    modelsStore.selectedObject.getObjectByName(NodeNames.HeadNames.Head) ||
    modelsStore.selectedObject.getObjectByName("CutHeadNode");

  if (node === undefined) {
    console.warn("\n -- updateHeadNode -- head node is undefined!");
    return;
  }

  if (node instanceof THREE.Mesh && node.morphTargetInfluences) {
    headNode.value = node;
    // Copy the values to local reactive ref
    influencesValues.value = [...node.morphTargetInfluences];
  } else {
    headNode.value = null;
    influencesValues.value = [];
  }
};

// Watch for selection changes
watch(() => modelsStore.selectedObject, updateHeadNode, { immediate: true });

/**
 * Watch for condition changes
 */
watch(isVisible, (newVal) => {
  if (!newVal) {
    headNode.value = null;
    influencesValues.value = [];
  } else {
    updateHeadNode();
  }
});

/**
 * Morph Target Data for the template
 */
const morphTargetsData = computed(() => {
  if (!headNode.value || !headNode.value.morphTargetDictionary) return [];

  const dictionary = headNode.value.morphTargetDictionary;
  // Sort by index
  return Object.entries(dictionary)
    .sort((a, b) => a[1] - b[1])
    .map(([name, index]) => ({
      label: name.charAt(0).toUpperCase() + name.slice(1),
      index: index,
    }));
});

/**
 * Update the morph target influence value.
 */
const updateInfluence = (index: number, value: number) => {
  if (headNode.value && headNode.value.morphTargetInfluences) {
    headNode.value.morphTargetInfluences[index] = value;
    influencesValues.value[index] = value;
  }
};

/**
 * Sync logic if external changes happen (advanced)
 */
let syncInterval: number | null = null;
onMounted(() => {
  syncInterval = window.setInterval(() => {
    if (headNode.value && headNode.value.morphTargetInfluences) {
      // Sync back only if they differ (to avoid unnecessary reactivity triggers)
      headNode.value.morphTargetInfluences.forEach((val, i) => {
        if (influencesValues.value[i] !== val) {
          influencesValues.value[i] = val;
        }
      });
    }
  }, 100);
});

onUnmounted(() => {
  if (syncInterval) clearInterval(syncInterval);
});
</script>

<template>
  <Transition name="slide-fade">
    <div
      v-if="isVisible && morphTargetsData.length > 0"
      class="fixed top-6 right-6 z-60 w-72 md:w-80 pointer-events-none group"
      @click.stop
    >
      <!-- Glassmorphism Container -->
      <div
        class="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] backdrop-blur-xl pointer-events-auto transition-all duration-500 hover:bg-slate-900/60 hover:border-cyan-500/40 group/container"
      >
        <!-- Background Glow -->
        <div
          class="absolute -right-10 -top-10 h-32 w-32 bg-cyan-500/10 blur-[50px] transition-all duration-700 group-hover/container:bg-cyan-500/20"
        ></div>

        <!-- Header Section -->
        <div class="mb-6 flex items-center justify-between">
          <div class="flex flex-col">
            <h3
              class="font-futuristic text-[10px] font-bold tracking-[0.3em] text-cyan-400 uppercase"
            >
              Facial Morphs
            </h3>
            <span class="text-[8px] text-cyan-500/50 font-mono tracking-tighter"
              >MORPH_SYS.v2.initialized</span
            >
          </div>
          <div class="flex gap-1">
            <div class="h-1 w-4 bg-cyan-500/20 rounded-full overflow-hidden">
              <div class="h-full bg-cyan-400 animate-pulse w-full"></div>
            </div>
          </div>
        </div>

        <!-- Sliders List -->
        <div class="space-y-6">
          <div
            v-for="target in morphTargetsData"
            :key="target.index"
            class="space-y-3"
          >
            <div class="flex justify-between items-end">
              <label
                class="text-[10px] text-slate-400 font-bold tracking-widest uppercase"
              >
                {{ target.label }}
              </label>
              <div class="flex items-baseline gap-1">
                <span class="font-mono text-xs text-cyan-400 font-bold">
                  {{ influencesValues[target.index]?.toFixed(2) }}
                </span>
                <span class="text-[8px] text-cyan-700 font-mono">val</span>
              </div>
            </div>

            <div class="relative group/slider">
              <!-- Slider Track Background -->
              <div
                class="absolute inset-y-[7px] w-full h-0.5 bg-white/5 rounded-full overflow-hidden"
              >
                <div
                  class="h-full bg-linear-to-r from-cyan-600 to-cyan-400 transition-all duration-75"
                  :style="{
                    width:
                      target.label === 'Nose'
                        ? `${((influencesValues[target.index] + 1) / 2) * 100}%`
                        : `${influencesValues[target.index] * 100}%`,
                  }"
                ></div>
              </div>

              <input
                type="range"
                :min="target.label === 'Nose' ? -1 : 0"
                max="1"
                step="0.01"
                :value="influencesValues[target.index]"
                @input="(e) => updateInfluence(target.index, parseFloat((e.target as HTMLInputElement).value))"
                class="relative w-full h-4 bg-transparent appearance-none cursor-pointer outline-none z-10"
              />
            </div>
          </div>
        </div>

        <!-- Footer Info -->
        <div
          class="mt-8 pt-4 border-t border-white/5 flex justify-between items-center text-[8px] font-mono text-slate-500 uppercase tracking-widest"
        >
          <span>Coordinate Matrix: Active</span>
          <span>{{ headNode?.uuid.slice(0, 8) }}</span>
        </div>

        <!-- Decorative Scanning Box -->
        <div
          class="absolute inset-0 border border-cyan-500/0 transition-colors duration-500 group-hover/container:border-cyan-500/10 pointer-events-none rounded-2xl"
        ></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Custom Range Input Styling */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 4px;
  height: 16px;
  background: #22d3ee;
  border-radius: 0;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.6);
  transition: all 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  height: 20px;
  background: #fff;
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
}

input[type="range"]::-moz-range-thumb {
  width: 4px;
  height: 16px;
  background: #22d3ee;
  border: none;
  border-radius: 0;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.6);
  transition: all 0.2s ease;
}

/* Slide Fade Transition */
.slide-fade-enter-active {
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}
.slide-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.755, 0.05, 0.855, 0.06);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(30px) scale(0.95);
  filter: blur(10px);
  opacity: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .fixed {
    top: auto;
    bottom: 32px;
    right: 50%;
    transform: translateX(50%);
    width: calc(100vw - 48px);
    max-width: 400px;
  }

  .slide-fade-enter-from,
  .slide-fade-leave-to {
    transform: translateY(30px) translateX(50%) scale(0.95);
  }
}

.font-futuristic {
  font-family: "Inter", system-ui, sans-serif;
}
</style>
