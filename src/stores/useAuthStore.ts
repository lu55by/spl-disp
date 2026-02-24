import { defineStore } from "pinia";
import axios from "axios";

/**
 * Auth Store to handle token management.
 */
export const useAuthStore = defineStore("auth", {
  state: () => ({
    // Map of server Base URLs to their respective tokens
    tokens: {} as Record<string, string>,
    // Loading state for token fetching
    loading: false,
    // Error state if token fetch fails
    error: null as string | null,
  }),

  getters: {
    /**
     * Get the token for a specific base URL.
     */
    getToken: (state) => (baseUrl: string) => {
      return state.tokens[baseUrl] || null;
    },
  },

  actions: {
    /**
     * Fetch a fresh token from a specific backend server.
     * @param baseUrl The base URL of the server to fetch the token from
     */
    async fetchToken(baseUrl: string = import.meta.env.VITE_API_BASE_URL) {
      if (!baseUrl) return;

      this.loading = true;
      this.error = null;

      try {
        const tokenPath = import.meta.env.VITE_API_TOKEN_PATH;
        const username = import.meta.env.VITE_API_TOKEN_USERNAME;
        const password = import.meta.env.VITE_API_TOKEN_PASSWORD;
        console.log(`\n-- fetchToken -- Fetching token for -> ${baseUrl}`);

        // Construct the full URL for the POST request
        const url = `${baseUrl}${tokenPath}`;

        // Create URLSearchParams for application/x-www-form-urlencoded
        const params = new URLSearchParams();
        params.append("username", username);
        params.append("password", password);

        const response = await axios.post(url, params, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            accept: "application/json",
          },
        });

        const resData = response.data;

        // Standard OAuth2 response usually contains 'access_token'
        const receivedToken = resData.access_token || resData.token || resData;

        if (receivedToken && typeof receivedToken === "string") {
          this.tokens[baseUrl] = receivedToken;
          console.log(`Token for ${baseUrl} fetched successfully!`);
        } else {
          throw new Error("Invalid token received from server.");
        }
      } catch (err: any) {
        this.error = err.message || "Failed to fetch token";
        console.error(
          `Error fetching auth token for ${baseUrl} ->`,
          this.error,
        );
        throw err; // Re-throw to handle in the component
      } finally {
        this.loading = false;
      }
    },
  },
});
