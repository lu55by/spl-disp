import axios from "axios";
import { useAuthStore } from "../stores/useAuthStore";

/**
 * Global Axios instance configuration.
 */
const apiClient = axios.create({
  // The baseURL can be adjusted based on the production/development environment
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth tokens
apiClient.interceptors.request.use(
  (config) => {
    // Access the auth store
    const authStore = useAuthStore();

    // If a token exists in the store, add it to the Authorization header
    if (authStore.token) {
      config.headers["Authorization"] = `Bearer ${authStore.token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (useful for global error handling)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Global error handling logic
    return Promise.reject(error);
  }
);

export default apiClient;
