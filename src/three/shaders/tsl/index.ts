import {
  cameraPosition,
  dot,
  Fn,
  normalWorld,
  positionWorld,
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
      // ! Fixed the issue of weird outline with positionWorld and normalWorld while we are repositioning and rotating the model.
      dot(positionWorld.sub(cameraPosition).normalize(), normalWorld)
        .abs()
        .oneMinus()
    );
  }
);
