import {
  cameraPosition,
  dot,
  Fn,
  modelWorldMatrix,
  normalLocal,
  positionLocal,
  smoothstep,
  vec4,
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
    // Try to deactivate the transformation of the normal
    // like in glsl ` vNormal = (modelMatrix * vec4(normal, 0.)).xyz;`
    const normalTransDeactivated = modelWorldMatrix.mul(
      vec4(normalLocal, 0)
    ).xyz;

    return smoothstep(
      uOutlineFactor.x,
      uOutlineFactor.y,
      dot(positionLocal.sub(cameraPosition).normalize(), normalTransDeactivated)
        .abs()
        .oneMinus()
    );
  }
);
