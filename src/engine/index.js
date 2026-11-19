// MenuiPro — point d'entrée du moteur
import { newCtx } from "./blocs.js";
import { RECIPES } from "./recettes.js";
import "./rembourre.js"; // enregistre les meubles rembourrés dans RECIPES
import { computeHoles } from "./percages.js";
import { construireCroquis } from "./croquis.js";
import { construireModele } from "./modele3d.js";

// « Mon dessin » : meuble dessiné par le menuisier (voir croquis.js). Hors familles : il a son propre bouton.
RECIPES.push({ id: "croquis", nom: "Mon dessin", e: "✏️", cat: "Mes dessins", dessin: true, dims: [120, 200, 55], dimMin: [30, 30, 20],
  opts: [{ k: "croquis", label: "Mon dessin", croquis: true, def: null }], build: construireCroquis });
// « Ma 3D » : découpe lue dans la 3D importée du menuisier (voir modele3d.js). Hors familles aussi.
RECIPES.push({ id: "modele3d", nom: "Ma 3D", e: "📤", cat: "Mes dessins", importe: true, dims: [100, 100, 50], dimMin: [10, 10, 5],
  opts: [{ k: "panneaux", label: "Panneaux lus dans la 3D", modele: true, def: null }], build: construireModele });

export { RECIPES, BIENTOT } from "./recettes.js";
export { pack, SHEET } from "./decoupe.js";
export { outils, vis } from "./outils.js";
export { SECTIONS_DEF, debitMassif, dimsMassif, choisirSection } from "./massif.js";
export { holeLocal, HOLE_KINDS, computeHoles } from "./percages.js";
export { vueFace } from "./facade.js";
export { TISSUS, teinte, COMPOSITIONS } from "./rembourre.js";
export { normaliserModele, etirerPanneau } from "./modele3d.js";
export { depuisLecture } from "./lecture.js";
export { hauteurSocle, croquisDefaut, normaliserCroquis, lireTrait, appliquerTrait, appliquerOutil, deplacerLigne, enleverLigne, bordsColonnes, bordsZones } from "./croquis.js";

export function buildRecipe(id, p, opts) {
  const r = RECIPES.find(x => x.id === id);
  const c = newCtx(p);
  r.build(c, p, opts);
  computeHoles(c);
  return c;
}

