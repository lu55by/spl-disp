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

  BindThumbnail: "Binding thumbnail...",
  BindThumbnailZH: "正在绑定缩略图...",
  BindThumbnailSuccess: "Thumbnail bound!",
  BindThumbnailSuccessZH: "缩略图绑定成功！",
  BindThumbnailFailed: "Thumbnail binding failed!",
  BindThumbnailFailedZH: "缩略图绑定失败！",

  BindCuttingModel: "Binding cutting model...",
  BindCuttingModelZH: "正在绑定切割模型...",
  BindCuttingModelSuccess: "Cutting model bound!",
  BindCuttingModelSuccessZH: "切割模型绑定成功！",
  BindCuttingModelFailed: "Cutting model binding failed!",
  BindCuttingModelFailedZH: "切割模型绑定失败！",

  UploadModelMapTexNotFound: "Material map is not found!",
  UploadModelMapTexNotFoundZH: "贴图未找到！",
  UploadModelCuttingModelNotBound: "Cutting model is not bound!",
  UploadModelCuttingModelNotBoundZH: "切割模型未绑定！",
  UploadModelThumbNotBound: "Thumbnail is not bound!",
  UploadModelThumbNotBoundZH: "缩略图未绑定！",
  UploadModelNameRequired: "Model name is required!",
  UploadModelNameRequiredZH: "模型名称不能为空！",

  ModelUploading: "Uploading model data...",
  ModelUploadingZH: "正在上传模型数据...",
  ModelUploadSuccess: "Model synced to database successfully!",
  ModelUploadSuccessZH: "模型成功同步至数据库！",
  ModelUploadFailed: "Upload failed, please try again later!",
  ModelUploadFailedZH: "上传失败，请稍后重试！",
  UnknownError: "Unknown error occurred!",
  UnknownErrorZH: "发生未知错误！",
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
export const ToastContentsTextureApplying = {
  Loading: ToastContents.TextureApplyingZH,
  Success: ToastContents.TextureAppliedZH,
  Error: ToastContents.TextureApplyingFailedZH,
};
export const ToastContentsBindingThumbnail = {
  Loading: ToastContents.BindThumbnailZH,
  Success: ToastContents.BindThumbnailSuccessZH,
  Error: ToastContents.BindThumbnailFailedZH,
};
export const ToastContentsBindingCuttingModel = {
  Loading: ToastContents.BindCuttingModelZH,
  Success: ToastContents.BindCuttingModelSuccessZH,
  Error: ToastContents.BindCuttingModelFailedZH,
};

// UI Contents
export const UIContents = {
  // Drop Zone Indicator
  DropZoneIndicatorContent: "DROP FILES TO IMPORT",
  DropZoneIndicatorContentZH: "松开以导入",

  // Upload Modal Type
  DefaultOutfit: "Default",
  DefaultOutfitZH: "默认",
  NormalOutfit: "Normal Outfit",
  NormalOutfitZH: "日常造型",
  IPOutfit: "IP Outfit",
  IPOutfitZH: "IP 造型",
};

// Morph Target
export const MorphTargetLabelMapping = {
  ForeheadWidth: "额头宽度",
  ForeheadDepth: "额头深度",
  ForeheadHeight: "额头高度",
  ZygomaticArchWidth: "颧骨宽度",
  ZygomaticArchDepth: "颧骨深度",
  ZygomaticArchHeight: "颧骨高度",
  // TODO: Add the Apple Cheek morphs (height, depth, width)
  Cheek0Width: "脸颊宽度",
  Cheek0Depth: "脸颊深度",
  Cheek0Height: "脸颊高度",
  Cheek1Width: "腮帮宽度",
  Cheek1Depth: "腮帮深度",
  Cheek1Height: "腮帮高度",
  // TODO: Add the Philtrum sides morphs (height, depth, width)
  JawWidth: "下巴宽度",
  JawHeight: "下巴高度",
  JawDepth: "下巴深度",
  JawSidesWidth: "下巴两侧宽度",
  JawSidesHeight: "下巴两侧高度",
  JawSidesDepth: "下巴两侧深度",
  NoseHeight: "鼻高",
  NostrilWidth: "鼻翼宽度",
  // TODO: Add the height and depth morphs of the mandible
  MandibleWidth: "下颌宽度",
  MandibleHeight: "下颌高度",
  MandibleDepth: "下颌深度",
  // TODO: Add the height and depth morphs of the mandible corners
  MandibleCornersWidth: "下颌角宽度",
  MandibleCornersHeight: "下颌角高度",
  MandibleCornersDepth: "下颌角深度",
  EyeBrowHeight: "眉毛高度",
  MouseCornersWidth: "嘴角宽度",
  // TODO: Add the height, depth, size morphs of the ear
  EarMiddleWidth: "耳朵宽度",
  EarTopThickness: "耳朵厚度",
};

// Global Model
export const MaxModelLength = 3;

// Development or Production
export const IsDevelopment = import.meta.env.DEV;
