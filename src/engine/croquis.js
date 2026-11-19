// MenuiPro — « Mon dessin » : le menuisier dessine la façade, le moteur en fait un vrai meuble
// (pièces, découpe, quincaillerie, 3D). Aucun accès au DOM ici.
import { add, caisse, zonesFill, piedsAchetes } from "./blocs.js";

/* Format du croquis (tout en proportions, les cotes réelles viennent de L × H × P) :
   { socle: 1|0 (plinthe de 8 cm) ou hauteur de plinthe en mm (40 → 200), pieds: hauteur des pieds en mm (0 = pas de pieds),
     dos: 1|0 (panneau de fond),
     cols: [ { f: poids de largeur,
               zones: [ { f: poids de hauteur, t: "etageres"|"tiroirs"|"penderie"|"vide", n, portes: 0|1|2 } ] } ] }
   Les zones vont du BAS vers le HAUT. */
export const TYPES_ZONE = ["etageres", "tiroirs", "penderie", "vide"];
export const MAX_COLS = 8, MAX_ZONES = 8;

export function croquisDefaut() {
  return {
    socle: 1,
    cols: [
      { f: 1, zones: [{ f: 1, t: "penderie", n: 1, portes: 1 }] },
      { f: 1, zones: [{ f: 1, t: "tiroirs", n: 2, portes: 0 }, { f: 2.5, t: "etageres", n: 3, portes: 1 }] }
    ]
  };
}

const num = (v, d, a, b) => { v = Number(v); if (!Number.isFinite(v)) v = d; return Math.max(a, Math.min(b, v)); };

// Nettoie un croquis venu de l'interface ou d'un projet enregistré : jamais d'erreur, au pire le croquis par défaut.
export function normaliserCroquis(k) {
  if (!k || !Array.isArray(k.cols) || !k.cols.length) return croquisDefaut();
  const cols = k.cols.slice(0, MAX_COLS).map(c => {
    const zs = (Array.isArray(c && c.zones) && c.zones.length ? c.zones : [{ t: "vide" }]).slice(0, MAX_ZONES).map(z => {
      const t = TYPES_ZONE.includes(z && z.t) ? z.t : "vide";
      return {
        f: num(z && z.f, 1, 0.05, 100), t,
        n: t === "tiroirs" ? Math.round(num(z.n, 1, 1, 8)) : t === "etageres" ? Math.round(num(z.n, 1, 0, 10)) : t === "penderie" ? 1 : 0,
        portes: t === "tiroirs" ? 0 : Math.round(num(z && z.portes, 0, 0, 2))
      };
    });
    return { f: num(c && c.f, 1, 0.05, 100), zones: zs };
  });
  const socle = Number(k.socle) > 1 ? Math.round(num(k.socle, 80, 40, 200)) : k.socle ? 1 : 0;
  const pieds = Number(k.pieds) >= 30 ? Math.round(num(k.pieds, 100, 30, 400)) : 0;
  return { socle: pieds ? 0 : socle, pieds, dos: k.dos === 0 || k.dos === false ? 0 : 1, cols };
}

// Zone du croquis → zone du moteur à blocs. La hauteur « h » est un poids : zonesFill la remet à l'échelle.
const zoneMoteur = z => ({
  t: z.t === "vide" ? "etageres" : z.t,
  n: z.t === "vide" ? 0 : z.n,
  h: z.f,
  portes: z.portes ? { n: z.portes } : null
});

export function construireCroquis(c, p, o) {
  const k = normaliserCroquis(o && o.croquis), E = c.E;
  const socle = hauteurSocle(k), y0 = k.pieds || 0;
  // La caisse donne côtés, dessus, dessous, dos et plinthe ; les colonnes sont posées ici, à largeurs libres.
  const inner = caisse(c, 0, y0, 0, p.L, p.H - y0, p.P, { socle, dos: !!k.dos, colonnes: [[]] });
  if (y0) piedsAchetes(c, [[60, 60], [p.L - 60, 60], [60, p.P - 60], [p.L - 60, p.P - 60]], y0);
  const n = k.cols.length, wTot = inner.w - (n - 1) * E, sf = k.cols.reduce((s, x) => s + x.f, 0);
  let x = inner.x;
  k.cols.forEach((col, i) => {
    const w = wTot * col.f / sf;
    if (i > 0) add(c, "Séparation " + i, "caisson", [x - E, inner.y, 0, E, inner.h, p.P - 2], { edge: inner.h });
    zonesFill(c, { x, y: inner.y, w, h: inner.h, z: 0, d: p.P }, col.zones.map(zoneMoteur), n > 1 ? "Col. " + (i + 1) + " · " : "");
    x += w + E;
  });
}

export const hauteurSocle = k => k.pieds ? 0 : Number(k.socle) > 1 ? Number(k.socle) : k.socle ? 80 : 0;

/* ---------- Lecture d'un trait dessiné au doigt ----------
   pts : points [x, y] en proportions de la façade (0 → 1, y = 0 en haut).
   Renvoie { sens: "vertical"|"horizontal", pos, de, a } ou null si le trait n'est pas assez droit. */
export function lireTrait(pts) {
  if (!pts || pts.length < 2) return null;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const dx = x1 - x0, dy = y1 - y0, moy = a => a.reduce((s, v) => s + v, 0) / a.length;
  if (dy >= 0.08 && dy > 2 * dx) return { sens: "vertical", pos: moy(xs), de: y0, a: y1 };
  if (dx >= 0.08 && dx > 2 * dy) return { sens: "horizontal", pos: moy(ys), de: x0, a: x1 };
  return null;
}

// Bords des colonnes en proportions (0 → 1), sans tenir compte des épaisseurs : c'est le dessin.
export function bordsColonnes(k) {
  const sf = k.cols.reduce((s, c) => s + c.f, 0); let a = 0;
  return k.cols.map(c => { const b = a + c.f / sf, r = [a, b]; a = b; return r; });
}
// Bords des zones d'une colonne, en proportions depuis le HAUT (sens du dessin).
export function bordsZones(col) {
  const sf = col.zones.reduce((s, z) => s + z.f, 0); let a = 0;
  return col.zones.slice().reverse().map(z => { const b = a + z.f / sf, r = [a, b]; a = b; return r; }).reverse();
}

const copie = o => JSON.parse(JSON.stringify(o));

/* Applique un trait au croquis. L, H : cotes réelles (mm) pour refuser les cases trop petites.
   Renvoie un nouveau croquis, ou null si le trait ne change rien. */
export function appliquerTrait(k0, trait, L = 1200, H = 2000, min = 120) {
  if (!trait) return null;
  const k = copie(normaliserCroquis(k0));
  const cb = bordsColonnes(k);
  if (trait.sens === "vertical") {
    if (k.cols.length >= MAX_COLS) return null;
    const i = cb.findIndex(([a, b]) => trait.pos > a && trait.pos < b);
    if (i < 0) return null;
    const [a, b] = cb[i], r = (trait.pos - a) / (b - a);
    if ((trait.pos - a) * L < min || (b - trait.pos) * L < min) return null;
    const col = k.cols[i];
    k.cols.splice(i, 1, { f: col.f * r, zones: copie(col.zones) }, { f: col.f * (1 - r), zones: copie(col.zones) });
    return k;
  }
  // Horizontal : coupe la case touchée dans chaque colonne traversée (au moins celle du milieu du trait).
  const milieu = (trait.de + trait.a) / 2;
  let change = false;
  cb.forEach(([a, b], i) => {
    const traverse = (trait.de < b - 0.02 && trait.a > a + 0.02) || (milieu >= a && milieu < b);
    if (!traverse) return;
    const col = k.cols[i];
    if (col.zones.length >= MAX_ZONES) return;
    const zb = bordsZones(col), j = zb.findIndex(([h, bas]) => trait.pos > h && trait.pos < bas);
    if (j < 0) return;
    const [h, bas] = zb[j];
    if ((trait.pos - h) * H < min || (bas - trait.pos) * H < min) return;
    const z = col.zones[j], rBas = (bas - trait.pos) / (bas - h);
    // zones du bas vers le haut : la partie basse d'abord
    col.zones.splice(j, 1, { ...copie(z), f: z.f * rBas }, { ...copie(z), f: z.f * (1 - rBas) });
    change = true;
  });
  return change ? k : null;
}

/* Remplit une case avec un outil : etagere, tiroir, porte, penderie, vide.
   Toucher plusieurs fois ajoute (étagères, tiroirs) ou change le nombre de portes. */
export function appliquerOutil(k0, i, j, outil) {
  const k = copie(normaliserCroquis(k0)), col = k.cols[i], z = col && col.zones[j];
  if (!z) return null;
  if (outil === "etagere") { if (z.t === "etageres") z.n = (z.n + 1) % 7; else { z.t = "etageres"; z.n = 1; } }
  else if (outil === "tiroir") { if (z.t === "tiroirs") z.n = z.n % 6 + 1; else { z.t = "tiroirs"; z.n = 1; z.portes = 0; } }
  else if (outil === "porte") { if (z.t === "tiroirs") { z.t = "vide"; z.n = 0; } z.portes = (z.portes + 1) % 3; }
  else if (outil === "penderie") { z.t = "penderie"; z.n = 1; }
  else if (outil === "vide") { z.t = "vide"; z.n = 0; z.portes = 0; }
  else if (outil === "gomme") {
    // La gomme efface ce qui est devant en premier : porte, puis étagère, tiroir ou tringle, un à la fois.
    // Une case déjà vide disparaît : elle rejoint sa voisine.
    if (z.portes) z.portes--;
    else if (z.t === "etageres" && z.n > 0) z.n--;
    else if (z.t === "tiroirs" && z.n > 1) z.n--;
    else if (z.t === "tiroirs" || z.t === "penderie") { z.t = "vide"; z.n = 0; }
    else return effacer(k, i, j);
  }
  else return null;
  return normaliserCroquis(k);
}

// Gomme : la case rejoint sa voisine du dessus (ou du dessous) ; une colonne d'une seule case rejoint sa voisine.
function effacer(k, i, j) {
  const col = k.cols[i];
  if (col.zones.length > 1) {
    const v = j + 1 < col.zones.length ? j + 1 : j - 1, garde = col.zones[v];
    garde.f += col.zones[j].f; col.zones.splice(j, 1);
    return normaliserCroquis(k);
  }
  if (k.cols.length > 1) {
    const v = i + 1 < k.cols.length ? i + 1 : i - 1;
    k.cols[v].f += col.f; k.cols.splice(i, 1);
    return normaliserCroquis(k);
  }
  return null;
}

/* Déplace une ligne de séparation. type "col" : entre les colonnes i et i+1 ; "zone" : dans la colonne i,
   entre la case j (en bas) et j+1 (au-dessus). pos : nouvelle position en proportions (x, ou y depuis le haut). */
export function deplacerLigne(k0, type, i, j, pos, L = 1200, H = 2000, min = 120) {
  const k = copie(normaliserCroquis(k0));
  if (type === "col") {
    const cb = bordsColonnes(k); if (!cb[i + 1]) return null;
    const a = cb[i][0], b = cb[i + 1][1];
    const p = Math.max(a + min / L, Math.min(b - min / L, pos));
    if (p <= a || p >= b) return null;
    const tot = k.cols[i].f + k.cols[i + 1].f;
    k.cols[i].f = tot * (p - a) / (b - a); k.cols[i + 1].f = tot - k.cols[i].f;
    return k;
  }
  const col = k.cols[i]; if (!col || !col.zones[j + 1]) return null;
  const zb = bordsZones(col), haut = zb[j + 1][0], bas = zb[j][1];
  const p = Math.max(haut + min / H, Math.min(bas - min / H, pos));
  if (p <= haut || p >= bas) return null;
  const tot = col.zones[j].f + col.zones[j + 1].f;
  col.zones[j].f = tot * (bas - p) / (bas - haut); col.zones[j + 1].f = tot - col.zones[j].f;
  return k;
}

/* Gomme sur une ligne : enlève la séparation entre deux colonnes (type "col", i et i+1)
   ou entre deux cases d'une colonne (type "zone", colonne i, cases j et j+1). La plus grande garde son contenu. */
export function enleverLigne(k0, type, i, j) {
  const k = copie(normaliserCroquis(k0));
  if (type === "col") {
    const a = k.cols[i], b = k.cols[i + 1]; if (!a || !b) return null;
    const garde = a.f >= b.f ? a : b;
    k.cols.splice(i, 2, { f: a.f + b.f, zones: copie(garde.zones) });
    return normaliserCroquis(k);
  }
  const col = k.cols[i], a = col && col.zones[j], b = col && col.zones[j + 1]; if (!a || !b) return null;
  const garde = a.f >= b.f ? a : b;
  col.zones.splice(j, 2, { ...copie(garde), f: a.f + b.f });
  return normaliserCroquis(k);
}
