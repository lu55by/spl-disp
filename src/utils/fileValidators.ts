import type { Group, Object3DEventMap } from "three";
import { toast } from "vue3-toastify";
import { ToastContents } from "../constants";
import { OBJLoaderInstance, ValidNodeNames } from "../three/constants";

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
    ! Only One File Selected and Not an Obj File
   */
  if (files.length === 1 && !files[0].name.endsWith(".obj")) {
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
    ! No Obj File Selected
   */
  let hasObjFile = false;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.name.endsWith(".obj")) {
      hasObjFile = true;
      break;
    }
  }
  if (!hasObjFile) {
    toast(ToastContents.ModelImportWarningNoObjFileZH, {
      autoClose: 1000,
      type: "warning",
    });
    return false;
  }

  /*
    ! Two Obj Files Selected
   */
  if (
    files.length === 2 &&
    files[0].name.endsWith(".obj") &&
    files[1].name.endsWith(".obj")
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
): Promise<boolean> => {
  const isValid = await validateImportFiles(files);
  if (!isValid) return false;

  /*
    Node Name Validation
   */
  let objFile: File | null = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.name.endsWith(".obj")) {
      objFile = file;
    }
  }

  // Check if the .obj file exists
  if (!objFile) {
    toast(ToastContents.ModelImportWarningNoObjFileZH, {
      autoClose: 1000,
      type: "warning",
    });
    return false;
  }

  // Parse the obj file
  const text = await objFile.text();
  const importedParsedObject: Group<Object3DEventMap> =
    OBJLoaderInstance.parse(text);
  console.log(
    "\n -- validateImportFiles -- importedParsedObject ->",
    importedParsedObject
  );

  // Check if the imported object has the correct node names
  const nodeName = importedParsedObject.children[0].name;
  console.log("\n -- validateImportFiles -- nodeName ->", nodeName);
  if (!nodeName.length || !ValidNodeNames.includes(nodeName)) {
    toast(ToastContents.ModelNodeNameErrorContentZH, {
      autoClose: 1000,
      type: "warning",
    });
    return false;
  }

  return true;
};
