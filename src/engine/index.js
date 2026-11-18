// MenuiPro — point d'entrée du moteur
import { newCtx } from "./blocs.js";
import { RECIPES } from "./recettes.js";
import "./rembourre.js"; // enregistre les meubles rembourrés dans RECIPES
import { computeHoles } from "./percages.js";
import { construireCroquis } from "./croquis.js";

// « Mon dessin » : meuble dessiné par le menuisier (voir croquis.js). Hors familles : il a son propre bouton.
RECIPES.push({ id: "croquis", nom: "Mon dessin", e: "✏️", cat: "Mes dessins", dessin: true, dims: [120, 200, 55], dimMin: [30, 30, 20],
  opts: [{ k: "croquis", label: "Mon dessin", croquis: true, def: null }], build: construireCroquis });

export { RECIPES, BIENTOT } from "./recettes.js";
export { pack, SHEET } from "./decoupe.js";
export { outils, vis } from "./outils.js";
export { SECTIONS_DEF, debitMassif, dimsMassif, choisirSection } from "./massif.js";
export { holeLocal, HOLE_KINDS, computeHoles } from "./percages.js";
export { vueFace } from "./facade.js";
export { TISSUS, teinte, COMPOSITIONS } from "./rembourre.js";
export { croquisDefaut, normaliserCroquis, lireTrait, appliquerTrait, appliquerOutil, deplacerLigne, bordsColonnes, bordsZones } from "./croquis.js";

export function buildRecipe(id, p, opts) {
  const r = RECIPES.find(x => x.id === id);
  const c = newCtx(p);
  r.build(c, p, opts);
  computeHoles(c);
  return c;
}

