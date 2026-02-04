<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

const goHome = () => {
  router.push("/");
};
</script>

<template>
  <div
    class="min-h-screen w-full flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,var(--tw-gradient-from)_0%,transparent_100%)] from-indigo-500/10"
  >
    <div
      class="max-w-md w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 text-center shadow-2xl space-y-8 relative overflow-hidden group"
    >
      <!-- Decorative background blur -->
      <div
        class="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/20 blur-[80px] rounded-full group-hover:bg-purple-500/30 transition-all duration-700"
      ></div>
      <div
        class="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 blur-[80px] rounded-full group-hover:bg-blue-500/30 transition-all duration-700"
      ></div>

      <div class="space-y-4 relative">
        <h1
          class="text-8xl font-black text-transparent bg-clip-text bg-linear-to-br from-indigo-400 to-purple-400 tracking-tighter"
        >
          404
        </h1>
        <h2 class="text-2xl font-bold text-white/90">页面未找到</h2>
        <p class="text-white/40 leading-relaxed">
          页面未找到，请检查URL是否正确
        </p>
      </div>

      <div class="pt-4 relative">
        <button
          @click="goHome"
          class="w-full py-4 px-8 rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
        >
          返回首页
        </button>
      </div>

      <p class="text-xs text-white/20 uppercase tracking-widest pt-4">
        Splicing Models System
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Any additional specific styles if needed -> but Tailwind 4 is powerful enough */
</style>
