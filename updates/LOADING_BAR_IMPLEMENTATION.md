# Walkthrough - Loading Bar Implementation

I have implemented a global loading bar to visualize the loading progress of 3D assets.

## Files Created/Modified

### 1. New Files
- **`src/three/managers/GlobalLoadingManager.ts`**: A singleton `THREE.LoadingManager` instance.
- **`src/stores/useLoadingStore.ts`**: A Pinia store that hooks into the loading manager's events (`onStart`, `onProgress`, `onLoad`) to track `isLoading` state and `progress` percentage.
- **`src/components/ui/LoadingOverlay.vue`**: A styled Vue component that displays a black full-screen overlay with a white progress bar, bound to the store's state.

### 2. Modified Files
- **`src/three/constants/index.ts`**: Updated `OBJLoaderInstance` to use `GlobalLoadingManager`.
- **`src/three/loaders/TextureLoader.ts`**: Updated `loadTexture` to use `GlobalLoadingManager` for `THREE.TextureLoader`.
- **`src/components/three/ThreeScene.vue`**: Updated `UltraHDRLoader` to use `GlobalLoadingManager`.
- **`src/App.vue`**: Added `<LoadingOverlay />` to the main application template.

## Verification Results

### Manual Verification
- **Visual Check**:
    - The loading overlay appears immediately upon page load (transitioning from black).
    - The progress bar fills up as `OBJ` files, textures, and the HDR environment map are loaded.
    - The overlay fades out smoothly once all assets are loaded (progress reaches 100%).
- **Code Check**:
    - Verified that all major loaders are correctly passing the shared `GlobalLoadingManager`.
