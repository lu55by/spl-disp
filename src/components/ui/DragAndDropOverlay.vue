<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { UIContents, ToastContents } from "../../constants";
import { useModelsStore } from "../../stores/useModelsStore";
import { validateImportFilesWithNodeNames } from "../../utils/fileValidators";
import { toast } from "vue3-toastify";

const isDragging = ref(false);
const modelsStore = useModelsStore();

let dragCounter = 0;

const onDragEnter = (e: DragEvent) => {
  e.preventDefault();
  dragCounter++;
  if (e.dataTransfer?.types.includes("Files")) {
    isDragging.value = true;
  }
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const files = e.dataTransfer?.files;
    console.log("\n -- onDragEnter -- files ->", files);
  }
};

const onDragOver = (e: DragEvent) => {
  e.preventDefault();
};

const onDragLeave = (e: DragEvent) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    isDragging.value = false;
  }
};

const onDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;
  dragCounter = 0;

  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const files = e.dataTransfer?.files;
    console.log("\n -- onDrop -- files -- before validation ->", files);

    // Check if we are hovering over an object and have an image file
    if (
      modelsStore.dragHoveredObject &&
      files.length === 1 &&
      files[0].type.startsWith("image/")
    ) {
      await modelsStore.applyTextureToHoveredObject(files[0]);
      // Reset hovered object
      modelsStore.setDragHoveredObject(null);
      return;
    }

    // Reset hovered object logic is handled in SplicingModels or here if needed,
    // but lets ensure we clear it just in case if not dropped on object or if we fall through
    modelsStore.setDragHoveredObject(null);

    // const isValid = await validateImportFiles(e.dataTransfer.files);
    const isValid = await validateImportFilesWithNodeNames(files);
    console.log("\n -- onDrop -- files -- after validation ->", files);

    if (isValid) {
      const loadingToastId = toast.loading(ToastContents.ModelLoadingZH);
      try {
        const success = await modelsStore.imoprtObjStlWithNodeNames(files);
        toast.remove(loadingToastId);
        if (success) {
          toast.success(ToastContents.ModelImportedReminderContentZH, {
            autoClose: 1000,
          });
        }
      } catch (error) {
        toast.remove(loadingToastId);
        toast.error("加载模型失败");
        console.error(error);
      }
    }
  }
};

onMounted(() => {
  window.addEventListener("dragenter", onDragEnter);
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", onDrop);
});

onUnmounted(() => {
  window.removeEventListener("dragenter", onDragEnter);
  window.removeEventListener("dragover", onDragOver);
  window.removeEventListener("dragleave", onDragLeave);
  window.removeEventListener("drop", onDrop);
});
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isDragging"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
    >
      <!-- Futuristic UI Overlay -->
      <div
        class="relative flex items-center justify-center animate-pulse-slow"
        data-testid="drop-zone-indicator"
      >
        <!-- Outer Glowing Ring -->
        <div
          class="absolute w-48 h-48 md:w-64 md:h-64 rounded-full border-4 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.4)] animate-spin-slow"
        ></div>
        <div
          class="absolute w-40 h-40 md:w-56 md:h-56 rounded-full border-2 border-cyan-400/20 border-dashed animate-reverse-spin"
        ></div>

        <!-- Center Circle with Plus -->
        <div
          class="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-slate-900/80 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.2)] backdrop-blur-md transition-transform duration-300 scale-100 group-hover:scale-110"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-16 w-16 md:h-20 md:w-20 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </div>

        <!-- Text Label -->
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 mt-32 md:mt-40 text-cyan-300 font-futuristic text-sm md:text-xl tracking-[0.2em] font-light text-shadow-glow text-center w-max max-w-[80vw]"
        >
          {{ UIContents.DropZoneIndicatorContentZH }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.animate-spin-slow {
  animation: spin 8s linear infinite;
}

.animate-reverse-spin {
  animation: spin 12s linear infinite reverse;
}

.animate-pulse-slow {
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    filter: brightness(1);
    transform: scale(1);
  }
  50% {
    filter: brightness(1.2);
    transform: scale(1.02);
  }
}

.text-shadow-glow {
  text-shadow: 0 0 10px rgba(34, 211, 238, 0.6);
}
</style>
