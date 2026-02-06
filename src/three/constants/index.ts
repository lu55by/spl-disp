import {
  BufferGeometry,
  Color,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Vector2,
  TextureLoader,
  MeshStandardMaterial,
  DataTexture,
  RGBAFormat,
  UnsignedByteType,
  Texture,
  ClampToEdgeWrapping,
  NearestFilter,
  SRGBColorSpace,
} from "three";
import {
  OBJExporter,
  OBJLoader,
  STLLoader,
} from "three/examples/jsm/Addons.js";
import { GlobalLoadingManager } from "../managers/GlobalLoadingManager";

/*
 * -----------------------------------------------------------------------------
 * Loaders
 * -----------------------------------------------------------------------------
 */

export const OBJLoaderInstance = new OBJLoader(GlobalLoadingManager);
export const TextureLoaderInstance = new TextureLoader(GlobalLoadingManager);
export const STLLoaderInstance = new STLLoader(GlobalLoadingManager);

/*
 * -----------------------------------------------------------------------------
 * Exporters
 * -----------------------------------------------------------------------------
 */
export const OBJExporterInstance = new OBJExporter();

/*
 * -----------------------------------------------------------------------------
 * Helper Types
 * -----------------------------------------------------------------------------
 */

export type MeshOf<M extends Material> = Mesh<BufferGeometry, M>;

export type StandardMesh = MeshOf<MeshStandardMaterial>;
export type PhongMesh = MeshOf<MeshPhongMaterial>;

export interface CutHeadInspectorDebugProps {
  isShowWireframe: boolean;
  color: string | Color;
}

/*
 * -----------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------
 */

/**
 * Lights
 */
export const DirectionalLightIntensity = 5;

// Head Scalar (Deprecated/Unused)
// export const HeadScalar = .0107;

/**
 * UV Coordinate to modify on both x and y
 */
export const UVCoordinateMod = new Vector2(0, 0.2);

/**
 * HDR Path
 */
export const HDRPath = "/hdrs/royal_esplanade_2k.hdr.jpg";
// export const HDRPath = "hdrs/moon_lab_2k.jpg";

/**
 * Colors
 */
export const Colors = {
  White: new Color("#eee"),
  Red: new Color("#f00"),
  Green: new Color("#0f0"),
  Blue: new Color("#00f"),
  Yellow: new Color("#ff0"),
  Pink: new Color("#f0f"),
  Cyan: new Color("#0ff"),
};

/**
 * Camera Configuration
 */
export const CameraProps = {
  Pos: { x: -39.13, y: 221.74, z: 52.17 },
  PosEarTopDebug: { x: -13.966, y: 158.38, z: -20.76 },
  PosNormal: { x: 1, y: 1, z: 1 },
  Fov: 45,
  Near: 0.1,
  Far: 500,
};

/*
 * -----------------------------------------------------------------------------
 * CutHead Config
 * -----------------------------------------------------------------------------
 */

export const CutHeadDebugProps = {
  Pos: { x: 0.05, y: -1.78, z: 0.05 },
  Scalar: 0.0132,
  ScalarSplicing: 0.018,
};

export const OffsetPosNegPercentages = {
  PostSphere: { pos: 0, neg: 0.08 },
  PostCylinder: {
    Female: { pos: 0, neg: 0.046 },
    Male: { pos: 0, neg: 0.044 },
  },
};

export const CutHeadEyesNodeCombinedGroupName = "CutHeadEyesNodeCombinedGrp";

export const CutHeadBoundingBoxHeight = 22.35 + 40;

/*
 * -----------------------------------------------------------------------------
 * Materials
 * -----------------------------------------------------------------------------
 */

export const BasicMatWireframe = new MeshBasicMaterial({ wireframe: true });
export const BasicMat = new MeshBasicMaterial();

/*
 * -----------------------------------------------------------------------------
 * Textures
 * -----------------------------------------------------------------------------
 */
// Create a White Texture by using DataTexture from three
export const WhiteTex = new DataTexture(
  new Uint8Array([255, 255, 255, 255]),
  1,
  1,
  RGBAFormat,
  UnsignedByteType,
  Texture.DEFAULT_MAPPING,
  ClampToEdgeWrapping,
  ClampToEdgeWrapping,
  NearestFilter,
  NearestFilter,
  Texture.DEFAULT_ANISOTROPY,
  SRGBColorSpace,
);

/*
 * -----------------------------------------------------------------------------
 * Node Names
 * -----------------------------------------------------------------------------
 */

export const NodeNames = {
  HeadNames: {
    Head: "head_lod0_mesh",
    Teeth: "teeth_lod0_mesh",
    EyeL: "eyeLeft_lod0_mesh",
    EyeR: "eyeRight_lod0_mesh",
  },
  CuttersNames: {
    Sphere: "Sphere006",
    Cylinder: "Cylinder004",
    Single: "cutting",
  },
  HairNames: {
    Hair: "hair",
  },
  BodyNames: {
    Body: "body",
  },
};

export const ValidNodeNames = ["hair", "body", "cutting"];

/*
 * -----------------------------------------------------------------------------
 * Model Paths
 * -----------------------------------------------------------------------------
 */

// --- Models Prefix ---
const ModelsPathPrefix = "/models";

// --- Hair Prefix ---
const HairPathPrefix = `${ModelsPathPrefix}/hair`;

// --- Head Prefix ---
export const HeadPathPrefix = `${ModelsPathPrefix}/head`;

// --- Head Male Prefix ---
export const HeadMalePathPrefix = `${HeadPathPrefix}/male`;
// Head Male sub path
/*
  big-one-01
  default
  isspd-01
  sasha-01
  seki-01
  ukn-01
  ukn-02
  ukn-03
 */
export const DefaultHeadMaleSubPath = `/isspd-01`;

// --- Head Female Prefix ---
export const HeadFeMalePathPrefix = `${HeadPathPrefix}/female`;
// Head Female sub path
/*
  ellie01
  default/prev
  default/new
  ukn01-issue01
  ukn02-issue01
*/
export const DefaultHeadFeMaleSubPath = `/default/prev`;

/**
 * Get the head model paths based on gender and subpath.
 * @param isFemale boolean
 * @param subPath string (optional, starts with /)
 * @returns object with model and texture paths
 */
export const getHeadModelPaths = (isFemale: boolean, subPath?: string) => {
  const prefix = isFemale ? HeadFeMalePathPrefix : HeadMalePathPrefix;
  const currentSubPath =
    subPath || (isFemale ? DefaultHeadFeMaleSubPath : DefaultHeadMaleSubPath);
  const basePath = `${prefix}${currentSubPath}`;

  return {
    Model: `${basePath}/model.obj`,
    Texture: {
      HeadColTex: `${basePath}/headColor.png`,
      EyeLColTex: `${basePath}/eyeColorL.png`,
      EyeRColTex: `${basePath}/eyeColorR.png`,
      TeethColTex: `${basePath}/TeethColor.png`,
    },
    MTLPath: `${basePath}/metaHumanLod0.mtl`,
  };
};

// --- Body Prefix ---
const BodyPathPrefix = `${ModelsPathPrefix}/body`;

// --- Cutter Prefix ---
const CutterPathPrefix = `${ModelsPathPrefix}/cutters`;

export const ModelPaths = {
  Hair: {
    Model: `${HairPathPrefix}/mold.obj`,
    Texture: { ColorTex: `${HairPathPrefix}/map.png` },
  },
  HeadFemale: getHeadModelPaths(true),
  HeadMale: getHeadModelPaths(false),
  Body: {
    Model: `${BodyPathPrefix}/mold.obj`,
    Texture: { ColorTex: `${BodyPathPrefix}/map.png` },
  },
  Cutters: {
    OralSphereCylinderCombined: `${CutterPathPrefix}/cutters-cutter-teeth-added.obj`,
    OralMod01: `${CutterPathPrefix}/slf-mod/oral-mod-01.obj`,
  },
};
