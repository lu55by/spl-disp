import {Color, Group, Mesh, type MeshPhongMaterial, type NormalBufferAttributes, Object3D} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {Brush} from "three-bvh-csg";
import {Colors} from "../constants";

export function combineMeshes(meshes: Mesh[]) {
    const geometries = meshes.map(mesh => {
        const g = mesh.geometry.clone()
        // console.log(`Geometry of [${g.name}] -> `, g)
        g.applyMatrix4(mesh.matrixWorld)
        return g
    })
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries)
    const mesh0 = meshes[0] as Mesh
    return new Mesh(mergedGeometry, mesh0.material)
}

export function flattenMesh(mesh2Simplify: Mesh) {
    mesh2Simplify.updateMatrixWorld(true);
    mesh2Simplify.geometry.applyMatrix4(mesh2Simplify.matrixWorld);
    // mesh2Simplify.geometry.deleteAttribute('normal'); // optional
    // mesh2Simplify.geometry.deleteAttribute('uv');     // not needed for printing
    mesh2Simplify.position.set(0, 0, 0);
    mesh2Simplify.rotation.set(0, 0, 0);
    mesh2Simplify.scale.set(1, 1, 1)
}

export function getAttributes(mesh: Mesh): NormalBufferAttributes {
    return mesh.geometry.attributes;
}

export function applyGeometryScaling(mesh: Mesh | Brush, scale: number): void {
    mesh.geometry.scale(scale, scale, scale);
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
}

export function applyMaterialWireframe(obj: Object3D, color?: Color) {
    if (obj instanceof Group) obj.traverse(m => {
        if (m instanceof Mesh) {
            const mat = m.material as MeshPhongMaterial;
            mat.color = color || Colors.White;
            mat.wireframe = true;
        }
    })
    if (obj instanceof Mesh) {
        const mat = obj.material as MeshPhongMaterial;
        mat.color = color || Colors.White;
        mat.wireframe = true;
    }
}