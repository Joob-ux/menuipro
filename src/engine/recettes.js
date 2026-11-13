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
rec({ id: "armoire-2", nom: "Armoire 2 portes", e: "🚪", cat: "Chambre", dims: [100, 200, 58], opts: [stp("etageres", "Étagères", "📚", 3, 0, 8), stp("penderie", "Penderie", "👔", 0, 0, 1), stp("tiroirs", "Tiroirs en bas", "🗄️", 0, 0, 2)], build(c, p, o) { armoire(c, p, { portes: 2, etageres: o.etageres, penderie: o.penderie, tiroirs: o.tiroirs }); } });
rec({ id: "armoire-34", nom: "Armoire 3 ou 4 portes", e: "🚪", cat: "Chambre", dims: [160, 210, 58], opts: [stp("portes", "Portes", "🚪", 3, 3, 4), stp("etageres", "Étagères", "📚", 4, 0, 8), stp("penderie", "Penderie", "👔", 1, 0, 1), stp("tiroirs", "Tiroirs en bas", "🗄️", 0, 0, 2)], build(c, p, o) { armoire(c, p, { portes: o.portes, etageres: o.etageres, penderie: o.penderie, tiroirs: o.tiroirs }); } });
rec({ id: "armoire-coulissante", nom: "Armoire portes coulissantes", e: "↔️", cat: "Chambre", dims: [180, 220, 62], opts: [stp("etageres", "Étagères", "📚", 4, 0, 8), stp("penderie", "Penderie", "👔", 1, 0, 1)], build(c, p, o) { armoire(c, p, { portes: 2, type: "coulissante", etageres: o.etageres, penderie: o.penderie }); } });
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
export function basCuisine(c, x, W, o) {
  const H = 870, D = 560, zones = o.tiroirs >= 2 ? [{ t: "tiroirs", n: o.tiroirs }] : o.tiroirs === 1 ? [{ t: "etageres", n: 1, portes: { n: W > 600 ? 2 : 1 } }, { t: "tiroirs", n: 1, h: 150 }] : [{ t: "etageres", n: 1, portes: { n: W > 600 ? 2 : 1 } }];
  caisse(c, x, 0, 0, W, H - 38, D, { nom: o.nom, socle: 100, dessus: false, colonnes: [zones] });
  hw(c, "piedsreg", "🦵", "Pieds réglables de cuisine", 4);
}
export function hautCuisine(c, x, W, nom) {
  caisse(c, x, 1450, 0, W, 700, 330, { nom, colonnes: [[{ t: "etageres", n: 1, portes: { n: W > 600 ? 2 : 1 } }]] });
  hw(c, "fixhaut", "🔩", "Fixations meubles hauts", 2);
}
rec({ id: "cuisine-bas", nom: "Meuble bas de cuisine", e: "🧽", cat: "Cuisine", dims: [60, 87, 56], fixedHP: true, opts: [stp("tiroirs", "Tiroirs", "🗄️", 1, 0, 4)], build(c, p, o) { basCuisine(c, 0, p.L, { tiroirs: o.tiroirs }); planTravail(c, 0, 832, 0, p.L, 600); } });
rec({ id: "cuisine-haut", nom: "Meuble haut de cuisine", e: "⬆️", cat: "Cuisine", dims: [80, 70, 33], opts: [stp("etageres", "Étagères", "📚", 1, 0, 3)], build(c, p, o) {
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { colonnes: [[{ t: "etageres", n: o.etageres, portes: { n: p.L > 600 ? 2 : 1 } }]] }); hw(c, "fixhaut", "🔩", "Fixations meubles hauts", 2);
} });
rec({ id: "cuisine-colonne", nom: "Colonne (frigo, four)", e: "🧊", cat: "Cuisine", dims: [60, 215, 58], opts: [chx("usage", "Usage", [["four", "Four + rangement"], ["rangement", "Rangement"]], "four")], build(c, p, o) {
  const zones = o.usage === "four" ? [{ t: "etageres", n: 1, h: 700, portes: { n: 1 } }, { t: "niche", h: 600 }, { t: "etageres", n: 1, portes: { n: 1 } }] : [{ t: "etageres", n: 2, portes: { n: 1 } }, { t: "etageres", n: 1, h: 600, portes: { n: 1 } }];
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: 100, colonnes: [zones] });
} });
rec({ id: "cuisine-complete", nom: "Cuisine complète", e: "🍳", cat: "Cuisine", dims: [300, 220, 60], dimLabels: ["Longueur totale", "Hauteur", "Profondeur"], opts: [stp("hauts", "Meubles hauts", "⬆️", 1, 0, 1), stp("tiroirs", "Modules à tiroirs", "🗄️", 1, 0, 3)], build(c, p, o) {
  const n = Math.max(1, Math.round(p.L / 600)), W = p.L / n;
  for (let i = 0; i < n; i++) {
    basCuisine(c, i * W, W, { nom: "Bas " + (i + 1), tiroirs: i < o.tiroirs ? 3 : 0 });
    if (o.hauts) hautCuisine(c, i * W, W, "Haut " + (i + 1));
  }
  planTravail(c, 0, 832, 0, p.L, 600);
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
rec({ id: "ilot-cuisine", nom: "Îlot de cuisine / bar", e: "🏝️", cat: "Cuisine", dims: [180, 87, 56], fixedHP: true, opts: [stp("tiroirs", "Modules à tiroirs", "🗄️", 1, 0, 3), stp("bar", "Débord côté bar (cm)", "🍹", 30, 0, 40, 5)], build(c, p, o) {
  const E = c.E, n = Math.max(1, Math.round(p.L / 600)), W = p.L / n;
  for (let i = 0; i < n; i++) {
    basCuisine(c, i * W, W, { nom: "Module " + (i + 1), tiroirs: i < o.tiroirs ? 3 : 0 });
    add(c, "Habillage côté bar " + (i + 1), "caisson", [i * W, 0, -5 - E, W, 832, E], { edge: W });
  }
  planTravail(c, 0, 832, -5 - E - o.bar * 10, p.L, 560 + 5 + E + o.bar * 10);
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

/* Bientôt (bois massif, menuiserie de bâtiment) */
export const BIENTOT = [];

/* ===================== BOIS MASSIF ===================== */
// Pièce en bois massif : la section (planche, chevron, madrier…) est choisie au débit, ou imposée par « sec ».
const M = (c, name, box, sec, extra = {}) => add(c, name, "massif", box, { flags: { section: sec, ...extra } });

rec({ id: "lit-superpose", nom: "Lit superposé", e: "🪜", cat: "Chambre", massif: true, dims: [90, 165, 190], dimLabels: ["Largeur matelas", "Hauteur totale", "Longueur matelas"], opts: [stp("echelle", "Échelle", "🪜", 1, 0, 1)], build(c, p, o) {
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

rec({ id: "chaise", nom: "Chaise", e: "🪑", cat: "Salon", massif: true, dims: [44, 90, 44], dimMin: [30, 60, 30], dimLabels: ["Largeur", "Hauteur du dossier", "Profondeur"], opts: [stp("nombre", "Nombre de chaises", "🪑", 4, 1, 12)], build(c, p, o) {
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

rec({ id: "canape", nom: "Cadre de canapé", e: "🛋️", cat: "Salon", massif: true, dims: [200, 85, 85], opts: [stp("places", "Places", "🛋️", 3, 2, 4)], build(c, p, o) {
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
rec({ id: "porte-pleine", nom: "Porte pleine en bois massif", e: "🚪", cat: "Portes et autres", massif: true, dims: [83, 204, 4], dimMin: [40, 100, 3], dimLabels: DIMS_PORTE, opts: [stp("huisserie", "Avec huisserie", "🧱", 1, 0, 1)], build(c, p, o) {
  const L = p.L, H = p.H, T = p.P, m = 120;
  M(c, "Montant gauche", [0, 0, 0, m, H, T]); M(c, "Montant droit", [L - m, 0, 0, m, H, T]);
  M(c, "Traverse basse", [m, 0, 0, L - 2 * m, 200, T]); M(c, "Traverse du milieu", [m, H / 2 - 75, 0, L - 2 * m, 150, T]); M(c, "Traverse haute", [m, H - m, 0, L - 2 * m, m, T]);
  const pe = Math.max(15, T - 20);
  M(c, "Panneau bas", [m, 200, (T - pe) / 2, L - 2 * m, H / 2 - 75 - 200, pe]);
  M(c, "Panneau haut", [m, H / 2 + 75, (T - pe) / 2, L - 2 * m, H / 2 - 75 - m, pe]);
  if (o.huisserie) huisserie(c, L, H);
  hw(c, "paumelles", "⚙️", "Paumelles", 3); hw(c, "serrure", "🔒", "Serrure + cylindre", 1); hw(c, "poignees", "🚪", "Poignée de porte", 1);
  hw(c, "colle", "🧴", "Colle à bois", 1);
} });
rec({ id: "porte-isoplane", nom: "Porte isoplane", e: "🚪", cat: "Portes et autres", massif: true, dims: [83, 204, 4], dimMin: [40, 100, 3], dimLabels: DIMS_PORTE, opts: [stp("huisserie", "Avec huisserie", "🧱", 1, 0, 1)], build(c, p, o) {
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
rec({ id: "fenetre", nom: "Fenêtre / persienne", e: "🪟", cat: "Portes et autres", massif: true, dims: [120, 140, 8], dimMin: [40, 40, 5], dimLabels: ["Largeur", "Hauteur", "Épaisseur du dormant"], opts: [stp("vantaux", "Vantaux", "🪟", 2, 1, 2)], build(c, p, o) {
  const L = p.L, H = p.H, T = p.P, d = 65;
  M(c, "Dormant montant gauche", [0, 0, 0, d, H, T], "chevron"); M(c, "Dormant montant droit", [L - d, 0, 0, d, H, T], "chevron");
  M(c, "Dormant traverse basse", [d, 0, 0, L - 2 * d, d, T], "chevron"); M(c, "Dormant traverse haute", [d, H - d, 0, L - 2 * d, d, T], "chevron");
  const n = o.vantaux, wv = (L - 2 * d - G * (n + 1)) / n, hv = H - 2 * d - 2 * G, yv = d + G, ev = 45;
  for (let v = 0; v < n; v++) {
    const x = d + G + v * (wv + G), nm = n > 1 ? " (vantail " + (v + 1) + ")" : "";
    M(c, "Montant gauche" + nm, [x, yv, 10, 50, hv, ev]); M(c, "Montant droit" + nm, [x + wv - 50, yv, 10, 50, hv, ev]);
    M(c, "Traverse basse" + nm, [x + 50, yv, 10, wv - 100, 70, ev]); M(c, "Traverse haute" + nm, [x + 50, yv + hv - 60, 10, wv - 100, 60, ev]);
    const nl = Math.max(1, Math.floor((hv - 130) / 45));
    for (let i = 0; i < nl; i++) M(c, "Lame" + nm + " " + (i + 1), [x + 50, yv + 70 + i * 45, 18, wv - 100, 55, 12], "lame");
  }
  hw(c, "paumelles", "⚙️", "Paumelles", 2 * n); hw(c, "espagnolette", "🔒", "Espagnolette / crémone", 1); hw(c, "colle", "🧴", "Colle à bois", 1);
} });
rec({ id: "lambris", nom: "Faux plafond / lambris", e: "🏠", cat: "Portes et autres", massif: true, dims: [400, 280, 300], dimLabels: ["Longueur de la pièce", "Hauteur sous plafond", "Largeur de la pièce"], opts: [], build(c, p) {
  const L = p.L, H = p.H, P = p.P, utile = 90, maxL = 3980;
  // Lames pleine longueur ; le complément (au moins 60 cm) est pris dans les chutes, qui servent à plusieurs rangs.
  const rangs = Math.ceil(P / utile), longs = [];
  let reste = L;
  while (reste > maxL) { longs.push(maxL); reste -= maxL; }
  if (longs.length && reste < 600) { longs[longs.length - 1] -= 600 - reste; reste = 600; }
  longs.push(reste);
  for (let r = 0; r < rangs; r++) {
    let x = 0;
    longs.forEach((lg, k) => {
      M(c, "Lame rang " + (r + 1) + (longs.length > 1 ? " (" + (k + 1) + "/" + longs.length + ")" : ""), [x, H - 15, r * utile, lg, 15, Math.min(100, P - r * utile + 10)], "lame");
      x += lg;
    });
  }
  const nt = Math.floor(L / 400) + 1;
  for (let i = 0; i < nt; i++) M(c, "Tasseau " + (i + 1), [Math.min(i * 400, L - 27), H - 15 - 27, 0, 27, 27, P], "latte");
  hw(c, "chevilles", "🔩", "Chevilles + vis de fixation des tasseaux", nt * Math.ceil(P / 600));
  hw(c, "pointes", "🔨", "Pointes de lambris", rangs * nt);
} });

