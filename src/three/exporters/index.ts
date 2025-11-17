import {OBJExporter} from "three/examples/jsm/exporters/OBJExporter.js";
import type {Material, Mesh} from "three";
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