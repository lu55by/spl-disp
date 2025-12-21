<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'relative group px-6 py-2.5 overflow-hidden transition-all duration-300 w-full sm:w-auto min-w-[140px]',
      'bg-slate-900/40 backdrop-blur-md border border-cyan-500/30',
      'text-cyan-400 font-futuristic tracking-widest uppercase text-sm',
      'hover:border-cyan-400 hover:text-cyan-200 hover:shadow-[0_0_20px_rgba(34,211,238,0.25)]',
      'active:scale-[0.98]',
      'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100',
      'flex items-center justify-center gap-2 pointer-events-auto',
      customClass
    ]"
  >
    <!-- Background Glow Effect on Hover -->
    <div class="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

    <!-- Edge Accents -->
    <div class="absolute top-0 left-0 w-2 h-0.5 bg-cyan-500 group-hover:bg-cyan-300 transition-colors"></div>
    <div class="absolute top-0 left-0 w-0.5 h-2 bg-cyan-500 group-hover:bg-cyan-300 transition-colors"></div>

    <div class="absolute bottom-0 right-0 w-2 h-0.5 bg-cyan-500 group-hover:bg-cyan-300 transition-colors"></div>
    <div class="absolute bottom-0 right-0 w-0.5 h-2 bg-cyan-500 group-hover:bg-cyan-300 transition-colors"></div>

    <!-- Subtle Scanline -->
    <div class="absolute inset-0 pointer-events-none bg-size-[100%_2px,3px_100%] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-0"></div>

    <!-- Label -->
    <span class="relative z-10 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
      <slot />
    </span>

    <!-- Animated Shine -->
    <div class="absolute -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-linear-to-r from-transparent via-white/10 to-transparent group-hover:animate-shine"></div>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  customClass?: string;
}>(), {
  type: 'button',
  disabled: false,
  customClass: '',
});
</script>

<style scoped>
@keyframes shine {
  100% {
    left: 125%;
  }
}
.animate-shine {
  animation: shine 0.8s ease-in-out;
}
</style>
