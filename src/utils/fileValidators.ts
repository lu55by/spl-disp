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
): Promise<boolean> => {
  console.log("\n -- validateImportFilesWithNodeNames -- files ->", files);
  const isValid = await validateImportFiles(files);
  if (!isValid) return false;

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
    return false;
  }

  /*
    STL File Validation
   */
  if (stlFile) {
    // ! The stl file name must match one of the valid node names, or we don't know what kind of model is imported (hair or body)
    if (
      !stlFile.name.toLocaleLowerCase().includes("hair") &&
      !stlFile.name.toLocaleLowerCase().includes("body")
    ) {
      toast(ToastContents.ModelNodeNameErrorContentZH, {
        autoClose: 1000,
        type: "warning",
      });
      return false;
    }
    // STL file validation passed, return true
    return true;
  }

  /*
    Not a STL File, must be an OBJ File to validate
   */
  // Parse the obj file
  const text = await objFile.text();
  const importedParsedObject: Group<Object3DEventMap> =
    OBJLoaderInstance.parse(text);
  console.log(
    "\n -- validateImportFiles -- importedParsedObject ->",
    importedParsedObject
  );

  // Check if the imported object has the correct node names
  const nodeName = importedParsedObject.children[0].name.toLocaleLowerCase();
  let isValidNodeName = false;
  for (const validNodeName of ValidNodeNames) {
    if (nodeName.length > 0 && nodeName.includes(validNodeName)) {
      isValidNodeName = true;
      break;
    }
  }
  isValidNodeName &&
    console.log("\n -- validateImportFiles -- nodeName ->", nodeName);
  !isValidNodeName &&
    console.warn("\n -- validateImportFiles -- nodeName ->", nodeName);
  if (!isValidNodeName) {
    toast(ToastContents.ModelNodeNameErrorContentZH, {
      autoClose: 1000,
      type: "warning",
    });
    return false;
  }

  // OBJ file validation passed, return true
  return true;
};
