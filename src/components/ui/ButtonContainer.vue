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
import {computed, ref} from "vue";
import Button from "./Button.vue";
import {useModelsStore} from "../../stores/useModelsStore";
import {toast} from "vue3-toastify";
import {
  MaxModelLength,
  ModelClearedReminderContent,
  ModelImportedReminderContent,
  ModelImportMaxLenReminderContent
} from "../../constants";
import {storeToRefs} from "pinia";

// Get the store
const store = useModelsStore();
const {group} = storeToRefs(store);


console.log('groupLen ->', group.value.children.length);

// Disable logic
const isImportBtnDisabled = computed(() => group.value.children.length === MaxModelLength);
const isExportBtnDisabled = computed(() => group.value.children.length < MaxModelLength);
const isClearBtnDisabled = computed(() => group.value.children.length === 0);

// Hidden input reference
const fileInput = ref<HTMLInputElement | null>(null);

// Click "Import" button → open file picker
const openFilePicker = () => {
  fileInput.value?.click();
};

// When file selected → import it
const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  await store.importObj(file);

  // clear input so selecting same file works
  target.value = "";

  if (group.value.children.length < MaxModelLength) {
    toast(ModelImportedReminderContent, {
      autoClose: 1000,
    });
  } else {
    toast(ModelImportMaxLenReminderContent, {
      autoClose: 1000,
      type: "warning",
    });
  }
};

const clearModels = () => {
  store.clear();

  toast(ModelClearedReminderContent, {
    autoClose: 1000,
  });
};
</script>
