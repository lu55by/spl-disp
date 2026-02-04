import { createApp } from "vue";
import { createPinia } from "pinia";
import Vue3Toastify, { type ToastContainerOptions } from "vue3-toastify";
import "./style.css";
import "vue3-toastify/dist/index.css";
import App from "./App.vue";
import router from "./router";
import { useAuthStore } from "./stores/useAuthStore";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(Vue3Toastify, {
  autoClose: 3000,
  position: "top-center",
} as ToastContainerOptions);

// Initialize Auth Token on startup
const authStore = useAuthStore(pinia);
authStore.fetchToken();

app.mount("#app");
