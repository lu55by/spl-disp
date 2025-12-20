<template>
  <div
    class="max-w-1/6 w-auto h-full flex flex-col items-start justify-start gap-4"
  >
    <!-- Imports -->
    <Button @click="openFilePicker">导入文件夹</Button>
    <Button @click="openFilesPicker">导入文件</Button>

    <Button @click="toggleIsShowMap"
      >切换{{ isShowMap ? "白" : "彩" }}模</Button
    >

    <!-- Export (not implemented here) -->
    <!-- <Button :disabled="isExportBtnDisabled" :customClass="`exporter`">导出</Button> -->
    <Button :disabled="false" @click="handleExport">导出</Button>

    <!-- Clear -->
    <Button :disabled="false" @click="clearModels">清空</Button>

    <p class="text-stone-100">当前模型组长度: {{ splicingGroupLen }}</p>

    <!-- Hidden file input -->
    <input
      type="file"
      ref="fileInput"
      webkitdirectory
      directory
      multiple
      class="hidden"
      @change="handleFileChange"
    />

    <!-- Hidden files input -->
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
