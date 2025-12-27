import type { Group, Object3DEventMap } from "three";
import { toast } from "vue3-toastify";
import { ToastContents } from "../constants";
import {
  NodeNames,
  OBJLoaderInstance,
  ValidNodeNames,
} from "../three/constants";
import { disposeGroupObject } from "../three/meshOps";
import type { FilesValidatorReturnType } from "../types";

/**
 * Validates the imported files for the splicing model.
 * Checks for:
 *  -- 1. Existence of files
 *  -- 2. Single file must be .obj
 *  -- 3. Max 2 files
 *  -- 4. At least one .obj file
 *  -- 5. Not two .obj files (must be .obj + texture)
 *
 * Displays toast warnings if validation fails.
 *
 * @param files The FileList to validate
 * @returns true if valid, false otherwise
 */
export const validateImportFiles = async (
  files: FileList | null
): Promise<boolean> => {
  /*
    ! No File Selected
   */
  if (!files || files.length === 0) return false;

  /*
    ! Only One File Selected and Not an Obj File or STL File
   */
  if (
    files.length === 1 &&
    !files[0].name.toLocaleLowerCase().endsWith(".obj") &&
    !files[0].name.toLocaleLowerCase().endsWith(".stl")
  ) {
    toast(ToastContents.ModelImportWarningOneFileNotObjZH, {
      autoClose: 1000,
      type: "warning",
    });
    return false;
  }

  /*
    ! More than 2 Files Selected
   */
  if (files.length > 2) {
    toast(ToastContents.ModelImportWarningMoreThanTwoFilesZH, {
      autoClose: 1000,
      type: "warning",
    });
    return false;
  }

  /*
    ! No Obj File or STL File Selected
   */
  let hasObjStlFile = false;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (
      file.name.toLocaleLowerCase().endsWith(".obj") ||
      file.name.toLocaleLowerCase().endsWith(".stl")
    ) {
      hasObjStlFile = true;
      break;
    }
  }
  if (!hasObjStlFile) {
    toast(ToastContents.ModelImportWarningNoObjFileZH, {
      autoClose: 1000,
      type: "warning",
    });
    return false;
  }

  /*
    ! Two Model Files Selected
   */
  if (
    files.length === 2 &&
    Array.from(files).every((file) => /\.(obj|stl)$/i.test(file.name))
  ) {
    toast(ToastContents.ModelImportWarningTwoObjFilesZH, {
      autoClose: 1000,
      type: "warning",
    });
    return false;
  }

  return true;
};

/**
 * Validates the imported files for the splicing model.
 * Checks for:
 *  -- All Validates in validateImportFiles fn + Node Name Matches
 *
 * Displays toast warnings if validation fails.
 *
 * @param files The FileList to validate
 * @returns true if valid, false otherwise
 */
export const validateImportFilesWithNodeNames = async (
  files: FileList | null
): Promise<FilesValidatorReturnType> => {
  console.log("\n -- validateImportFilesWithNodeNames -- files ->", files);
  const isValid = await validateImportFiles(files);
  if (!isValid) return { isValid: false, parsedObjGroupFromValidators: null };

  /*
    Node Name Validation
   */
  let objFile: File | null = null;
  let stlFile: File | null = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.name.toLocaleLowerCase().endsWith(".obj")) {
      objFile = file;
      break;
    } else if (file.name.toLocaleLowerCase().endsWith(".stl")) {
      stlFile = file;
      break;
    }
  }

  // Check if the .obj or .stl file exists
  if (!objFile && !stlFile) {
    toast(ToastContents.ModelImportWarningNoObjFileZH, {
      autoClose: 1000,
      type: "warning",
    });
    return { isValid: false, parsedObjGroupFromValidators: null };
  }

  /*
    STL File Validation
   */
  if (stlFile) {
    // ! The stl file name must match one of the valid node names, or we don't know what kind of model is imported (hair, body or cutter)
    if (
      !stlFile.name
        .toLocaleLowerCase()
        .includes(NodeNames.HairNames.Hair.toLocaleLowerCase()) &&
      !stlFile.name
        .toLocaleLowerCase()
        .includes(NodeNames.BodyNames.Body.toLocaleLowerCase()) &&
      !stlFile.name
        .toLocaleLowerCase()
        .includes(NodeNames.CuttersNames.Single.toLocaleLowerCase())
    ) {
      toast(ToastContents.ModelNodeNameErrorZH, {
        autoClose: 1000,
        type: "warning",
      });
      return { isValid: false, parsedObjGroupFromValidators: null };
    }
    // STL file validation passed, return true
    return { isValid: true, parsedObjGroupFromValidators: null };
  }

  /*
    Not a STL File, must be an OBJ File to validate
   */
  // Parse the obj file
  const text = await objFile.text();
  const parsedObjGroup: Group<Object3DEventMap> = OBJLoaderInstance.parse(text);
  console.log("\n -- validateImportFiles -- parsedObjGroup ->", parsedObjGroup);

  /*
    ! Check if the imported object has the correct node names (Currently, supporting one single cutter node only)
   */
  const firstNodeName = parsedObjGroup.children[0].name.toLocaleLowerCase();
  let isValidNodeName = false;
  for (const validNodeName of ValidNodeNames) {
    if (firstNodeName.length > 0 && firstNodeName.includes(validNodeName)) {
      isValidNodeName = true;
      break;
    }
  }

  /*
    Logs
   */
  isValidNodeName &&
    console.log(
      "\n -- validateImportFiles -- First NodeName ->",
      firstNodeName
    );
  !isValidNodeName &&
    console.warn(
      "\n -- validateImportFiles -- First NodeName ->",
      firstNodeName
    );

  /*
    Toast Warning
   */
  if (!isValidNodeName) {
    toast(ToastContents.ModelNodeNameErrorZH, {
      autoClose: 1000,
      type: "warning",
    });
    disposeGroupObject(parsedObjGroup);
    return { isValid: false, parsedObjGroupFromValidators: null };
  }

  /*
    OBJ file validation passed, return true
   */
  return { isValid: true, parsedObjGroupFromValidators: parsedObjGroup };
};

/**
 * Checks if the imported object has the correct node names (Currently, supporting one single cutter node only)
 * @param objGroup The parsed obj group to check
 * @returns true if the obj group is a cutter node, false otherwise
 */
export const isObjGroupCutterNode = (
  objGroup: Group<Object3DEventMap> | null
): boolean => {
  if (!objGroup) return false;
  return (
    objGroup.children.length === 1 &&
    objGroup.children[0].name
      .toLocaleLowerCase()
      .includes(NodeNames.CuttersNames.Single.toLocaleLowerCase())
  );
};
