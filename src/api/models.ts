import apiClient from "./index";

/**
 * Service to handle model-related API calls.
 */
export const modelService = {
  /**
   * Upload a 3D model with metadata.
   * @param formData The form data containing the file and metadata
   * @param onProgress Callback function to track upload progress
   */
  uploadModel(
    formData: FormData,
    onProgress?: (progress: number) => void
  ) {
    return apiClient.post("/upload", formData, {
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
