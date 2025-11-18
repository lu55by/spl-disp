import {
    Box3,
    BufferGeometry,
    Color,
    Group,
    Mesh,
    type MeshPhongMaterial,
    type NormalBufferAttributes,
    Object3D,
    Vector3
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {Brush} from "three-bvh-csg";
import {Colors, CutHeadDebugProps, UVCoordinateMod} from "../constants";

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

export function applyDebugTransformation(obj: Object3D, posOffset?: Vector3): void {
    const {x, y, z} = posOffset ? posOffset : new Vector3();
    obj.position.set(CutHeadDebugProps.Pos.x + x, CutHeadDebugProps.Pos.y + y, CutHeadDebugProps.Pos.z + z);
    obj.scale.setScalar(CutHeadDebugProps.Scalar);
}

/**
 * Modify the uv coordinates of the new vertices.
 * @param originalNode Original Node before csg operation.
 * @param cutObj Cut Object after csg operation.
 * @param offsetPositivePercentage 0 ~ 1 value of the positive offset of the uv start idx based on the original node vertices count.
 * @param offsetNegativePercentage 0 ~ 1 value of the negative offset of the uv start idx based on the original node vertices count.
 */
export function modifyNewVerticesUv(originalNode: Brush | Mesh, cutObj: Brush | Mesh, offsetPositivePercentage: number, offsetNegativePercentage: number): void {
    const originalNodeAttr = getAttributes(originalNode);
    // console.log('originalNode Geometry attributes before cut ->', originalNodeAttr)
    const finalCutObjAttr = getAttributes(cutObj);
    // console.log('cylinder cut cutHead geometry attributes -> ', cylCutHeadAttr)

    // Get the vertices count

    const orgCount = originalNodeAttr.uv!.count;
    const finalCount = finalCutObjAttr.uv!.count;
    const newVerticesCount = finalCount - orgCount
    // console.log('newVerticesCount ->', newVerticesCount)

    const orgCountOffsetPositive = Math.floor(newVerticesCount * offsetPositivePercentage);
    const orgCountOffsetNegative = Math.floor(orgCount * offsetNegativePercentage) * -1;
    // console.log('orgCountOffsetPositive -> ', orgCountOffsetPositive);
    // console.log('orgCountOffsetNegative -> ', orgCountOffsetNegative);

    const offsetCount = orgCount + orgCountOffsetPositive + orgCountOffsetNegative;
    // console.log('offsetCount -> ', offsetCount);


    // Update uv coordinates of the new vertices

    for (let i = offsetCount; i < finalCount; i++) {
        // const u = cylCutHeadAttr.uv!.getX(i)
        // const v = cylCutHeadAttr.uv!.getY(i)
        // if (i < 3) console.log(`uv of idx (${i}) -> [${u}, ${v}]`)
        finalCutObjAttr.uv!.setX(i, UVCoordinateMod.x);
        finalCutObjAttr.uv!.setY(i, UVCoordinateMod.y);
    }
    finalCutObjAttr.uv!.needsUpdate = true;
}


/**
 * Combines multiple meshes into a THREE.Group.
 *
 * @param name Optional name for the group.
 * @param meshes List of meshes to combine.
 * @returns THREE.Group containing all meshes.
 */
export function combineMeshesToGroup(
    name: string,
    ...meshes: Mesh[]
): Group {
    const group = new Group();
    group.name = name;

    for (const mesh of meshes) {
        // Avoid accidental re-parenting if mesh already has a parent
        if (mesh.parent) mesh.parent.remove(mesh);
        group.add(mesh);
    }

    return group;
}

/**
 * Scales all meshes inside a group to a final real-world height of 37mm.
 * The scaling is applied directly to geometry vertices (not mesh.scale).
 *
 * @param group Group containing meshes
 * @param targetHeight number (millimeters)
 */
export function scaleGroupToHeight(
    group: Group,
    targetHeight: number = 37
) {
    // -------------------------------
    // 1. Compute the current height
    // -------------------------------
    const groupBox = new Box3().setFromObject(group);
    const currentHeight = groupBox.max.y - groupBox.min.y;
    console.log('Grp height -> ', currentHeight);

    if (currentHeight === 0) {
        console.warn("Group has zero height; cannot scale.");
        return;
    }

    // Compute scale factor
    const scale = targetHeight / currentHeight;

    // -------------------------------
    // 2. Apply scaling to each mesh geometry
    // -------------------------------
    group.traverse((obj) => {
        if (obj instanceof Mesh && obj.geometry instanceof BufferGeometry) {
            const geom = obj.geometry;
            const pos = geom.attributes.position;

            for (let i = 0; i < pos.count; i++) {
                pos.setXYZ(
                    i,
                    pos.getX(i) * scale,
                    pos.getY(i) * scale,
                    pos.getZ(i) * scale
                );
            }

            pos.needsUpdate = true;

            // Recompute bounds
            geom.computeBoundingBox();
            geom.computeBoundingSphere();
        }
    });

    // -------------------------------
    // 3. Reset transforms to identity (VERY IMPORTANT)
    // -------------------------------
    group.scale.set(1, 1, 1);
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);

    console.log(`Group scaled by factor: ${scale}`);
}
