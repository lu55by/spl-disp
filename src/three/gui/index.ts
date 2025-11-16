import GUI from "lil-gui";
import {Color, Mesh, type MeshPhongMaterial, Object3D} from "three";

/**
 * Add lil-gui controls to debug a obj's transform.
 * @param guiTitle Title of the gui.
 * @param gui - The lil-gui instance.
 * @param obj - The THREE.Mesh to debug.
 * @param wireframeColor - The Color of the wireframe.
 * @param options - Optional configuration.
 */
export function addTransformDebug(
    guiTitle: string,
    gui: GUI,
    obj: Object3D,
    wireframeColor: Color,
    options?: { showRotation?: boolean; showScale?: boolean }
) {
    const folder = gui.addFolder(obj.name || guiTitle)

    // --- Position controls ---
    const posFolder = folder.addFolder('Position')
    posFolder.add(obj.position, 'x', -10, 10, 0.01).name('X').onChange(() => obj.updateMatrixWorld())
    posFolder.add(obj.position, 'y', -10, 10, 0.01).name('Y').onChange(() => obj.updateMatrixWorld())
    posFolder.add(obj.position, 'z', -10, 10, 0.01).name('Z').onChange(() => obj.updateMatrixWorld())

    // --- Rotation controls ---
    if (options?.showRotation) {
        const rotFolder = folder.addFolder('Rotation')
        rotFolder.add(obj.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X')
        rotFolder.add(obj.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y')
        rotFolder.add(obj.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z')
    }

    // --- Scale controls ---
    if (options?.showScale) {
        const scaleFolder = folder.addFolder('Scale')
        // scaleFolder.add(obj.scale, 'x', 0.01, 10, 0.01).name('Scale X')
        // scaleFolder.add(obj.scale, 'y', 0.01, 10, 0.01).name('Scale Y')
        // scaleFolder.add(obj.scale, 'z', 0.01, 10, 0.01).name('Scale Z')

        // Store a local scalar value for GUI
        const scaleState = {
            scalar: obj.scale.x  // assumes uniform at start, safe for setScalar
        };

        scaleFolder
            .add(scaleState, "scalar", 0.001, .1, 0.0001)
            .name("uniformScale")
            .onChange((v: number) => {
                obj.scale.setScalar(v);
            });
    }

    // TODO: Fix the color.
    const wireframeState = {
        showWireframe: false,
    }
    folder.add(wireframeState, 'showWireframe')
        .name('Show Wireframe')
        .onChange((v: boolean) => {
            obj.traverse(m => {
                if (m instanceof Mesh) {
                    const mat = m.material as MeshPhongMaterial;
                    mat.color = wireframeColor;
                    mat.wireframe = v;
                }
            })
        })

    folder.open()
}




