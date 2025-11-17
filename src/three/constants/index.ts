import {BufferGeometry, Color, Material, Mesh, MeshBasicMaterial, MeshPhongMaterial} from "three";

export type MeshOf<M extends Material> = Mesh<BufferGeometry, M>

export type PhongMesh = MeshOf<MeshPhongMaterial>

// Lights
export const DirectionalLightIntensity = 5

// Head Scalar
// export const HeadScalar = .0107;

// UV Coordinate to modify on both x and y
export const UVCoordinateMod = .2;

// Colors
export const Colors = {
    White: new Color('#eee'),
    Cyan: new Color('#0ff'),
}

// Camera
export const CameraProps = {
    Pos: {x: -.02999, y: 2.58, z: -.82},
    Fov: 75,
    Near: .01,
    Far: 500,
}

export const CutHeadDebugProps = {
    Pos: {x: .05, y: -1.78, z: .05},
    Scalar: .0132
}

export const BasicMatWireframe = new MeshBasicMaterial({wireframe: true})

export const NodeNames = {
    HeadNames: {
        Head: 'head_lod0_mesh',
        Teeth: 'teeth_lod0_mesh',
        EyeL: 'eyeLeft_lod0_mesh',
        EyeR: 'eyeRight_lod0_mesh',
    },
    CuttersNames: {
        Sphere: 'Sphere006',
        Cylinder: 'Cylinder004',
    }
}

// Model Paths
const ModelsPathPrefix = './models'
const HairPathPrefix = `${ModelsPathPrefix}/hair`
const HeadPathPrefix = `${ModelsPathPrefix}/head`
const HeadMalePathPrefix = `${ModelsPathPrefix}/head/headMale`
const BodyPathPrefix = `${ModelsPathPrefix}/body`
const CutterPathPrefix = `${ModelsPathPrefix}/cutters`
export const ModelPaths = {
    Hair: {Model: `${HairPathPrefix}/mold.obj`, Texture: {ColorTex: `${HairPathPrefix}/map.png`}},
    HeadFemale: {
        Model: `${HeadPathPrefix}/final.obj`,
        Texture: {
            HeadColTex: `${HeadPathPrefix}/headColor.png`,
            EyeLColTex: `${HeadPathPrefix}/eyeColorL.png`,
            EyeRColTex: `${HeadPathPrefix}/eyeColorR.png`,
            TeethColTex: `${HeadPathPrefix}/TeethColor.png`
        }
    },
    HeadMale: {
        Model: `${HeadMalePathPrefix}/headMale.obj`,
        Texture: {
            HeadColorTex: `${HeadMalePathPrefix}/headColor.png`,
            EyeLColTex: `${HeadMalePathPrefix}/eyeColorL.jpg`,
            EyeRColTex: `${HeadMalePathPrefix}/eyeColorR.jpg`,
        }
    },
    Body: {Model: `${BodyPathPrefix}/mold.obj`, Texture: {ColorTex: `${BodyPathPrefix}/map.png`}},
    Cutters: {Model: `${CutterPathPrefix}/cutters.obj`}
}