# Drag and Drop Feature with Futuristic UI

I have implemented the drag and drop feature for importing files into the scene.

## Changes

- **New Component**: Created `src/components/ui/DragAndDropOverlay.vue` which handles drag events and displays a futuristic full-page overlay.
- **Integration**: Added `DragAndDropOverlay` to `src/components/SplicingModelsMainUIContainer.vue` so it sits on top of the generic UI and 3D scene.
- **Store Integration**: Connected the drop event to `modelsStore.imoprtObjStlModelWithHeight` to handle the actual file loading.

## How it works

1. **Drag**: When you drag a file into the window, a futuristic overlay appears with a glowing ring and a centered plus icon.
2. **Drop**: When you release the file, the overlay disappears and the file is processed by `modelsStore.imoprtObjStlModelWithHeight`.

## Visuals

- The overlay uses Tailwind CSS for `backdrop-blur`, `animate-spin` (customized), and `z-index` to ensure it looks premium and covers the screen.
- Custom animations (`spin`, `pulse-glow`) were added for that "futuristic" feel.

## Files Modified

- `src/components/ui/DragAndDropOverlay.vue` (New)
- `src/components/SplicingModelsMainUIContainer.vue` (Modified)
