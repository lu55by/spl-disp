import type { Group, Object3DEventMap, Vector3 } from "three";

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
  visualizerEarTipL: Vector3;
  visualizerEarTipR: Vector3;
  visualizerByNoseTipDetection: Vector3[];
  visualizerByNostrilTipsDetection: Vector3[];
  visualizerByJawTipsDetection: Vector3[];
  visualizerByEyeBrowTipsDetection: Vector3[];
  visualizerByMouseCornerTipsDetection: Vector3[];
  visualizerByEarTipsDetection: Vector3[];
  visualizerByNoseMorph: Vector3[];
  visualizerByNostrilMorph: Vector3[];
  visualizerByJawMorph: Vector3[];
  visualizerByEyeBrowMorph: Vector3[];
  visualizerByMouseCornersWidthMorph: Vector3[];
  visualizerByEarMorph: Vector3[];
}
