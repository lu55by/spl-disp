import type { Group, Object3DEventMap } from "three";

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
