# Adjust Pivot Points of Splicing Models

The goal is to automatically move the pivot point of each 3D object in `splicingGroupGlobal` to its bounding box center. This ensures that the TransformControls gizmo appears at the visual center of the object, and Raycaster attachment points are logical.

## User Review Required

> [!NOTE]
> This change modifies the `position` and `geometry` (for Meshes) or `children` positions (for Groups) of the objects. This is a destructive operation on the scene graph structure (transforms), but preserves visual rendering.

## Proposed Changes

### SplicingModels.vue

#### [MODIFY] [SplicingModels.vue](../src/components/three/SplicingModels.vue)

- Implement a helper function `adjustPivots(group: THREE.Group)` inside the component.
- The `adjustPivots` function will:
  - Iterate through `group.children`.
  - For each child:
    - Calculate the center of its bounding box.
    - If it is a `Mesh`:
      - Center the geometry (translate by `-center`).
      - Offset the mesh position (add `center` transformed by rotation/scale).
    - If it is a `Group`:
      - Calculate world center.
      - Temporarily detach children (attach to parent).
      - Move Group to world center.
      - Re-attach children.
- Call `adjustPivots(splicingGroupGlobal)` inside `updateOrbitControlsTargetCenter` so it runs whenever models are added or updated.

## Verification Plan

### Automated Tests

- None available for this specific UI/3D logic.

### Manual Verification

1.  **Launch the app** and load models into the scene.
2.  **Select a model** (click on it).
3.  **Verify Gizmo Position**: Ensure the TransformControls gizmo appears at the **visual center** of the object, not at `(0,0,0)` or an offset corner.
4.  **Verify Rendering**: Ensure the object does not visually jump or shift when the pivot is adjusted (it should stay in place).
5.  **Move Object**: Use the gizmo to move the object and verify it behaves correctly around its new center.
