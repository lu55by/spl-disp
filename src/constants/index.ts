// Toast Contents
export const ToastContents = {
  ModelImportMaxLenReached: "Model maximum length reached!",
  ModelImportMaxLenReachedZH: "模型数量已达上限！",

  ModelImportWarningOneFileNotObj: "Please select an .obj file.",
  ModelImportWarningOneFileNotObjZH: "请选择一个 .obj 文件或 .stl 文件。",

  ModelImportWarningMoreThanTwoFiles: "Please select at most 2 files.",
  ModelImportWarningMoreThanTwoFilesZH: "最多选择两个文件。",

  ModelImportWarningNoObjFile: "Please select one .obj file.",
  ModelImportWarningNoObjFileZH: "请选择一个 .obj 文件或 .stl 文件。",

  ModelImportWarningTwoObjFiles: "Please select at most one .obj file.",
  ModelImportWarningTwoObjFilesZH: "最多选择一个 .obj 文件或 .stl 文件。",

  ModelExported: "Model exported!",
  ModelExportedZH: "模型已导出！",

  ModelCleared: "Model cleared!",
  ModelClearedZH: "模型已清空！",

  ModelEmptyToClear: "Nothing to clear!",
  ModelEmptyToClearZH: "没有可清空的模型！",

  ModelNodeNameError: "Model node name error!",
  ModelNodeNameErrorZH: "模型节点名称错误！",

  ModelLoading: "Model loading...",
  ModelLoadingZH: "正在解析并加载模型...",
  ModelLoadingFailed: "Model loading failed!",
  ModelLoadingFailedZH: "模型加载失败！",
  ModelImported: "Model imported!",
  ModelImportedZH: "模型已导入！",

  ModelCuttingOperation: "Cutting head...",
  ModelCuttingOperationZH: "头模切割中...",
  ModelCuttingOperationSuccess: "Cutting head success!",
  ModelCuttingOperationSuccessZH: "头模切割成功！",
  ModelCuttingOperationFailed: "Cutting head failed!",
  ModelCuttingOperationFailedZH: "头模切割失败！",

  TextureApplying: "Applying texture...",
  TextureApplyingZH: "正在应用贴图...",
  TextureApplied: "Texture applied!",
  TextureAppliedZH: "贴图应用成功！",
  TextureApplyingFailed: "Texture applying failed!",
  TextureApplyingFailedZH: "贴图应用失败！",

  // Here gose for Toast Contents of uploading model
  UploadModelMapTexNotFound: "Material map is not found",
  UploadModelMapTexNotFoundZH: "贴图未找到",

  ModelUploading: "Uploading model data...",
  ModelUploadingZH: "正在上传模型数据...",
  ModelUploadSuccess: "Model synced to database successfully",
  ModelUploadSuccessZH: "模型成功同步至数据库",
  ModelUploadFailed: "Upload failed, please try again later",
  ModelUploadFailedZH: "上传失败，请稍后重试",
  UnknownError: "Unknown error occurred",
  UnknownErrorZH: "发生未知错误",
};

export const ToastContentsImportDefault = {
  Loading: ToastContents.ModelLoadingZH,
  Success: ToastContents.ModelImportedZH,
  Error: ToastContents.ModelLoadingFailedZH,
};
export const ToastContentsImportCutter = {
  Loading: ToastContents.ModelCuttingOperationZH,
  Success: ToastContents.ModelCuttingOperationSuccessZH,
  Error: ToastContents.ModelCuttingOperationFailedZH,
};
export const ToastContentsUpload = {
  Loading: ToastContents.ModelUploadingZH,
  Success: ToastContents.ModelUploadSuccessZH,
  Error: ToastContents.ModelUploadFailedZH,
  UnknownError: ToastContents.UnknownErrorZH,
};

// UI Contents
export const UIContents = {
  // Drop Zone Indicator
  DropZoneIndicatorContent: "DROP FILES TO IMPORT",
  DropZoneIndicatorContentZH: "松开以导入",

  // Upload Modal Type
  Default: "Default",
  DefaultZH: "默认",
  NormalOutfit: "Normal Outfit",
  NormalOutfitZH: "日常造型",
  IPOutfit: "IP Outfit",
  IPOutfitZH: "IP 造型",
};

// Global Model
export const MaxModelLength = 3;
