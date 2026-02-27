import type { Group, Object3DEventMap, Vector3 } from "three";
import type { UniformNode } from "three/webgpu";

export interface FilesValidatorReturnType {
  isValid: boolean;
  parsedObjGroupFromValidators: Group<Object3DEventMap> | null;
}

export interface UploadModelInputFields {
  name: string;
  description: string;
  sex: string;
  is_default: string;
}

/*
  Facial Morphs Visualizers
 */
export interface FacialMorphsVisualizers {
  /*
    Tips
  */
  // Nose Tip
  visualizerNoseTip: Vector3;
  // Nostril Tips
  visualizerNostrilTipL: Vector3;
  visualizerNostrilTipR: Vector3;
  // Mandible Tips
  visualizerMandibleTipL: Vector3;
  visualizerMandibleTipR: Vector3;
  // Mouse Corner Tips
  visualizerMouseCornerTipL: Vector3;
  visualizerMouseCornerTipR: Vector3;
  // Eye Brow Tips
  visualizerEyeBrowTipL: Vector3;
  visualizerEyeBrowTipR: Vector3;
  // Ear Middle Tips
  visualizerEarMiddleTipL: Vector3;
  visualizerEarMiddleTipR: Vector3;
  // Ear Top Tips
  visualizerEarTopTipL: Vector3;
  visualizerEarTopTipR: Vector3;
  // Zygomatic Arch Tips
  visualizerZygomaticArchTipL: Vector3;
  visualizerZygomaticArchTipR: Vector3;
  // Cheek Tips
  visualizerCheek0TipL: Vector3;
  visualizerCheek0TipR: Vector3;
  visualizerCheek1TipL: Vector3;
  visualizerCheek1TipR: Vector3;
  // Jaw Tips
  visualizerJawTipL: Vector3;
  visualizerJawTipR: Vector3;
  visualizerJawTipM: Vector3;
  // Mandible Corner Tips
  visualizerMandibleCornerTipL: Vector3;
  visualizerMandibleCornerTipR: Vector3;
  // Forehead Tips
  visualizerForeheadTipL: Vector3;
  visualizerForeheadTipR: Vector3;
  visualizerForeheadTipM: Vector3;
  /*
    Detection
  */
  // Nose Tip Detection
  visualizerByNoseTipDetection: Vector3[];
  // Nostril Tips Detection
  visualizerByNostrilTipsDetection: Vector3[];
  // Mandible Tips Detection
  visualizerByMandibleTipsDetection: Vector3[];
  // Eye Brow Tips Detection
  visualizerByEyeBrowTipsDetection: Vector3[];
  // Mouse Corner Tips Detection
  visualizerByMouseCornerTipsDetection: Vector3[];
  // Ear Middle Tips Detection
  visualizerByEarMiddleTipsDetection: Vector3[];
  // Jaw Tips Detection
  visualizerByJawTipsDetection: Vector3[];
  /*
    Morph
  */
  // Nose Morph
  visualizerByNoseHeightMorph: Vector3[];
  // Nostril Morph
  visualizerByNostrilWidthMorph: Vector3[];
  // Mandible Morph
  visualizerByMandibleWidthMorph: Vector3[];
  // Eye Brow Morph
  visualizerByEyeBrowHeightMorph: Vector3[];
  // Mouse Corners Width Morph
  visualizerByMouseCornersWidthMorph: Vector3[];
  // Ear Middle Morph
  visualizerByEarMiddleWidthMorph: Vector3[];
  // Ear Top Morph
  visualizerByEarTopThicknessMorph: Vector3[];
  // Zygomatic Arch Width Morph
  visualizerByZygomaticArchWidthMorph: Vector3[];
  // Zygomatic Arch Depth Morph
  visualizerByZygomaticArchDepthMorph: Vector3[];
  // Zygomatic Arch Height Morph
  visualizerByZygomaticArchHeightMorph: Vector3[];
  // Face Morphs
  visualizerByCheek0WidthMorph: Vector3[];
  visualizerByCheek0DepthMorph: Vector3[];
  visualizerByCheek0HeightMorph: Vector3[];
  visualizerByCheek1WidthMorph: Vector3[];
  visualizerByCheek1DepthMorph: Vector3[];
  visualizerByCheek1HeightMorph: Vector3[];
  // Jaw Width Morph
  visualizerByJawWidthMorph: Vector3[];
  visualizerByJawHeightMorph: Vector3[];
  visualizerByJawDepthMorph: Vector3[];
  // Jaw Sides Width Morph
  visualizerByJawSidesWidthMorph: Vector3[];
  visualizerByJawSidesHeightMorph: Vector3[];
  visualizerByJawSidesDepthMorph: Vector3[];
  // Mandible Corner Width Morph
  visualizerByMandibleCornersWidthMorph: Vector3[];
  // Forehead Morphs
  visualizerByForeheadWidthMorph: Vector3[];
  visualizerByForeheadDepthMorph: Vector3[];
  visualizerByForeheadHeightMorph: Vector3[];
}

/*
  Cut Head Eyes Node Combined Grp UserData
 */
export interface CutHeadEyesNodeCombinedGrpUserData {
  minYSphCutHead: number;
  maxYSphCutHead: number;
  sphCutHeadHeight: number;
  uLocalToggleOutline: UniformNode<number>;
}
