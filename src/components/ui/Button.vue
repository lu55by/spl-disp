<template>
  <button :type="type" :disabled="disabled" :class="customClass"
          class="exporter w-1/2 pointer-events-auto
          bg-stone-100
          text-stone-800 p-2 rounded-md font-medium cursor-pointer
          disabled:cursor-not-allowed disabled:opacity-70">
    <slot/>
  </button>
</template>
<script setup lang="ts">
const props = defineProps<{
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  customClass?: string;
}>();

const {
  type = 'button',
  disabled = false,
  customClass = '',
} = props;
</script>