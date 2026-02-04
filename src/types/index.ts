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
  visualizerNoseTip: Vector3;
  visualizerNostrilTipL: Vector3;
  visualizerNostrilTipR: Vector3;
  visualizerjawTipL: Vector3;
  visualizerjawTipR: Vector3;
  visualizerMouseCornerTipL: Vector3;
  visualizerMouseCornerTipR: Vector3;
  visualizerEyeBrowTipL: Vector3;
  visualizerEyeBrowTipR: Vector3;
  visualizerEarMiddleTipL: Vector3;
  visualizerEarMiddleTipR: Vector3;
  visualizerEarTopTipL: Vector3;
  visualizerEarTopTipR: Vector3;
  visualizerByNoseTipDetection: Vector3[];
  visualizerByNostrilTipsDetection: Vector3[];
  visualizerByJawTipsDetection: Vector3[];
  visualizerByEyeBrowTipsDetection: Vector3[];
  visualizerByMouseCornerTipsDetection: Vector3[];
  visualizerByEarMiddleTipsDetection: Vector3[];
  visualizerByNoseMorph: Vector3[];
  visualizerByNostrilMorph: Vector3[];
  visualizerByJawMorph: Vector3[];
  visualizerByEyeBrowMorph: Vector3[];
  visualizerByMouseCornersWidthMorph: Vector3[];
  visualizerByEarMiddleMorph: Vector3[];
  visualizerByEarTopMorph: Vector3[];
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
