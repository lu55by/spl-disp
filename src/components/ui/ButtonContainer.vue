<template>
  <!-- Btn Container -->
  <div class="max-w-1/6 w-auto h-full flex flex-col items-start justify-start gap-2">
    <Button :disabled="isImportBtnDisabled">Import</Button>
    <Button :disabled="isExportBtnDisabled">Export</Button>
  </div>
</template>
<script setup lang="ts">
import Button from "./Button.vue";
import {useModelsStore} from "../../stores/useModelsStore.ts";

const modelStore = useModelsStore();

const isImportBtnDisabled = modelStore.groupLen === 3;
const isExportBtnDisabled = modelStore.groupLen === 0;
</script>