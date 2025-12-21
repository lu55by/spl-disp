# Walkthrough - Directory Import Feature

I have implemented the ability to import a model and its texture by selecting a directory.

## Changes

### 1. `ButtonContainer.vue`

- Updated the file input to support `webkitdirectory` (folder selection) and `multiple` files.
- Updated `handleFileChange` to pass the full `FileList` to the store.
- **[NEW] Added "Import Files" button**: Added a second button and file input to allow selecting individual `.obj` and `.png` files directly, without needing a folder container.

### 2. `useModelsStore.ts`

- Updated `imoprtObjStlModelWithHeight` to accept a `FileList`.
- Added logic to finding the `.obj` file and the texture file (image) within the selected files.
- Added logic to load the texture using `URL.createObjectURL` and apply it to the loaded model.

## Verification Results

### Automated Checks

- Ran `npx vue-tsc -b` to verify type safety. Result: Success.

### Manual Verification Steps

1. **Folder Mode**: Click "Import Folder". Select a folder containing `obj+img`. Verify load.
2. **File Mode**: Click "Import Files". Select `obj` and `img` files together. Verify load.
