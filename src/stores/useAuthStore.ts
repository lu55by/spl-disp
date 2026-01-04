import { defineStore } from "pinia";
import axios from "axios";

/**
 * Auth Store to handle token management.
 */
export const useAuthStore = defineStore("auth", {
  state: () => ({
    // The authentication token
    token: null as string | null,
    // Loading state for token fetching
    loading: false,
    // Error state if token fetch fails
    error: null as string | null,
  }),

  actions: {
    /**
     * Fetch a fresh token from the backend.
     * This is called on page reload to ensure a valid token is available.
     */
    async fetchToken() {
      this.loading = true;
      this.error = null;

      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL;
        const tokenPath = import.meta.env.VITE_API_TOKEN_PATH;
        const username = import.meta.env.VITE_API_TOKEN_USERNAME;
        const password = import.meta.env.VITE_API_TOKEN_PASSWORD;
        console.log("\n-- fetchToken -- Base URL ->", baseUrl);
        // console.log("\n-- fetchToken -- Token Path ->", tokenPath);
        // console.log("\n-- fetchToken -- Username ->", username);
        // console.log("\n-- fetchToken -- Password ->", password);

        // Construct the full URL for the GET request
        const url = `${baseUrl}${tokenPath}`;

        // Create URLSearchParams for application/x-www-form-urlencoded
        const params = new URLSearchParams();
        // params.append("grant_type", "password");
        params.append("username", username);
        params.append("password", password);
        // params.append("scope", "");
        // params.append("client_id", "string");
        // params.append("client_secret", "********");

        const response = await axios.post(url, params, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            accept: "application/json",
          },
        });

        const resData = response.data;
        // console.log("\n-- fetchToken -- Response Data ->", resData);
        // return;

        // Standard OAuth2 response usually contains 'access_token'
        const receivedToken = resData.access_token || resData.token || resData;

        if (receivedToken && typeof receivedToken === "string") {
          this.token = receivedToken;
          console.log("Token fetched successfully!");
        } else {
          throw new Error("Invalid token received from server.");
        }
      } catch (err: any) {
        this.error = err.message || "Failed to fetch token";
        console.error("Error fetching auth token ->", this.error);
      } finally {
        this.loading = false;
      }
    },
  },
});
