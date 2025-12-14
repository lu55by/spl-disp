<template>
  <div
    class="max-w-1/6 w-auto h-full flex flex-col items-start justify-start gap-4"
  >
    <!-- Import -->
    <Button @click="openFilePicker">导入</Button>

    <!-- Export (not implemented here) -->
    <Button :disabled="isExportBtnDisabled" :customClass="`exporter`"
      >导出</Button
    >

    <!-- Clear -->
    <Button :disabled="isClearBtnDisabled" @click="clearModels">清空</Button>

    <p class="text-stone-100">当前模型组长度: {{ splicingGroupLen }}</p>

    <!-- Hidden file input -->
    <input
      type="file"
      ref="fileInput"
      accept=".obj"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Button from "./Button.vue";
import { useModelsStore } from "../../stores/useModelsStore";
import { toast } from "vue3-toastify";
import {
  MaxModelLength,
  ModelClearedReminderContent,
  ModelEmptyReminderContent,
  ModelImportedReminderContent,
  ModelImportMaxLenReminderContent,
} from "../../constants";
import { storeToRefs } from "pinia";
import { CutHeadEyesCombinedGroupName } from "../../three/constants";
import type { Group, Object3DEventMap } from "three";
import { getFilteredSubGroups } from "../../three/meshOps";

// Get the store
const store = useModelsStore();
const { splicingGroupGlobal, splicingGroupLen } = storeToRefs(store);

// TODO: Fix the non-reactive group length.
console.log("splicingGroupLen ->", splicingGroupLen.value);

// Use 'watch' to perform a side effect (like logging) when a reactive source changes
watch(splicingGroupLen, (newLength, oldLength) => {
  console.log(`splicingGroupLen changed from ${oldLength} to ${newLength}`);
});

// Disable logic
let isExportBtnDisabled = computed(
  () => splicingGroupLen.value < MaxModelLength
);
let isClearBtnDisabled = computed(() => splicingGroupLen.value === 0);

console.log("isClearBtnDisabled ->", isClearBtnDisabled.value);

// Hidden input reference
const fileInput = ref<HTMLInputElement | null>(null);

// Click "Import" button → open file picker
const openFilePicker = () => {
  fileInput.value?.click();
};

// When file selected → import it
const handleFileChange = async (e: Event) => {
  console.log("splicingGroupLen before import ->", splicingGroupLen.value);
  let toastContent: string = ModelImportedReminderContent;
  if (splicingGroupLen.value === MaxModelLength) {
    toastContent = ModelImportMaxLenReminderContent;
    toast(toastContent, {
      autoClose: 1000,
      type: "warning",
    });
    return;
  }

  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  await store.importObj(file);

  // clear input so selecting same file works
  target.value = "";

  toast(toastContent, {
    autoClose: 1000,
  });
};

const clearModels = () => {
  console.log("splicingGroupLen before clear ->", splicingGroupLen.value);

  // The toast content to show, whether it is successful or not.
  let toastContent: string = ModelClearedReminderContent;

  // Filter out the cut head group
  const filteredSubGroups: Group<Object3DEventMap>[] = getFilteredSubGroups(
    splicingGroupGlobal.value
  );

  console.log("\nfilteredSubGroups ->", filteredSubGroups);

  /*
    Check if there is hair or body group or both.
    If not, show a warning toast, return.
   */
  if (filteredSubGroups.length === 0) {
    // Reassign the toast content of failure to show.
    toastContent = ModelEmptyReminderContent;
    // Show toast of failing to clear models.
    toast(toastContent, {
      autoClose: 1000,
      type: "warning",
    });
    return;
  }

  /*
    Dispose the geometries and materials of the hair or body group or both.
    Clear the hair or body group or both from the splicing global group.
   */
  store.clear(filteredSubGroups);

  // Show toast of successfully cleared models.
  toast(toastContent, {
    autoClose: 1000,
  });
};
</script>
