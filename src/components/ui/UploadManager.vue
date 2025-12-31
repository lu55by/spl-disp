<template>
  <div
    class="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none"
    @click.stop
  >
    <!-- Upload Button (Bottom of viewport) -->
    <Transition name="slide-up">
      <div
        v-if="
          selectedObject &&
          selectedObject.name !== CutHeadEyesNodeCombinedGroupName &&
          !isUploadModalVisible
        "
        class="mb-4 pointer-events-auto"
      >
        <Button @click="showModal">
          <i class="opacity-50 text-[10px] uppercase mr-2">Sync</i>
          上传
        </Button>
      </div>
    </Transition>

    <!-- Pop-up Modal (Teleported to body to bypass parent transform) -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isUploadModalVisible"
          class="fixed inset-0 flex items-center justify-center z-100 pointer-events-auto"
          @click.stop
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-md"
            @click="closeModal"
          ></div>

          <!-- Modal Content -->
          <div
            class="relative bg-slate-950 border border-cyan-500/50 p-8 flex flex-col gap-6 max-w-sm w-[90vw] shadow-[0_0_50px_rgba(0,0,0,0.8)]"
          >
            <!-- Corner Accents -->
            <div class="absolute top-0 left-0 w-4 h-0.5 bg-cyan-500"></div>
            <div class="absolute top-0 left-0 w-0.5 h-4 bg-cyan-500"></div>
            <div class="absolute bottom-0 right-0 w-4 h-0.5 bg-cyan-500"></div>
            <div class="absolute bottom-0 right-0 w-0.5 h-4 bg-cyan-500"></div>

            <!-- Header -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <div
                  class="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"
                ></div>
                <h3
                  class="text-cyan-400 font-futuristic tracking-[0.2em] text-xl uppercase"
                >
                  选择上传类型
                </h3>
              </div>
              <div
                class="h-px w-full bg-linear-to-r from-cyan-500/50 via-cyan-500/20 to-transparent"
              ></div>
            </div>

            <div class="flex flex-col gap-4">
              <Button @click="handleUpload('Default')" :disabled="isUploading">
                {{ UIContents.DefaultZH }}
              </Button>
              <Button
                @click="handleUpload('Normal Outfit')"
                :disabled="true"
              >
                {{ UIContents.NormalOutfitZH }}
              </Button>
              <Button
                @click="handleUpload('IP Outfit')"
                :disabled="true"
              >
                {{ UIContents.IPOutfitZH }}
              </Button>
            </div>

            <!-- Footer Info -->
            <div class="mt-2 flex justify-between items-center opacity-30">
              <span class="text-[8px] text-cyan-500 uppercase tracking-[0.3em]"
                >System.Ready</span
              >
              <span class="text-[8px] text-cyan-500 uppercase tracking-[0.3em]"
                >v1.0.4-Sync</span
              >
            </div>

            <button
              @click="closeModal"
              class="absolute -top-3 -right-3 w-8 h-8 bg-slate-950 border border-cyan-500/50 text-cyan-400 flex items-center justify-center hover:bg-cyan-500 hover:text-slate-950 transition-colors cursor-pointer z-10"
            >
              &times;
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { ref } from "vue";
import { toast } from "vue3-toastify";
import { UIContents } from "../../constants";
import { useModelsStore } from "../../stores/useModelsStore";
import Button from "./Button.vue";
import { CutHeadEyesNodeCombinedGroupName } from "../../three/constants";

const modelsStore = useModelsStore();
const { selectedObject, isUploadModalVisible } = storeToRefs(modelsStore);

const isUploading = ref(false);

const showModal = () => {
  modelsStore.setUploadModalVisible(true);
};

const closeModal = () => {
  if (isUploading.value) return;
  modelsStore.setUploadModalVisible(false);
};

const handleUpload = async (
  type: "Default" | "Normal Outfit" | "IP Outfit"
) => {
  if (isUploading.value) return;
  isUploading.value = true;

  const loadingToastId = toast.loading("正在上传模型数据...");

  try {
    const success = await modelsStore.uploadSelectedObject(type);

    if (success) {
      toast.update(loadingToastId, {
        render: "模型成功同步至数据库",
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
    } else {
      toast.update(loadingToastId, {
        render: "上传失败，请稍后重试",
        type: "error",
        isLoading: false,
        autoClose: 2000,
      });
    }
  } catch (error) {
    toast.update(loadingToastId, {
      render: "发生未知错误",
      type: "error",
      isLoading: false,
      autoClose: 2000,
    });
    console.error(error);
  } finally {
    isUploading.value = false;
  }
};
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate3d(0, 30px, 0);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
