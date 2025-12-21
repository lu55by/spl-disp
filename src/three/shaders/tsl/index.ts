import * as THREE from "three/webgpu";
import {
  cameraPosition,
  dot,
  Fn,
  mix,
  normalLocal,
  positionLocal,
  smoothstep,
} from "three/tsl";
import type MathNode from "three/src/nodes/math/MathNode.js";

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
