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

const modelStore = useModelsStore();

// Disable logic
const isImportBtnDisabled = computed(() => modelStore.groupLen === 3);
const isExportBtnDisabled = computed(() => modelStore.groupLen !== 3);
const isClearBtnDisabled = computed(() => modelStore.groupLen === 0);

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

  await modelStore.importObj(file);

  // clear input so selecting same file works
  target.value = "";
};

const clearModels = modelStore.clear;
</script>
