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
    // console.log(
    //   `Started loading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`
    // );
  };

  GlobalLoadingManager.onLoad = () => {
    isLoading.value = false;
    progress.value = 100;
    // console.log("Loading complete!");
  };

  GlobalLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    isLoading.value = true;
    progress.value = (itemsLoaded / itemsTotal) * 100;
    // console.log(
    //   `Loading file: ${url}.\nLoaded ${itemsLoaded} of ${itemsTotal} files.`
    // );
  };

  GlobalLoadingManager.onError = (url) => {
    console.error("There was an error loading " + url);
  };

  return {
    isLoading,
    progress,
  };
});
