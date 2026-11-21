// MenuiPro — bois massif : sections du commerce, choix de la section, refente, lamellé-collé
// et débit des pièces sur les barres (guillotine sans rotation : le fil du bois suit la longueur).
import { pack } from "./decoupe.js";

/** Sections vendues en quincaillerie (mm). Modifiables dans le catalogue de l'application. */
export const SECTIONS_DEF = [
  { id: "lame", nom: "Lame de lambris", ep: 15, larg: 100, long: 4000 },
  { id: "latte", nom: "Latte", ep: 27, larg: 70, long: 4000 },
  { id: "planche", nom: "Planche", ep: 27, larg: 200, long: 4000 },
  { id: "chevron", nom: "Chevron", ep: 65, larg: 80, long: 4000 },
  { id: "madrier", nom: "Madrier", ep: 65, larg: 220, long: 4000 }
];
// Pénalité par joint de colle : on préfère refendre une section plus large que coller des lames.
export const COLLAGE = 150;
export const SURLONGUEUR = 20; // mm pour mettre à longueur après sciage
export const RABOTAGE = 5;     // mm perdus en largeur à la refente et au rabotage

/** Longueur, largeur, épaisseur d'une pièce (mm), à partir de sa boîte 3D. */
export function dimsMassif(p) {
  if (p.mdims) return p.mdims;
  const d = [p.box[3], p.box[4], p.box[5]].sort((a, b) => b - a);
  return { L: Math.round(d[0]), W: Math.round(d[1]), T: Math.round(d[2]) };
}

/** Nombre de lames à coller pour obtenir la largeur (1 si la section suffit telle quelle). */
export const nbLames = (W, s) => (W <= s.larg ? 1 : Math.ceil(W / (s.larg - RABOTAGE)));

/** Section la plus économique : épaisseur suffisante la plus proche, puis le moins de perte en largeur. */
export function choisirSection(p, sections = SECTIONS_DEF) {
  const { L, W, T } = dimsMassif(p);
  let ok = sections.filter(s => s.ep >= T && s.long >= L + SURLONGUEUR);
  // Pièce plus longue que toutes les barres : la plus longue barre assez épaisse, la pièce sera aboutée (joint).
  if (!ok.length) { const ep = sections.filter(s => s.ep >= T); if (!ep.length) return null; const m = Math.max(...ep.map(s => s.long)); ok = ep.filter(s => s.long === m); }
  if (p.section) { const f = ok.find(s => s.id === p.section); if (f) return f; }
  const cout = s => { const n = nbLames(W, s); return (s.ep - T) * 1000 + (n * s.larg - W) + (n - 1) * COLLAGE; };
  return ok.slice().sort((a, b) => cout(a) - cout(b))[0];
}

/** Débit complet : pour chaque section, les barres à acheter et le placement des pièces. */
export function debitMassif(parts, sections = SECTIONS_DEF, kerf = 4) {
  const parSection = {}, trop = [];
  let id = 0;
  for (const p of parts.filter(x => x.mat === "massif")) {
    const { L, W, T } = dimsMassif(p);
    const s = choisirSection(p, sections);
    if (!s) { trop.push({ name: p.name, L, W, T }); continue; }
    const n = nbLames(W, s);
    const w = n === 1 ? Math.min(s.larg, W + RABOTAGE) : Math.ceil(W / n) + RABOTAGE;
    (parSection[s.id] = parSection[s.id] || { section: s, items: [] });
    for (let q = 0; q < (p.qty || 1); q++) for (let k = 0; k < n; k++)
      parSection[s.id].items.push({ id: ++id, name: p.name + (n > 1 ? ` (lame ${k + 1}/${n})` : ""), l: L + SURLONGUEUR, w, lamelle: n > 1, src: p });
  }
  const res = Object.values(parSection).map(({ section, items }) => ({
    section, items, res: pack(items, kerf, false, { w: section.long, h: section.larg, trim: 0 })
  }));
  return { sections: res, trop };
}
