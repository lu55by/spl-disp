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
            class="relative bg-slate-950 border border-cyan-500/50 p-8 flex flex-col gap-6 w-[90vw] transition-all duration-300 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            :class="currentStep === 'select' ? 'max-w-sm' : 'max-w-md'"
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
                  {{
                    currentStep === "select" ? "选择上传类型" : "完善模型信息"
                  }}
                </h3>
              </div>
              <div
                class="h-px w-full bg-linear-to-r from-cyan-500/50 via-cyan-500/20 to-transparent"
              ></div>
            </div>

            <!-- Step 1: Selection -->
            <div v-if="currentStep === 'select'" class="flex flex-col gap-4">
              <Button @click="goToForm('Default')">
                {{ UIContents.DefaultOutfitZH }}
              </Button>
              <Button @click="goToForm('Normal Outfit')" :disabled="true">
                {{ UIContents.NormalOutfitZH }}
              </Button>
              <Button @click="goToForm('IP Outfit')" :disabled="true">
                {{ UIContents.IPOutfitZH }}
              </Button>
            </div>

            <!-- Step 2: Form -->
            <div v-else class="flex flex-col gap-5" @click.stop>
              <!-- Name Input -->
              <div class="flex flex-col gap-1.5">
                <label
                  class="text-[10px] text-cyan-500/70 uppercase tracking-widest pl-1"
                  >模型名称</label
                >
                <input
                  v-model="formFields.name"
                  type="text"
                  placeholder="请输入模型名称"
                  class="bg-slate-900 border border-cyan-500/30 text-cyan-100 p-2.5 text-sm focus:border-cyan-400 focus:outline-none transition-colors"
                />
              </div>

              <!-- Description Input -->
              <div class="flex flex-col gap-1.5">
                <label
                  class="text-[10px] text-cyan-500/70 uppercase tracking-widest pl-1"
                  >模型描述</label
                >
                <textarea
                  v-model="formFields.description"
                  placeholder="可选：输入模型描述"
                  rows="2"
                  class="bg-slate-900 border border-cyan-500/30 text-cyan-100 p-2.5 text-sm focus:border-cyan-400 focus:outline-none transition-colors resize-none"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <!-- Sex Selection -->
                <div class="flex flex-col gap-1.5">
                  <label
                    class="text-[10px] text-cyan-500/70 uppercase tracking-widest pl-1"
                    >性别</label
                  >
                  <div
                    class="flex bg-slate-900 border border-cyan-500/30 p-0.5"
                  >
                    <button
                      @click="formFields.sex = '0'"
                      :class="
                        formFields.sex === '0'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-cyan-500/50 hover:bg-cyan-500/10'
                      "
                      class="flex-1 py-1.5 text-xs transition-all uppercase tracking-tighter"
                    >
                      男
                    </button>
                    <button
                      @click="formFields.sex = '1'"
                      :class="
                        formFields.sex === '1'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-cyan-500/50 hover:bg-cyan-500/10'
                      "
                      class="flex-1 py-1.5 text-xs transition-all uppercase tracking-tighter"
                    >
                      女
                    </button>
                  </div>
                </div>

                <!-- Is Default Selection -->
                <div class="flex flex-col gap-1.5">
                  <label
                    class="text-[10px] text-cyan-500/70 uppercase tracking-widest pl-1"
                    >是否为默认模型</label
                  >
                  <div
                    class="flex bg-slate-900 border border-cyan-500/30 p-0.5"
                  >
                    <button
                      @click="formFields.is_default = '1'"
                      :class="
                        formFields.is_default === '1'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-cyan-500/50 hover:bg-cyan-500/10'
                      "
                      class="flex-1 py-1.5 text-xs transition-all uppercase tracking-tighter"
                    >
                      是
                    </button>
                    <button
                      @click="formFields.is_default = '0'"
                      :class="
                        formFields.is_default === '0'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'text-cyan-500/50 hover:bg-cyan-500/10'
                      "
                      class="flex-1 py-1.5 text-xs transition-all uppercase tracking-tighter"
                    >
                      否
                    </button>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-4 mt-2">
                <button
                  @click="currentStep = 'select'"
                  class="flex-1 py-2.5 border border-cyan-500/20 text-cyan-500/50 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-xs uppercase tracking-[0.2em] font-futuristic"
                >
                  返回
                </button>
                <Button
                  class="flex-1 h-[42px]"
                  @click="handleUpload"
                  :disabled="isUploading || !formFields.name"
                >
                  确认上传
                </Button>
              </div>
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
import { reactive, ref } from "vue";
import { toast } from "vue3-toastify";
import { ToastContentsUpload, UIContents } from "../../constants";
import { useModelsStore } from "../../stores/useModelsStore";
import { CutHeadEyesNodeCombinedGroupName } from "../../three/constants";
import type { UploadModelInputFields } from "../../types";
import Button from "./Button.vue";

const modelsStore = useModelsStore();
const { selectedObject, isUploadModalVisible } =
  storeToRefs(modelsStore);

const isUploading = ref(false);
const currentStep = ref<"select" | "form">("select");
const selectedType = ref<"Default" | "Normal Outfit" | "IP Outfit">("Default");

const formFields = reactive<UploadModelInputFields>({
  name: "",
  description: "",
  sex: "0",
  is_default: "0",
});

const showModal = () => {
  currentStep.value = "select";
  modelsStore.setUploadModalVisible(true);
};

const goToForm = (type: "Default" | "Normal Outfit" | "IP Outfit") => {
  selectedType.value = type;
  currentStep.value = "form";

  // Pre-populate defaults
  if (selectedObject.value && selectedObject.value.children.length > 0) {
    formFields.name = selectedObject.value.children[0].name || "";
  }
};

const closeModal = () => {
  if (isUploading.value) return;
  modelsStore.setUploadModalVisible(false);
};

const handleUpload = async () => {
  if (isUploading.value || !selectedType.value) return;
  isUploading.value = true;

  const loadingToastId = toast.loading(ToastContentsUpload.Loading);

  try {
    const success = await modelsStore.uploadSelectedObject(selectedType.value, {
      ...formFields,
    });

    if (success) {
      toast.update(loadingToastId, {
        render: ToastContentsUpload.Success,
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
      closeModal();
    } else {
      toast.update(loadingToastId, {
        render: ToastContentsUpload.Error,
        type: "error",
        isLoading: false,
        autoClose: 2000,
      });
    }
  } catch (error) {
    toast.update(loadingToastId, {
      render: (error as any).message || ToastContentsUpload.UnknownError,
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
