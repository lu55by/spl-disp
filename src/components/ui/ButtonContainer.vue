<template>
  <div class="max-w-1/6 w-auto h-full flex flex-col items-start justify-start gap-4">
    <!-- Import -->
    <Button :disabled="isImportBtnDisabled" @click="openFilePicker">
      Import
    </Button>

    <!-- Export (not implemented here) -->
    <Button :disabled="isExportBtnDisabled">Export</Button>

    <!-- Clear -->
    <Button :disabled="isClearBtnDisabled" @click="clearModels">Clear</Button>

    <p class="text-stone-100">Current Length: {{ groupLen }}</p>

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
import {computed, ref, watch} from "vue";
import Button from "./Button.vue";
import {useModelsStore} from "../../stores/useModelsStore";
import {toast} from "vue3-toastify";
import {
  MaxModelLength,
  ModelClearedReminderContent,
  ModelEmptyReminderContent,
  ModelImportedReminderContent,
  ModelImportMaxLenReminderContent
} from "../../constants";
import {storeToRefs} from "pinia";

// Get the store
const store = useModelsStore();
const {groupLen} = storeToRefs(store);

// TODO: Fix the non-reactive group length.
console.log('groupLen ->', groupLen.value);

// Use 'watch' to perform a side effect (like logging) when a reactive source changes
watch(groupLen, (newLength, oldLength) => {
  console.log(`groupLen changed from ${oldLength} to ${newLength}`);
});


// Disable logic
let isImportBtnDisabled = computed(() => groupLen.value === MaxModelLength);
let isExportBtnDisabled = computed(() => groupLen.value < MaxModelLength);
let isClearBtnDisabled = computed(() => groupLen.value === 0);

console.log('isClearBtnDisabled ->', isClearBtnDisabled.value);

// Hidden input reference
const fileInput = ref<HTMLInputElement | null>(null);

// Click "Import" button → open file picker
const openFilePicker = () => {
  fileInput.value?.click();
};

// When file selected → import it
const handleFileChange = async (e: Event) => {
  console.log('groupLen before import ->', groupLen.value);
  let toastContent: string = ModelImportedReminderContent;
  if (groupLen.value === MaxModelLength) {
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
  console.log('groupLen before clear ->', groupLen.value);
  let toastContent: string = ModelClearedReminderContent;
  if (groupLen.value === 0) {
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
