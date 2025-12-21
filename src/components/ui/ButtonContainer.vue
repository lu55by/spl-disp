<template>
  <div
    class="flex flex-col items-start justify-start gap-6 p-4 w-full md:w-auto transition-all duration-500"
  >
    <!-- HUD Header -->
    <div class="flex flex-col gap-1 w-full mb-2 group">
      <h2 class="text-cyan-500 font-futuristic tracking-[0.2em] text-lg uppercase drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">
        Control Center
      </h2>
      <div class="h-px w-full bg-linear-to-r from-cyan-500/50 via-cyan-500/20 to-transparent group-hover:from-cyan-400 transition-all duration-300"></div>
    </div>

    <!-- Actions Container - Responsive Layout -->
    <div class="w-full flex flex-row flex-wrap md:flex-col gap-4">
      <!-- Imports Section -->
      <div class="flex flex-row md:flex-col gap-3 w-full sm:w-auto">
        <Button @click="openFilePicker">
          <i class="opacity-50 text-[10px] uppercase">Dir</i> 导入文件夹
        </Button>
        <Button @click="openFilesPicker">
          <i class="opacity-50 text-[10px] uppercase">File</i> 导入文件
        </Button>
      </div>

      <!-- Divider for mobile view (hidden on small) -->
      <div class="hidden md:block h-px w-full bg-slate-700/30"></div>

      <!-- Tools Section -->
      <div class="flex flex-row md:flex-col gap-3 w-full sm:w-auto">
        <Button @click="toggleIsShowMap">
          <i class="opacity-50 text-[10px] uppercase">Vis</i> 
          切换{{ isShowMap ? "白" : "彩" }}模
        </Button>
        <Button @click="handleExport">
          <i class="opacity-50 text-[10px] uppercase">Out</i> 导出
        </Button>
        <Button @click="clearModels">
          <i class="opacity-50 text-[10px] uppercase">Clr</i> 清空
        </Button>
      </div>
    </div>

    <!-- Digital Readout / Status -->
    <div class="w-full mt-2 p-3 bg-slate-900/30 backdrop-blur-md border-l-2 border-cyan-500/60 flex flex-col gap-1 group hover:bg-slate-900/40 transition-colors">
      <div class="flex justify-between items-center">
        <p class="text-cyan-400/70 font-futuristic text-[10px] tracking-widest uppercase">
          Unit Data Stream
        </p>
        <div class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_5px_rgba(34,211,238,0.8)]"></div>
      </div>
      <div class="flex items-baseline gap-3">
        <span class="text-stone-400 text-xs font-chinese tracking-tight">当前模型组长度:</span>
        <span class="text-cyan-400 font-futuristic text-2xl tabular-nums drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
          {{ splicingGroupLen.toString().padStart(2, '0') }}
        </span>
      </div>
    </div>

    <!-- Hidden file inputs -->
    <input
      type="file"
      ref="fileInput"
      webkitdirectory
      directory
      multiple
      class="hidden"
      @change="handleFileChange"
    />
    <input
      type="file"
      ref="filesInput"
      accept=".obj,image/*"
      multiple
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>


<script setup lang="ts">
import { storeToRefs } from "pinia";
import type { Group, Object3DEventMap } from "three";
import { ref, watch } from "vue";
import { toast } from "vue3-toastify";
import { ToastContents } from "../../constants";
import { useModelsStore } from "../../stores/useModelsStore";
import { getFilteredSubGroups } from "../../three/meshOps";
import { validateImportFiles } from "../../utils/fileValidators";
import Button from "./Button.vue";

/**
 * Get the store
 */
const modelsStore = useModelsStore();
const { splicingGroupGlobal, splicingGroupLen, isShowMap } =
  storeToRefs(modelsStore);

// Use 'watch' to perform a side effect (like logging) when a reactive source changes
watch(splicingGroupLen, (newLength, oldLength) => {
  console.log(
    `\n -- ButtonContainer -- splicingGroupLen changed from ${oldLength} to ${newLength}`
  );
});

/**
 * Disable logic
 */
// let isExportBtnDisabled = computed(
//   // () => splicingGroupLen.value < MaxModelLength
//   () => splicingGroupLen.value === 0
// );
// let isClearBtnDisabled = computed(() => splicingGroupLen.value === 1);

/**
 * Input elements and fns.
 */
const fileInput = ref<HTMLInputElement | null>(null);
const filesInput = ref<HTMLInputElement | null>(null);

// Click "Import Folder" button → open file picker (directory mode)
const openFilePicker = () => {
  fileInput.value?.click();
};

// Click "Import Files" button -> open file picker (files mode)
const openFilesPicker = () => {
  filesInput.value?.click();
};

/**
 * Toggle isShowMap
 */
const toggleIsShowMap = () => {
  modelsStore.toggleIsShowMap();
};

/**
 * Import Models
 * When file selected → import it
 */
const handleFileChange = async (e: Event) => {
  console.log("splicingGroupLen before importing ->", splicingGroupLen.value);

  const target = e.target as HTMLInputElement;
  const files = target.files;

  /*
    Validate Files
   */
  // TODO: Change the validateImportFiles fn to validateImportFilesWithNodeNames fn later.
  const isValid = await validateImportFiles(files);
  if (!isValid) return;

  /*
    Import Obj File
   */
  // TODO: Change the imoprtObjWithModelHeight fn to imoprtObjWithNodeNames fn later.
  await modelsStore.imoprtObjWithModelHeight(files);

  console.log("splicingGroupLen after imported ->", splicingGroupLen.value);

  // clear input so selecting same file works
  target.value = "";

  toast(ToastContents.ModelImportedReminderContentZH, {
    autoClose: 1000,
  });
};

/**
 * Clear models
 */
const clearModels = () => {
  console.log("splicingGroupLen before clear ->", splicingGroupLen.value);

  // Filter out the cut head group (filteredSubGroups -> sub groups to remove)
  const filteredSubGroups: Group<Object3DEventMap>[] = getFilteredSubGroups(
    splicingGroupGlobal.value
  );

  console.log("\nfilteredSubGroups ->", filteredSubGroups);

  /*
    Check if there is hair or body group or both.
    If not, show a warning toast, return.
   */
  if (filteredSubGroups.length === 0) {
    // Show toast of failing to clear models, return.
    toast(ToastContents.ModelEmptyReminderContentZH, {
      autoClose: 1000,
      type: "warning",
    });
    return;
  }

  /*
    Dispose the geometries and materials of the hair or body group or both.
    Clear the hair or body group or both from the splicing global group.
   */
  modelsStore.clear(filteredSubGroups);

  // Show toast of successfully cleared models.
  toast(ToastContents.ModelClearedReminderContentZH, {
    autoClose: 1000,
  });
};

/**
 * Export models
 */
const handleExport = async () => {
  try {
    // TODO: Show a loading bar on the UI while exporting.
    const result = await modelsStore.exportModel();
    if (result) {
      toast.success("导出成功", { autoClose: 2000 });
    } else {
      console.log("Export cancelled or failed silently");
    }
  } catch (error) {
    console.error("Export failed", error);
    toast.error("导出失败", { autoClose: 2000 });
  }
};
</script>
