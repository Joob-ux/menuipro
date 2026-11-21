// MenuiPro — blocs de construction (caisse, zones, tiroirs, portes, plateaux, lits)
import { SHEET } from "./decoupe.js";

/* ===================== MOTEUR À BLOCS MENUIPRO =====================
   Unités : millimètres. Repère : x = largeur (gauche→droite), y = hauteur (sol→haut),
   z = profondeur (fond→façade). box = [x, y, z, sx, sy, sz].
   Un meuble = une recette qui assemble des blocs : caisse, colonnes, zones
   (tiroirs, étagères, penderie, niche), portes, plateaux, pieds, cadres de lit.
==================================================================== */
export const G = 3; // jeu entre façades (mm)

export function newCtx(p) { return { E: p.ep, parts: [], hw: {}, p }; }

export function add(ctx, name, mat, box, o = {}) {
  // L'atelier travaille en panneaux (mélaminé, contreplaqué) : une pièce épaisse (pied, tasseau, cadre…)
  // est faite de bandes de panneau collées les unes sur les autres (contrecollé), découpées sur les feuilles.
  if (mat === "massif") {
    const d = box ? [box[3], box[4], box[5]].sort((a, b) => b - a) : null, E = ctx.E;
    if (d) {
      const couches = d[2] <= E * 1.3 ? 1 : Math.ceil(d[2] / E);
      return add(ctx, name + (couches > 1 ? " (" + couches + " épaisseurs collées)" : ""), "caisson", box,
        { cut: [d[0], d[1]], edge: 0, flags: { ...(o.flags || {}), section: undefined, plein: true, qty: ((o.flags && o.flags.qty) || o.qty || 1) * couches } });
    }
    mat = "caisson";
  }
  let cut = o.cut;
  if (!cut && box) { const d = [box[3], box[4], box[5]].sort((a, b) => b - a); cut = [d[0], d[1]]; }
  const part = Object.assign({
    name, mat, box,
    cut: cut ? [Math.round(Math.max(...cut)), Math.round(Math.min(...cut))] : null,
    edge: Math.round(o.edge || 0), qty: o.qty || 1,
    look: o.look || (mat === "dos" ? "back" : mat === "massif" ? "massif" : "case"),
    holes: []
  }, o.flags || {});
  ctx.parts.push(part);
  return part;
}
// Boîte d'une pièce dans le repère de la pièce entière. Une pièce peut avoir un repère tourné de ±90° autour
// de la verticale (« rep » : retour d'une cuisine en L) : rot 90 → façade vers +x, rot -90 → façade vers -x.
export function boiteMonde(p) {
  const b = p.box, r = p.rep; if (!r || !b) return b;
  const [x, y, z, sx, sy, sz] = b;
  return r.rot === 90 ? [r.x + z, y, r.z - x - sx, sz, sy, sx] : [r.x - z - sz, y, r.z + x, sz, sy, sx];
}
export function add3d(ctx, look, box, flags = {}) { ctx.parts.push(Object.assign({ name: "", mat: null, box, look, only3d: true, qty: 1, edge: 0, holes: [] }, flags)); }
export function hw(ctx, key, icon, label, qty, unit = "") {
  if (!ctx.hw[key]) ctx.hw[key] = { icon, label, qty: 0, unit };
  ctx.hw[key].qty += qty;
}

/* ---------- Bloc : caisse ---------- */
export function caisse(ctx, x0, y0, z0, W, H, D, o = {}) {
  const E = ctx.E, socle = o.socle || 0, nm = o.nom ? o.nom + " · " : "";
  if (o.cotes !== false) {
    add(ctx, nm + "Côté gauche", "caisson", [x0, y0, z0, E, H, D], { edge: H });
    add(ctx, nm + "Côté droit", "caisson", [x0 + W - E, y0, z0, E, H, D], { edge: H });
  }
  add(ctx, nm + "Dessous", "caisson", [x0 + E, y0 + socle, z0, W - 2 * E, E, D], { edge: W - 2 * E });
  if (o.dessus !== false) add(ctx, nm + "Dessus", "caisson", [x0 + E, y0 + H - E, z0, W - 2 * E, E, D], { edge: W - 2 * E });
  if (socle > 0) add(ctx, nm + "Plinthe", "caisson", [x0 + E, y0, z0 + D - E - 20, W - 2 * E, socle, E], { edge: W - 2 * E });
  if (o.dos !== false) {
    const Hd = H - socle, maxL = SHEET.w - 2 * SHEET.trim, maxW = SHEET.h - 2 * SHEET.trim;
    const fits = (a, b) => Math.max(a, b) <= maxL && Math.min(a, b) <= maxW;
    let k = 1; while (!fits(W / k, Hd) && k < 6) k++;
    if (fits(W / k, Hd)) for (let i = 0; i < k; i++) add(ctx, nm + "Dos" + (k > 1 ? " " + (i + 1) + "/" + k : ""), "dos", [x0 + i * W / k, y0 + socle, z0 - 5, W / k, Hd, 5]);
    else { let j = 1; while (!fits(W, Hd / j) && j < 6) j++; for (let i = 0; i < j; i++) add(ctx, nm + "Dos " + (i + 1) + "/" + j, "dos", [x0, y0 + socle + i * Hd / j, z0 - 5, W, Hd / j, 5]); }
    hw(ctx, "pointes", "🔨", "Pointes pour les dos", Math.ceil(2 * (W + H - socle) / 120));
  }
  if (o.facadeArriere) add(ctx, nm + "Façade arrière", "caisson", [x0, y0, z0 - E, W, H, E], { edge: 2 * W + 2 * H });
  const top = o.dessus === false ? H : H - E;
  const inner = { x: x0 + E, y: y0 + socle + E, w: W - 2 * E, h: top - socle - E, z: z0, d: D };
  const cols = o.colonnes || [[]];
  const n = cols.length, libre = inner.w - (n - 1) * E;
  // Largeurs de colonnes : égales, ou proportionnelles à o.largeurs (ex. caisson d'angle : partie cachée + partie avec porte).
  const wcs = o.largeurs && o.largeurs.length === n ? o.largeurs.map(v => v * libre / o.largeurs.reduce((t, u) => t + u, 0)) : cols.map(() => libre / n);
  let cx = inner.x;
  cols.forEach((zones, k) => {
    const wc = wcs[k];
    if (k > 0) cx += wcs[k - 1] + E;
    if (k > 0) add(ctx, nm + "Séparation " + k, "caisson", [cx - E, inner.y, z0, E, inner.h, D - 2], { edge: inner.h });
    zonesFill(ctx, { x: cx, y: inner.y, w: wc, h: inner.h, z: z0, d: D }, zones, nm + (n > 1 ? "Col. " + (k + 1) + " · " : ""));
  });
  return inner;
}

/* ---------- Bloc : empilement de zones dans une colonne ---------- */
export function zonesFill(ctx, r, zones, nm) {
  const E = ctx.E;
  if (!zones.length) return;
  const sep = (zones.length - 1) * E, avail = r.h - sep;
  let hs = zones.map(z => z.h || 0);
  const free = zones.filter(z => !z.h).length;
  let fixed = hs.reduce((a, b) => a + b, 0), auto = 0;
  if (free) {
    auto = (avail - fixed) / free;
    if (auto < 120 && fixed > 0) { const k = Math.max(0.2, (avail - 120 * free) / fixed); hs = hs.map(h => h * k); fixed = hs.reduce((a, b) => a + b, 0); auto = (avail - fixed) / free; }
  } else if (fixed > 0) { const k = avail / fixed; hs = hs.map(h => h * k); }
  let y = r.y;
  zones.forEach((z, i) => {
    const zh = z.h ? hs[i] : auto;
    fillZone(ctx, { x: r.x, y, w: r.w, h: zh, z: r.z, d: r.d }, z, nm);
    y += zh;
    if (i < zones.length - 1) { add(ctx, nm + "Traverse " + (i + 1), "caisson", [r.x, y, r.z, r.w, E, r.d - 20], { edge: r.w }); y += E; }
  });
}

/* ---------- Bloc : contenu d'une zone ---------- */
export function fillZone(ctx, r, z, nm) {
  const E = ctx.E;
  // Case partagée en sous-colonnes : séparations verticales, puis chaque sous-colonne comme une colonne.
  if (z.sous && z.sous.length > 1) {
    const n = z.sous.length, wTot = r.w - (n - 1) * E, sf = z.sous.reduce((s, c) => s + c.f, 0);
    let x = r.x;
    z.sous.forEach((c, i) => {
      const w = wTot * c.f / sf;
      if (i > 0) add(ctx, nm + "Séparation intérieure " + i, "caisson", [x - E, r.y, r.z, E, r.h, r.d - 20], { edge: r.h });
      zonesFill(ctx, { x, y: r.y, w, h: r.h, z: r.z, d: r.d }, c.zones, nm + "Casier " + (i + 1) + " · ");
      x += w + E;
    });
    if (z.portes && z.portes.n > 0) portes(ctx, r, z.portes, nm);
    return;
  }
  if (z.t === "etageres") {
    const n = z.n || 0;
    for (let i = 1; i <= n; i++) {
      const y = r.y + i * r.h / (n + 1) - E / 2;
      add(ctx, nm + "Étagère " + i, "caisson", [r.x + 1, y, r.z, r.w - 2, E, r.d - 20], { edge: r.w, flags: { shelf: true } });
      hw(ctx, "taquets", "📌", "Taquets d'étagère", 4);
    }
  }
  if (z.t === "penderie") {
    const chap = (z.n || 0) > 0 && r.h > 900;
    if (chap) add(ctx, nm + "Étagère chapelière", "caisson", [r.x + 1, r.y + r.h - 300, r.z, r.w - 2, E, r.d - 20], { edge: r.w, flags: { shelf: true } });
    if (chap) hw(ctx, "taquets", "📌", "Taquets d'étagère", 4);
    add3d(ctx, "metal", [r.x, r.y + r.h - (chap ? 380 : 80), r.z + r.d / 2 - 12, r.w, 25, 25]);
    hw(ctx, "tringle", "➖", "Tringle de penderie", r.w / 1000, "m");
    hw(ctx, "supports", "🔩", "Supports de tringle", 2);
  }
  if (z.t === "tiroirs") tiroirs(ctx, r, z.n || 1, nm);
  if (z.portes && z.portes.n > 0) portes(ctx, r, z.portes, nm);
}

/* ---------- Bloc : tiroirs (façades + caissons) ---------- */
export function tiroirs(ctx, r, n, nm, o = {}) {
  const E = ctx.E;
  n = Math.max(1, Math.min(n, Math.floor((r.h + E) / 90)));
  const X = r.x - E / 2 + G / 2, W = r.w + E - G, Y = r.y - E / 2 + G / 2, Ht = r.h + E - G;
  const fh = (Ht - G * (n - 1)) / n;
  const bd = Math.max(200, r.d - 50), bw = r.w - 26;
  const slide = Math.max(250, Math.min(550, Math.floor(bd / 50) * 50));
  for (let i = 0; i < n; i++) {
    const y = Y + i * (fh + G), bh = Math.max(60, Math.min(fh - 40, 250));
    // « tiroir » : mesures du caisson et des coulisses, pour les montrer dans la 3D quand le tiroir s'ouvre
    // (les pièces à couper, elles, sont listées juste en dessous).
    const yb = y + Math.max(8, Math.min(30, (fh - bh) / 3));
    add(ctx, nm + "Façade tiroir " + (i + 1), "caisson", [X, y, r.z + r.d, W, fh, E], { edge: 2 * (W + fh),
      flags: { drawer: true, travel: bd * 0.7, tiroir: { x: r.x, w: r.w, y: yb, h: bh, front: r.z + r.d, prof: bd, coulisse: slide, ep: E } } });
    add(ctx, nm + "Côtés tiroir " + (i + 1) + " (×2)", "caisson", null, { cut: [bd, bh], qty: 2 });
    add(ctx, nm + "Avant/arrière tiroir " + (i + 1) + " (×2)", "caisson", null, { cut: [bw - 2 * E, bh], qty: 2 });
    add(ctx, nm + "Fond tiroir " + (i + 1), "dos", null, { cut: [bw, bd] });
  }
  hw(ctx, "coulisses" + slide, "🗄️", "Coulisses " + slide / 10 + " cm (paires)", n);
  hw(ctx, "poignees", "🚪", "Poignées", n);
}

/* ---------- Bloc : portes ---------- */
export function portes(ctx, r, o, nm) {
  const E = ctx.E, n = o.n, type = o.type || "battante";
  const X = r.x - E / 2 + G / 2, W = r.w + E - G, Y = r.y - E / 2 + G / 2, Hh = r.h + E - G, z = r.z + r.d;
  if (type === "coulissante" || type === "coulissante-vitree") {
    const w = (W + 40) / 2;
    [0, 1].forEach(i => {
      const box = [X + i * (W - w), Y, z + (i ? 0 : E + 4), w, Hh, type === "coulissante" ? E : 6];
      if (type === "coulissante") add(ctx, nm + "Porte coulissante " + (i + 1), "caisson", box, { edge: 2 * (w + Hh), flags: { slide: i ? -1 : 1, travel: w * 0.75 } });
      else add3d(ctx, "glass", box, { slide: i ? -1 : 1, travel: w * 0.75 });
    });
    if (type === "coulissante-vitree") hw(ctx, "verre", "🪟", "Verre trempé", 2 * w * Hh / 1e6, "m²");
    hw(ctx, "rail", "↔️", "Rail de porte coulissante", W / 1000, "m");
    hw(ctx, "galets", "⚙️", "Kits galets coulissants", 2);
    hw(ctx, "cuvettes", "✋", "Poignées cuvette", 2);
    return;
  }
  const wd = (W - G * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = X + i * (wd + G), left = n === 1 || i % 2 === 0;
    const nb = Hh <= 900 ? 2 : Hh <= 1600 ? 3 : 4;
    if (type === "vitree") {
      add3d(ctx, "glass", [x, Y, z, wd, Hh, 6], { door: true, hingeLeft: left });
      hw(ctx, "verre", "🪟", "Verre trempé", wd * Hh / 1e6, "m²");
      hw(ctx, "charnv", "⭕", "Charnières pour verre", nb);
    } else {
      const door = add(ctx, nm + "Porte " + (i + 1), "caisson", [x, Y, z, wd, Hh, E], { edge: 2 * (wd + Hh), flags: { door: true, hingeLeft: left } });
      const hx = left ? x + 22.5 : x + wd - 22.5;
      for (let j = 0; j < nb; j++) { const hy = Y + 100 + j * (Hh - 200) / (nb - 1); door.holes.push({ p: [hx, hy, z], axis: 2, d: 35, depth: 12, kind: "charniere" }); }
      hw(ctx, "charn", "⭕", "Charnières invisibles", nb);
    }
    hw(ctx, "poignees", "🚪", "Poignées", 1);
  }
}

/* ---------- Blocs : plateau, panneau, pieds ---------- */
export function plateau(ctx, name, x, y, z, W, D, edge) { add(ctx, name, "caisson", [x, y, z, W, ctx.E, D], { edge: edge ?? 2 * (W + D) }); }
export function panneauV(ctx, name, x, y, z, H, D, edge) { add(ctx, name, "caisson", [x, y, z, ctx.E, H, D], { edge: edge ?? H }); }
export function voile(ctx, name, x, y, z, W, H) { add(ctx, name, "caisson", [x, y, z, W, H, ctx.E], { edge: 0 }); }
export function piedsAchetes(ctx, pts, h) {
  pts.forEach(([x, z]) => add3d(ctx, "metal", [x - 20, 0, z - 20, 40, h, 40]));
  hw(ctx, "pieds", "🦵", "Pieds " + Math.round(h / 10) + " cm (achetés)", pts.length);
}
export function planTravail(ctx, x, y, z, W, D) {
  add3d(ctx, "top", [x, y, z, W, 38, D]);
  hw(ctx, "pdt", "🟫", "Plan de travail 38 mm", W / 1000, "m");
}

/* ---------- Bloc : lit ---------- */
export function lit(ctx, p, o = {}) {
  const E = ctx.E, L = p.L, Lg = p.P, Ht = p.H, Hc = 350;
  // Chant sur le dessus, toute la longueur (les bouts sont cachés par la tête et le pied de lit).
  panneauV(ctx, "Côté de lit gauche", 0, 0, 0, Hc, Lg, Lg);
  panneauV(ctx, "Côté de lit droit", L + E, 0, 0, Hc, Lg, Lg);
  add(ctx, "Tête de lit", "caisson", [0, 0, -E, L + 2 * E, Ht, E], { edge: 2 * (L + 2 * E) + 2 * Ht });
  add(ctx, "Pied de lit", "caisson", [0, 0, Lg, L + 2 * E, Hc + 50, E], { edge: 2 * (L + 2 * E) + 2 * (Hc + 50) });
  const nl = Math.round(Lg / 110);
  for (let i = 0; i < nl; i++) add3d(ctx, "massif", [E, Hc - 60, 40 + i * (Lg - 80) / (nl - 1) - 35, L, 20, 70]);
  hw(ctx, "lattes", "🪵", "Lattes bois " + (L / 10) + " cm", nl);
  hw(ctx, "tasseaux", "🪵", "Tasseaux d'appui (bois massif)", 2 * Lg / 1000, "m");
  if (L > 1000) { add3d(ctx, "massif", [E + L / 2 - 30, 0, 40, 60, Hc - 60, Lg - 80]); hw(ctx, "poutre", "🪵", "Traverse centrale (bois massif)", Lg / 1000, "m"); }
  hw(ctx, "equerres", "📐", "Équerres d'assemblage", 8);
  const nt = o.tiroirs || 0;
  if (nt > 0) {
    const dw = (Lg - 200 - G * (nt - 1)) / nt;
    [0, 1].forEach(s => {
      for (let i = 0; i < nt; i++) {
        const x = s ? L + 2 * E : -E;
        add(ctx, "Façade tiroir de lit " + (s ? "D" : "G") + (i + 1), "caisson", [x, 30, 100 + i * (dw + G), E, 230, dw], { edge: 2 * (dw + 230), flags: { drawer: true, axis: "x", dir: s ? 1 : -1, travel: 350 } });
        add(ctx, "Caisson tiroir de lit " + (s ? "D" : "G") + (i + 1) + " (côtés ×2)", "caisson", null, { cut: [450, 180], qty: 2 });
        add(ctx, "Caisson tiroir de lit " + (s ? "D" : "G") + (i + 1) + " (avant/arrière ×2)", "caisson", null, { cut: [dw - 40, 180], qty: 2 });
        add(ctx, "Fond tiroir de lit " + (s ? "D" : "G") + (i + 1), "dos", null, { cut: [dw - 40, 450] });
      }
    });
    hw(ctx, "roulettes", "🛞", "Roulettes de tiroir", 4 * 2 * nt);
    hw(ctx, "poignees", "🚪", "Poignées", 2 * nt);
  }
}

/* ---------- Armoire générique ---------- */
export function armoire(c, p, o) {
  const nP = o.portes, type = o.type || "battante";
  const sliding = type.startsWith("coulissante");
  const ncol = sliding ? Math.max(1, Math.ceil(nP / 2)) : Math.max(1, Math.ceil(nP / 2));
  const cols = [];
  for (let k = 0; k < ncol; k++) {
    const dpc = sliding ? 0 : (k === ncol - 1 && nP % 2 === 1 ? 1 : Math.min(2, nP));
    const z = [];
    if (o.tiroirs) z.push({ t: "tiroirs", n: o.tiroirs, h: o.tiroirs * 170 });
    const pend = o.penderie && k === 0;
    z.push({ t: pend ? "penderie" : "etageres", n: pend ? 1 : o.etageres, portes: dpc ? { n: dpc, type } : null });
    cols.push(z);
  }
  caisse(c, 0, 0, 0, p.L, p.H, p.P, { socle: o.socle ?? 80, colonnes: cols });
  if (sliding) portes(c, { x: c.E, y: (o.socle ?? 80) + c.E, w: p.L - 2 * c.E, h: p.H - (o.socle ?? 80) - 2 * c.E, z: 0, d: p.P }, { n: 2, type }, "");
}

