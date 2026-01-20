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
  visualizerjawTipL: Vector3;
  visualizerjawTipR: Vector3;
  visualizerByJawTipsDetection: Vector3[];
  visualizerByNoseMorph: Vector3[];
  visualizerByJawMorph: Vector3[];
}
