import type { ParametersGroup } from "three/examples/jsm/inspector/tabs/Parameters.js";
import { color, materialColor, mix, uniform } from "three/tsl";
import { Group, Mesh, MeshStandardNodeMaterial, Object3D } from "three/webgpu";
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
            console.log("\nMaterial wireframe to be toggled -> ", mat);
            console.log("\nWireframe state -> ", ev.value);
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

export function addTransformDebugInspector(
  inspector: ParametersGroup,
  obj: Object3D,
  debugProps: any,
  options?: {
    showRotation?: boolean;
    showScale?: boolean;
    posMin?: number;
    posMax?: number;
  }
) {
  let posMinimum: number = -10;
  let posMaximum: number = 10;
  if (options && options.posMin && options.posMax) {
    posMinimum = options.posMin;
    posMaximum = options.posMax;
  }

  inspector
    .add(obj.position, "x", posMinimum, posMaximum, 0.01)
    .name("Position X");
  inspector
    .add(obj.position, "y", posMinimum, posMaximum, 0.01)
    .name("Position Y");
  inspector
    .add(obj.position, "z", posMinimum, posMaximum, 0.01)
    .name("Position Z");

  if (options?.showRotation) {
    inspector
      .add(obj.rotation, "x", -Math.PI, Math.PI, 0.01)
      .name("Rotation X");
    inspector
      .add(obj.rotation, "y", -Math.PI, Math.PI, 0.01)
      .name("Rotation Y");
    inspector
      .add(obj.rotation, "z", -Math.PI, Math.PI, 0.01)
      .name("Rotation Z");
  }

  if (options?.showScale) {
    inspector
      .add({ scale: obj.scale.x }, "scale", 0.001, 1, 0.001)
      .name("Scale")
      .onChange((v) => obj.scale.setScalar(v));
  }

  // Toggle wireframe
  if ("isShowWireframe" in debugProps) {
    inspector
      .add(debugProps, "isShowWireframe")
      .name("Wireframe")
      .onChange((value) => {
        obj.traverse((m) => {
          if (m instanceof Mesh && "wireframe" in m.material) {
            m.material.wireframe = value;
          }
        });
      });
  }

  // Change color
  if ("color" in debugProps) {
    inspector
      .addColor(debugProps, "color")
      .name("Color")
      .onChange((value) => {
        obj.traverse((m) => {
          if (m instanceof Mesh && "color" in m.material) {
            m.material.color.set(value);
          }
        });
      });
  }

  // Toggle map in the material
  // if ("isShowMap" in debugProps) {
  //   inspector
  //     .add(debugProps, "isShowMap")
  //     .name("Map")
  //     .onChange((v) => {
  //       obj.traverse((m) => {
  //         if (
  //           m instanceof Mesh &&
  //           m.material instanceof MeshStandardNodeMaterial &&
  //           m.material.map instanceof Texture
  //         ) {
  //           console.log("\nMap Debug in Inspector Clicked!");
  //           // m.material.map = v ? m.material.map : WhiteTex;
  //           m.material.positionNode = positionLocal.add(vec3(0, 2, 0));
  //           m.material.colorNode = materialColor.mul(color("#f00"));
  //           console.log(
  //             "\nm.material.positionNode -> ",
  //             m.material.positionNode
  //           );
  //           console.log("\nm.material.colorNode -> ", m.material.colorNode);
  //         }
  //       });
  //     });
  // }

  const uniformIsShowMap = uniform(1);

  if ("isShowMap" in debugProps) {
    inspector
      .add(debugProps, "isShowMap")
      .name("Map")
      .onChange((v) => {
        uniformIsShowMap.value = v ? 1 : 0;
      });
  }

  obj.traverse((m) => {
    if (
      m instanceof Mesh &&
      m.material instanceof MeshStandardNodeMaterial
      // && m.material.map instanceof Texture
    ) {
      console.log("\nMap Debug in Inspector Clicked!");
      // m.material.map = v ? m.material.map : WhiteTex;
      // m.material.positionNode = positionLocal.add(vec3(0, 2, 0));
      // m.material.colorNode = materialColor.mul(color("#f00"));
      m.material.colorNode = mix(
        materialColor,
        color("#fff"),
        uniformIsShowMap
      );
      // console.log("\nm.material.positionNode -> ", m.material.positionNode);
      // console.log("\nm.material.colorNode -> ", m.material.colorNode);
    }
  });
}
