import { rgbShift } from "three/examples/jsm/tsl/display/RGBShiftNode.js";
import {
  cameraPosition,
  color,
  densityFogFactor,
  dot,
  float,
  Fn,
  fog,
  hue,
  luminance,
  materialColor,
  normalWorld,
  PI2,
  positionWorld,
  posterize,
  rangeFogFactor,
  saturation,
  sin,
  smoothstep,
  time,
  vibrance,
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
      // vWorldPosition (GLSL) -> positionWorld (TSL)
      dot(positionWorld.sub(cameraPosition).normalize(), normalWorld)
        .abs()
        .oneMinus()
    );
  }
);

export const getFogNode = Fn(() => {
  /*
    Functions for creating fog effects in the scene.
      // Creates a fog node with specified color and fog factor.
      fog(color: THREE.Node, factor: THREE.Node)
      // Creates a linear fog factor based on distance from camera.
      rangeFogFactor(near: THREE.Node | number, far: THREE.Node | number)
      // Creates an exponential squared fog factor for denser fog.
      densityFogFactor(density: THREE.Node)
   */
  // Linear fog (starts at .1 units, fully opaque at 300 units)
  const linearFog = fog(color("#000"), rangeFogFactor(0.1, 300));
  // Exponential fog (density-based)
  const exponentialFog = fog(color("#ccc"), densityFogFactor(float(0.004)));

  return linearFog.toVar();
});

/**
 * Functions for adjusting and manipulating colors.
 */
export const adjustAndManipulateColorNode = Fn(() => {
  /*
      Color Adjustments
    */

  // 1. luminance -> Calculates the luminance (perceived brightness) of a color.
  const luminanceNode = luminance(materialColor, float(2));

  // 2. saturation -> Adjusts the saturation of a Color. Values > 1 increase saturation, < 1 decrease.
  const saturationNode = saturation(materialColor, sin(time));

  // 3. vibrance -> Selectively enhances less saturated colors while preserving already saturated ones.
  const vibranceNode = vibrance(materialColor, sin(time).sub(0.5));

  // 4. hue -> Rotates the hue of a color. Value is in radians.
  const hueNode = hue(materialColor, sin(time.mul(0.4)).mul(PI2));

  // 5. posterize -> Reduces the number of color levels, creating a poster-like effect.
  const posterizeNode = posterize(
    materialColor,
    sin(time.mul(0.7)).add(2).mul(0.5).mul(10)
  );

  return vibranceNode.toVar();
});

/**
 * Fn to return Post-Processing Node
 */
export const getPostProcessingNode = Fn(
  ([scenePassColor]: [scenePassColor: THREE.TextureNode]) => {
    /*
      after image effect
     */
    // const afterImagePass = afterImage(scenePassColor, 0.96);

    /*
      anamophic flare effect
     */
    // const anamorphicFlarePass = anamorphic(
    //   scenePassColor,
    //   float(0.9),
    //   float(3),
    //   32
    // );

    /*
      bloom effect
     */
    // const bloomPass = bloom(scenePassColor);

    /*
      boxBlur effect
     */
    // const boxBlurPass = boxBlur(scenePassColor, {
    //   size: float(2),
    //   separation: float(5),
    //   mask: float(3),
    //   premultipliedAlpha: true,
    // });

    /*
      chromatic aberration effect
     */
    // const chromaticAberrationPass = chromaticAberration(
    //   scenePassColor,
    //   float(1),
    //   vec2(0),
    //   float(1)
    // );

    /*
      denoise effect (not working currently)
     */
    // const denoisePass = denoise(scenePassColor, depth, normalWorld, camera);

    /*
      dof effect (figure out what params to pass later)
     */
    // const dofPass = dof(scenePassColor, )

    /*
      dot-screen effect
     */
    // const dotScreenPass = dotScreen(scenePassColor, vec2(0).value, 1.57, 1);

    /*
      film grain effect
     */
    // const filmGrainPasss = film(scenePassColor, float(2), screenUV);

    /*
      FXAA anti-aliasing effect
     */
    // const fxaaPass = fxaa(scenePassColor);

    /*
      gaussian blur effect
     */
    // const gaussianBlurPass = gaussianBlur(scenePassColor, 10, 2, {
    //   premultipliedAlpha: false,
    //   resolution: vec2(1).value,
    // });

    /*
      grayscale effect
     */
    // const grayscalePass = grayscale(scenePassColor);

    /*
      hash blur effect
     */
    // const hashBlurPass = hashBlur(scenePassColor, 0.8, {
    //   size: float(2),
    //   mask: float(1),
    //   premultipliedAlpha: false,
    // });

    /*
      LUT color grading effect (figure out what params to pass later)
     */
    // const lut3DPass = lut3D(
    //   scenePassColor,
    //   texture3D(scenePassColor.value),
    //   2,
    //   float(1)
    // );

    /*
      motion blur effect
     */
    // const motionBlurPass = motionBlur(
    //   scenePassColor,
    //   sin(time.mul(1)).add(1).mul(0.5).pow(6),
    //   int(4)
    // );
    /*
      outline effect
     */
    // const outlinePass = outline(scene, camera, {
    //   selectedObjects: [splicingGroupGlobal.children[0].children[0]],
    //   edgeThickness: float(2),
    //   edgeGlow: float(0.2),
    //   downSampleRatio: 5,
    // });
    /*
      RGB shift effect
     */
    const rgbShiftPass = rgbShift(scenePassColor, 0.005, 1.57);
    return rgbShiftPass.toVar();

    /*
      sepia effect
     */
    // const sepiaPass = sepia(scenePassColor);

    /*
      SMAA anti-aliasing effect
     */
    // const smaaPass = smaa(scenePassColor);

    /*
      sobel edge detection effect
     */
    // const sobelPass = sobel(scenePassColor);

    /*
      screen space reflections effect
     */
    // const headModelNodeMat = (
    //   splicingGroupGlobal.children[0].children[0] as THREE.Mesh
    // ).material as THREE.MeshStandardNodeMaterial;
    // console.log("\nheadModelNodeMat ->", headModelNodeMat);
    // const ssrPass = ssr(
    //   scenePassColor,
    //   headModelNodeMat.depthNode,
    //   headModelNodeMat.normalNode,
    //   headModelNodeMat.metalnessNode,
    //   headModelNodeMat.roughnessNode,
    //   camera
    // );

    /*
      SSGI effect
     */
    // const ssgiPass = ssgi(
    //   scenePassColor,
    //   headModelNodeMat.depthNode,
    //   headModelNodeMat.normalNode,
    //   camera
    // );

    /*
      Ground Truth Ambient Occlusion (GTAO) effect
     */
    // const aoPass = ao(
    //   headModelNodeMat.depthNode,
    //   headModelNodeMat.normalNode,
    //   camera
    // );

    /*
      transition effect between two scenes (figure out what params to pass later)
     */
    // const transitionPass = transition(scenePassColor, )

    /*
      TRAA temporal anti-aliasing effect (figure out what params to pass later)
    */
    // const traaPass = traa(scenePassColor, scenePassColor, scenePassColor, camera);
  }
);
