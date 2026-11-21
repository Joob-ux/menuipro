// MenuiPro — optimisation de découpe en guillotine
/* ===================== DÉCOUPE GUILLOTINE ===================== */
export const SHEET = { w: 2440, h: 1220, trim: 10 };
export function packOnce(items, W, H, kerf, rot, rule) {
  const sheets = [], over = [];
  for (const it of items) {
    let placed = false;
    for (const sh of sheets) { if (tryPlace(sh, it)) { placed = true; break; } }
    if (!placed) { const sh = { free: [{ x: 0, y: 0, w: W, h: H }], parts: [] }; if (tryPlace(sh, it)) sheets.push(sh); else over.push(it); }
  }
  return { sheets, over };
  function tryPlace(sh, it) {
    let best = null;
    sh.free.forEach((f, fi) => {
      [[it.l, it.w], [it.w, it.l]].forEach(([pw, ph], o) => {
        if (o === 1 && (!rot || it.l === it.w)) return;
        if (pw <= f.w && ph <= f.h) { const sc = Math.min(f.w - pw, f.h - ph); if (!best || sc < best.sc) best = { sc, fi, pw, ph }; }
      });
    });
    if (!best) return false;
    const f = sh.free[best.fi], { pw, ph } = best;
    sh.parts.push(Object.assign({}, it, { x: f.x, y: f.y, pw, ph }));
    const dw = f.w - pw, dh = f.h - ph;
    let horiz = dw < dh; if (rule === "long") horiz = !horiz;
    const right = horiz ? { x: f.x + pw + kerf, y: f.y, w: dw - kerf, h: ph } : { x: f.x + pw + kerf, y: f.y, w: dw - kerf, h: f.h };
    const below = horiz ? { x: f.x, y: f.y + ph + kerf, w: f.w, h: dh - kerf } : { x: f.x, y: f.y + ph + kerf, w: pw, h: dh - kerf };
    sh.free.splice(best.fi, 1);
    [right, below].forEach(r => { if (r.w > 20 && r.h > 20) sh.free.push(r); });
    return true;
  }
}
/* Pièce plus grande que la feuille : on la coupe en morceaux égaux (assemblés avec un joint) pour que
   chaque morceau rentre. Ainsi toutes les cotes donnent un nombre exact de feuilles.
   Les trous suivent leur morceau. Renvoie les morceaux et la liste des pièces coupées. */
export function decouperTropGrand(items, W, H) {
  const out = [], joints = [];
  for (const it of items) {
    const na = Math.max(1, Math.ceil(it.l / W)), nb = Math.max(1, Math.ceil(it.w / H));
    if (na * nb === 1) { out.push(it); continue; }
    const l = Math.ceil(it.l / na), w = Math.ceil(it.w / nb), n = na * nb;
    joints.push({ name: it.name, l: it.l, w: it.w, n });
    for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
      const holes = it.holes ? it.holes.filter(h => Math.min(na - 1, Math.floor(h.u / l)) === i && Math.min(nb - 1, Math.floor(h.v / w)) === j).map(h => ({ ...h, u: h.u - i * l, v: h.v - j * w })) : undefined;
      out.push({ ...it, id: it.id + "-" + (i * nb + j + 1), name: it.name + " (morceau " + (i * nb + j + 1) + "/" + n + ", joint)", l, w, joint: true, ...(holes ? { holes } : {}) });
    }
  }
  return { items: out, joints };
}
export function pack(items, kerf, rot, sheet = SHEET) {
  const W = sheet.w - 2 * sheet.trim, H = sheet.h - 2 * sheet.trim;
  const coupe = decouperTropGrand(items, W, H);
  items = coupe.items;
  const sorts = { aire: (a, b) => b.l * b.w - a.l * a.w, long: (a, b) => b.l - a.l || b.w - a.w, large: (a, b) => b.w - a.w || b.l - a.l, perim: (a, b) => (b.l + b.w) - (a.l + a.w) };
  let best = null;
  for (const k in sorts) for (const rule of ["short", "long"]) {
    const r = packOnce(items.slice().sort(sorts[k]), W, H, kerf, rot, rule);
    const last = r.sheets.length ? r.sheets[r.sheets.length - 1].parts.reduce((s, p) => s + p.pw * p.ph, 0) : 0;
    const score = r.over.length * 1e12 + r.sheets.length * 1e8 + last / 1e3;
    if (!best || score < best.score) best = Object.assign({}, r, { score, strategy: k + "/" + rule });
  }
  best.joints = coupe.joints;
  return best;
}

