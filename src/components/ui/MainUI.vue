<template>
  <div class="fixed max-lg:pt-9 top-0 left-0 right-0 bottom-0 z-10 p-3 pointer-events-none">
    <!-- Btn Container -->
    <div class="max-w-1/6 h-full flex flex-col items-start justify-start gap-2">
      <Button>Import</Button>
      <Button>Export</Button>
    </div>
  </div>
</template>
<script setup lang="ts">
import Button from "./Button.vue";
</script>