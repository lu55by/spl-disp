import {OBJExporter} from "three/examples/jsm/exporters/OBJExporter.js";
import type {Material, Mesh, Object3D} from "three";
import * as THREE from "three";
import { flattenMesh } from "../meshOps";

export function exportMeshToOBJ(mesh: Mesh, baseName = "cutHead-exported") {
  const exporter = new OBJExporter();

  // console.log('Geometry Attributes -> ', mesh.geometry.attributes)
  const mesh2Flatten = mesh.clone();
  const clonedGeo = mesh.geometry.clone();
  const clonedMat = (mesh.material as Material).clone();
  mesh2Flatten.geometry = clonedGeo;
  mesh2Flatten.material = clonedMat;
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
  const blob = new Blob([objData], { type: "text/plain" });
  const link = document.createElement("a");
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

/**
 * Converts a Texture to a Blob (PNG)
 */
async function textureToBlob(texture: THREE.Texture): Promise<Blob | null> {
  if (!texture || !texture.image) return null;

  const image = texture.image as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  // Flip Y if needed (Three.js textures are often flipped)
  // if (texture.flipY) {
  //     ctx.translate(0, canvas.height);
  //     ctx.scale(1, -1);
  // }

  ctx.drawImage(image, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
}

/**
 * Connects to the File System Access API to save the files.
 * Exports:
 * 1. OBJ file
 * 2. MTL file
 * 3. Texture files (PNG)
 */
export async function exportSplicingGroup(
  group: Object3D,
  baseName: string = "splicing-group"
) {
  // 1. Ask user for directory
  // @ts-ignore - File System Access API
  const dirHandle = await window.showDirectoryPicker();
  if (!dirHandle) return;

  const exporter = new OBJExporter();

  // We will collect materials to generate MTL
  const materials = new Map<string, THREE.Material>();
  const texturesToSave = new Map<string, Blob>();

  // 2. clone the group to modify it if necessary (though we just read names)
  // Actually, we need to ensure unique material names if they aren't already.
  // The user ensured names are set in previous steps.

  const textureFileNames = new Map<string, string>(); // material.uuid -> filename.png

  // Traverse to find meshes and textures
  const promises: Promise<void>[] = [];

  group.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh;
      const material = mesh.material as Material;

      // Ensure material has a name
      if (!material.name) {
        material.name = `Mat_${mesh.name || mesh.id}`;
      }

      materials.set(material.name, material);

      // Check for map
      // Use 'any' cast to check for map property on generic Material
      const matAny = material as any;
      if (matAny.map && matAny.map.image) {
        const map = matAny.map as THREE.Texture;
        const texName = `${mesh.name}Color.png`;

        // Store mapping for MTL generation
        textureFileNames.set(material.name, texName);

        // Process texture to blob
        promises.push(
          (async () => {
            const blob = await textureToBlob(map);
            if (blob) {
              texturesToSave.set(texName, blob);
            }
          })()
        );
      }
    }
  });

  await Promise.all(promises);

  // 3. Generate OBJ
  let objContent = exporter.parse(group);

  // Prepend reference to MTL file
  const mtlFileName = `${baseName}.mtl`;
  objContent = `mtllib ${mtlFileName}\n` + objContent;

  // 4. Generate MTL Content
  let mtlContent = `# Generated by spl-disp\n`;
  materials.forEach((mat, name) => {
    mtlContent += `\nnewmtl ${name}\n`;
    // Basic colors
    // @ts-ignore
    if (mat.color) {
      // @ts-ignore
      const c = mat.color;
      mtlContent += `Kd ${c.r} ${c.g} ${c.b}\n`;
    } else {
      mtlContent += `Kd 1.0 1.0 1.0\n`;
    }

    // Specular
    // @ts-ignore
    if (mat.specular) {
      // @ts-ignore
      const s = mat.specular;
      mtlContent += `Ks ${s.r} ${s.g} ${s.b}\n`;
    }

    // Texture map
    const texFile = textureFileNames.get(name);
    if (texFile) {
      mtlContent += `map_Kd ${texFile}\n`;
    }
  });

  // 5. Write Files

  // Helper to write file
  const writeFile = async (filename: string, content: string | Blob) => {
    const fileHandle = await dirHandle.getFileHandle(filename, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  };

  try {
    // Write OBJ
    await writeFile(`${baseName}.obj`, objContent);

    // Write MTL
    await writeFile(mtlFileName, mtlContent);

    // Write Textures
    for (const [name, blob] of texturesToSave) {
      await writeFile(name, blob);
    }

    console.log("Export successful!");
    // We might want to show a toast here, but that's UI concern.
    // We can return true to indicate success.
    return true;
  } catch (err) {
    console.error("Error writing files", err);
    return false;
  }
}
