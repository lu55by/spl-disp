import { Brush } from "three-bvh-csg";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three/webgpu";
import {
  Colors,
  CutHeadBoundingBoxHeight,
  CutHeadDebugProps,
  CutHeadEyesNodeCombinedGroupName,
  ModelPaths,
  NodeNames,
  type PhongMesh,
  UVCoordinateMod,
} from "../constants";
import { exportObjectToOBJ } from "../exporters";
import { loadTexture } from "../loaders/TextureLoader";
import { getCutHead } from "../utils/csgCutHeadV3";

import initManifold from "manifold-3d";
import manifoldWasm from "manifold-3d/manifold.wasm?url";
import type {
  CutHeadEyesNodeCombinedGrpUserData,
  FacialMorphsVisualizers,
} from "../../types";

/**
 * Generates facial morphs for a given model.
 * @param model The model to generate facial morphs for.
 * @param manualTips The manual selected tips.
 */
export function generateFacialMorphs(
  model: THREE.Group,
  manualTips?: {
    jawTipL?: THREE.Vector3;
    jawTipR?: THREE.Vector3;
    eyeBrowTipL?: THREE.Vector3;
    eyeBrowTipR?: THREE.Vector3;
    mouseCornerTipL?: THREE.Vector3;
    mouseCornerTipR?: THREE.Vector3;
  },
): FacialMorphsVisualizers {
  console.log(
    `\n---- Ready to generate facial morphs for [${model.name}] ----\n`,
  );
  console.log("\n -- generateFacialMorphs -- model ->", model);

  // Get the head node
  const headNode = (model.getObjectByName(NodeNames.HeadNames.Head) ||
    model.getObjectByName("CutHeadNode")) as THREE.Mesh;

  // Check if the geometry has morph attributes
  if (headNode.geometry.morphAttributes.position) {
    console.warn(
      "\n -- generateFacialMorphs -- mesh.geometry.morphAttributes.position exists, overwriting...",
    );
  }

  // Get the eye nodes
  const eyeLNode = (model.getObjectByName(NodeNames.HeadNames.EyeL) ||
    model.getObjectByName("EyeLNode")) as THREE.Mesh;
  const eyeRNode = (model.getObjectByName(NodeNames.HeadNames.EyeR) ||
    model.getObjectByName("EyeRNode")) as THREE.Mesh;
  // Get the center of the eye nodes
  const centerEyeLNode = new THREE.Box3()
    .setFromObject(eyeLNode)
    .getCenter(new THREE.Vector3());
  const centerEyeRNode = new THREE.Box3()
    .setFromObject(eyeRNode)
    .getCenter(new THREE.Vector3());
  console.log("\n -- generateFacialMorphs -- headNode ->", headNode);
  console.log("\n -- generateFacialMorphs -- eyeLNode ->", eyeLNode);
  console.log("\n -- generateFacialMorphs -- eyeRNode ->", eyeRNode);
  console.log(
    "\n -- generateFacialMorphs -- centerEyeLNode ->",
    centerEyeLNode,
  );
  console.log(
    "\n -- generateFacialMorphs -- centerEyeRNode ->",
    centerEyeRNode,
  );

  // Get the minYSphCutHead, maxYSphCutHead and sphCutHeadHeight from the headNode.parent userData
  const { minYSphCutHead, maxYSphCutHead, sphCutHeadHeight } = headNode.parent
    ?.userData as CutHeadEyesNodeCombinedGrpUserData;
  const mouseTipY = minYSphCutHead + sphCutHeadHeight * 0.215;
  // console.log(
  //   "\n -- generateFacialMorphs -- minYSphCutHead ->",
  //   minYSphCutHead,
  // );
  // console.log(
  //   "\n -- generateFacialMorphs -- maxYSphCutHead ->",
  //   maxYSphCutHead,
  // );
  // console.log(
  //   "\n -- generateFacialMorphs -- sphCutHeadHeight ->",
  //   sphCutHeadHeight,
  // );
  // console.log(
  //   "\n -- generateFacialMorphs -- mouseTipY calculated ->",
  //   mouseTipY,
  // );

  const geoOrg = headNode.geometry;
  // Clone geometry to ensure we don't affect other meshes sharing the same geometry
  headNode.geometry = headNode.geometry.clone();
  // Dispose the original geometry before cloning
  geoOrg.dispose();
  const geo = headNode.geometry;
  const positions = geo.getAttribute("position");
  const vertex = new THREE.Vector3();

  /*
    Tips
   */
  // Nose Tip
  let noseTip = new THREE.Vector3(0, 0, -Infinity);
  // Nostril Tip L
  let nostrilTipL = new THREE.Vector3(Infinity, 0, 0);
  // Nostril Tip R
  let nostrilTipR = new THREE.Vector3(-Infinity, 0, 0);
  // Jaw Tip L
  let jawTipL = new THREE.Vector3(Infinity, 0, 0);
  // Jaw Tip R
  let jawTipR = new THREE.Vector3(-Infinity, 0, 0);
  // Eye Brow Tip L
  let eyeBrowTipL = new THREE.Vector3(Infinity, 0, 0);
  // Eye Brow Tip R
  let eyeBrowTipR = new THREE.Vector3(-Infinity, 0, 0);
  // Mouse Tip L
  let mouseCornerTipL = new THREE.Vector3(Infinity, 0, 0);
  // Mouse Tip R
  let mouseCornerTipR = new THREE.Vector3(-Infinity, 0, 0);
  // Ear Tip L
  let earTipL = new THREE.Vector3(Infinity, 0, 0);
  // Ear Tip R
  let earTipR = new THREE.Vector3(-Infinity, 0, 0);

  /*
    Vertices for visualization
   */
  const visualizerByNoseTipDetection: THREE.Vector3[] = [];
  const visualizerByNostrilTipsDetection: THREE.Vector3[] = [];
  const visualizerByJawTipsDetection: THREE.Vector3[] = [];
  const visualizerByEyeBrowTipsDetection: THREE.Vector3[] = [];
  const visualizerByMouseCornerTipsDetection: THREE.Vector3[] = [];
  const visualizerByEarTipsDetection: THREE.Vector3[] = [];
  const visualizerByNoseMorph: THREE.Vector3[] = [];
  const visualizerByNostrilMorph: THREE.Vector3[] = [];
  const visualizerByJawMorph: THREE.Vector3[] = [];
  const visualizerByEyeBrowMorph: THREE.Vector3[] = [];
  const visualizerByMouseCornersWidthMorph: THREE.Vector3[] = [];
  const visualizerByEarMorph: THREE.Vector3[] = [];

  /**
   * Ⅰ.Ⅰ NOSE TIP DETECTION
   */
  // 1.1.1 Look for the vertex with the max Z value within a narrow vertical strip in the center

  /*
    Variables for excluding the vertices that the y coordinate is outside the
    offset boundingBox on the Y axis for nose tip detection
   */
  const maxVertYPerc = 0.3;
  const minVertYPerc = 0.25;
  const noseTipDetectionDisY = sphCutHeadHeight;
  const maxYNoseTipDetection =
    maxYSphCutHead - noseTipDetectionDisY * maxVertYPerc;
  const minYNoseTipDetection =
    minYSphCutHead + noseTipDetectionDisY * minVertYPerc;

  // 1.1.2 Iterate through the vertex count to get the nose tip
  for (let i = 0; i < positions.count; i++) {
    // Update the vertex based on the current index
    vertex.fromBufferAttribute(positions, i);
    // Exclude the vertices that the y coordinate is outside the offset boundingBox on the Y axis
    if (vertex.y <= maxYNoseTipDetection && vertex.y >= minYNoseTipDetection) {
      // Find the vertex with maximal Z
      if (vertex.z > noseTip.z) noseTip.copy(vertex);
      visualizerByNoseTipDetection.push(vertex.clone());
    }
  }
  console.log("\n -- generateFacialMorphs -- noseTip calculated ->", noseTip);

  /**
   * Ⅰ.Ⅱ NOSTRIL TIPS DETECTION
   */
  // Find the lateral extremes (min X and max X) within a target bounding box relative to a reference point
  findLateralTips(
    noseTip,
    {
      yMinOffset: 0,
      yMaxOffset: 1,
      zMinOffset: -2,
      zMaxOffset: 0,
    },
    positions,
    nostrilTipL,
    nostrilTipR,
    visualizerByNostrilTipsDetection,
  );
  console.log(
    "\n -- generateFacialMorphs -- nostrilTipL calculated ->",
    nostrilTipL.x === Infinity ? "Not Found" : nostrilTipL,
  );
  console.log(
    "\n -- generateFacialMorphs -- nostrilTipR calculated ->",
    nostrilTipR.x === -Infinity ? "Not Found" : nostrilTipR,
  );

  /**
   * Ⅰ.Ⅲ JAW TIPS DETECTION
   */
  // Use manual jaw tips if provided, otherwise detect them
  if (manualTips?.jawTipL && manualTips?.jawTipR) {
    jawTipL.copy(manualTips.jawTipL);
    jawTipR.copy(manualTips.jawTipR);
    console.log("\n -- generateFacialMorphs -- using manual jaw tips");
  } else {
    // Find the lateral extremes (min X and max X) within a target bounding box relative to a reference point
    findLateralTips(
      noseTip,
      {
        yMinOffset: -7,
        yMaxOffset: -6,
        zMinOffset: -7,
        zMaxOffset: -5,
      },
      positions,
      jawTipL,
      jawTipR,
      visualizerByJawTipsDetection,
    );
  }
  console.log(
    "\n -- generateFacialMorphs -- jawTipL calculated ->",
    jawTipL.x === Infinity ? "Not Found" : jawTipL,
  );
  console.log(
    "\n -- generateFacialMorphs -- jawTipR calculated ->",
    jawTipR.x === -Infinity ? "Not Found" : jawTipR,
  );

  /**
   * Ⅰ.Ⅳ EYE BROW TIPS DETECTION
   */
  // Update the eye brow tips relative to the center of the eye nodes with some offsets
  if (manualTips?.eyeBrowTipL && manualTips?.eyeBrowTipR) {
    eyeBrowTipL.copy(manualTips.eyeBrowTipL);
    eyeBrowTipR.copy(manualTips.eyeBrowTipR);
    console.log("\n -- generateFacialMorphs -- using manual eye brow tips");
  } else {
    eyeBrowTipL.copy(
      centerEyeRNode.clone().add(new THREE.Vector3(0, 1.6, 2.3)),
    );
    eyeBrowTipR.copy(
      centerEyeLNode.clone().add(new THREE.Vector3(0, 1.6, 2.3)),
    );
  }
  console.log(
    "\n -- generateFacialMorphs -- eyeBrowTipL calculated ->",
    eyeBrowTipL.x === Infinity ? "Not Found" : eyeBrowTipL,
  );
  console.log(
    "\n -- generateFacialMorphs -- eyeBrowTipR calculated ->",
    eyeBrowTipR.x === -Infinity ? "Not Found" : eyeBrowTipR,
  );

  /**
   * Ⅰ.Ⅴ MOUSE CORNER TIPS DETECTION
   */
  // Updat the mouse tips relative to the coordinate of X and Z (with some offset) of the centerEyeLNode and centerEyeRNode, and the calculated mouseTipY
  if (manualTips?.mouseCornerTipL && manualTips?.mouseCornerTipR) {
    mouseCornerTipL.copy(manualTips.mouseCornerTipL);
    mouseCornerTipR.copy(manualTips.mouseCornerTipR);
    console.log("\n -- generateFacialMorphs -- using manual mouse corner tips");
  } else {
    mouseCornerTipL.copy(
      new THREE.Vector3(centerEyeRNode.x, mouseTipY, centerEyeRNode.z + 1.2),
    );
    mouseCornerTipR.copy(
      new THREE.Vector3(centerEyeLNode.x, mouseTipY, centerEyeLNode.z + 1.2),
    );
  }
  console.log(
    "\n -- generateFacialMorphs -- mouseCornerTipL calculated ->",
    mouseCornerTipL.x === Infinity ? "Not Found" : mouseCornerTipL,
  );
  console.log(
    "\n -- generateFacialMorphs -- mouseCornerTipR calculated ->",
    mouseCornerTipR.x === -Infinity ? "Not Found" : mouseCornerTipR,
  );

  /**
   * Ⅰ.Ⅵ EAR TIPS DETECTION (Reuse the bounding box on the Y axis based on the sph cut head)
   */
  const maxPerc = 0.3;
  const minPerc = 0.25;
  const maxYEarTipDetection = maxYSphCutHead - sphCutHeadHeight * maxPerc;
  const minYEarTipDetection = minYSphCutHead + sphCutHeadHeight * minPerc;

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    if (vertex.y <= maxYEarTipDetection && vertex.y >= minYEarTipDetection) {
      // Find the ear tips with the max X and min X
      if (vertex.x < earTipL.x) earTipL.copy(vertex);
      if (vertex.x > earTipR.x) earTipR.copy(vertex);
      visualizerByEarTipsDetection.push(vertex.clone());
    }
  }
  // Offset the ear tips on the Y axis
  earTipL.sub(new THREE.Vector3(0, 1.5, 0));
  earTipR.sub(new THREE.Vector3(0, 1.5, 0));

  /**
   * Ⅱ. CREATE BUFFERS FOR MORPHS
   */
  // 2.1 Define the distinct arrays for each "shape" we want
  const noseTarget = new Float32Array(positions.array);
  const nostrilTarget = new Float32Array(positions.array);
  const jawTarget = new Float32Array(positions.array);
  const eyeBrowTarget = new Float32Array(positions.array);
  const mouseCornersWidthTarget = new Float32Array(positions.array);
  const earTarget = new Float32Array(positions.array);

  // Parameters for the procedural brushes
  const noseRadius = 7;

  // 2.2 Traverse through the vertex count to get the morphs

  // --- A. GENERATE NOSE HEIGHT MORPH (Move Forward) ---
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    const distToNoseTip = vertex.distanceTo(noseTip);
    if (distToNoseTip < noseRadius) {
      // Influence based on the distance to the nose tip, the further the vertex is from the nose tip, the less influence it has
      const influence = Math.pow(1 - distToNoseTip / noseRadius, 4);
      // Indices of the Y and Z coordinates
      const i3Y = i * 3 + 1;
      const i3Z = i * 3 + 2;
      // const factorInf = vertex.y > noseTip.y + 1 ? 1.5 : 0.2;
      const factorInf = 0.2;
      const finalInf = factorInf * influence;
      noseTarget[i3Y] += finalInf;
      noseTarget[i3Z] += finalInf;
      // Add the vertex to filtered the nose vertices morph array
      visualizerByNoseMorph.push(vertex.clone());
    }

    // --- B. GENERATE NOSTRIL WIDTH MORPH (Widen) ---
    applyMorph(
      vertex,
      i,
      nostrilTipL,
      nostrilTipR,
      { xRange: 2, yRange: 1, zRange: 1 },
      nostrilTarget,
      "widening",
      {
        powerVal: 1,
        isInfXFixed: false,
      },
      visualizerByNostrilMorph,
      0.8,
    );

    // --- C. GENERATE JAW WIDTH MORPH (Widen) ---
    applyMorph(
      vertex,
      i,
      jawTipL,
      jawTipR,
      { xRange: 5, yRange: 6.0, zRange: 4.0 },
      jawTarget,
      "widening",
      {
        powerVal: 2,
        isInfXFixed: false,
      },
      visualizerByJawMorph,
      1.25,
    );

    // --- D. GENERATE EYE BROW HEIGHT MORPH (Height) ---
    applyMorph(
      vertex,
      i,
      eyeBrowTipL,
      eyeBrowTipR,
      { xRange: 3.0, yRange: 1.0, zRange: 2 },
      eyeBrowTarget,
      "height",
      {
        powerVal: 2,
        isInfXFixed: true,
      },
      visualizerByEyeBrowMorph,
      0.7,
    );

    // --- E. GENERATE MOUSE CORNERS WIDTH MORPH (Widen) ---
    applyMorph(
      vertex,
      i,
      mouseCornerTipL,
      mouseCornerTipR,
      { xRange: 2, yRange: 2.2, zRange: 1 },
      mouseCornersWidthTarget,
      "widening",
      {
        powerVal: 2,
        isInfXFixed: false,
      },
      visualizerByMouseCornersWidthMorph,
      1.7,
    );

    // --- F. GENERATE EAR TIPS WIDTH MORPH (Widen) ---
    applyMorph(
      vertex,
      i,
      earTipL,
      earTipR,
      { xRange: 6, yRange: 3, zRange: 2.5 },
      earTarget,
      ["widening", "height"],
      {
        powerVal: 2,
        isInfXFixed: false,
      },
      visualizerByEarMorph,
      0.7,
    );
  }

  /**
   * Ⅲ. APPLY THE MORPH TARGETS
   */
  // 3.1 Create the BufferAttributes for the morphs
  const noseAttr = new THREE.BufferAttribute(noseTarget, 3);
  const nostrilAttr = new THREE.BufferAttribute(nostrilTarget, 3);
  const jawAttr = new THREE.BufferAttribute(jawTarget, 3);
  const eyeBrowAttr = new THREE.BufferAttribute(eyeBrowTarget, 3);
  const mouseCornersWidthAttr = new THREE.BufferAttribute(
    mouseCornersWidthTarget,
    3,
  );
  const earAttr = new THREE.BufferAttribute(earTarget, 3);

  // 3.2 Assign names to the BufferAttributes to correspond with the morphTargetDictionary keys
  noseAttr.name = "nose";
  nostrilAttr.name = "nostril";
  jawAttr.name = "jaw";
  eyeBrowAttr.name = "eyeBrow";
  mouseCornersWidthAttr.name = "mouseCornersWidth";
  earAttr.name = "ear";

  // 3.3 Assign the BufferAttributes to the position attribute of the geometry morphAttributes
  geo.morphAttributes.position = [
    noseAttr,
    nostrilAttr,
    jawAttr,
    eyeBrowAttr,
    mouseCornersWidthAttr,
    earAttr,
  ];

  // 3.4 Required for lighting to update correctly when morphed
  geo.computeVertexNormals();

  // 3.5 Updates the morphTargets to have no influence on the object, and automatically build the morphTargetDictionary based on the attribute names
  headNode.updateMorphTargets();

  // 3.7 Initialize at 0 of the morph targets on the mesh
  // headNode.morphTargetInfluences = [0, 0, 0, 0, 0, 0];

  // 3.8 Inform the renderer that the material needs to be recompiled to include morphing logic
  if (headNode.material) {
    console.log(
      `\n -- generateFacialMorphs -- setting material.needsUpdate to true for [${headNode.name}] to enable morphing support ->`,
      headNode.material,
    );
    if (Array.isArray(headNode.material)) {
      headNode.material.forEach((mat) => (mat.needsUpdate = true));
    } else {
      headNode.material.needsUpdate = true;
    }
  }

  console.log(
    "\n-- generateFacialMorphs -- morph target generation complete, headNode -> ",
    headNode,
  );

  /**
   * Ⅳ. RETURN THE RESULTS FOR VISUALIZATION
   */
  return {
    visualizerNoseTip: noseTip,
    visualizerNostrilTipL: nostrilTipL,
    visualizerNostrilTipR: nostrilTipR,
    visualizerjawTipL: jawTipL,
    visualizerjawTipR: jawTipR,
    visualizerEyeBrowTipL: eyeBrowTipL,
    visualizerEyeBrowTipR: eyeBrowTipR,
    visualizerMouseCornerTipL: mouseCornerTipL,
    visualizerMouseCornerTipR: mouseCornerTipR,
    visualizerEarTipL: earTipL,
    visualizerEarTipR: earTipR,
    visualizerByNoseTipDetection,
    visualizerByNostrilTipsDetection,
    visualizerByJawTipsDetection,
    visualizerByEyeBrowTipsDetection,
    visualizerByMouseCornerTipsDetection,
    visualizerByEarTipsDetection,
    visualizerByNoseMorph,
    visualizerByNostrilMorph,
    visualizerByJawMorph,
    visualizerByEyeBrowMorph,
    visualizerByMouseCornersWidthMorph,
    visualizerByEarMorph,
  };
}

/**
 * Bakes the current morph target influences into the geometry's position attribute.
 * This effectively makes the current morph state the "base" shape of the mesh.
 * @param mesh The mesh to bake morphs for.
 */
export function bakeMorphTargets(mesh: THREE.Mesh): void {
  const influences = mesh.morphTargetInfluences;
  console.log(
    `\n -- bakeMorphTargets -- influences of ${mesh.name} ->`,
    influences,
  );

  if (!influences || influences.length === 0) return;

  const clonedGeo = mesh.geometry.clone();

  const morphAttr = clonedGeo.morphAttributes.position;

  if (!morphAttr || morphAttr.length === 0) return;

  const positionAttr = clonedGeo.getAttribute("position");
  const vertexCount = positionAttr.count;
  const isRelative = (clonedGeo as any).morphTargetsRelative;

  // I. VERTEX PROCESSING LOOP: Calculate final positions based on active morph targets
  for (let i = 0; i < vertexCount; i++) {
    // 1. Get current base coordinate for the vertex
    let x = positionAttr.getX(i);
    let y = positionAttr.getY(i);
    let z = positionAttr.getZ(i);

    // 2. Clear displacement accumulators for the current vertex
    let dx = 0,
      dy = 0,
      dz = 0;

    // 3. MORPH ACCUMULATION: Loop through each available morph target
    for (let j = 0; j < morphAttr.length; j++) {
      const influence = influences[j];

      // Skip influence calculation if the target has no effect (influence is 0)
      if (influence === 0) continue;

      const target = morphAttr[j];

      if (isRelative) {
        // RELATIVE MODE: Target positions represent offsets (deltas) from the base position
        dx += target.getX(i) * influence;
        dy += target.getY(i) * influence;
        dz += target.getZ(i) * influence;
      } else {
        // ABSOLUTE MODE: Target positions represent final world-space coordinates
        // Calculate displacement as: (Final Position - Base Position) * Influence
        dx += (target.getX(i) - x) * influence;
        dy += (target.getY(i) - y) * influence;
        dz += (target.getZ(i) - z) * influence;
      }
    }

    // 4. APPLY DISPLACEMENT: Update the vertex position attribute with the final calculated coordinates
    positionAttr.setXYZ(i, x + dx, y + dy, z + dz);
  }

  // II. ATTRIBUTE UPDATE: Mark the position attribute as needing an update on the GPU
  positionAttr.needsUpdate = true;

  // III. NORMALS RECOMPUTATION: Re-generate normals to ensure lighting matches the new shape
  clonedGeo.computeVertexNormals();

  // IV. UPDATE MESH GEOMETRY
  mesh.geometry = clonedGeo;
}

/**
 * Finds the lateral extremes (min X and max X) within a target bounding box relative to a reference point.
 * Used for detecting jaw angles, nostrils, etc.
 * @param referencePoint The reference point (e.g., nose tip) to calculate the offsets from.
 * @param range The offsets for Y and Z axes to define the search region.
 * @param positions The position attribute of the geometry.
 * @param tipL The vector to store the left-most vertex (min X).
 * @param tipR The vector to store the right-most vertex (max X).
 * @param visualizer Optional array to store all vertices within the range for visualization.
 */
function findLateralTips(
  referencePoint: THREE.Vector3,
  range: {
    yMinOffset: number;
    yMaxOffset: number;
    zMinOffset: number;
    zMaxOffset: number;
  },
  positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  tipL: THREE.Vector3,
  tipR: THREE.Vector3,
  visualizer?: THREE.Vector3[],
): void {
  const yMin = referencePoint.y + range.yMinOffset;
  const yMax = referencePoint.y + range.yMaxOffset;
  const zMin = referencePoint.z + range.zMinOffset;
  const zMax = referencePoint.z + range.zMaxOffset;

  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    // Filter for the specified region relative to the reference point
    if (
      vertex.y > yMin &&
      vertex.y < yMax &&
      vertex.z > zMin &&
      vertex.z < zMax
    ) {
      // Find the lateral extremes (min X for left, max X for right)
      if (vertex.x < tipL.x) tipL.copy(vertex);
      if (vertex.x > tipR.x) tipR.copy(vertex);
      // Add the vertex to the visualizer array if provided
      if (visualizer) visualizer.push(vertex.clone());
    }
  }
}

/**
 * Applies a morph to a vertex based on its proximity to the nearest lateral tip (L/R).
 * @param vertex The current vertex being processed.
 * @param index The index of the vertex.
 * @param tipL The detected left-side tip.
 * @param tipR The detected right-side tip.
 * @param ranges Range for X, Y and Z influence.
 * @param targetArray The target Float32Array to write the morph delta to.
 * @param type The type of morph to apply (widening, height, depth).
 * @param visualizer Optional array to store the vertex for visualization if it was affected.
 * @param totalInfluenceStrength The total influence strength.
 */
function applyMorph(
  vertex: THREE.Vector3,
  index: number,
  tipL: THREE.Vector3,
  tipR: THREE.Vector3,
  ranges: { xRange: number; yRange: number; zRange: number },
  targetArray: Float32Array,
  type: "widening" | "height" | "depth" | ("widening" | "height" | "depth")[],
  infConfig: {
    powerVal: number;
    isInfXFixed: boolean;
  },
  visualizer?: THREE.Vector3[],
  totalInfluenceStrength: number = 1.25,
): void {
  const { powerVal, isInfXFixed } = infConfig;

  // Use the detected tips as anchors for the morph
  const targetTip = vertex.x < 0 ? tipL : tipR;

  // Check if tips were actually found
  if (targetTip.x === Infinity || targetTip.x === -Infinity) return;

  // Calculate distance to the nearest tip on all axes
  const dx = Math.abs(vertex.x - targetTip.x);
  const dy = Math.abs(vertex.y - targetTip.y);
  const dz = Math.abs(vertex.z - targetTip.z);

  const { xRange, yRange, zRange } = ranges;

  // Determine which morph types should be applied (handles single string or array of strings)
  const isWidening =
    type === "widening" || (Array.isArray(type) && type.includes("widening"));
  const isHeight =
    type === "height" || (Array.isArray(type) && type.includes("height"));
  const isDepth =
    type === "depth" || (Array.isArray(type) && type.includes("depth"));

  let applied = false;

  // --- 1. WIDENING MORPH (X axis) ---
  // This morph type focuses on lateral expansion
  if (dx < xRange && dy < yRange && dz < zRange) {
    if (isWidening) {
      // Vertical Falloff (Y) -> the power of 2 ensures a smoother falloff
      const influenceY = Math.pow(Math.sin(1 - dy / yRange), powerVal);
      // Depth Falloff (Z)
      const influenceZ = Math.pow(Math.sin(1 - dz / zRange), powerVal);

      // Lateral Falloff (X) -> ensure we affect the sides more than the center to avoid tearing the center line (X=0)
      // const influenceX = Math.min(Math.abs(vertex.x) / 5.0, 1.0);
      const influenceX = Math.pow(Math.sin(1 - dx / xRange), 1);

      const totalInfluence =
        influenceY * influenceZ * influenceX * totalInfluenceStrength;

      // Apply widening on the X axis -> move lateral extremes further out
      targetArray[index * 3] += Math.sign(vertex.x) * totalInfluence;
      applied = true;
    }
    // --- 2. HEIGHT and DEPTH MORPHS (Y and Z axes) ---
    // These morph types share similar logic for lateral (X) and vertical (Y) falloff
    if (isHeight || isDepth) {
      /*
        Inf X
       */
      // X -> 0 ~ 1 >> Y -> 0 ~ 1
      const influenceX = isInfXFixed
        ? 1
        : Math.sin((1 - dx / xRange) * Math.PI * 0.5);

      /*
        Inf Y
       */
      const y01 = 1 - dy / yRange;
      // const influenceX = 1 - Math.cos(1 - dx / xRange);
      // const influenceY =
      //   vertex.y < targetTip.y
      //     ? Math.pow(Math.sin(1 - dy / yRange), 2)
      //     : remap01(Math.sin(1 - dy / yRange), 0.3);
      // const influenceY = Math.sin(1 - dy / yRange);
      const influenceY = Math.sin(y01 * Math.PI * 0.5);

      /*
        Inf Z
       */
      const z01 = 1 - dz / zRange;
      // const influenceZ = Math.pow(Math.sin(z01), 2);
      // const influenceZ = Math.pow(z01, 2);
      const influenceZ = z01;

      /*
        Total Inf
       */
      const totalInfluence =
        influenceX * influenceY * influenceZ * totalInfluenceStrength;
      // influenceY * influenceZ * totalInfluenceStrength;

      /*
        Apply
       */
      if (isHeight) targetArray[index * 3 + 1] += totalInfluence;

      if (isDepth) targetArray[index * 3 + 2] -= totalInfluence;

      applied = true;
    }
  }

  // Add the vertex to the filtered vertices array for visualization if it was affected by any morph
  if (applied && visualizer) visualizer.push(vertex.clone());
}

/**
 * Returns a value between 0 and 1 using a sine wave.
 * @param value The input value.
 * @returns The output value.
 */
export function getOscSine(value: number) {
  return Math.sin(value) * 0.5 + 0.5;
}

/**
 * Remaps a value between a input factor and 1.
 * @param value The input value (0 ~ 1).
 * @param factor The input factor to remap the value.
 * @returns The remapped value.
 */
export function remap01(value: number, factor: number) {
  return value * (1 - factor) + factor;
}

/**
 * Adjusts the pivot points of a mesh.
 * @param mesh The Mesh to be adjusted.
 */
export function adjustPivotPointsForMesh(mesh: THREE.Mesh): void {
  const meshName = mesh.name;

  // console.log(`\n---- Ready to adjust the pivots of mesh ${meshName} ----\n`);

  if (mesh.geometry.boundingBox === null) mesh.geometry.computeBoundingBox();
  const center = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());

  // Apply the negative offset to the geometry to center it around (0,0,0)
  mesh.geometry.translate(-center.x, -center.y, -center.z);

  // Apply the positive offset to the object's position to keep it in the same visual place
  const vec = center.clone();
  vec.applyQuaternion(mesh.quaternion);
  vec.multiply(mesh.scale);
  // console.log(
  //   `\n -- adjustPivots -- vec to be add to ${childName} position ->`,
  //   vec
  // );
  mesh.position.add(vec);
}

let cachedManifoldModule: any = null;

/**
 * Optimized and more robust version of repairMesh.
 * 1. Caches the Manifold WASM module to avoid re-loading.
 * 2. Enforces strict typed arrays for Wasm compatibility.
 * 3. Handles memory cleanup more reliably.
 */
export async function repairMeshV2(mesh: THREE.Mesh): Promise<THREE.Mesh> {
  // 1. Initialize or get cached Manifold WASM module
  if (!cachedManifoldModule) {
    cachedManifoldModule = await initManifold({
      locateFile: () => manifoldWasm,
    });
    if (cachedManifoldModule.setup) cachedManifoldModule.setup();
  }

  const { Manifold, Mesh: ManifoldMeshRaw } = cachedManifoldModule;

  // 2. Prepare Geometry
  let geo = mesh.geometry.clone();
  // Merge vertices to handle floating point precision issues that cause non-manifold edges
  geo = BufferGeometryUtils.mergeVertices(geo, 1e-4);

  const posAttr = geo.getAttribute("position");
  const indexAttr = geo.index;

  if (!posAttr || !indexAttr) {
    throw new Error("Geometry must have position and index attributes");
  }

  // Ensure strict Float32Array for positions
  const vertices =
    posAttr.array instanceof Float32Array
      ? posAttr.array
      : new Float32Array(posAttr.array);

  // CRITICAL: Manifold WASM requires Uint32Array for triangle indices
  const indices =
    indexAttr.array instanceof Uint32Array
      ? indexAttr.array
      : new Uint32Array(indexAttr.array);

  console.log("\n -- repairMeshV2 -- input ->", {
    verts: vertices.length / 3,
    tris: indices.length / 3,
  });

  // 3. Create Manifold objects
  // Use the Mesh constructor from the module to ensure proper internal prototype linkage
  const inputMesh = new ManifoldMeshRaw({
    numProp: 3,
    vertProperties: vertices,
    triVerts: indices,
  });

  const manifold = new Manifold(inputMesh);

  // Check if construction was successful
  if (manifold.isEmpty()) {
    console.warn("\n -- repairMeshV2 -- Warning -> Created manifold is empty");
  }

  // 4. Extract Repaired Geometry
  // Use getMesh() (standard) or getMeshGL() (fallback for specific builds)
  const resultMesh = manifold.getMesh
    ? manifold.getMesh()
    : (manifold as any).getMeshGL();

  console.log("\n -- repairMeshV2 -- output ->", {
    verts: resultMesh.vertProperties.length / 3,
    tris: resultMesh.triVerts.length / 3,
  });

  // 5. Convert back to Three.js
  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(resultMesh.vertProperties, 3),
  );
  newGeo.setIndex(new THREE.BufferAttribute(resultMesh.triVerts, 1));
  newGeo.computeVertexNormals();

  // 6. Cleanup WASM memory (Crucial to avoid leaks)
  manifold.delete();
  inputMesh.delete();

  // Return a new mesh with the same material
  const outMesh = new THREE.Mesh(newGeo, mesh.material);
  outMesh.name = `${mesh.name}_repaired`;

  return outMesh;
}

export async function repairMesh(mesh: THREE.Mesh): Promise<THREE.Mesh> {
  // 1. Initialize the Manifold WASM module
  // Provide the WASM file location to avoid 404/HTML fallback issues in Vite
  const manifoldModule = await initManifold({
    locateFile: () => manifoldWasm,
  });
  const { Manifold, setup } = manifoldModule as any;
  if (setup) setup();

  // 2. Pre-process -> Merge vertices to close tiny gaps
  let geo = mesh.geometry.clone();
  geo = BufferGeometryUtils.mergeVertices(geo, 0.001);

  // 3. Convert THREE.js geometry to Manifold format
  // Extract the flat arrays for position and index
  const vertices = geo.getAttribute("position").array as Float32Array;
  const indices = geo.index?.array as Uint32Array;
  // console.log(
  //   "\n -- repairMesh -- vertices from original geometry ->",
  //   vertices
  // );
  // console.log("\n -- repairMesh -- indices from original geometry ->", indices);
  // return;

  if (!indices) throw new Error("Geometry must be indexed");

  // Create a proper Manifold Mesh instance
  // Use the Mesh constructor from the initialized module
  const { Mesh } = manifoldModule as any;
  const manifoldMesh = new Mesh({
    numProp: 3,
    vertProperties: vertices,
    triVerts: indices,
  });

  // 4. Run the repair
  const manifold = new Manifold(manifoldMesh);

  // Use `getMesh` or fallback to `getMeshGL` to get the cleaned geometry back
  const repairedMesh = manifold.getMesh
    ? manifold.getMesh()
    : (manifold as any).getMeshGL();

  console.log("\n -- repairMesh -- repairedMesh ->", repairedMesh);

  // 5. Convert back to Three.js BufferGeometry
  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(repairedMesh.vertProperties, 3),
  );
  newGeo.setIndex(new THREE.BufferAttribute(repairedMesh.triVerts, 1));
  newGeo.computeVertexNormals();

  // Clean up WASM memory
  manifold.delete();
  if ((manifoldMesh as any).delete) (manifoldMesh as any).delete();

  return new THREE.Mesh(newGeo, mesh.material);
}

export function combineMeshes(meshes: THREE.Mesh[]) {
  const geometries = meshes.map((mesh) => {
    const g = mesh.geometry.clone();
    // console.log(`Geometry of [${g.name}] -> `, g)
    g.applyMatrix4(mesh.matrixWorld);
    return g;
  });
  const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
  const mesh0 = meshes[0] as THREE.Mesh;
  return new THREE.Mesh(mergedGeometry, mesh0.material);
}

export function flattenMesh(mesh2Simplify: THREE.Mesh) {
  mesh2Simplify.updateMatrixWorld(true);
  mesh2Simplify.geometry.applyMatrix4(mesh2Simplify.matrixWorld);
  // mesh2Simplify.geometry.deleteAttribute('normal'); // optional
  // mesh2Simplify.geometry.deleteAttribute('uv');     // not needed for printing
  mesh2Simplify.position.set(0, 0, 0);
  mesh2Simplify.rotation.set(0, 0, 0);
  mesh2Simplify.scale.set(1, 1, 1);
}

export function getAttributes(mesh: THREE.Mesh): THREE.NormalBufferAttributes {
  return mesh.geometry.attributes;
}

export async function applyTextures2LoadedHeadModelAsync(
  loadedHeadModel: THREE.Group<THREE.Object3DEventMap>,
  isModelFeMale: boolean,
  customPaths?: {
    HeadColTex: string;
    TeethColTex: string;
    EyeLColTex: string;
    EyeRColTex: string;
  },
) {
  const headNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.Head,
  ) as PhongMesh;
  const teethNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.Teeth,
  ) as PhongMesh;
  const eyeLNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.EyeL,
  ) as PhongMesh;
  const eyeRNode = loadedHeadModel.getObjectByName(
    NodeNames.HeadNames.EyeR,
  ) as PhongMesh;

  const applyTexture = async (): Promise<void> => {
    /*
      Texture Paths
    */
    const paths =
      customPaths ||
      (isModelFeMale
        ? ModelPaths.HeadFemale.Texture
        : ModelPaths.HeadMale.Texture);

    const headColTexPath = paths.HeadColTex;
    const teethColTexPath = paths.TeethColTex;
    const eyeLColTexPath = paths.EyeLColTex;
    const eyeRColTexPath = paths.EyeRColTex;

    /*
      Head Color Texture
    */
    const headColTex = await loadTexture(headColTexPath);
    /*
      Teeth Color Texture
    */
    let teethColTex: THREE.Texture | null = null;
    try {
      teethColTex = await loadTexture(teethColTexPath);
    } catch (err: any) {
      console.warn(err);
    }
    /*
      Eye Left Color Texture
    */
    const eyeLColTex = await loadTexture(eyeLColTexPath);
    /*
      Eye Right Color Texture
    */
    const eyeRColTex = await loadTexture(eyeRColTexPath);

    headNode.material.map = headColTex;
    if (teethColTex) teethNode.material.map = teethColTex;
    eyeLNode.material.map = eyeLColTex;
    eyeRNode.material.map = eyeRColTex;
  };
  await applyTexture();
}

export function applyGeometryScaling(
  mesh: THREE.Mesh | Brush,
  scale: number,
): void {
  mesh.geometry.scale(scale, scale, scale);
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

export function applyMaterialWireframe(
  obj: THREE.Object3D,
  color?: THREE.Color,
) {
  if (obj instanceof THREE.Group)
    obj.traverse((m) => {
      if (m instanceof THREE.Mesh) {
        const mat = m.material as THREE.MeshPhongMaterial;
        mat.color = color || Colors.White;
        mat.wireframe = true;
      }
    });
  if (obj instanceof THREE.Mesh) {
    const mat = obj.material as THREE.MeshPhongMaterial;
    mat.color = color || Colors.White;
    mat.wireframe = true;
  }
}

export function applyDebugTransformation(
  obj: THREE.Object3D,
  posOffset: THREE.Vector3 = new THREE.Vector3(),
): void {
  const { x, y, z } = posOffset;
  obj?.position.set(
    CutHeadDebugProps.Pos.x + x,
    CutHeadDebugProps.Pos.y + y,
    CutHeadDebugProps.Pos.z + z,
  );
  obj?.scale.setScalar(CutHeadDebugProps.Scalar);
}

/**
 * Apply PBR Material and SRGB Color Space
 * @param obj Object to apply PBR Material and SRGB Color Space
 * @param isStandard Whether to use MeshStandardNodeMaterial
 * @param params Parameters for MeshStandardNodeMaterial
 */
export function applyPBRMaterialAndSRGBColorSpace(
  obj: THREE.Object3D,
  isStandard: boolean,
  params?: THREE.MeshStandardNodeMaterialParameters,
): void {
  obj.traverse((m) => {
    if (
      m instanceof THREE.Mesh &&
      m.material instanceof THREE.MeshPhongMaterial
    ) {
      const orgMat = m.material;
      m.material = isStandard
        ? new THREE.MeshStandardNodeMaterial({
            ...params,
            map: orgMat.map,
            name: orgMat.name,
          })
        : new THREE.MeshPhysicalNodeMaterial({
            ...params,
            map: orgMat.map,
            name: orgMat.name,
          });
      if (m.material.map) m.material.map.colorSpace = THREE.SRGBColorSpace;
      orgMat.dispose();
    }
  });
}

/**
 * Apply Double Side
 * @param obj Object to apply Double Side
 */
export function applyDoubleSide(obj: THREE.Object3D) {
  // console.log("\n -- applyDoubleSide -- obj ->", obj);
  if (!(obj instanceof THREE.Group)) return;
  obj.traverse((m: THREE.Object3D) => {
    if (m instanceof THREE.Mesh) {
      const mesh = m as any;
      mesh.material.side = THREE.DoubleSide;
    }
  });
}

/**
 * Modify the uv coordinates of the new vertices.
 * @param originalNode Original Node before csg operation.
 * @param cutObj Cut Object after csg operation.
 * @param offsetPositivePercentage 0 ~ 1 value of the positive offset of the uv start idx based on the original node vertices count.
 * @param offsetNegativePercentage 0 ~ 1 value of the negative offset of the uv start idx based on the original node vertices count.
 */
export function modifyNewVerticesUv(
  originalNode: Brush | THREE.Mesh,
  cutObj: Brush | THREE.Mesh,
  offsetPositivePercentage: number,
  offsetNegativePercentage: number,
): void {
  const originalNodeAttr = getAttributes(originalNode as THREE.Mesh);
  const finalCutObjAttr = getAttributes(cutObj as THREE.Mesh);

  // Get the vertices count

  const orgCount = originalNodeAttr.uv!.count;
  const finalCount = finalCutObjAttr.uv!.count;
  const newVerticesCount = finalCount - orgCount;
  // console.log('newVerticesCount ->', newVerticesCount)

  const orgCountOffsetPositive = Math.floor(
    newVerticesCount * offsetPositivePercentage,
  );
  const orgCountOffsetNegative =
    Math.floor(orgCount * offsetNegativePercentage) * -1;
  // console.log('orgCountOffsetPositive -> ', orgCountOffsetPositive);
  // console.log('orgCountOffsetNegative -> ', orgCountOffsetNegative);

  const offsetCount =
    orgCount + orgCountOffsetPositive + orgCountOffsetNegative;
  // console.log('offsetCount -> ', offsetCount);

  // Update uv coordinates of the new vertices

  for (let i = offsetCount; i < finalCount; i++) {
    finalCutObjAttr.uv!.setX(i, UVCoordinateMod.x);
    finalCutObjAttr.uv!.setY(i, UVCoordinateMod.y);
  }
  finalCutObjAttr.uv!.needsUpdate = true;
}

/**
 * Combines multiple meshes into a THREE.Group.
 *
 * @param name Optional name for the group.
 * @param meshes List of meshes to combine.
 * @returns THREE.Group containing all meshes.
 */
export function combineMeshesToGroup(
  name: string,
  ...meshes: THREE.Mesh[]
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  for (const mesh of meshes) {
    // Avoid accidental re-parenting if mesh already has a parent
    if (mesh.parent) mesh.parent.remove(mesh);
    group.add(mesh);
  }

  return group;
}

/**
 * Scales all meshes inside a group to a final real-world height of 37mm.
 * The scaling is applied directly to geometry vertices (not mesh.scale).
 *
 * @param group Group containing meshes
 * @param targetHeight number (millimeters)
 */
export function scaleGroupToHeight(
  group: THREE.Group,
  targetHeight: number = 37,
): THREE.Group {
  // -------------------------------
  // 1. Compute the current height
  // -------------------------------
  const groupCloned = group.clone();
  const grp2Scale = groupCloned;
  const groupBox = new THREE.Box3().setFromObject(grp2Scale);
  const currentHeight = groupBox.max.y - groupBox.min.y;
  console.log("Grp height -> ", currentHeight);

  if (currentHeight === 0) {
    console.warn("Group has zero height; cannot scale.");
    return group;
  }

  // Compute scale factor
  const scale = targetHeight / currentHeight;

  // -------------------------------
  // 2. Apply scaling to each mesh geometry
  // -------------------------------
  grp2Scale.traverse((m) => {
    if (m instanceof THREE.Mesh && m.geometry instanceof THREE.BufferGeometry) {
      const geom = m.geometry;
      const pos = geom.attributes.position;

      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
          i,
          pos.getX(i) * scale,
          pos.getY(i) * scale,
          pos.getZ(i) * scale,
        );
      }

      pos.needsUpdate = true;

      // Recompute bounds
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
    }
  });

  // -------------------------------
  // 3. Reset transforms to identity (VERY IMPORTANT)
  // -------------------------------
  grp2Scale.scale.set(1, 1, 1);
  grp2Scale.position.set(0, 0, 0);
  grp2Scale.rotation.set(0, 0, 0);

  console.log(`Group scaled by factor: ${scale}`);

  return grp2Scale;
}

export const exportCutHead = (
  exporterBtn: Element,
  cutHead2Export: THREE.Object3D,
): void => {
  exporterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    // if (cutHead.isBrush) {
    if (cutHead2Export instanceof THREE.Group) {
      const scaledCutHeadGrp = scaleGroupToHeight(cutHead2Export);
      exportObjectToOBJ(scaledCutHeadGrp);
    }
  });
};

export function disposeHairBodyGroup(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  hairOrBodyGroup: THREE.Group<THREE.Object3DEventMap>,
) {
  console.log("\nhairOrBodyGroup to be disposed ->", hairOrBodyGroup);
  hairOrBodyGroup.children.forEach((m) => {
    if (
      m instanceof THREE.Mesh &&
      m.geometry instanceof THREE.BufferGeometry &&
      m.material instanceof THREE.MeshPhongMaterial
    ) {
      m.geometry.dispose();
      m.material.dispose();
      (m as any).geometry = undefined;
      (m as any).material = undefined;
      hairOrBodyGroup.remove(m);
    }
  });
  splicingGroupGlobal.remove(hairOrBodyGroup);
}

export function disposeHairBodyFromSplicingGroupGlobal(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  filteredSubGroups: THREE.Group<THREE.Object3DEventMap>[],
) {
  /*
    ! The Hair or Body Group or both are definitely the children of the splicingGroupGlobal as we checked in `clearModels` fn from `ButtonContainer.vue` if this fn is called.
   */
  filteredSubGroups.forEach((hairOrBodyGroup) => {
    disposeHairBodyGroup(splicingGroupGlobal, hairOrBodyGroup);
  });
}

export function getObject3DHeight(obj3D: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj3D);
  const height = box.max.y - box.min.y;
  return height;
}

export function getObject3DBoundingBoxCenter(
  obj3D: THREE.Object3D,
): THREE.Vector3 {
  return new THREE.Box3().setFromObject(obj3D).getCenter(new THREE.Vector3());
}

export function getFilteredSubGroups(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
): THREE.Group<THREE.Object3DEventMap>[] {
  // Filter out the cut head group
  return splicingGroupGlobal.children.filter(
    (c) =>
      !c.name
        .toLocaleLowerCase()
        .includes(CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase()),
  ) as THREE.Group<THREE.Object3DEventMap>[];
}

export function removeAndAddModelWithModelHeight(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  importedGroup: THREE.Group<THREE.Object3DEventMap>,
  isHairImported: boolean,
) {
  // Check if there is a hair or body group in the splicingGroupGlobal
  const filteredSubGroups = getFilteredSubGroups(splicingGroupGlobal);
  // console.log(
  //   "\n -- removeAndAddModel -- filteredSubGroups length ->",
  //   filteredSubGroups.length
  // );
  // return;

  if (filteredSubGroups.length === 0) {
    // No hair or body group found, add it to the group.
    splicingGroupGlobal.add(importedGroup);
    return;
  }

  // Has hair or body group found, remove it and add the new one, or add it straightly if it is not conflicting.
  if (filteredSubGroups.length === 1) {
    // Check if the existed one is hair or body
    const existedHairOrBodyGroup = filteredSubGroups[0];
    // Get the height of the group to check if it is hair or body
    const existedHairOrBodyGroupHeight = getObject3DHeight(
      existedHairOrBodyGroup,
    );
    const isHairGroupExisted =
      existedHairOrBodyGroupHeight < CutHeadBoundingBoxHeight;
    if (isHairImported === isHairGroupExisted) {
      // Conflicting, remove the existed hair or body group and add the new one
      disposeHairBodyGroup(splicingGroupGlobal, existedHairOrBodyGroup);
      splicingGroupGlobal.add(importedGroup);
      return;
    }
    // Not conflicting, add the new one straightly
    splicingGroupGlobal.add(importedGroup);
    return;
  }

  // return;
  console.log("\nPrepare to remove the hair or body group...");

  // Handle the condition of hair and body groups existing at the same time
  // Get the hair and body groups
  let hairGroup = filteredSubGroups[0];
  let bodyGroup = filteredSubGroups[1];
  if (getObject3DHeight(hairGroup) > CutHeadBoundingBoxHeight) {
    hairGroup = filteredSubGroups[1];
    bodyGroup = filteredSubGroups[0];
  }

  console.log(
    "\nHair Group Height after checking ->",
    getObject3DHeight(hairGroup),
  );
  console.log(
    "\nBody Group Height after checking ->",
    getObject3DHeight(bodyGroup),
  );

  // Create a variable to store the group to remove
  let group2Dispose: THREE.Group<THREE.Object3DEventMap> | null = null;
  // Check if the new group is hair or body
  if (isHairImported) group2Dispose = hairGroup;
  else group2Dispose = bodyGroup;

  console.log("\nGroup to dispose ->", getObject3DHeight(group2Dispose));

  // Dispose the group
  disposeHairBodyGroup(splicingGroupGlobal, group2Dispose);
  // Add the new group
  splicingGroupGlobal.add(importedGroup);
}

export function removeAndAddModelWithNodeNames(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  importedGroup: THREE.Group<THREE.Object3DEventMap>,
  isHairImported: boolean,
) {
  // Check if there is a hair or body group in the splicingGroupGlobal
  const filteredSubGroups = getFilteredSubGroups(splicingGroupGlobal);
  console.log(
    "\n -- removeAndAddModelV2 -- filteredSubGroups length ->",
    filteredSubGroups.length,
  );
  // return;

  if (filteredSubGroups.length === 0) {
    // No hair or body group found, add it to the group.
    splicingGroupGlobal.add(importedGroup);
    return;
  }

  // Has hair or body group found, remove it and add the new one, or add it straightly if they are not conflicting.
  if (filteredSubGroups.length === 1) {
    // Check if the existed one is hair or body
    const existedHairOrBodyGroup = filteredSubGroups[0];
    const isHairGroupExisted = existedHairOrBodyGroup.children[0].name
      .toLowerCase()
      .includes(NodeNames.HairNames.Hair.toLocaleLowerCase());
    if (isHairImported === isHairGroupExisted) {
      // Conflicting, remove the existed hair or body group and add the new one
      disposeHairBodyGroup(splicingGroupGlobal, existedHairOrBodyGroup);
      splicingGroupGlobal.add(importedGroup);
      return;
    }
    // Not conflicting, add the new one straightly
    splicingGroupGlobal.add(importedGroup);
    return;
  }

  // return;
  console.log("\nPrepare to remove the hair or body group...");

  // Handle the condition of hair and body groups existing at the same time
  // Get the hair and body groups
  let hairGroup = filteredSubGroups[0];
  let bodyGroup = filteredSubGroups[1];
  // Reverse the assignments if the first group is body
  if (
    hairGroup.children[0].name
      .toLocaleLowerCase()
      .includes(NodeNames.BodyNames.Body.toLocaleLowerCase())
  ) {
    hairGroup = filteredSubGroups[1];
    bodyGroup = filteredSubGroups[0];
  }

  console.log("\nHair Group Name after reverse checking ->", hairGroup.name);
  console.log("\nBody Group Name after reverse checking ->", bodyGroup.name);

  // Create a variable to store the group to remove
  let group2Dispose: THREE.Group<THREE.Object3DEventMap> | null = null;
  // Check if the new group is hair or body
  if (isHairImported) group2Dispose = hairGroup;
  else group2Dispose = bodyGroup;

  console.log("\nGroup to dispose ->", group2Dispose.name);

  // Dispose the group
  disposeHairBodyGroup(splicingGroupGlobal, group2Dispose);
  // Add the new group
  splicingGroupGlobal.add(importedGroup);
}

/**
 * Dispose each geometry and material of meshes in a group object.
 * @param obj2Dispose The group object to dispose.
 */
export function disposeGroupObject(
  obj2Dispose: THREE.Group<THREE.Object3DEventMap>,
) {
  obj2Dispose.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((mat) => {
          // Dispose textures in material properties
          for (const key in mat) {
            const value = (mat as any)[key];
            if (value && value instanceof THREE.Texture) {
              value.dispose();
            }
          }
          mat.dispose();
        });
      }
    }
  });
}

/**
 * Disposes the current cut head in the splicing group global.
 * @param splicingGroupGlobal The splicing group global.
 */
export function disposeAndRemoveCurrentCutHead(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
) {
  let currentHead: THREE.Group<THREE.Object3DEventMap> | null = null;
  /*
    Ⅰ. Find the current head in the splicing group global
   */
  currentHead = splicingGroupGlobal.children.find((child) => {
    return child.name
      .toLocaleLowerCase()
      .includes(CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase());
  }) as THREE.Group<THREE.Object3DEventMap>;
  console.log(
    "\n -- disposeCurrentCutHead -- currentCutHead to be disposed ->",
    currentHead,
  );

  /*
    Ⅱ. Check if the current head is found
   */
  if (!currentHead) {
    console.warn("\n -- disposeCurrentCutHead -- No cut head found to dispose");
    return;
  }
  /*
    Ⅲ. Execute the dispose operation
   */
  disposeGroupObject(currentHead);

  /*
    Ⅳ. Finally remove the head from the splicingGroupGlobal
   */
  splicingGroupGlobal.remove(currentHead);
}

/**
 * Replaces the default head with the imported cutter.
 * @param splicingGroupGlobal The splicing group global.
 * @param defaultOriginalHead The default original head.
 * @param importedCutter The imported cutter.
 */
export async function replaceCurrentHeadWithCutHead(
  splicingGroupGlobal: THREE.Group<THREE.Object3DEventMap>,
  defaultOriginalHead: THREE.Group<THREE.Object3DEventMap>,
  importedCutter: THREE.Group<THREE.Object3DEventMap>,
) {
  // Get the userData of the current head
  const currentHeadUserData = splicingGroupGlobal.children.find((child) => {
    return child.name
      .toLocaleLowerCase()
      .includes(CutHeadEyesNodeCombinedGroupName.toLocaleLowerCase());
  })?.userData;
  console.log(
    "\n -- replaceCurrentHeadWithCutHead -- currentHeadUserData ->",
    currentHeadUserData,
  );
  // Remove the current default original head in the splicing group global
  disposeAndRemoveCurrentCutHead(splicingGroupGlobal);
  // Execute the getCutHead operation
  const newCutHead = await getCutHead(
    defaultOriginalHead,
    importedCutter,
    false,
  );
  // Place the userData of the current head to the new cut head
  newCutHead.userData = currentHeadUserData;
  console.log(
    "\n -- replaceDefaultHeadWithCutHead -- newCutHead ->",
    newCutHead,
  );
  disposeGroupObject(importedCutter);
  // Add the new cut head to the splicing group global
  splicingGroupGlobal.add(newCutHead);
  // Generate the facial morphs
  // generateFacialMorphs(splicingGroupGlobal, { noseRadius: 7 });
}
