import axios from "axios";

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

// Request interceptor (useful for adding auth tokens in the future)
apiClient.interceptors.request.use(
  (config) => {
    // Modify config here
    // TODO: Add the auth token here.
    // config.headers["Authorization"] = "Bearer " + localStorage.getItem("token");
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
