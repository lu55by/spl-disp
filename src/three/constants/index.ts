import {BufferGeometry, Material, Mesh, MeshPhongMaterial} from "three";

export type MeshOf<M extends Material> = Mesh<BufferGeometry, M>

export type PhongMesh = MeshOf<MeshPhongMaterial>

export const DirectionalLightIntensity = 5

export const HeadScalar = .0108;

export const CameraPos = { x: -.02999, y: 2.58, z: -.82 };
