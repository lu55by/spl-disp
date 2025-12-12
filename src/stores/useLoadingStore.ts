import { defineStore } from "pinia";
import { ref } from "vue";
import { GlobalLoadingManager } from "../three/managers/GlobalLoadingManager";

export const useLoadingStore = defineStore("loading", () => {
  const isLoading = ref(false);
  const progress = ref(0);

  // Hook into GlobalLoadingManager
  GlobalLoadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
    isLoading.value = true;
    progress.value = (itemsLoaded / itemsTotal) * 100;
    console.log(
      `\nStarted loading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`
    );
  };

  GlobalLoadingManager.onLoad = () => {
    isLoading.value = false;
    progress.value = 100;
    console.log("\nLoading complete!");
  };

  GlobalLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    isLoading.value = true;
    progress.value = (itemsLoaded / itemsTotal) * 100;
    console.log(
      `\nLoading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`
    );
  };

  GlobalLoadingManager.onError = (url) => {
    console.error("\nThere was an error loading " + url);
  };

  return {
    isLoading,
    progress,
  };
});
