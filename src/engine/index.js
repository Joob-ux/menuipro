// MenuiPro — point d'entrée du moteur
import { newCtx } from "./blocs.js";
import { RECIPES } from "./recettes.js";
import { computeHoles } from "./percages.js";

export { RECIPES, BIENTOT } from "./recettes.js";
export { pack, SHEET } from "./decoupe.js";
export { outils, vis } from "./outils.js";
export { holeLocal, HOLE_KINDS, computeHoles } from "./percages.js";

export function buildRecipe(id, p, opts) {
  const r = RECIPES.find(x => x.id === id);
  const c = newCtx(p);
  r.build(c, p, opts);
  computeHoles(c);
  return c;
}

