import {
  BufferGeometry,
  Color,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Vector2,
} from "three";

export type MeshOf<M extends Material> = Mesh<BufferGeometry, M>;

export type PhongMesh = MeshOf<MeshPhongMaterial>;

// Lights
export const DirectionalLightIntensity = 5;

// Head Scalar
// export const HeadScalar = .0107;

// UV Coordinate to modify on both x and y
export const UVCoordinateMod = new Vector2(0, 0.2);

// Colors
export const Colors = {
  White: new Color("#eee"),
  Red: new Color("#f00"),
  Green: new Color("#0f0"),
  Blue: new Color("#00f"),
  Yellow: new Color("#ff0"),
  Pink: new Color("#f0f"),
  Cyan: new Color("#0ff"),
};

// Camera
export const CameraProps = {
  Pos: { x: 0.31, y: -0.21, z: 0.31 },
  Fov: 75,
  Near: 0.01,
  Far: 500,
};

// CutHead
export const CutHeadDebugProps = {
  Pos: { x: 0.05, y: -1.78, z: 0.05 },
  Scalar: 0.0132,
};

export const OffsetPosNegPercentages = {
  PostSphere: { pos: 0, neg: 0.08 },
  PostCylinder: {
    Female: { pos: 0, neg: 0.046 },
    Male: { pos: 0, neg: 0.044 },
  },
};

export const BasicMatWireframe = new MeshBasicMaterial({ wireframe: true });
export const BasicMat = new MeshBasicMaterial();

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

// Model Paths
const ModelsPathPrefix = "./models";
const HairPathPrefix = `${ModelsPathPrefix}/hair`;
const HeadPathPrefix = `${ModelsPathPrefix}/head`;
const HeadMalePathPrefix = `${ModelsPathPrefix}/head/headMale`;
const BodyPathPrefix = `${ModelsPathPrefix}/body`;
const CutterPathPrefix = `${ModelsPathPrefix}/cutters`;
export const ModelPaths = {
  Hair: {
    Model: `${HairPathPrefix}/mold.obj`,
    Texture: { ColorTex: `${HairPathPrefix}/map.png` },
  },
  HeadFemale: {
    Model: `${HeadPathPrefix}/final.obj`,
    Texture: {
      HeadColTex: `${HeadPathPrefix}/headColor.png`,
      EyeLColTex: `${HeadPathPrefix}/eyeColorL.png`,
      EyeRColTex: `${HeadPathPrefix}/eyeColorR.png`,
      TeethColTex: `${HeadPathPrefix}/TeethColor.png`,
    },
  },
  HeadMale: {
    Model: `${HeadMalePathPrefix}/headMale.obj`,
    Texture: {
      HeadColorTex: `${HeadMalePathPrefix}/headColor.png`,
      EyeLColTex: `${HeadMalePathPrefix}/eyeColorL.jpg`,
      EyeRColTex: `${HeadMalePathPrefix}/eyeColorR.jpg`,
    },
  },
  HeadMaleLs: {
    Model: `${HeadPathPrefix}/headMaleLs/headMaleLs.obj`,
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
    // CylinderMod: `${CutterPathPrefix}/cutters.obj`,
  },
};
