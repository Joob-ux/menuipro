// MenuiPro — « Ma 3D » : découpe tirée d'une 3D importée (SketchUp, Blender…). Aucun accès au DOM ici.
// L'interface lit les panneaux dans la 3D (import3d.js → lirePanneaux) ; ce module les transforme en pièces
// aux dimensions réelles saisies par le menuisier (L × H × P).
import { add, caisse } from "./blocs.js";

/* Format (mm, repère MenuiPro : x largeur, y hauteur, z profondeur) :
   { base: [L, H, P] taille de la 3D lue,
     list: [ { n: nom, b: [x, y, z, w, h, d], t: axe de l'épaisseur 0|1|2, m: "caisson"|"dos"|"massif", ep: épaisseur lue } ],
     ignores: nombre d'objets qui ne sont pas des panneaux (poignées, tissus, déco…) } */

const MATS = ["caisson", "dos", "massif"];
const ok = v => Number.isFinite(v);

export function normaliserModele(m) {
  if (!m || !Array.isArray(m.list) || !Array.isArray(m.base) || m.base.length !== 3 || !m.base.every(v => ok(v) && v > 0)) return null;
  const list = m.list.slice(0, 400).filter(p => p && Array.isArray(p.b) && p.b.length === 6 && p.b.every(ok) && p.b.slice(3).every(v => v > 0))
    .map(p => ({ n: String(p.n || "Panneau").slice(0, 60), b: p.b.map(Number), t: [0, 1, 2].includes(p.t) ? p.t : 1, m: MATS.includes(p.m) ? p.m : "caisson", ep: ok(p.ep) ? p.ep : 18 }));
  return list.length ? { base: m.base.map(Number), list, ignores: Math.max(0, m.ignores | 0) } : null;
}

/* Remet un panneau aux dimensions réelles. Sur l'axe de l'épaisseur, l'épaisseur ne change pas :
   un panneau collé à un bord reste collé à ce bord, les autres gardent leur milieu. */
export function etirerPanneau(p, base, dims, E) {
  const b = p.b.slice();
  // Bois massif (pied, tasseau) : la section ne change pas, seule la longueur suit le meuble.
  const long = [0, 1, 2].reduce((m, a) => p.b[3 + a] > p.b[3 + m] ? a : m, 0);
  const garde = a => p.m === "massif" ? a !== long : a === p.t;
  for (let a = 0; a < 3; a++) {
    const k = dims[a] / base[a], x0 = b[a], x1 = b[a] + b[3 + a];
    const ep = p.m === "caisson" && a === p.t ? E : p.m === "dos" && a === p.t ? 5 : p.b[3 + a];
    if (!garde(a)) { b[a] = x0 * k; b[3 + a] = (x1 - x0) * k; continue; }
    const tol = Math.max(2, base[a] * 0.01);
    if (x1 >= base[a] - tol) b[a] = x1 * k - ep;          // collé au bord droit / haut / avant
    else if (x0 <= tol) b[a] = x0 * k;                    // collé au bord gauche / bas / fond
    else b[a] = (x0 + x1) / 2 * k - ep / 2;               // au milieu
    b[3 + a] = ep;
  }
  return b;
}

export function construireModele(c, p, o) {
  const m = normaliserModele(o && o.panneaux);
  if (!m) { // pas encore de 3D lue : une caisse simple, pour que l'écran ne soit jamais vide
    caisse(c, 0, 0, 0, p.L, p.H, p.P, { nom: "Caisse", colonnes: [[{ t: "etageres", n: 1 }]] });
    return;
  }
  const dims = [p.L, p.H, p.P];
  m.list.forEach(x => {
    const b = etirerPanneau(x, m.base, dims, c.E);
    const longueur = Math.max(...b.slice(3).filter((_, a) => a !== x.t));
    add(c, x.n, x.m, b, { edge: x.m === "caisson" ? longueur : 0 });
  });
}
