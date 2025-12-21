import {
  cameraPosition,
  dot,
  Fn,
  normalLocal,
  positionLocal,
  smoothstep,
} from "three/tsl";
import * as THREE from "three/webgpu";

/**
 * Get Outline Pattern
 * args:
 *  uOutlineFactor: THREE.UniformNode<THREE.Vector2>
 * return:
 *  Outline Pattern
 */
export const getOutlinePattern = Fn(
  ([uOutlineFactor]: [uOutlineFactor: THREE.UniformNode<THREE.Vector2>]) => {
    return smoothstep(
      uOutlineFactor.x,
      uOutlineFactor.y,
      dot(positionLocal.sub(cameraPosition).normalize(), normalLocal)
        .abs()
        .oneMinus()
    );
  }
);
