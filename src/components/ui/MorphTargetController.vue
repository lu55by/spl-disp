<script setup lang="ts">
import * as THREE from "three";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { MorphTargetLabelMapping } from "../../constants";
import { useModelsStore } from "../../stores/useModelsStore";
import {
  CutHeadEyesNodeCombinedGroupName,
  NodeNames,
} from "../../three/constants";
import { storeToRefs } from "pinia";

const modelsStore = useModelsStore();
const { isMorphTargetReady } = storeToRefs(modelsStore);

/**
 * The head node that contains the morph targets.
 */
const headNode = ref<THREE.Mesh | null>(null);

/**
 * Local reactive values for the morph target influences to ensure Vue reactivity.
 */
const headNodeinfluencesValues = ref<number[]>([]);

/**
 * The Eye Nodes
 */
const eyeLNode = ref<THREE.Mesh | null>(null);
const eyeRNode = ref<THREE.Mesh | null>(null);

/**
 * Eye scale value for the UI slider.
 */
const eyeScale = ref(1);

const minEyeScale = 0.9;
const maxEyeScale = 1;

/**
 * Check if the controller should be visible.
 */
const isVisible = computed(() => {
  const selected = modelsStore.selectedObject;
  return (
    selected !== null &&
    selected.name
      .toLocaleLowerCase()
      .includes(CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase())
  );
});

/**
 * Find the head node within the selected object.
 */
const updateHeadNode = () => {
  if (!isVisible.value || !modelsStore.selectedObject) {
    headNode.value = null;
    headNodeinfluencesValues.value = [];
    return;
  }

  // Find the head node
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
    headNodeinfluencesValues.value = [...node.morphTargetInfluences];
  } else {
    headNode.value = null;
    headNodeinfluencesValues.value = [];
  }
};

/**
 * Find the eye nodes within the selected object.
 */
const updateEyeNodes = () => {
  if (!isVisible.value || !modelsStore.selectedObject) {
    eyeLNode.value = null;
    eyeRNode.value = null;
    return;
  }

  // Find the eye nodes
  const nodeL =
    modelsStore.selectedObject.getObjectByName(NodeNames.HeadNames.EyeL) ||
    modelsStore.selectedObject.getObjectByName("EyeLNode");
  const nodeR =
    modelsStore.selectedObject.getObjectByName(NodeNames.HeadNames.EyeR) ||
    modelsStore.selectedObject.getObjectByName("EyeRNode");

  if (nodeL === undefined || nodeR === undefined) {
    console.warn("\n -- updateEyeNodes -- eye nodes are undefined!");
    return;
  }

  // console.log("\n -- updateEyeNodes -- eyeLNode ->", nodeL);
  // console.log("\n -- updateEyeNodes -- eyeRNode ->", nodeR);

  if (nodeL instanceof THREE.Mesh && nodeR instanceof THREE.Mesh) {
    eyeLNode.value = nodeL;
    eyeRNode.value = nodeR;
    // Set the eyeScale value to the current scale of the eye node
    eyeScale.value = nodeL.scale.x;
  } else {
    eyeLNode.value = null;
    eyeRNode.value = null;
  }
};

// Watch for selection changes
watch(() => modelsStore.selectedObject, updateHeadNode, { immediate: true });
watch(() => modelsStore.selectedObject, updateEyeNodes, { immediate: true });

/**
 * Watch for condition changes
 */
watch(isVisible, (newVal) => {
  if (!newVal) {
    headNode.value = null;
    headNodeinfluencesValues.value = [];
    eyeLNode.value = null;
    eyeRNode.value = null;
  } else {
    updateHeadNode();
    updateEyeNodes();
  }
});

/*
  Manual Morph Generation Trigger Watcher
  */
watch(isMorphTargetReady, (newVal) => {
  if (newVal) {
    console.log(
      "\nisMorphTargetReady changed -> triggering head node re-updating...",
    );
    updateHeadNode();
  }
});

/**
 * Morph Target Data for the template
 */
interface MorphTargetItem {
  label: string;
  morphTargetInfIdx: number;
}

interface MorphTargetGroup {
  groupName: string;
  targets: MorphTargetItem[];
}

const MorphTargetGroupsDict = [
  {
    name: "额头",
    labels: ["ForeheadWidth", "ForeheadDepth", "ForeheadHeight"],
  },
  { name: "眉毛", labels: ["EyeBrowHeight"] },
  { name: "耳朵", labels: ["EarMiddleWidth", "EarTopThickness"] },
  {
    name: "颧骨",
    labels: ["ZygomaticArchWidth", "ZygomaticArchDepth", "ZygomaticArchHeight"],
  },
  { name: "脸颊", labels: ["Cheek0Width", "Cheek0Depth", "Cheek0Height"] },
  { name: "腮帮", labels: ["Cheek1Width", "Cheek1Depth", "Cheek1Height"] },
  { name: "鼻子", labels: ["NoseHeight", "NostrilWidth"] },
  { name: "嘴角", labels: ["MouseCornersWidth"] },
  { name: "下颌", labels: ["MandibleWidth", "MandibleCornersWidth"] },
  { name: "下巴", labels: ["JawWidth", "JawSidesWidth"] },
];

const groupedMorphTargetsData = computed(() => {
  if (!headNode.value || !headNode.value.morphTargetDictionary) return [];

  const dictionary = headNode.value.morphTargetDictionary;
  console.log(
    "\n -- groupedMorphTargetsData -- dictionary of head node ->",
    dictionary,
  );

  // Sort by index initially
  const allTargets = Object.entries(dictionary)
    .sort((a, b) => a[1] - b[1])
    .map(([name, morphTargetInfIdx]) => ({
      label: name.charAt(0).toUpperCase() + name.slice(1),
      morphTargetInfIdx,
    }));

  const grouped: MorphTargetGroup[] = [];
  const processedLabels = new Set<string>();

  // -> Group the morph targets by categories
  for (const groupDef of MorphTargetGroupsDict) {
    const targetsInGroup = allTargets.filter((t) =>
      groupDef.labels.includes(t.label),
    );
    if (targetsInGroup.length > 0) {
      grouped.push({
        groupName: groupDef.name,
        targets: targetsInGroup,
      });
      // Mark as processed
      targetsInGroup.forEach((t) => processedLabels.add(t.label));
    }
  }

  // -> Any remaining targets that didn't match a group
  const otherTargets = allTargets.filter((t) => !processedLabels.has(t.label));
  if (otherTargets.length > 0) {
    grouped.push({
      groupName: "其他",
      targets: otherTargets,
    });
  }

  return grouped;
});

/**
 * Update the morph target influence value.
 */
const updateHeadNodeInfluence = (index: number, value: number) => {
  if (headNode.value && headNode.value.morphTargetInfluences) {
    headNode.value.morphTargetInfluences[index] = value;
    headNodeinfluencesValues.value[index] = value;
  }
};

/**
 * Get the minimum value for a morph target influence based on its label.
 */
const getMorphMin = (label: string) => {
  switch (label) {
    case "JawSidesWidth":
    case "ForeheadWidth":
    case "ForeheadDepth":
    case "ForeheadHeight":
      return -0.4;
    case "Nose":
    case "MouseCornersWidth":
    case "ZygomaticArchDepth":
    case "ZygomaticArchHeight":
    case "Cheek0Depth":
    case "Cheek0Height":
    case "Cheek1Depth":
    case "Cheek1Height":
      return -1;
    default:
      return 0;
  }
};

/**
 * Update the eye scale for both left and right eye nodes.
 */
const updateEyeScale = (value: number) => {
  eyeScale.value = value;
  if (eyeLNode.value) eyeLNode.value.scale.setScalar(value);
  if (eyeRNode.value) eyeRNode.value.scale.setScalar(value);
};

/**
 * Reset the eye scale to 1.
 */
const resetEyeScale = () => {
  updateEyeScale(1);
};

/**
 * Reset all morph target influences of the head node.
 */
const resetAllMorphTargets = () => {
  if (headNode.value) headNode.value.updateMorphTargets();
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
        if (headNodeinfluencesValues.value[i] !== val) {
          headNodeinfluencesValues.value[i] = val;
        }
      });
    }
  }, 100);
});

onUnmounted(() => {
  console.log("\n-- MorphTargetController -- onUnmounted --");
  if (syncInterval) clearInterval(syncInterval);
});
</script>

<template>
  <Transition name="slide-fade">
    <div
      v-if="isVisible && groupedMorphTargetsData.length > 0"
      class="fixed top-6 right-6 z-60 w-72 md:w-80 pointer-events-none group rounded-2xl"
      @click.stop
    >
      <!-- Glassmorphism Container (Static Wrapper) -->
      <div
        class="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] backdrop-blur-xl pointer-events-auto transition-all duration-500 hover:bg-slate-900/60 hover:border-cyan-500/40 group/container flex flex-col max-h-[calc(100vh-3rem)]"
      >
        <!-- Background Glow (Stays fixed) -->
        <div
          class="absolute -right-10 -top-10 h-32 w-32 bg-cyan-500/10 blur-[50px] transition-all duration-700 group-hover/container:bg-cyan-500/20 pointer-events-none"
        ></div>

        <!-- Scrollable Content Container -->
        <div class="overflow-y-auto flex-1 scroll-smooth">
          <!-- Sticky Header Section -->
          <div
            class="sticky top-0 z-20 px-5 py-4 flex items-center justify-between bg-slate-900/40 backdrop-blur-xl border-b border-white/5 rounded-t-2xl"
          >
            <div class="flex flex-col">
              <h3
                class="font-futuristic text-[10px] font-bold tracking-[0.3em] text-cyan-400 uppercase"
              >
                Facial Morphs
              </h3>
              <span
                class="text-[8px] text-cyan-500/50 font-mono tracking-tighter"
                >MORPH_SYS.v2.initialized</span
              >
            </div>
            <button
              @click="resetAllMorphTargets"
              class="p-1.5 hover:bg-white/10 rounded-lg transition-all duration-300 group/reset border border-white/0 hover:border-white/10 active:scale-95 cursor-pointer"
              title="重置变形目标"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5 text-cyan-500/50 group-hover/reset:text-cyan-400 group-hover/reset:rotate-180 transition-transform duration-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>

          <!-- Padded Content Area -->
          <div class="p-5 pt-6 space-y-6">
            <!-- Sliders List -->
            <div class="space-y-6">
              <!-- Morph Targets Grouped -->
              <div
                v-for="group in groupedMorphTargetsData"
                :key="group.groupName"
                class="space-y-4 pt-4 border-t border-white/5 first:border-t-0 first:pt-0"
              >
                <!-- Group Title -->
                <div class="flex items-center gap-2 mb-1">
                  <div
                    class="h-px flex-1 bg-linear-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"
                  ></div>
                  <h4
                    class="text-[10px] text-cyan-300 font-bold tracking-widest uppercase"
                  >
                    {{ group.groupName }}
                  </h4>
                  <div
                    class="h-px flex-1 bg-linear-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"
                  ></div>
                </div>

                <div
                  v-for="target in group.targets"
                  :key="target.morphTargetInfIdx"
                  class="space-y-3"
                >
                  <div class="flex justify-between items-end">
                    <label
                      class="text-[10px] text-slate-400 font-bold tracking-widest uppercase"
                    >
                      {{
                        MorphTargetLabelMapping[
                          target.label as keyof typeof MorphTargetLabelMapping
                        ] || target.label
                      }}
                    </label>
                    <div class="flex items-baseline gap-1">
                      <span class="font-mono text-xs text-cyan-400 font-bold">
                        {{
                          headNodeinfluencesValues[
                            target.morphTargetInfIdx
                          ]?.toFixed(2)
                        }}
                      </span>
                      <span class="text-[8px] text-cyan-700 font-mono"
                        >val</span
                      >
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
                          width: `${
                            ((headNodeinfluencesValues[
                              target.morphTargetInfIdx
                            ] -
                              getMorphMin(target.label)) /
                              (1 - getMorphMin(target.label))) *
                            100
                          }%`,
                        }"
                      ></div>
                    </div>

                    <input
                      type="range"
                      :min="getMorphMin(target.label)"
                      max="1"
                      step="0.01"
                      :value="
                        headNodeinfluencesValues[target.morphTargetInfIdx]
                      "
                      @input="
                        (e) =>
                          updateHeadNodeInfluence(
                            target.morphTargetInfIdx,
                            parseFloat((e.target as HTMLInputElement).value),
                          )
                      "
                      class="relative w-full h-4 bg-transparent appearance-none cursor-pointer outline-none z-10"
                    />
                  </div>
                </div>
              </div>

              <!-- Eye Size Slider -->
              <!-- -> Updated to match and reuse the group layout visual style -->
              <div
                v-if="eyeLNode && eyeRNode"
                class="space-y-4 pt-4 border-t border-white/5 first:border-t-0 first:pt-0"
              >
                <!-- Group Title -->
                <div class="flex items-center gap-2 mb-1">
                  <div
                    class="h-px flex-1 bg-linear-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"
                  ></div>
                  <h4
                    class="text-[10px] text-cyan-300 font-bold tracking-widest uppercase"
                  >
                    眼睛
                  </h4>
                  <div
                    class="h-px flex-1 bg-linear-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0"
                  ></div>
                </div>

                <div class="space-y-3">
                  <div class="flex justify-between items-end">
                    <label
                      class="text-[10px] text-slate-400 font-bold tracking-widest uppercase"
                    >
                      眼睛大小
                    </label>
                    <div class="flex items-center gap-2">
                      <div class="flex items-baseline gap-1">
                        <span class="font-mono text-xs text-cyan-400 font-bold">
                          {{ eyeScale.toFixed(2) }}
                        </span>
                        <span class="text-[8px] text-cyan-700 font-mono"
                          >scale</span
                        >
                      </div>
                      <!-- Reset Button -->
                      <button
                        @click="resetEyeScale"
                        class="p-1.5 hover:bg-white/10 rounded-lg transition-all duration-300 group/reset border border-white/0 hover:border-white/10 active:scale-95"
                        title="Reset Scale"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="w-3.5 h-3.5 text-cyan-500/50 group-hover/reset:text-cyan-400 group-hover/reset:rotate-180 transition-transform duration-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
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
                          width: `${((eyeScale - minEyeScale) / (maxEyeScale - minEyeScale)) * 100}%`,
                        }"
                      ></div>
                    </div>

                    <input
                      type="range"
                      :min="minEyeScale"
                      :max="maxEyeScale"
                      step="0.01"
                      :value="eyeScale"
                      @input="
                        (e) =>
                          updateEyeScale(
                            parseFloat((e.target as HTMLInputElement).value),
                          )
                      "
                      class="relative w-full h-4 bg-transparent appearance-none cursor-pointer outline-none z-10"
                    />
                  </div>
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
          </div>
        </div>

        <!-- Decorative Scanning Box (Stays fixed) -->
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

/* Custom Scrollbar Styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px; /* Thin scrollbar width */
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.1); /* Subtle track background */
  border-radius: 10px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(34, 211, 238, 0.2); /* Cyan thumb with transparency */
  border-radius: 10px;
  transition: all 0.3s ease;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(34, 211, 238, 0.5); /* Brighter cyan on hover */
}

/* For Firefox compatibility */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(34, 211, 238, 0.2) rgba(15, 23, 42, 0.1);
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
