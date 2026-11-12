// MenuiPro — recettes de meubles
import { add, add3d, hw, caisse, portes, plateau, panneauV, voile, piedsAchetes, planTravail, lit, armoire } from "./blocs.js";

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

/* Bientôt (bois massif, menuiserie de bâtiment) */
export const BIENTOT = [["Lit superposé", "🪜", "Chambre"], ["Chaises", "🪑", "Salon"], ["Cadre de canapé", "🛋️", "Salon"], ["Porte pleine en bois massif", "🚪", "Portes et autres"], ["Porte isoplane", "🚪", "Portes et autres"], ["Fenêtre / persienne", "🪟", "Portes et autres"], ["Faux plafond / lambris", "🏠", "Portes et autres"]];

