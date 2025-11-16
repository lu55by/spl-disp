import {BufferGeometry, Material, Mesh, MeshPhongMaterial} from "three";

export type MeshOf<M extends Material> = Mesh<BufferGeometry, M>

export type PhongMesh = MeshOf<MeshPhongMaterial>