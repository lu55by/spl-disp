import type { Material, Mesh, Object3D } from "three";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { flattenMesh } from "../meshOps";

export function exportMeshToOBJ(mesh: Mesh, baseName = "cutHead-exported") {
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

  // const objData = OBJExporterInstance.parse(mesh2Flatten);
  const objData = parseObjectToOptimizedOBJ(mesh2Flatten);

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
  // Convert object to OBJ text
  const objText = parseObjectToOptimizedOBJ(object);

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
 * Exports a THREE.Object3D as a Blob (OBJ format).
 * @param object The THREE.Object3D to export.
 * @returns A Blob containing the OBJ text.
 */
export function exportObjectToBlob(object: Object3D): Blob {
  const objText = parseObjectToOptimizedOBJ(object);
  return new Blob([objText], { type: "text/plain" });
}

/**
 * Converts a map Texture to a Blob (PNG)
 */
export async function mapTexToBlob(
  texture: THREE.Texture
): Promise<Blob | null> {
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

import JSZip from "jszip";
import { OBJExporterInstance } from "../constants";

/**
 * Connects to the File System Access API to save the files.
 * Exports:
 * 1. OBJ file
 * 2. MTL file
 * 3. Texture files (PNG)
 * Packs everything into a ZIP file.
 */
export async function exportSplicingGroup(group: Object3D): Promise<boolean> {
  const zip = new JSZip();

  // We will collect materials to generate MTL
  const materials = new Map<string, THREE.Material>();
  const textureFileNames = new Map<string, string>(); // material.name -> filename.png

  // Generate random ID for filenames
  const uuid = Math.random().toString(36).substring(2, 10);
  const baseName = `spl_disp_exported_models_${uuid}`;

  // Traverse to find meshes and textures
  const texturePromises: Promise<void>[] = [];

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

        // Process texture to blob and add to zip
        texturePromises.push(
          (async () => {
            const blob = await mapTexToBlob(map);
            if (blob) {
              zip.file(texName, blob);
            }
          })()
        );
      }
    }
  });

  await Promise.all(texturePromises);

  // 3. Generate OBJ
  let objContent = parseObjectToOptimizedOBJ(group);

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

  // Add OBJ, MTL to zip
  zip.file(`${baseName}.obj`, objContent);
  zip.file(mtlFileName, mtlContent);

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: {
      level: 5,
    },
  });
  const zipFileName = `${baseName}.zip`;

  // Save ZIP file
  // Try File System Access API first
  try {
    // @ts-ignore
    const handle = await window.showSaveFilePicker({
      suggestedName: zipFileName,
      types: [
        {
          description: "ZIP Archive",
          accept: { "application/zip": [".zip"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(zipBlob);
    await writable.close();
    return true;
  } catch (err) {
    // Fallback to standard download if user cancels or API not supported/allowed
    if ((err as Error).name !== "AbortError") {
      console.warn(
        "File System Access API failed, falling back to download anchor",
        err
      );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      link.click();
      URL.revokeObjectURL(link.href);
      return true;
    }
    // If user aborted, treat as "failed" or just return false/undefined
    console.log("Save cancelled");
    return false;
  }
}

/**
 * Internal helper to parse an object to OBJ with optimizations:
 * 1. Merges vertices to re-index geometry (reduces size if de-indexed).
 * 2. Truncates floating point precision in the resulting string.
 */
function parseObjectToOptimizedOBJ(object: Object3D): string {
  // Clone to avoid side effects on the original scene objects
  const cloned = object.clone();

  cloned.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh;
      // mergeVertices can significantly reduce vertex count by sharing identical vertices
      mesh.geometry = BufferGeometryUtils.mergeVertices(mesh.geometry);
      // Delete the normal attribute to reduce file size
      mesh.geometry.deleteAttribute("normal");
    }
  });

  console.log("\n -- parseObjectToOptimizedOBJ -- Optimized OBJ ->", cloned);

  let objText = OBJExporterInstance.parse(cloned);

  // Truncate floating point precision to 6 decimal places.
  // This drastically reduces file size for text-based formats like OBJ.
  objText = objText.replace(/(\d+\.\d{4})\d+/g, "$1");

  return objText;
}
