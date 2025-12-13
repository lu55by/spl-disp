import {
  BufferGeometry,
  Color,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Vector2,
  TextureLoader,
} from "three";
import { OBJLoader } from "three/examples/jsm/Addons.js";
import { GlobalLoadingManager } from "../managers/GlobalLoadingManager";

/*
 * -----------------------------------------------------------------------------
 * Loaders
 * -----------------------------------------------------------------------------
 */

export const OBJLoaderInstance = new OBJLoader(GlobalLoadingManager);
export const TextureLoaderInstance = new TextureLoader(GlobalLoadingManager);

/*
 * -----------------------------------------------------------------------------
 * Helper Types
 * -----------------------------------------------------------------------------
 */

export type MeshOf<M extends Material> = Mesh<BufferGeometry, M>;

export type PhongMesh = MeshOf<MeshPhongMaterial>;

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
export const HDRPath = "hdrs/royal_esplanade_2k.hdr.jpg";
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
  Pos: { x: 1, y: 1, z: 1 },
  Fov: 75,
  Near: 0.01,
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

export const CutHeadEyesCombinedGroupName = "CutHeadEyesCombinedGrp";

export const CutHeadBoundingBoxHeight = 22.35;

/*
 * -----------------------------------------------------------------------------
 * Materials
 * -----------------------------------------------------------------------------
 */

export const BasicMatWireframe = new MeshBasicMaterial({ wireframe: true });
export const BasicMat = new MeshBasicMaterial();

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
  },
};

/*
 * -----------------------------------------------------------------------------
 * Model Paths
 * -----------------------------------------------------------------------------
 */

// --- Models Prefix ---
const ModelsPathPrefix = "./models";

// --- Hair Prefix ---
const HairPathPrefix = `${ModelsPathPrefix}/hair`;

// --- Head Prefix ---
const HeadPathPrefix = `${ModelsPathPrefix}/head`;

// --- Head Male Prefix ---
export const HeadMalePathPrefix = `${HeadPathPrefix}/male`;
// Head Male sub path
export const HeadMaleSubPath = `/default`;

// --- Head Female Prefix ---
export const HeadFeMalePathPrefix = `${HeadPathPrefix}/female`;
// Head Female sub path
export const HeadFeMaleSubPath = `/default`;

// --- Body Prefix ---
const BodyPathPrefix = `${ModelsPathPrefix}/body`;

// --- Cutter Prefix ---
const CutterPathPrefix = `${ModelsPathPrefix}/cutters`;

export const ModelPaths = {
  Hair: {
    Model: `${HairPathPrefix}/mold.obj`,
    Texture: { ColorTex: `${HairPathPrefix}/map.png` },
  },
  HeadFemale: {
    Model: `${HeadFeMalePathPrefix}${HeadFeMaleSubPath}/model.obj`,
    Texture: {
      HeadColTex: `${HeadFeMalePathPrefix}${HeadFeMaleSubPath}/headColor.png`,
      EyeLColTex: `${HeadFeMalePathPrefix}${HeadFeMaleSubPath}/eyeColorL.png`,
      EyeRColTex: `${HeadFeMalePathPrefix}${HeadFeMaleSubPath}/eyeColorR.png`,
      TeethColTex: `${HeadFeMalePathPrefix}${HeadFeMaleSubPath}/TeethColor.png`,
    },
    MTLPath: `${HeadFeMalePathPrefix}${HeadFeMaleSubPath}/metaHumanLod0.mtl`,
  },
  HeadMale: {
    Model: `${HeadMalePathPrefix}${HeadMaleSubPath}/model.obj`,
    Texture: {
      HeadColorTex: `${HeadMalePathPrefix}${HeadMaleSubPath}/headColor.png`,
      EyeLColTex: `${HeadMalePathPrefix}${HeadMaleSubPath}/eyeColorL.png`,
      EyeRColTex: `${HeadMalePathPrefix}${HeadMaleSubPath}/eyeColorR.png`,
    },
  },
  Body: {
    Model: `${BodyPathPrefix}/mold.obj`,
    Texture: { ColorTex: `${BodyPathPrefix}/map.png` },
  },
  Cutters: {
    OralCavity: `${CutterPathPrefix}/cutter-oral-cavity-2.obj`,
    CylinderMod: `${CutterPathPrefix}/cutters-cyl-mod.obj`,
    CylinderStrLineRmvdMod: `${CutterPathPrefix}/cutter-cyl-strc-line-rmvd.obj`,
    CylinderStrCloseLineRmvdMod: `${CutterPathPrefix}/cutter-cyl-strc-close-line-rmvd.obj`,
    SphereLineTranslated: `${CutterPathPrefix}/cutters-sph-line-translated.obj`,
    CylinderStrCloseLineTranslated: `${CutterPathPrefix}/cutters-cly-strc-close-line-translated.obj`,
    ClyinderStrcLinesRmvd: `${CutterPathPrefix}/cutters-cyl-strc-lines-rmvd.obj`,
    OralSphereCylinderCombined: `${CutterPathPrefix}/cutters-mod-oral-vt-1.obj`,
  },
};
