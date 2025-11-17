import type {Material, Mesh} from "three";
import {Brush, Evaluator, HOLLOW_SUBTRACTION, SUBTRACTION} from "three-bvh-csg";

export function csgSubtract(obj2Cut: Mesh | Brush, cutter: Mesh | Brush, isHollowSub: boolean, material?: Material) {
    let csgEvaluator = new Evaluator();
    // csgEvaluator.attributes = ['position', 'normal'];
    // csgEvaluator.attributes = ['position', 'uv'];
    csgEvaluator.attributes = ['position', 'normal', 'uv'];
    csgEvaluator.useGroups = false;

    const brushObj2Cut = new Brush(obj2Cut.geometry, material || obj2Cut.material);
    brushObj2Cut.updateMatrixWorld();

    const brushCutter = new Brush(cutter.geometry, material || cutter.material);
    brushCutter.updateMatrixWorld();

    // console.log(brushObj2Cut, brushCutter)

    // return csgEvaluator.evaluate(brushObj2Cut, brushCutter, SUBTRACTION)
    // const rs = csgEvaluator.evaluate(brushObj2Cut, brushCutter, operation);
    const rs = csgEvaluator.evaluate(brushObj2Cut, brushCutter, isHollowSub ? HOLLOW_SUBTRACTION : SUBTRACTION);
    rs.updateMatrixWorld();
    return rs;
}
