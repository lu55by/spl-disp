<script lang="ts" setup>
import { MathUtils } from "three";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useModelsStore } from "../../stores/useModelsStore";

const modelsStore = useModelsStore();

// Local state for inputs
const pos = ref({ x: 0, y: 0, z: 0 });
const rot = ref({ x: 0, y: 0, z: 0 }); // In degrees
const scale = ref({ x: 1, y: 1, z: 1 });

const isFocused = ref(false);

const syncFromObject = () => {
  const obj = modelsStore.selectedObject;
  if (!obj || isFocused.value) return;

  pos.value.x = Number(obj.position.x.toFixed(3));
  pos.value.y = Number(obj.position.y.toFixed(3));
  pos.value.z = Number(obj.position.z.toFixed(3));

  rot.value.x = Number(MathUtils.radToDeg(obj.rotation.x).toFixed(2));
  rot.value.y = Number(MathUtils.radToDeg(obj.rotation.y).toFixed(2));
  rot.value.z = Number(MathUtils.radToDeg(obj.rotation.z).toFixed(2));

  scale.value.x = Number(obj.scale.x.toFixed(3));
  scale.value.y = Number(obj.scale.y.toFixed(3));
  scale.value.z = Number(obj.scale.z.toFixed(3));
};

const syncToObject = () => {
  const obj = modelsStore.selectedObject;
  if (!obj) return;

  obj.position.set(pos.value.x, pos.value.y, pos.value.z);
  obj.rotation.set(
    MathUtils.degToRad(rot.value.x),
    MathUtils.degToRad(rot.value.y),
    MathUtils.degToRad(rot.value.z)
  );
  obj.scale.set(scale.value.x, scale.value.y, scale.value.z);
};

watch(
  () => modelsStore.selectedObject,
  (current) => {
    if (current) {
      syncFromObject();
    }
  },
  { immediate: true }
);

let rafId: number;
const loop = () => {
  syncFromObject();
  rafId = requestAnimationFrame(loop);
};

onMounted(() => {
  rafId = requestAnimationFrame(loop);
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
});

const handleInput = () => {
  syncToObject();
};
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="modelsStore.selectedObject"
      @click.stop
      class="pointer-events-auto absolute bottom-6 right-6 w-72 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 p-5 font-futuristic shadow-[0_0_30px_rgba(34,211,238,0.15)] rounded-sm"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between mb-5 border-b border-cyan-500/10 pb-2"
      >
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
          <h3 class="text-cyan-400 text-xs tracking-[0.2em] uppercase">
            Object Telemetry
          </h3>
        </div>
        <span class="text-[10px] text-cyan-500/50 uppercase tracking-widest"
          >Active</span
        >
      </div>

      <div class="flex flex-col gap-6">
        <!-- Position -->
        <div class="group/section">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-slate-500 text-[9px] uppercase tracking-[0.2em]"
              >01</span
            >
            <label
              class="text-slate-300 text-[10px] uppercase tracking-widest group-hover/section:text-cyan-400 transition-colors"
              >Position</label
            >
          </div>
          <div class="grid grid-cols-3 gap-3">
            <!-- X -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >X</span
                >
                <input
                  v-model.number="pos.x"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <input
                type="range"
                v-model.number="pos.x"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="-50"
                max="50"
                step="0.01"
                class="telemetry-slider"
              />
            </div>
            <!-- Y -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >Y</span
                >
                <input
                  v-model.number="pos.y"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <!-- TODO: Make the min and max range based on the posY value with some offsets -->
              <input
                type="range"
                v-model.number="pos.y"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="-50"
                max="50"
                step="0.01"
                class="telemetry-slider"
              />
            </div>
            <!-- Z -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >Z</span
                >
                <input
                  v-model.number="pos.z"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <!-- TODO: Make the min and max range based on the posZ value with some offsets -->
              <input
                type="range"
                v-model.number="pos.z"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="-50"
                max="50"
                step="0.01"
                class="telemetry-slider"
              />
            </div>
          </div>
        </div>

        <!-- Rotation -->
        <div class="group/section">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-slate-500 text-[9px] uppercase tracking-[0.2em]"
              >02</span
            >
            <label
              class="text-slate-300 text-[10px] uppercase tracking-widest group-hover/section:text-cyan-400 transition-colors"
              >Rotation (DEG)</label
            >
          </div>
          <div class="grid grid-cols-3 gap-3">
            <!-- X -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >X</span
                >
                <input
                  v-model.number="rot.x"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <input
                type="range"
                v-model.number="rot.x"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="-180"
                max="180"
                step="0.1"
                class="telemetry-slider"
              />
            </div>
            <!-- Y -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >Y</span
                >
                <input
                  v-model.number="rot.y"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <input
                type="range"
                v-model.number="rot.y"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="-180"
                max="180"
                step="0.1"
                class="telemetry-slider"
              />
            </div>
            <!-- Z -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >Z</span
                >
                <input
                  v-model.number="rot.z"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <input
                type="range"
                v-model.number="rot.z"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="-180"
                max="180"
                step="0.1"
                class="telemetry-slider"
              />
            </div>
          </div>
        </div>

        <!-- Scale -->
        <div class="group/section">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-slate-500 text-[9px] uppercase tracking-[0.2em]"
              >03</span
            >
            <label
              class="text-slate-300 text-[10px] uppercase tracking-widest group-hover/section:text-cyan-400 transition-colors"
              >Scale</label
            >
          </div>
          <div class="grid grid-cols-3 gap-3">
            <!-- X -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >X</span
                >
                <input
                  v-model.number="scale.x"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <input
                type="range"
                v-model.number="scale.x"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="0.01"
                max="10"
                step="0.01"
                class="telemetry-slider"
              />
            </div>
            <!-- Y -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >Y</span
                >
                <input
                  v-model.number="scale.y"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <input
                type="range"
                v-model.number="scale.y"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="0.01"
                max="10"
                step="0.01"
                class="telemetry-slider"
              />
            </div>
            <!-- Z -->
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span
                  class="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-cyan-500/40 uppercase"
                  >Z</span
                >
                <input
                  v-model.number="scale.z"
                  @input="handleInput"
                  @focus="isFocused = true"
                  @blur="isFocused = false"
                  class="w-full bg-slate-800/40 border-b border-white/5 focus:border-cyan-500/60 placeholder-slate-600 text-cyan-50 text-xs py-2 pl-6 pr-2 outline-none transition-all"
                />
              </div>
              <input
                type="range"
                v-model.number="scale.z"
                @input="handleInput"
                @mousedown="isFocused = true"
                @mouseup="isFocused = false"
                min="0.01"
                max="10"
                step="0.01"
                class="telemetry-slider"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer / ID -->
      <div class="mt-6 pt-3 border-t border-cyan-500/10 flex flex-col gap-1">
        <div class="flex justify-between items-baseline">
          <span class="text-[8px] text-slate-500 uppercase tracking-widest"
            >Target UID</span
          >
          <span class="text-cyan-500/70 text-[10px] tracking-wider">{{
            modelsStore.selectedObject?.uuid.slice(0, 8)
          }}</span>
        </div>
        <p
          class="text-[7px] text-cyan-400/30 uppercase tracking-[0.3em] font-mono"
        >
          System.status: Operational // Sync.rate: 60Hz
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

/* Firefox */
input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* Futuristic Slider Styling */
.telemetry-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 2px;
  background: rgba(34, 211, 238, 0.1);
  border-radius: 2px;
  outline: none;
  transition: all 0.3s ease;
}

.telemetry-slider:hover {
  background: rgba(34, 211, 238, 0.2);
}

/* Thumb Styling - Chrome/Safari/Edge/Opera */
.telemetry-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 8px;
  height: 8px;
  background: #22d3ee;
  border-radius: 1px;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
  transition: all 0.2s ease;
}

.telemetry-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.8);
}

/* Thumb Styling - Firefox */
.telemetry-slider::-moz-range-thumb {
  width: 8px;
  height: 8px;
  background: #22d3ee;
  border: none;
  border-radius: 1px;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
  transition: all 0.2s ease;
}

.telemetry-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.8);
}
</style>
