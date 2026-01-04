import apiClient from "./index";

const ENDPOINTS = {
  UPLOAD_HAIR: import.meta.env.VITE_API_UPLOAD_PATH_HAIR,
  UPLOAD_BODY: import.meta.env.VITE_API_UPLOAD_PATH_BODY,
};

/**
 * Service to handle model-related API calls.
 */
export const modelService = {
  /**
   * Upload a 3D model with metadata.
   * @param formData The form data containing the file and metadata
   * @param isHair Whether the uploaded model is a hair, body otherwise
   * @param onProgress Callback function to track upload progress
   */
  uploadModel(
    formData: FormData,
    isHair: boolean,
    onProgress?: (progress: number) => void
  ) {
    const endpoint = isHair ? ENDPOINTS.UPLOAD_HAIR : ENDPOINTS.UPLOAD_BODY;
    // Iterate through the formData to log all keys and their values
    formData.forEach((value, key) => {
      console.log(
        `\n-- uploadModel -- formData key -> ${key}, value ->`,
        value
      );
    });
    console.log("\n-- uploadModel -- isHair ->", isHair);
    console.log("\n-- uploadModel -- endpoint ->", endpoint);
    // return;

    return apiClient.post(endpoint, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });
  },
};
