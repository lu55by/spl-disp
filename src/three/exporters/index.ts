import {OBJExporter} from "three/examples/jsm/exporters/OBJExporter.js";
import type {Material, Mesh, Object3D} from "three";
import {flattenMesh} from "../meshOps";

export function exportMeshToOBJ(mesh: Mesh, baseName = 'cutHead-exported') {
    const exporter = new OBJExporter();

    // console.log('Geometry Attributes -> ', mesh.geometry.attributes)
    const mesh2Flatten = mesh.clone()
    const clonedGeo = mesh.geometry.clone();
    const clonedMat = (mesh.material as Material).clone();
    mesh2Flatten.geometry = clonedGeo
    mesh2Flatten.material = clonedMat
    // Simplify the mesh
    // simplifyMesh(mesh)

    // Flatten transforms before export
    flattenMesh(mesh2Flatten);


    // console.log('After scale -> ', mesh2Simplify.geometry.attributes.position)

    const objData = exporter.parse(mesh2Flatten);

    // Generate a random 7-character string
    const randomId = Math.random().toString(36).substring(2, 9);

    // Create the full filename
    const filename = `${baseName}-${randomId}.obj`;

    // Create a Blob and download link
    const blob = new Blob([objData], {type: 'text/plain'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    URL.revokeObjectURL(link.href);

    return mesh2Flatten;
}

/**
 * Exports a THREE.Object3D as an OBJ file.
 *
 * @param object The THREE.Object3D to export.
 * @param baseName The base file name. Default = "cutHead-exported".
 */
export function exportObjectToOBJ(
    object: Object3D,
    baseName: string = "cutHead-exported"
) {
    const exporter = new OBJExporter();

    // Convert object to OBJ text
    const objText = exporter.parse(object);

    // Generate a random 7-character string
    const randomId = Math.random().toString(36).substring(2, 9);

    // Generate final file name
    const fileName = `${baseName}-${randomId}.obj`;

    // Create a Blob for downloading
    const blob = new Blob([objText], { type: "text/plain" });

    // Trigger browser download
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    // Cleanup
    URL.revokeObjectURL(link.href);
}