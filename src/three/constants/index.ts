import {BufferGeometry, Material, Mesh, MeshBasicMaterial, MeshPhongMaterial} from "three";

export type MeshOf<M extends Material> = Mesh<BufferGeometry, M>

export type PhongMesh = MeshOf<MeshPhongMaterial>

export const DirectionalLightIntensity = 5

export const HeadScalar = .0107;

export const CameraPos = {x: -.02999, y: 2.58, z: -.82};

export const BasicMatWireframe = new MeshBasicMaterial({wireframe: true})

export const HeadNodeNames = {
    Head: 'head_lod0_mesh',
    Teeth: 'teeth_lod0_mesh',
    EyeL: 'eyeLeft_lod0_mesh',
    EyeR: 'eyeRight_lod0_mesh',
}

// Model Paths
const ModelsPathPrefix = './models'
const HairPathPrefix = `${ModelsPathPrefix}/hair`
const HeadPathPrefix = `${ModelsPathPrefix}/head`
const BodyPathPrefix = `${ModelsPathPrefix}/body`
export const ModelPaths = {
    Hair: {Model: `${HairPathPrefix}/mold.obj`, Texture: {ColorTex: `${HairPathPrefix}/map.png`}},
    Head: {Model: `${HeadPathPrefix}/final.obj`,
        Texture: {
            HeadColTex: `${HeadPathPrefix}/headColor.png`,
            EyeLColTex: `${HeadPathPrefix}/eyeColorL.png`,
            EyeRColTex: `${HeadPathPrefix}/eyeColorR.png`,
            TeethColTex: `${HeadPathPrefix}/TeethColor.png`
        }
    },
    Body: {Model: `${BodyPathPrefix}/mold.obj`, Texture: {ColorTex: `${BodyPathPrefix}/map.png`}},
}