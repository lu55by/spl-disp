import { Group, Mesh, Object3D } from "three";
import type { FolderApi, Pane } from "tweakpane";

/**
 * Add tweakpane controls to debug a obj's transform.
 * @param guiTitle Title of the gui.
 * @param gui - The tweakpane instance.
 * @param obj - The THREE.Mesh to debug.
 * @param options - Optional configuration.
 */
export function addTransformDebug(
  guiTitle: string,
  gui: Pane | FolderApi,
  obj: Object3D,
  options?: {
    showRotation?: boolean;
    showScale?: boolean;
    posMin?: number;
    posMax?: number;
  }
) {
  // const folder = gui.addFolder({ title: obj.name || guiTitle });
  const folder = gui.addFolder({ title: guiTitle });

  let posMinimum: number = -10;
  let posMaximum: number = 10;
  if (options && options.posMin && options.posMax) {
    posMinimum = options.posMin;
    posMaximum = options.posMax;
  }

  // --- Position controls ---
  const posFolder = folder.addFolder({ title: "Position" });
  posFolder.addBinding(obj.position, "x", {
    min: posMinimum,
    max: posMaximum,
    step: 0.01,
    label: "X",
  });
  posFolder.addBinding(obj.position, "y", {
    min: posMinimum,
    max: posMaximum,
    step: 0.01,
    label: "Y",
  });
  posFolder.addBinding(obj.position, "z", {
    min: posMinimum,
    max: posMaximum,
    step: 0.01,
    label: "Z",
  });

  posFolder.on("change", () => obj.updateMatrixWorld());

  // --- Rotation controls ---
  if (options?.showRotation) {
    const rotFolder = folder.addFolder({ title: "Rotation" });
    rotFolder.addBinding(obj.rotation, "x", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
      label: "Rot X",
    });
    rotFolder.addBinding(obj.rotation, "y", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
      label: "Rot Y",
    });
    rotFolder.addBinding(obj.rotation, "z", {
      min: -Math.PI,
      max: Math.PI,
      step: 0.01,
      label: "Rot Z",
    });
  }

  // --- Scale controls ---
  if (options?.showScale) {
    const scaleFolder = folder.addFolder({ title: "Scale" });

    // Store a local scalar value for GUI
    const scaleState = {
      scalar: obj.scale.x, // assumes uniform at start, safe for setScalar
    };

    scaleFolder
      .addBinding(scaleState, "scalar", {
        min: 0.001,
        max: 1,
        step: 0.0001,
        label: "uniformScale",
      })
      .on("change", (ev) => {
        obj.scale.setScalar(ev.value);
      });
  }

  if (obj instanceof Group) {
    const wireframeState = {
      showWireframe: false,
    };
    folder
      .addBinding(wireframeState, "showWireframe", { label: "Show Wireframe" })
      .on("change", (ev) => {
        obj.traverse((m) => {
          if (m instanceof Mesh) {
            const mat = m.material;
            // Check if material is an array or single
            if (Array.isArray(mat)) {
              mat.forEach((material) => {
                if ("wireframe" in material) {
                  material.wireframe = ev.value;
                }
              });
            } else if ("wireframe" in mat) {
              mat.wireframe = ev.value;
            }
          }
        });
      });
  }
}
