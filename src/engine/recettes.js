// MenuiPro — recettes de meubles
import { add, add3d, hw, caisse, portes, plateau, panneauV, voile, piedsAchetes, planTravail, lit, armoire, G } from "./blocs.js";

/* ===================== RECETTES ===================== */
export const RECIPES = [];
export const rec = r => RECIPES.push(r);
export const stp = (k, label, icon, def, min, max, step = 1) => ({ k, label, icon, def, min, max, step });
export const chx = (k, label, options, def) => ({ k, label, options, def, choice: true });
export const TYPE_PORTE = chx("type", "Type de portes", [["battante", "Battantes"], ["coulissante", "Coulissantes"], ["vitree", "Vitrées"]], "battante");

/* ----- Bureau ----- */
rec({ id: "bureau-simple", nom: "Bureau simple", e: "🖥️", cat: "Bureau", dims: [120, 75, 60], opts: [], build(c, p) {
  const E = c.E; plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  panneauV(c, "Pied gauche", 0, 0, 0, p.H - E, p.P); panneauV(c, "Pied droit", p.L - E, 0, 0, p.H - E, p.P);
  voile(c, "Voile de fond", E, p.H - E - 350, 40, p.L - 2 * E, 350);
} });
rec({ id: "bureau-tiroirs", nom: "Bureau avec tiroirs", e: "🗄️", cat: "Bureau", dims: [140, 75, 65], opts: [stp("tiroirs", "Tiroirs", "🗄️", 3, 1, 4)], build(c, p, o) {
  const E = c.E, CW = 440; plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  panneauV(c, "Pied gauche", 0, 0, 0, p.H - E, p.P);
  voile(c, "Voile de fond", E, p.H - E - 350, 40, p.L - CW - E, 350);
  caisse(c, p.L - CW, 0, 0, CW, p.H - E, p.P, { nom: "Caisson", dessus: false, dos: false, socle: 80, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
} });
rec({ id: "bureau-angle", nom: "Bureau d'angle (en L)", e: "📐", cat: "Bureau", dims: [160, 75, 60], opts: [stp("retour", "Retour (cm)", "↪️", 120, 80, 200, 10), stp("tiroirs", "Tiroirs", "🗄️", 0, 0, 4)], build(c, p, o) {
  const E = c.E, R = o.retour * 10;
  plateau(c, "Plateau principal", 0, p.H - E, 0, p.L, p.P);
  plateau(c, "Plateau retour", p.L - p.P, p.H - E, p.P, p.P, R - p.P);
  panneauV(c, "Pied gauche", 0, 0, 0, p.H - E, p.P);
  add(c, "Pied du retour", "caisson", [p.L - p.P, 0, R - E, p.P, p.H - E, E], { edge: p.H - E });
  voile(c, "Voile de fond", E, p.H - E - 350, 40, p.L - 2 * E, 350);
  add(c, "Voile du retour", "caisson", [p.L - E - 40, p.H - E - 350, p.P, E, 350, R - p.P - E], { edge: 0 });
  if (o.tiroirs) caisse(c, p.L - 440, 0, 0, 440, p.H - E, p.P, { nom: "Caisson", dessus: false, dos: false, socle: 80, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
  else panneauV(c, "Pied d'angle", p.L - E, 0, 0, p.H - E, p.P);
} });
rec({ id: "bureau-direction", nom: "Bureau de direction", e: "👔", cat: "Bureau", dims: [180, 76, 85], opts: [stp("tiroirs", "Tiroirs (droite)", "🗄️", 3, 1, 4)], build(c, p, o) {
  const E = c.E, CW = 450;
  plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  caisse(c, 0, 0, 0, CW, p.H - E, p.P, { nom: "Caisson gauche", dessus: false, dos: false, socle: 60, colonnes: [[{ t: "etageres", n: 1, portes: { n: 1 } }]] });
  caisse(c, p.L - CW, 0, 0, CW, p.H - E, p.P, { nom: "Caisson droit", dessus: false, dos: false, socle: 60, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
  voile(c, "Voile de façade", CW, p.H - E - 450, 0, p.L - 2 * CW, 450);
} });
rec({ id: "caisson-tiroirs", nom: "Caisson à tiroirs", e: "🗃️", cat: "Bureau", dims: [42, 60, 55], opts: [stp("tiroirs", "Tiroirs", "🗄️", 3, 1, 5)], build(c, p, o) {
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 50, dos: false, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
  hw(c, "roulettes", "🛞", "Roulettes", 4);
} });
rec({ id: "armoire-bureau", nom: "Armoire de bureau", e: "🗂️", cat: "Bureau", dims: [90, 200, 42], opts: [stp("portes", "Portes", "🚪", 2, 1, 4), stp("etageres", "Étagères", "📚", 4, 0, 8)], build(c, p, o) { armoire(c, p, { portes: o.portes, etageres: o.etageres, socle: 60 }); } });
rec({ id: "bibliotheque", nom: "Bibliothèque / étagère", e: "📚", cat: "Bureau", dims: [90, 180, 32], opts: [stp("etageres", "Étagères", "📚", 4, 0, 8), stp("colonnes", "Colonnes", "▥", 1, 1, 4), stp("bas", "Portes en bas", "🚪", 0, 0, 1)], build(c, p, o) {
  const cols = [];
  for (let k = 0; k < o.colonnes; k++) cols.push(o.bas ? [{ t: "etageres", n: 1, h: p.H * 0.33, portes: { n: 1 } }, { t: "etageres", n: Math.max(0, o.etageres - 1) }] : [{ t: "etageres", n: o.etageres }]);
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 50, colonnes: cols });
} });
rec({ id: "table-reunion", nom: "Table de réunion", e: "🤝", cat: "Bureau", dims: [240, 75, 110], opts: [], build(c, p) {
  const E = c.E; plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  panneauV(c, "Pied gauche", 250, 0, 150, p.H - E, p.P - 300); panneauV(c, "Pied droit", p.L - 250 - E, 0, 150, p.H - E, p.P - 300);
  voile(c, "Voile central", 250 + E, p.H - E - 300, p.P / 2 - E / 2, p.L - 500 - 2 * E, 300);
} });
rec({ id: "comptoir-accueil", nom: "Comptoir d'accueil", e: "🛎️", cat: "Bureau", dims: [180, 110, 60], opts: [stp("etageres", "Étagères (côté agent)", "📚", 1, 0, 3)], build(c, p, o) {
  const E = c.E;
  caisse(c, 0, 0, 0, p.L, p.H - E, p.P, { socle: 0, dos: false, facadeArriere: false, colonnes: [[{ t: "etageres", n: o.etageres }]] });
  add(c, "Façade visiteurs", "caisson", [0, 0, p.P, p.L, p.H - E, E], { edge: 2 * p.L + 2 * p.H });
  plateau(c, "Plateau d'accueil", -30, p.H - E, 0, p.L + 60, p.P + 120);
} });
rec({ id: "table-banc", nom: "Table-banc d'école", e: "🏫", cat: "Bureau", dims: [120, 75, 40], opts: [], build(c, p) {
  const E = c.E;
  plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  plateau(c, "Assise du banc", 0, 430, p.P + 200, p.L, 300);
  [0, p.L - E].forEach((x, i) => { panneauV(c, "Pied table " + (i ? "D" : "G"), x, 0, 0, p.H - E, p.P); panneauV(c, "Pied banc " + (i ? "D" : "G"), x, 0, p.P + 200, 430, 300); add(c, "Longeron " + (i ? "D" : "G"), "caisson", [x + (i ? -E : E), 100, p.P - 50, E, 80, 300], { edge: 0 }); });
  voile(c, "Voile de table", E, p.H - E - 250, 30, p.L - 2 * E, 250);
} });

/* ----- Chambre ----- */
export const DIMS_LIT = ["Largeur matelas", "Hauteur tête de lit", "Longueur matelas"];
rec({ id: "lit-simple", nom: "Lit simple", e: "🛏️", cat: "Chambre", dims: [90, 100, 190], dimLabels: DIMS_LIT, opts: [], build(c, p) { lit(c, p); } });
rec({ id: "lit-double", nom: "Lit double", e: "🛏️", cat: "Chambre", dims: [160, 110, 200], dimLabels: DIMS_LIT, opts: [], build(c, p) { lit(c, p); } });
rec({ id: "lit-tiroirs", nom: "Lit avec tiroirs", e: "🛏️", cat: "Chambre", dims: [140, 110, 190], dimLabels: DIMS_LIT, opts: [stp("tiroirs", "Tiroirs par côté", "🗄️", 2, 1, 3)], build(c, p, o) { lit(c, p, { tiroirs: o.tiroirs }); } });
rec({ id: "chevet", nom: "Table de chevet", e: "🌙", cat: "Chambre", dims: [45, 55, 40], opts: [stp("tiroirs", "Tiroirs", "🗄️", 1, 1, 3)], build(c, p, o) {
  const zones = o.tiroirs >= 2 ? [{ t: "tiroirs", n: o.tiroirs }] : [{ t: "niche" }, { t: "tiroirs", n: 1, h: 160 }];
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 60, colonnes: [zones] });
} });
// Une seule armoire dans le catalogue : 2, 3 ou 4 portes battantes, ou 2 portes coulissantes.
// (« armoire-34 » et « armoire-coulissante » restent cachées pour les anciens projets et les modèles KILIFEU.)
rec({ id: "armoire-2", nom: "Armoire", e: "🚪", cat: "Chambre", dims: [100, 200, 58], opts: [chx("type", "Portes", [["battantes", "🚪 Battantes"], ["coulissantes", "↔️ Coulissantes"]], "battantes"), { ...stp("portes", "Nombre de portes", "🚪", 2, 2, 4), si: o => o.type !== "coulissantes" }, stp("etageres", "Étagères", "📚", 3, 0, 8), stp("penderie", "Penderie", "👔", 0, 0, 1), { ...stp("tiroirs", "Tiroirs en bas", "🗄️", 0, 0, 2), si: o => o.type !== "coulissantes" }], build(c, p, o) {
  if (o.type === "coulissantes") armoire(c, p, { portes: 2, type: "coulissante", etageres: o.etageres, penderie: o.penderie });
  else armoire(c, p, { portes: o.portes || 2, etageres: o.etageres, penderie: o.penderie, tiroirs: o.tiroirs });
} });
rec({ id: "armoire-34", nom: "Armoire 3 ou 4 portes", e: "🚪", cat: "Chambre", cache: true, dims: [160, 210, 58], opts: [stp("portes", "Portes", "🚪", 3, 3, 4), stp("etageres", "Étagères", "📚", 4, 0, 8), stp("penderie", "Penderie", "👔", 1, 0, 1), stp("tiroirs", "Tiroirs en bas", "🗄️", 0, 0, 2)], build(c, p, o) { armoire(c, p, { portes: o.portes, etageres: o.etageres, penderie: o.penderie, tiroirs: o.tiroirs }); } });
rec({ id: "armoire-coulissante", nom: "Armoire portes coulissantes", e: "↔️", cat: "Chambre", cache: true, dims: [180, 220, 62], opts: [stp("etageres", "Étagères", "📚", 4, 0, 8), stp("penderie", "Penderie", "👔", 1, 0, 1)], build(c, p, o) { armoire(c, p, { portes: 2, type: "coulissante", etageres: o.etageres, penderie: o.penderie }); } });
rec({ id: "dressing", nom: "Dressing", e: "👗", cat: "Chambre", dims: [240, 230, 58], opts: [stp("colonnes", "Colonnes", "▥", 3, 2, 5), stp("tiroirs", "Tiroirs (1re colonne)", "🗄️", 3, 0, 5)], build(c, p, o) {
  const cols = [];
  for (let k = 0; k < o.colonnes; k++) {
    if (k === 0) cols.push(o.tiroirs ? [{ t: "tiroirs", n: o.tiroirs, h: o.tiroirs * 170 }, { t: "penderie", n: 1 }] : [{ t: "penderie", n: 1 }]);
    else if (k % 2 === 1) cols.push([{ t: "etageres", n: 6 }]);
    else cols.push([{ t: "penderie", n: 0, h: p.H * 0.45 }, { t: "penderie", n: 1 }]);
  }
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 80, colonnes: cols });
} });
rec({ id: "commode", nom: "Commode", e: "🗄️", cat: "Chambre", dims: [100, 85, 45], opts: [stp("tiroirs", "Tiroirs par colonne", "🗄️", 4, 2, 6), stp("colonnes", "Colonnes", "▥", 1, 1, 2)], build(c, p, o) {
  const cols = []; for (let k = 0; k < o.colonnes; k++) cols.push([{ t: "tiroirs", n: o.tiroirs }]);
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 70, colonnes: cols });
} });
rec({ id: "coiffeuse", nom: "Coiffeuse", e: "🪞", cat: "Chambre", dims: [110, 76, 45], opts: [stp("tiroirs", "Tiroirs", "🗄️", 3, 1, 4)], build(c, p, o) {
  const E = c.E, CW = 400; plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  caisse(c, 0, 0, 0, CW, p.H - E, p.P, { nom: "Caisson", dessus: false, dos: false, socle: 60, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
  panneauV(c, "Pied droit", p.L - E, 0, 0, p.H - E, p.P);
  voile(c, "Voile de fond", CW, p.H - E - 300, 30, p.L - CW - E, 300);
  add3d(c, "mirror", [p.L / 2 - 300, p.H + 20, 30, 600, 800, 6]);
  hw(c, "miroir", "🪞", "Miroir 60 × 80 cm", 1);
} });

/* ----- Salon ----- */
rec({ id: "meuble-tv", nom: "Meuble TV", e: "📺", cat: "Salon", dims: [180, 50, 45], opts: [stp("tiroirs", "Tiroirs au centre", "🗄️", 1, 0, 2), TYPE_PORTE], build(c, p, o) {
  const mid = o.tiroirs ? [{ t: "tiroirs", n: o.tiroirs, h: o.tiroirs * 150 }, { t: "niche" }] : [{ t: "etageres", n: 1 }];
  const side = [{ t: "etageres", n: 1, portes: { n: 1, type: o.type === "coulissante" ? "battante" : o.type } }];
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 60, colonnes: [side, mid, side] });
} });
rec({ id: "table-basse", nom: "Table basse", e: "☕", cat: "Salon", dims: [110, 45, 60], opts: [stp("tablette", "Tablette basse", "▭", 1, 0, 1)], build(c, p, o) {
  const E = c.E; plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  panneauV(c, "Pied gauche", 60, 0, 0, p.H - E, p.P); panneauV(c, "Pied droit", p.L - 60 - E, 0, 0, p.H - E, p.P);
  if (o.tablette) plateau(c, "Tablette basse", 60 + E, 80, 0, p.L - 120 - 2 * E, p.P, p.L);
  else voile(c, "Voile", 60 + E, p.H - E - 120, p.P / 2, p.L - 120 - 2 * E, 120);
} });
rec({ id: "vitrine", nom: "Vitrine", e: "🏺", cat: "Salon", dims: [90, 190, 40], opts: [stp("etageres", "Étagères vitrées", "📚", 3, 1, 6)], build(c, p, o) {
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 60, colonnes: [[{ t: "etageres", n: 1, h: p.H * 0.3, portes: { n: 2 } }, { t: "etageres", n: o.etageres, portes: { n: 2, type: "vitree" } }]] });
} });
rec({ id: "buffet", nom: "Buffet / bahut", e: "🍽️", cat: "Salon", dims: [160, 90, 45], opts: [stp("colonnes", "Colonnes", "▥", 3, 2, 4), stp("tiroirs", "Rangée de tiroirs", "🗄️", 1, 0, 1)], build(c, p, o) {
  const cols = []; for (let k = 0; k < o.colonnes; k++) cols.push(o.tiroirs ? [{ t: "etageres", n: 1, portes: { n: 1 } }, { t: "tiroirs", n: 1, h: 150 }] : [{ t: "etageres", n: 1, portes: { n: 1 } }]);
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 80, colonnes: cols });
} });
rec({ id: "etagere-murale", nom: "Étagère murale", e: "🧱", cat: "Salon", dims: [100, 80, 25], opts: [stp("etageres", "Étagères", "📚", 2, 0, 5), stp("colonnes", "Colonnes", "▥", 1, 1, 3)], build(c, p, o) {
  const cols = []; for (let k = 0; k < o.colonnes; k++) cols.push([{ t: "etageres", n: o.etageres }]);
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 0, colonnes: cols });
  hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4);
} });
rec({ id: "table-manger", nom: "Table à manger", e: "🍽️", cat: "Salon", dims: [160, 75, 90], opts: [chx("pieds", "Pieds", [["panneau", "En panneau"], ["achetes", "Pieds achetés"]], "panneau")], build(c, p, o) {
  const E = c.E; plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  if (o.pieds === "achetes") { piedsAchetes(c, [[80, 80], [p.L - 80, 80], [80, p.P - 80], [p.L - 80, p.P - 80]], p.H - E); add(c, "Ceinture avant", "caisson", [80, p.H - E - 100, 60, p.L - 160, 100, E]); add(c, "Ceinture arrière", "caisson", [80, p.H - E - 100, p.P - 60 - E, p.L - 160, 100, E]); }
  else { panneauV(c, "Pied gauche", 200, 0, 100, p.H - E, p.P - 200); panneauV(c, "Pied droit", p.L - 200 - E, 0, 100, p.H - E, p.P - 200); voile(c, "Voile central", 200 + E, p.H - E - 250, p.P / 2, p.L - 400 - 2 * E, 250); }
} });

/* ----- Cuisine ----- */
/* Système de caisson bas unique (le même pour toutes les cuisines, seule la largeur change) :
   - hauteur 82 cm = caisson 72 cm + socle 10 cm ; les côtés descendent jusqu'au sol, plinthe en retrait ;
   - profondeur 46 cm façades comprises (corps = 46 cm − épaisseur de la porte) ;
   - pas de dessus : deux traverses de 10 cm (avant et arrière) tiennent le plan de travail ;
   - dos 5 mm, une étagère, 2 portes (1 seule sous 45 cm de large).
   Le plan de travail (38 mm) se pose au-dessus des 82 cm. */
export const CAISSON_BAS = { H: 820, P: 460, socle: 100, traverse: 100, plan: 500 };
export const PDT_CUISINE = 38;
export const HAUT_FINI = CAISSON_BAS.H + PDT_CUISINE; // dessus du plan de travail
export const profCorps = c => CAISSON_BAS.P - c.E;
export const portesCaisson = W => (W >= 450 ? 2 : 1);
// Sans dessus, les façades (portes, tiroirs) dépasseraient de E/2 en haut : on les descend pour qu'elles
// couvrent exactement du socle jusqu'au haut du caisson (82 cm).
export function recalerFacades(c, debut) {
  const d = c.E / 2;
  for (const p of c.parts.slice(debut)) {
    if (!(p.door || p.drawer) || !p.box) continue;
    p.box = p.box.slice(); p.box[1] -= d;
    for (const h of p.holes || []) h.p = [h.p[0], h.p[1] - d, h.p[2]];
    if (p.tiroir) p.tiroir = { ...p.tiroir, y: p.tiroir.y - d };
  }
}
export function traversesHaut(c, x, W, H, D, nm) {
  recalerFacades(c, c._debutCaisson ?? 0); delete c._debutCaisson;
  const E = c.E, T = CAISSON_BAS.traverse;
  add(c, nm + "Traverse avant", "caisson", [x + E, H - E, D - T, W - 2 * E, E, T], { edge: W - 2 * E });
  add(c, nm + "Traverse arrière", "caisson", [x + E, H - E, 0, W - 2 * E, E, T], { edge: 0 });
}
export function basCuisine(c, x, W, o = {}) {
  const { H, socle } = CAISSON_BAS, D = profCorps(c), np = portesCaisson(W);
  const zones = o.tiroirs >= 2 ? [{ t: "tiroirs", n: o.tiroirs }] : o.tiroirs === 1 ? [{ t: "etageres", n: 1, portes: { n: np } }, { t: "tiroirs", n: 1, h: 150 }] : [{ t: "etageres", n: 1, portes: { n: np } }];
  c._debutCaisson = c.parts.length;
  caisse(c, x, 0, 0, W, H, D, { nom: o.nom, socle, dessus: false, colonnes: [zones] });
  traversesHaut(c, x, W, H, D, o.nom ? o.nom + " · " : "");
}
export function hautCuisine(c, x, W, nom, y = 1450, H = 700, D = 330) {
  caisse(c, x, y, 0, W, H, D, { nom, colonnes: [[{ t: "etageres", n: H >= 600 ? 1 : 0, portes: { n: W > 600 ? 2 : 1 } }]] });
  hw(c, "fixhaut", "🔩", "Fixations meubles hauts", 2);
}
/* Caisson évier : même système, mais sans dos ni étagère (passage des tuyaux et du siphon).
   L'évier se pose dans une découpe du plan de travail. */
export function evierCuisine(c, x, W, o = {}) {
  const { H, socle } = CAISSON_BAS, D = profCorps(c), nm = (o.nom || "Évier") + " · ";
  c._debutCaisson = c.parts.length;
  caisse(c, x, 0, 0, W, H, D, { nom: o.nom || "Évier", socle, dessus: false, dos: false, colonnes: [[{ t: "etageres", n: 0, portes: { n: portesCaisson(W) } }]] });
  traversesHaut(c, x, W, H, D, nm);
  // Évier, robinet et évacuation : visibles en 3D, comptés dans la liste d'achat.
  const bacs = W >= 1000 ? 2 : 1, lb = Math.min(W - 160, bacs === 2 ? 860 : 500), y = HAUT_FINI;
  for (let b = 0; b < bacs; b++) add3d(c, "metal", [x + (W - lb) / 2 + b * (lb / bacs) + 10, y - 2, 80, lb / bacs - 20, 6, Math.min(340, D - 100)]);
  add3d(c, "metal", [x + W / 2 - 15, y, 30, 30, 260, 30]);
  add3d(c, "metal", [x + W / 2 - 12, y + 230, 30, 24, 24, 170]);
  hw(c, "evier", "🚰", bacs === 2 ? "Évier inox 2 bacs" : "Évier inox 1 bac", 1);
  hw(c, "robinet", "🚿", "Robinet mitigeur d'évier", 1);
  hw(c, "siphon", "🔧", "Siphon + bonde d'évier", 1);
  hw(c, "silicone", "🧴", "Silicone sanitaire (joint évier)", 1, "tube");
  hw(c, "decoupe", "🪚", "Découpe de l'évier dans le plan de travail", 1);
}
// Cotes affichées pour les caissons bas : seule la largeur se règle.
export const DIMS_CAISSON = { fixes: [false, true, true], dimLabels: ["Largeur du caisson", "Hauteur (fixe)", "Profondeur façades comprises (fixe)"] };

/* Cuisine en caissons : la longueur est partagée en modules d'environ 60 cm autour du caisson évier.
   Renvoie la liste des modules [{ x, W, type }] (utile aux tests et au dessin). */
export function modulesCuisine(L, o) {
  const We = Math.min(Number(o.evier) || 1000, Math.max(600, L - 300));
  const reste = Math.max(0, L - We);
  let partage = o.position === "gauche" ? [0, reste] : o.position === "droite" ? [reste, 0] : [Math.floor(reste / 2 / 10) * 10, reste - Math.floor(reste / 2 / 10) * 10];
  // Cuisine courte : pas la place d'un caisson de chaque côté → un seul caisson, à droite de l'évier.
  if (o.position !== "gauche" && o.position !== "droite" && partage[0] < 300 && reste >= 300) partage = [0, reste];
  const cote = l => { if (l < 300) return []; const n = Math.max(1, Math.round(l / 600)); return Array(n).fill(l / n); };
  const gauche = cote(partage[0]), droite = cote(partage[1]);
  // Un petit reste (< 30 cm) agrandit l'évier plutôt que de laisser un trou.
  const WeR = We + (partage[0] < 300 ? partage[0] : 0) + (partage[1] < 300 ? partage[1] : 0);
  const mods = []; let x = 0;
  gauche.forEach(W => { mods.push({ x, W, type: "bas" }); x += W; });
  mods.push({ x, W: WeR, type: "evier" }); x += WeR;
  droite.forEach(W => { mods.push({ x, W, type: "bas" }); x += W; });
  // Les modules à tiroirs se placent juste à côté de l'évier (droite d'abord, puis gauche).
  const ie = mods.findIndex(m => m.type === "evier"), ordre = [];
  for (let d = 1; d < mods.length; d++) { if (mods[ie + d]) ordre.push(ie + d); if (mods[ie - d]) ordre.push(ie - d); }
  ordre.slice(0, o.tiroirs || 0).forEach(i => mods[i].type = "tiroirs");
  return mods;
}
rec({ id: "cuisine-bas", nom: "Caisson bas de cuisine", e: "🧽", cat: "Cuisine", dims: [60, 82, 46], dimMin: [30, 82, 46], ...DIMS_CAISSON, opts: [stp("tiroirs", "Tiroirs", "🗄️", 0, 0, 4)], build(c, p, o) { basCuisine(c, 0, p.L, { tiroirs: o.tiroirs }); planTravail(c, 0, CAISSON_BAS.H, 0, p.L, CAISSON_BAS.plan); } });
rec({ id: "cuisine-haut", nom: "Caisson haut de cuisine", e: "⬆️", cat: "Cuisine", dims: [80, 70, 33], opts: [stp("etageres", "Étagères", "📚", 1, 0, 3)], build(c, p, o) {
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { colonnes: [[{ t: "etageres", n: o.etageres, portes: { n: p.L > 600 ? 2 : 1 } }]] }); hw(c, "fixhaut", "🔩", "Fixations meubles hauts", 2);
} });
rec({ id: "cuisine-colonne", nom: "Caisson colonne (frigo, four)", e: "🧊", cat: "Cuisine", dims: [60, 215, 58], opts: [chx("usage", "Usage", [["four", "Four + rangement"], ["rangement", "Rangement"]], "four")], build(c, p, o) {
  const zones = o.usage === "four" ? [{ t: "etageres", n: 1, h: 700, portes: { n: 1 } }, { t: "niche", h: 600 }, { t: "etageres", n: 1, portes: { n: 1 } }] : [{ t: "etageres", n: 2, portes: { n: 1 } }, { t: "etageres", n: 1, h: 600, portes: { n: 1 } }];
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 100, colonnes: [zones] });
} });
rec({ id: "cuisine-complete", nom: "Cuisine en caissons (évier au milieu)", e: "🍳", cat: "Cuisine", cache: true, dims: [300, 220, 60], dimMin: [120, 150, 50], dimLabels: ["Longueur totale", "Hauteur jusqu'en haut", "Profondeur"], // cachée : remplacée par « Cuisine en I ou en L » (cuisine.js), gardée pour les anciens projets
  opts: [chx("position", "Place de l'évier", [["milieu", "🚰 Au milieu"], ["gauche", "⬅️ À gauche"], ["droite", "➡️ À droite"]], "milieu"),
    chx("evier", "Caisson évier", [[800, "80 cm"], [1000, "100 cm"], [1200, "120 cm (2 bacs)"]], 1000),
    stp("tiroirs", "Caissons à tiroirs", "🗄️", 1, 0, 4), stp("hauts", "Caissons hauts", "⬆️", 1, 0, 1), stp("hautEvier", "Caisson haut au-dessus de l'évier", "🪟", 0, 0, 1)],
  build(c, p, o) {
    const mods = modulesCuisine(p.L, o), yHaut = Math.max(1350, p.H - 700);
    let nb = 0, nh = 0;
    mods.forEach(m => {
      if (m.type === "evier") evierCuisine(c, m.x, m.W, { nom: "Caisson évier" });
      else basCuisine(c, m.x, m.W, { nom: "Caisson bas " + (++nb), tiroirs: m.type === "tiroirs" ? 3 : 1 });
      // Au-dessus de l'évier : souvent une fenêtre. Un caisson haut seulement si on le demande.
      if (o.hauts && (m.type !== "evier" || o.hautEvier)) hautCuisine(c, m.x, m.W, "Caisson haut " + (++nh), yHaut);
    });
    planTravail(c, 0, CAISSON_BAS.H, 0, p.L, CAISSON_BAS.plan);
  } });
rec({ id: "caisson-evier", nom: "Caisson évier (sous-évier)", e: "🚰", cat: "Cuisine", dims: [100, 82, 46], dimMin: [60, 82, 46], ...DIMS_CAISSON, opts: [], build(c, p) {
  evierCuisine(c, 0, p.L, { nom: "Caisson évier" }); planTravail(c, 0, CAISSON_BAS.H, 0, p.L, CAISSON_BAS.plan);
} });
rec({ id: "placard", nom: "Placard de rangement", e: "🚪", cat: "Cuisine", dims: [80, 200, 45], opts: [stp("portes", "Portes", "🚪", 2, 1, 4), stp("etageres", "Étagères", "📚", 4, 0, 8)], build(c, p, o) { armoire(c, p, { portes: o.portes, etageres: o.etageres, socle: 60 }); } });

/* ----- Boutique ----- */
rec({ id: "comptoir-caisse", nom: "Comptoir de caisse", e: "💰", cat: "Boutique", dims: [150, 100, 60], opts: [stp("tiroirs", "Tiroir-caisse", "🗄️", 1, 0, 2)], build(c, p, o) {
  const E = c.E;
  const zones = o.tiroirs ? [{ t: "etageres", n: 1 }, { t: "tiroirs", n: o.tiroirs, h: o.tiroirs * 150 }] : [{ t: "etageres", n: 2 }];
  caisse(c, 0, 0, 0, p.L, p.H - E, p.P, { socle: 0, dos: false, colonnes: [zones, [{ t: "etageres", n: 2 }]] });
  add(c, "Façade clients", "caisson", [0, 0, p.P + 25, p.L, p.H - E, E], { edge: 2 * p.L + 2 * p.H });
  plateau(c, "Plateau", -20, p.H - E, 0, p.L + 40, p.P + 70);
} });
rec({ id: "presentoir", nom: "Présentoir / gondole", e: "🛍️", cat: "Boutique", dims: [120, 160, 80], opts: [stp("etageres", "Étagères par face", "📚", 4, 1, 6)], build(c, p, o) {
  const E = c.E, half = (p.P - E) / 2;
  panneauV(c, "Côté gauche", 0, 0, 0, p.H, p.P); panneauV(c, "Côté droit", p.L - E, 0, 0, p.H, p.P);
  voile(c, "Panneau central", E, 0, half, p.L - 2 * E, p.H);
  plateau(c, "Dessus", E, p.H - E, 0, p.L - 2 * E, p.P, 2 * p.L);
  for (let f = 0; f < 2; f++) for (let i = 0; i < o.etageres; i++) {
    const y = 100 + i * (p.H - 400) / Math.max(1, o.etageres - 1);
    add(c, "Étagère face " + (f + 1) + " n°" + (i + 1), "caisson", [E, y, f ? half + E : 0, p.L - 2 * E, E, half], { edge: p.L - 2 * E, flags: { shelf: true } });
  }
  hw(c, "taquets", "📌", "Taquets d'étagère", 8 * o.etageres);
} });
rec({ id: "rayonnage", nom: "Rayonnage mural", e: "📦", cat: "Boutique", dims: [200, 220, 40], opts: [stp("colonnes", "Colonnes", "▥", 2, 1, 5), stp("etageres", "Étagères", "📚", 5, 1, 8)], build(c, p, o) {
  const cols = []; for (let k = 0; k < o.colonnes; k++) cols.push([{ t: "etageres", n: o.etageres }]);
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 80, colonnes: cols }); hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4);
} });
rec({ id: "vitrine-boutique", nom: "Vitrine de boutique", e: "🏬", cat: "Boutique", dims: [120, 100, 50], opts: [stp("etageres", "Étagères", "📚", 1, 0, 3)], build(c, p, o) {
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 80, colonnes: [[{ t: "etageres", n: 1, h: 300, portes: { n: 2 } }, { t: "etageres", n: o.etageres }]] });
  portes(c, { x: c.E, y: 80 + c.E + 300 + c.E, w: p.L - 2 * c.E, h: p.H - 80 - 3 * c.E - 300, z: 0, d: p.P }, { n: 2, type: "coulissante-vitree" }, "");
} });

/* ----- Portes et autres ----- */
rec({ id: "placard-integre", nom: "Placard intégré au mur", e: "🧱", cat: "Portes et autres", dims: [150, 240, 60], opts: [stp("portes", "Portes", "🚪", 2, 2, 4), TYPE_PORTE, stp("etageres", "Étagères", "📚", 4, 0, 8), stp("penderie", "Penderie", "👔", 1, 0, 1)], build(c, p, o) { armoire(c, p, { portes: o.portes, type: o.type, etageres: o.etageres, penderie: o.penderie, socle: 0 }); } });
rec({ id: "salle-de-bain", nom: "Meuble de salle de bain", e: "🚿", cat: "Portes et autres", dims: [80, 55, 45], opts: [stp("tiroirs", "Tiroirs", "🗄️", 0, 0, 2)], build(c, p, o) {
  const zones = o.tiroirs ? [{ t: "tiroirs", n: o.tiroirs }] : [{ t: "etageres", n: 1, portes: { n: p.L > 600 ? 2 : 1 } }];
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 0, dessus: false, colonnes: [zones] });
  add3d(c, "top", [0, p.H, 0, p.L, 20, p.P + 20]); hw(c, "vasque", "🚰", "Vasque à poser + plan", 1); hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4);
} });

/* ===================== MODÈLES ACTUELS (très demandés) ===================== */
/* ----- Salon ----- */
rec({ id: "tv-suspendu", nom: "Meuble TV suspendu", e: "📺", cat: "Salon", dims: [160, 40, 38], opts: [stp("colonnes", "Casiers", "▥", 3, 2, 5), stp("ouvert", "Casier ouvert au centre", "⬜", 1, 0, 1)], build(c, p, o) {
  // Fixé au mur, à 35 cm du sol : pas de socle.
  const cols = [];
  for (let k = 0; k < o.colonnes; k++) cols.push(o.ouvert && k === Math.floor(o.colonnes / 2) ? [{ t: "niche" }] : [{ t: "etageres", n: 0, portes: { n: 1 } }]);
  caisse(c, 0, 350, 0, p.L, p.H, p.P, { socle: 0, colonnes: cols });
  hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4 * Math.ceil(p.L / 1000));
} });
rec({ id: "mur-tv", nom: "Mur TV (ensemble complet)", e: "🖼️", cat: "Salon", dims: [280, 200, 40], dimMin: [180, 140, 30], dimLabels: ["Largeur du mur", "Hauteur", "Profondeur du bas"], opts: [stp("etageres", "Étagères des colonnes", "📚", 4, 1, 6), stp("pont", "Pont en haut", "🌉", 1, 0, 1), stp("led", "Ruban LED", "💡", 1, 0, 1)], build(c, p, o) {
  const Hb = 450, CW = 450, Dc = Math.min(p.P, 300);
  // Bas : modules de 120 cm au plus (une feuille) ; le module central reste ouvert pour le décodeur.
  const nb = Math.ceil(p.L / 1200), wb = p.L / nb;
  for (let i = 0; i < nb; i++) {
    const centre = nb > 1 && i === Math.floor(nb / 2);
    caisse(c, i * wb, 0, 0, wb, Hb, p.P, { nom: "Bas " + (i + 1), socle: 60, colonnes: [centre ? [{ t: "etageres", n: 1 }] : [{ t: "etageres", n: 0, portes: { n: 2 } }]] });
  }
  // Colonnes à gauche et à droite, posées sur le bas.
  [0, p.L - CW].forEach((x, i) => caisse(c, x, Hb, 0, CW, p.H - Hb, Dc, { nom: "Colonne " + (i ? "droite" : "gauche"), colonnes: [[{ t: "etageres", n: o.etageres }]] }));
  if (o.pont) {
    const Lp = p.L - 2 * CW, np = Math.ceil(Lp / 2400);
    for (let i = 0; i < np; i++) caisse(c, CW + i * Lp / np, p.H - 300, 0, Lp / np, 300, Dc, { nom: "Pont" + (np > 1 ? " " + (i + 1) : ""), colonnes: [[{ t: "niche" }]] });
    if (o.led) hw(c, "led", "💡", "Ruban LED + alimentation", Math.ceil(Lp / 1000), "m");
  }
  hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 8);
} });
rec({ id: "range-chaussures", nom: "Range-chaussures", e: "👟", cat: "Salon", dims: [80, 100, 35], opts: [stp("etageres", "Étagères", "📚", 4, 2, 8), stp("portes", "Portes (0 = ouvert)", "🚪", 2, 0, 2)], build(c, p, o) {
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 50, colonnes: [[{ t: "etageres", n: o.etageres, portes: { n: o.portes } }]] });
} });
rec({ id: "console-entree", nom: "Console d'entrée", e: "🪴", cat: "Salon", dims: [100, 80, 35], opts: [stp("tiroirs", "Tiroirs", "🗄️", 2, 0, 3), stp("tablette", "Tablette basse", "▭", 1, 0, 1)], build(c, p, o) {
  const E = c.E;
  plateau(c, "Plateau", 0, p.H - E, 0, p.L, p.P);
  panneauV(c, "Pied gauche", 0, 0, 0, p.H - E, p.P); panneauV(c, "Pied droit", p.L - E, 0, 0, p.H - E, p.P);
  if (o.tiroirs) caisse(c, 0, p.H - E - 160, 0, p.L, 160, p.P, { nom: "Tiroirs", cotes: false, dessus: false, dos: false, colonnes: Array.from({ length: o.tiroirs }, () => [{ t: "tiroirs", n: 1 }]) });
  else voile(c, "Voile", E, p.H - E - 120, p.P - E, p.L - 2 * E, 120);
  if (o.tablette) plateau(c, "Tablette basse", E, 120, 0, p.L - 2 * E, p.P, p.L);
} });
rec({ id: "vaisselier", nom: "Vaisselier", e: "🍶", cat: "Salon", dims: [120, 200, 45], dimMin: [60, 150, 35], opts: [stp("etageres", "Étagères vitrées", "📚", 2, 1, 4), stp("tiroirs", "Rangée de tiroirs", "🗄️", 1, 0, 1)], build(c, p, o) {
  const Hb = 850, Dh = Math.min(p.P, 350);
  const bas = o.tiroirs ? [{ t: "etageres", n: 1, portes: { n: 2 } }, { t: "tiroirs", n: 1, h: 150 }] : [{ t: "etageres", n: 1, portes: { n: 2 } }];
  caisse(c, 0, 0, 0, p.L, Hb, p.P, { nom: "Bas", socle: 80, colonnes: [bas] });
  caisse(c, 0, Hb, 0, p.L, p.H - Hb, Dh, { nom: "Haut", colonnes: [[{ t: "etageres", n: o.etageres, portes: { n: 2, type: "vitree" } }]] });
} });
rec({ id: "etagere-cubes", nom: "Étagère à cases carrées", e: "🔲", cat: "Salon", dims: [150, 150, 39], opts: [stp("colonnes", "Colonnes", "▥", 4, 2, 6), stp("rangees", "Rangées", "▤", 4, 2, 6), stp("portes", "Cases avec porte", "🚪", 0, 0, 2)], build(c, p, o) {
  // Cases identiques ; les premières cases du bas peuvent recevoir une porte.
  const cols = [];
  for (let k = 0; k < o.colonnes; k++) cols.push(Array.from({ length: o.rangees }, (_, j) => j === 0 && k < o.portes ? { t: "etageres", n: 0, portes: { n: 1 } } : { t: "niche" }));
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 0, colonnes: cols });
} });

/* ----- Chambre ----- */
rec({ id: "tete-lit-chevets", nom: "Tête de lit avec chevets", e: "🛌", cat: "Chambre", dims: [260, 110, 40], dimMin: [160, 60, 30], dimLabels: ["Largeur totale", "Hauteur", "Profondeur des chevets"], opts: [stp("tiroirs", "Tiroirs par chevet", "🗄️", 1, 1, 2)], build(c, p, o) {
  const E = c.E, CW = 450, Hc = 180 * o.tiroirs;
  // Panneau mural (en plusieurs morceaux s'il dépasse une feuille) et deux chevets suspendus.
  const n = Math.ceil(p.L / 2400);
  for (let i = 0; i < n; i++) add(c, "Panneau tête de lit" + (n > 1 ? " " + (i + 1) + "/" + n : ""), "caisson", [i * p.L / n, 0, 0, p.L / n, p.H, E], { edge: p.L / n + (i === 0 || i === n - 1 ? p.H : 0) });
  [0, p.L - CW].forEach((x, i) => caisse(c, x, 400, E, CW, Hc, p.P - E, { nom: "Chevet " + (i ? "droit" : "gauche"), dos: false, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] }));
  hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 8);
} });

/* ----- Bureau ----- */
rec({ id: "bureau-etude", nom: "Bureau d'étude avec étagères", e: "📖", cat: "Bureau", dims: [120, 180, 55], dimMin: [60, 140, 40], opts: [stp("etageres", "Étagères au-dessus", "📚", 2, 1, 3), stp("colonnes", "Colonnes d'étagères", "▥", 2, 1, 3)], build(c, p, o) {
  const E = c.E, Hp = 750;
  plateau(c, "Plateau", 0, Hp - E, 0, p.L, p.P);
  panneauV(c, "Pied gauche", 0, 0, 0, Hp - E, p.P); panneauV(c, "Pied droit", p.L - E, 0, 0, Hp - E, p.P);
  voile(c, "Voile de fond", E, Hp - E - 300, 30, p.L - 2 * E, 300);
  caisse(c, 0, 1000, 0, p.L, p.H - 1000, 250, { nom: "Étagère haute", colonnes: Array.from({ length: o.colonnes }, () => [{ t: "etageres", n: o.etageres - 1 }]) });
  hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4);
} });
rec({ id: "vestiaire-casiers", nom: "Vestiaire à casiers", e: "🔐", cat: "Bureau", dims: [120, 180, 50], opts: [stp("colonnes", "Colonnes", "▥", 3, 1, 4), stp("casiers", "Casiers par colonne", "🔲", 3, 1, 5)], build(c, p, o) {
  const cols = Array.from({ length: o.colonnes }, () => Array.from({ length: o.casiers }, () => ({ t: "etageres", n: 0, portes: { n: 1 } })));
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 80, colonnes: cols });
  hw(c, "moraillon", "🔒", "Moraillons porte-cadenas", o.colonnes * o.casiers);
} });

/* ----- Cuisine ----- */
rec({ id: "ilot-cuisine", nom: "Îlot de cuisine / bar", e: "🏝️", cat: "Cuisine", dims: [180, 82, 46], dimMin: [60, 82, 46], ...DIMS_CAISSON, dimLabels: ["Longueur de l'îlot", "Hauteur (fixe)", "Profondeur façades comprises (fixe)"], opts: [stp("tiroirs", "Modules à tiroirs", "🗄️", 1, 0, 3), stp("bar", "Débord côté bar (cm)", "🍹", 30, 0, 40, 5)], build(c, p, o) {
  const E = c.E, n = Math.max(1, Math.round(p.L / 600)), W = p.L / n;
  for (let i = 0; i < n; i++) {
    basCuisine(c, i * W, W, { nom: "Module " + (i + 1), tiroirs: i < o.tiroirs ? 3 : 0 });
    add(c, "Habillage côté bar " + (i + 1), "caisson", [i * W, 0, -5 - E, W, CAISSON_BAS.H, E], { edge: W });
  }
  planTravail(c, 0, CAISSON_BAS.H, -5 - E - o.bar * 10, p.L, CAISSON_BAS.P + 5 + E + o.bar * 10);
} });

/* ----- Boutique ----- */
rec({ id: "poste-coiffure", nom: "Poste de coiffure", e: "💇", cat: "Boutique", dims: [120, 85, 45], dimLabels: ["Largeur d'un poste", "Hauteur", "Profondeur"], opts: [stp("postes", "Postes", "💺", 1, 1, 4), stp("tiroirs", "Tiroirs", "🗄️", 3, 1, 4)], build(c, p, o) {
  const E = c.E, CW = 400;
  for (let k = 0; k < o.postes; k++) {
    const x = k * p.L, nm = o.postes > 1 ? " " + (k + 1) : "";
    plateau(c, "Plateau" + nm, x, p.H - E, 0, p.L, p.P);
    caisse(c, x, 0, 0, CW, p.H - E, p.P, { nom: "Caisson" + nm, dessus: false, dos: false, socle: 60, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
    panneauV(c, "Pied droit" + nm, x + p.L - E, 0, 0, p.H - E, p.P);
    add(c, "Panneau de miroir" + nm, "caisson", [x, p.H, 0, p.L, 1000, E], { edge: 2 * (p.L + 1000) });
    add3d(c, "mirror", [x + p.L / 2 - 300, p.H + 150, E, 600, 800, 6]);
    hw(c, "miroir", "🪞", "Miroir 60 × 80 cm", 1);
  }
  hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4 * o.postes);
} });

/* ===================== DÉCO MURALE ===================== */
const DECO = "Déco murale";
// Grand panneau découpé en morceaux qui tiennent dans une feuille (2420 × 1200 utiles, sens libre).
function panneauDecoupe(c, nom, mat, x0, y0, z0, W, H, T, edge = 0, look) {
  const fits = (a, b) => Math.max(a, b) <= 2420 && Math.min(a, b) <= 1200;
  let best = null;
  for (let j = 1; j <= 6; j++) for (let k = 1; k <= 8; k++) if (fits(W / k, H / j) && (!best || k * j < best[0] * best[1])) best = [k, j];
  const [k, j] = best || [Math.ceil(W / 1180), Math.ceil(H / 2400)], n = k * j;
  for (let a = 0; a < j; a++) for (let b = 0; b < k; b++)
    add(c, nom + (n > 1 ? " " + (a * k + b + 1) + "/" + n : ""), mat, [x0 + b * W / k, y0 + a * H / j, z0, W / k, H / j, T], { edge: edge / n, look });
  return n;
}
// Finition (vernis ou peinture) : 2 couches, environ 10 m² par litre et par couche.
const vernis = (c, m2) => hw(c, "vernis", "🖌️", "Vernis ou peinture (2 couches)", Math.max(0.5, Math.ceil(m2 * 2 / 10 * 2) / 2), "L");

rec({ id: "mur-tasseaux", nom: "Mur en tasseaux", e: "🎋", cat: DECO, dims: [200, 240, 4], dimMin: [30, 30, 2], dimLabels: ["Largeur du mur", "Hauteur", "Largeur d'un tasseau"],
  opts: [stp("ecart", "Écart entre tasseaux (cm)", "↔️", 2, 1, 10), chx("fond", "Fond", [["noir", "Panneau de fond noir"], ["aucun", "Directement sur le mur"]], "noir"), stp("led", "Ruban LED sur les côtés", "💡", 0, 0, 1)],
  build(c, p, o) {
    const w = p.P, e = o.ecart * 10, T = c.E, zf = o.fond === "noir" ? 5 : 0;
    const n = Math.max(1, Math.floor((p.L + e) / (w + e))), x0 = (p.L - (n * w + (n - 1) * e)) / 2;
    if (zf) { const k = panneauDecoupe(c, "Panneau de fond (à peindre en noir)", "dos", 0, 0, 0, p.L, p.H, 5, 0, "noir"); hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4 * k); }
    // Un tasseau en panneau ne dépasse pas la longueur d'une feuille : au-delà, il est fait en deux morceaux.
    const morceaux = p.H > 2400 ? 2 : 1;
    for (let i = 0; i < n; i++) for (let m = 0; m < morceaux; m++)
      add(c, "Tasseau " + (i + 1) + (morceaux > 1 ? (m ? " (haut)" : " (bas)") : ""), "caisson", [x0 + i * (w + e), m * p.H / morceaux, zf, w, p.H / morceaux, T], { edge: 2 * p.H / morceaux });
    // Collage par plots : environ 10 m de tasseau par cartouche.
    hw(c, "mastic", "🧴", "Colle mastic de fixation", Math.ceil(n * p.H / 1000 / 10), "cartouche(s)");
    hw(c, "pointes", "🔨", "Pointes sans tête", n * Math.ceil(p.H / 400) * 2);
    vernis(c, n * (w + 2 * T) * p.H / 1e6);
    if (o.led) { hw(c, "led", "💡", "Ruban LED + alimentation", Math.ceil(2 * p.H / 1000), "m"); [x0 - 25, p.L - x0 + 15].forEach(x => add3d(c, "led", [x, 0, zf, 10, p.H, 10])); }
  } });

rec({ id: "claustra", nom: "Claustra / séparation de pièce", e: "🎐", cat: DECO, dims: [120, 240, 7], dimMin: [30, 60, 3], dimLabels: ["Largeur", "Hauteur", "Profondeur des lattes"],
  opts: [stp("ecart", "Écart entre lattes (cm)", "↔️", 4, 1, 20), chx("pose", "Pose", [["plafond", "Du sol au plafond"], ["pieds", "Libre, sur pieds"]], "plafond")],
  build(c, p, o) {
    const t = 27, d = p.P, e = o.ecart * 10, lis = 45, pied = o.pose === "pieds";
    // Lisses haute et basse (fixées au sol et au plafond, ou posées sur deux pieds), lattes verticales entre les deux.
    add(c, "Lisse basse", "massif", [0, pied ? 60 : 0, 0, p.L, lis, d]);
    add(c, "Lisse haute", "massif", [0, p.H - lis, 0, p.L, lis, d]);
    const n = Math.max(2, Math.floor((p.L + e) / (t + e))), pas = (p.L - t) / (n - 1), yb = (pied ? 60 : 0) + lis;
    for (let i = 0; i < n; i++) add(c, "Latte " + (i + 1), "massif", [i * pas, yb, 0, t, p.H - lis - yb, d], { flags: { section: "latte" } });
    if (pied) { [[0], [p.L - 80]].forEach(([x], i) => add(c, "Pied " + (i ? "droit" : "gauche"), "massif", [x, 0, d / 2 - 200, 80, 60, 400])); hw(c, "equerres", "📐", "Équerres d'assemblage", 4); }
    else hw(c, "fixmur", "🔩", "Fixations sol et plafond + chevilles", 8);
    hw(c, "visbois", "🔩", "Vis à bois 5 × 60", n * 2 + 8);
    hw(c, "colle", "🧴", "Colle à bois", 1);
    vernis(c, n * 2 * (t + d) * p.H / 1e6);
  } });

rec({ id: "panneau-led", nom: "Panneau mural rétroéclairé", e: "💡", cat: DECO, dims: [180, 120, 3], dimMin: [30, 30, 2], dimLabels: ["Largeur", "Hauteur", "Décollement du mur"],
  opts: [stp("led", "Ruban LED derrière", "💡", 1, 0, 1)],
  build(c, p, o) {
    // Jusqu'à 3 cm de décollement, une latte de 2,7 cm suffit (moins chère qu'un chevron).
    const T = p.P <= 30 ? 27 : Math.min(65, p.P), m = 100;
    // Cadre de tasseaux contre le mur (en retrait de 10 cm), panneau devant : la lumière déborde tout autour.
    add(c, "Tasseau haut", "massif", [m, p.H - m - 45, 0, p.L - 2 * m, 45, T]);
    add(c, "Tasseau bas", "massif", [m, m, 0, p.L - 2 * m, 45, T]);
    const nv = Math.max(2, Math.ceil((p.L - 2 * m) / 600) + 1);
    for (let i = 0; i < nv; i++) add(c, "Tasseau vertical " + (i + 1), "massif", [m + i * (p.L - 2 * m - 45) / (nv - 1), m + 45, 0, 45, p.H - 2 * m - 90, T]);
    panneauDecoupe(c, "Panneau", "caisson", 0, 0, T, p.L, p.H, c.E, 2 * (p.L + p.H));
    hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 2 * (nv + 2));
    hw(c, "visbois", "🔩", "Vis à bois 4 × 40", 4 * (nv + 2));
    if (o.led) {
      hw(c, "led", "💡", "Ruban LED + alimentation", Math.ceil(2 * (p.L + p.H - 4 * m) / 1000), "m");
      // Ruban collé au dos du panneau, en retrait : la 3D montre la lumière qui déborde.
      const r = 60, z = T - 8;
      [[r, r, p.L - 2 * r, 8], [r, p.H - r - 8, p.L - 2 * r, 8]].forEach(([x, y, w, h]) => add3d(c, "led", [x, y, z, w, h, 6]));
      [[r, r], [p.L - r - 8, r]].forEach(([x, y]) => add3d(c, "led", [x, y, z, 8, p.H - 2 * r, 6]));
      // Halo de lumière sur le mur, autour du panneau (visible de face).
      const g = 90;
      [[-g, -g, p.L + 2 * g, g], [-g, p.H, p.L + 2 * g, g], [-g, 0, g, p.H], [p.L, 0, g, p.H]].forEach(([x, y, w, h]) => add3d(c, "halo", [x, y, -2, w, h, 2]));
    }
  } });

rec({ id: "etageres-flottantes", nom: "Étagères flottantes", e: "📏", cat: DECO, dims: [80, 5, 22], dimMin: [20, 2, 12], dimLabels: ["Longueur", "Épaisseur visible", "Profondeur"],
  opts: [stp("nombre", "Nombre d'étagères", "📚", 3, 1, 6), stp("ecartV", "Écart entre étagères (cm)", "↕️", 35, 20, 60, 5)],
  build(c, p, o) {
    const E = c.E, creux = p.H > E + 4;
    for (let k = 0; k < o.nombre; k++) {
      const y = 1000 + k * o.ecartV * 10, nm = o.nombre > 1 ? " " + (k + 1) : "";
      if (!creux) { add(c, "Étagère" + nm, "caisson", [0, y, 0, p.L, E, p.P], { edge: p.L + 2 * p.P }); continue; }
      // Étagère épaisse et creuse : dessus, dessous, façade et deux joues ; elle glisse sur des tiges cachées.
      add(c, "Dessus" + nm, "caisson", [0, y + p.H - E, 0, p.L, E, p.P - E], { edge: 0 });
      add(c, "Dessous" + nm, "caisson", [0, y, 0, p.L, E, p.P - E], { edge: 0 });
      add(c, "Façade" + nm, "caisson", [0, y, p.P - E, p.L, p.H, E], { edge: 2 * p.L + 2 * p.H });
      add(c, "Joue gauche" + nm, "caisson", [0, y + E, 0, E, p.H - 2 * E, p.P - E], { edge: p.P });
      add(c, "Joue droite" + nm, "caisson", [p.L - E, y + E, 0, E, p.H - 2 * E, p.P - E], { edge: p.P });
    }
    hw(c, "supinv", "🔩", "Supports invisibles (tiges)", o.nombre * Math.max(2, Math.ceil(p.L / 400)));
    if (creux) hw(c, "colle", "🧴", "Colle à bois", 1);
  } });

rec({ id: "niches-murales", nom: "Niches murales", e: "🔳", cat: DECO, dims: [35, 35, 25], dimMin: [15, 15, 12], dimLabels: ["Largeur d'une niche", "Hauteur", "Profondeur"],
  opts: [stp("nombre", "Nombre de niches", "🔳", 3, 1, 8), chx("dispo", "Disposition", [["ligne", "En ligne"], ["escalier", "En escalier"], ["quinconce", "En quinconce"]], "escalier"), stp("fond", "Avec fond", "▣", 1, 0, 1)],
  build(c, p, o) {
    for (let k = 0; k < o.nombre; k++) {
      const x = k * (p.L + 40), y = 1000 + (o.dispo === "escalier" ? k * p.H / 2 : o.dispo === "quinconce" ? (k % 2) * (p.H + 40) : 0);
      caisse(c, x, y, 0, p.L, p.H, p.P, { nom: "Niche " + (k + 1), socle: 0, dos: !!o.fond, colonnes: [[{ t: "niche" }]] });
    }
    hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 2 * o.nombre);
  } });

/* Bientôt */
export const BIENTOT = [];

/* ===================== PIÈCES ÉPAISSES ===================== */
// Pièce épaisse (montant, chevron, pied…) : faite en bandes de panneau contrecollées (voir add dans blocs.js).
const M = (c, name, box, sec, extra = {}) => add(c, name, "massif", box, { flags: { section: sec, ...extra } });

rec({ id: "lit-superpose", nom: "Lit superposé", e: "🪜", cat: "Chambre", dims: [90, 165, 190], dimLabels: ["Largeur matelas", "Hauteur totale", "Longueur matelas"], opts: [stp("echelle", "Échelle", "🪜", 1, 0, 1)], build(c, p, o) {
  const L = p.L, H = p.H, P = p.P, pw = 65, pd = 80, D = P + 2 * pd, X2 = L + pw;
  [[0, 0], [X2, 0], [0, D - pd], [X2, D - pd]].forEach(([x, z], i) => M(c, "Montant " + (i + 1), [x, 0, z, pw, H, pd], "chevron"));
  const niveaux = [250, Math.max(900, H - 650)];
  niveaux.forEach((y, n) => {
    const nm = n ? "haut" : "bas";
    M(c, "Longeron gauche (" + nm + ")", [pw, y, pd, 27, 150, P], "planche");
    M(c, "Longeron droit (" + nm + ")", [L + pw - 27, y, pd, 27, 150, P], "planche");
    M(c, "Traverse tête (" + nm + ")", [0, y, pd - 27, L + 2 * pw, 150, 27], "planche");
    M(c, "Traverse pied (" + nm + ")", [0, y, pd + P, L + 2 * pw, 150, 27], "planche");
    const nl = Math.round(P / 110);
    for (let i = 0; i < nl; i++) add3d(c, "massif", [pw + 27, y + 100, pd + 40 + i * (P - 80) / (nl - 1) - 35, L - 54, 20, 70]);
    hw(c, "lattes", "🪵", "Lattes de lit " + Math.round((L - 54) / 10) + " cm", nl);
    hw(c, "tasseaux", "🪵", "Tasseaux d'appui", 2 * P / 1000, "m");
  });
  const yH = niveaux[1];
  M(c, "Garde-corps mur", [-27, yH + 220, pd, 27, 120, P], "planche");
  M(c, "Garde-corps avant", [X2 + pw, yH + 220, pd, 27, 120, P - 520], "planche");
  if (o.echelle) {
    const zE = D - pd - 470;
    M(c, "Montant d'échelle 1", [X2 + pw, 0, zE, 27, yH + 200, 70], "latte");
    M(c, "Montant d'échelle 2", [X2 + pw, 0, zE + 400, 27, yH + 200, 70], "latte");
    const nb = Math.max(3, Math.floor((yH + 100) / 280));
    for (let i = 1; i <= nb; i++) M(c, "Barreau " + i, [X2 + pw + 27, i * (yH + 100) / (nb + 1), zE, 27, 70, 470], "latte");
  }
  hw(c, "boulons", "🔩", "Boulons de lit 8 × 120 + écrous", 16);
  hw(c, "visbois", "🔩", "Vis à bois 5 × 60", 40);
} });

rec({ id: "chaise", nom: "Chaise", e: "🪑", cat: "Salon", dims: [44, 90, 44], dimMin: [30, 60, 30], dimLabels: ["Largeur", "Hauteur du dossier", "Profondeur"], opts: [stp("nombre", "Nombre de chaises", "🪑", 4, 1, 12)], build(c, p, o) {
  const L = p.L, H = p.H, P = p.P, A = 450, f = 40;
  const q = { qty: o.nombre };
  M(c, "Pied avant gauche", [0, 0, P - f, f, A, f], null, q); M(c, "Pied avant droit", [L - f, 0, P - f, f, A, f], null, q);
  M(c, "Pied arrière gauche", [0, 0, 0, f, H, f], null, q); M(c, "Pied arrière droit", [L - f, 0, 0, f, H, f], null, q);
  M(c, "Ceinture avant", [f, A - 90, P - f + 9, L - 2 * f, 70, 22], null, q); M(c, "Ceinture arrière", [f, A - 90, 9, L - 2 * f, 70, 22], null, q);
  M(c, "Ceinture gauche", [9, A - 90, f, 22, 70, P - 2 * f], null, q); M(c, "Ceinture droite", [L - 31, A - 90, f, 22, 70, P - 2 * f], null, q);
  M(c, "Traverse haute du dossier", [f, H - 120, 9, L - 2 * f, 70, 22], null, q); M(c, "Traverse basse du dossier", [f, A + 180, 9, L - 2 * f, 60, 22], null, q);
  add(c, "Assise", "caisson", [0, A - 20, 0, L, c.E, P], { qty: o.nombre, edge: 2 * (L + P) });
  hw(c, "tourillons_ch", "🪵", "Tourillons Ø8 + colle", 24 * o.nombre);
  hw(c, "patins", "⚪", "Patins de pieds", 4 * o.nombre);
} });

rec({ id: "canape", nom: "Cadre de canapé", e: "🛋️", cat: "Salon", dims: [200, 85, 85], opts: [stp("places", "Places", "🛋️", 3, 2, 4)], build(c, p, o) {
  const L = p.L, H = p.H, P = p.P, s = 65, h = 80, yA = 180;
  [[0, 0], [L - s, 0], [0, P - s], [L - s, P - s]].forEach(([x, z], i) => M(c, "Pied " + (i + 1), [x, 0, z, s, yA, s], "chevron"));
  M(c, "Longeron avant", [0, yA, P - s, L, h, s], "chevron"); M(c, "Longeron arrière", [0, yA, 0, L, h, s], "chevron");
  for (let i = 0; i <= o.places; i++) M(c, "Traverse d'assise " + (i + 1), [i * (L - s) / o.places, yA, s, s, h, P - 2 * s], "chevron");
  M(c, "Montant de dossier gauche", [0, yA + h, 0, s, H - yA - h, s], "chevron"); M(c, "Montant de dossier droit", [L - s, yA + h, 0, s, H - yA - h, s], "chevron");
  M(c, "Traverse haute du dossier", [s, H - h, 0, L - 2 * s, h, s], "chevron");
  M(c, "Accoudoir gauche", [0, 600, 0, s, 27, P]); M(c, "Accoudoir droit", [L - s, 600, 0, s, 27, P]);
  M(c, "Montant d'accoudoir gauche", [0, yA + h, P - s, s, 600 - yA - h, s], "chevron"); M(c, "Montant d'accoudoir droit", [L - s, yA + h, P - s, s, 600 - yA - h, s], "chevron");
  hw(c, "sangles", "🧵", "Sangles élastiques", Math.ceil((P / 1000) * (L / 120)), "m");
  hw(c, "mousse", "🟨", "Mousse d'assise 10 cm", (L / 1000) * (P / 1000), "m²");
  hw(c, "tissu", "🧶", "Tissu", (L / 1000) * 3, "m");
  hw(c, "visbois", "🔩", "Vis à bois 5 × 80", 48);
} });

const DIMS_PORTE = ["Largeur", "Hauteur", "Épaisseur"];
function huisserie(c, L, H) {
  M(c, "Huisserie montant gauche", [-70, 0, -20, 65, H + 5, 80], "chevron");
  M(c, "Huisserie montant droit", [L + 5, 0, -20, 65, H + 5, 80], "chevron");
  M(c, "Huisserie traverse", [-70, H + 5, -20, L + 140, 65, 80], "chevron");
  hw(c, "pattes", "🔩", "Pattes de scellement", 6);
}
rec({ id: "porte-isoplane", nom: "Porte isoplane", e: "🚪", cat: "Portes et autres", dims: [83, 204, 4], dimMin: [40, 100, 3], dimLabels: DIMS_PORTE, opts: [stp("huisserie", "Avec huisserie", "🧱", 1, 0, 1)], build(c, p, o) {
  const L = p.L, H = p.H, T = p.P, ec = T - 10, b = 40;
  M(c, "Cadre montant gauche", [0, 0, 5, b, H, ec]); M(c, "Cadre montant droit", [L - b, 0, 5, b, H, ec]);
  M(c, "Cadre traverse basse", [b, 0, 5, L - 2 * b, b, ec]); M(c, "Cadre traverse haute", [b, H - b, 5, L - 2 * b, b, ec]);
  for (let i = 1; i <= 3; i++) M(c, "Traverse intermédiaire " + i, [b, i * H / 4 - b / 2, 5, L - 2 * b, b, ec]);
  M(c, "Renfort de serrure", [L - b - 80, H / 2 - 200, 5, 80, 400, ec]);
  add(c, "Parement face 1", "dos", [0, 0, 0, L, H, 5]); add(c, "Parement face 2", "dos", [0, 0, T - 5, L, H, 5]);
  if (o.huisserie) huisserie(c, L, H);
  hw(c, "paumelles", "⚙️", "Paumelles", 3); hw(c, "serrure", "🔒", "Serrure + cylindre", 1); hw(c, "poignees", "🚪", "Poignée de porte", 1);
  hw(c, "colle", "🧴", "Colle à bois", 1); hw(c, "pointes", "🔨", "Pointes", Math.ceil((2 * (L + H) * 2) / 100));
} });

