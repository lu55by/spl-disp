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
  visualizerByNoseMorph: Vector3[];
  // Nostril Morph
  visualizerByNostrilMorph: Vector3[];
  // Mandible Morph
  visualizerByMandibleMorph: Vector3[];
  // Eye Brow Morph
  visualizerByEyeBrowMorph: Vector3[];
  // Mouse Corners Width Morph
  visualizerByMouseCornersWidthMorph: Vector3[];
  // Ear Middle Morph
  visualizerByEarMiddleMorph: Vector3[];
  // Ear Top Morph
  visualizerByEarTopMorph: Vector3[];
  // Zygomatic Arch Width Morph
  visualizerByZygomaticArchWidthMorph: Vector3[];
  // Face Width Morph
  visualizerByCheek0WidthMorph: Vector3[];
  visualizerByCheek1WidthMorph: Vector3[];
  // Jaw Width Morph
  visualizerByJawWidthMorph: Vector3[];
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
