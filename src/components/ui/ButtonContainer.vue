<template>
  <div
    class="max-w-1/6 w-auto h-full flex flex-col items-start justify-start gap-4"
  >
    <!-- Import -->
    <Button :disabled="isImportBtnDisabled" @click="openFilePicker">
      导入
    </Button>

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

// Get the store
const store = useModelsStore();
const { splicingGroupLen } = storeToRefs(store);

// TODO: Fix the non-reactive group length.
console.log("splicingGroupLen ->", splicingGroupLen.value);

// Use 'watch' to perform a side effect (like logging) when a reactive source changes
watch(splicingGroupLen, (newLength, oldLength) => {
  console.log(`splicingGroupLen changed from ${oldLength} to ${newLength}`);
});

// Disable logic
let isImportBtnDisabled = computed(() => splicingGroupLen.value === MaxModelLength);
let isExportBtnDisabled = computed(() => splicingGroupLen.value < MaxModelLength);
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
  let toastContent: string = ModelClearedReminderContent;
  if (splicingGroupLen.value === 0) {
    toastContent = ModelEmptyReminderContent;
    toast(toastContent, {
      autoClose: 1000,
      type: "warning",
    });
    return;
  }

  store.clear();

  toast(toastContent, {
    autoClose: 1000,
  });
};
</script>
