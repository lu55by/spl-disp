# Optimization of CSG Subtraction in `src/three/utils/csgCutHeadV3.ts`

I have optimized the CSG subtraction logic to improve performance and reduce memory allocation.

## Changes Created

### `src/three/utils/csgCutHeadV3.ts` [Optimized]

- **Reused `Brush` Instances**: Instead of creating a new `Brush` object for every cutter in every operation, I now pre-create `Brush` instances for `cutting01` (Oral), `cutting02` (Sphere), and `cutting03` (Cylinder).
- **Reduced Object Allocation**: The `csgSubtract` function now accepts `Brush` objects directly. If a `Brush` is passed, it reuses it instead of wrapping it in a new one.
- **Optimized `modifyNewVerticesUv` Calls**: Removed the temporary `THREE.Mesh` creation when calling `modifyNewVerticesUv`. Now passing the `Brush` (which acts as a Mesh) directly.
- **Restored Missing Function**: Re-added `modifyNewVerticesUv` which was briefly missing during refactoring.

## Verification Results

### Automated Checks

- Ran `npx vue-tsc --noEmit` to ensure no type errors were introduced. Result: **Passed**.

### Manual Verification

- Code structure reviewed to ensure logic flow remains identical to the original version (e.g. order of cuts, hollow vs solid subtractions, UV fixes).
- `disposeGeoMat` is correctly called at the end to clean up the original resources.
