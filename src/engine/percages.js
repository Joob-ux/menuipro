// MenuiPro — perçages automatiques (vis, tourillons, taquets, charnières)
/* ===================== PERÇAGES =====================
   Détecte chaque assemblage « chant d'un panneau contre la face d'un autre »
   et place les trous dans le panneau traversé :
   - vis Ø4 traversantes (côtés, séparations, dessus/dessous)
   - tourillons Ø8 borgnes quand le panneau repose dessous (plateaux)
   - taquets Ø5 sous les étagères mobiles ; charnières Ø35 sur les portes */
export function computeHoles(ctx) {
  const P = ctx.parts.filter(p => p.box && p.mat === "caisson" && !p.door && !p.drawer && !p.slide);
  const lo = (p, i) => p.box[i], hi = (p, i) => p.box[i] + p.box[i + 3];
  const thin = p => { const d = [p.box[3], p.box[4], p.box[5]]; return d.indexOf(Math.min(...d)); };
  for (const B of P) {
    if (B.shelf) continue;
    const tB = thin(B);
    for (const A of P) {
      if (A === B) continue;
      const tA = thin(A);
      if (tA === tB) continue;
      const tol = A.shelf ? 2.5 : 0.6;
      const touchLow = Math.abs(hi(A, tB) - lo(B, tB)) <= tol, touchHigh = Math.abs(lo(A, tB) - hi(B, tB)) <= tol;
      if (!touchLow && !touchHigh) continue;
      const k = 3 - tA - tB;
      const cA = (lo(A, tA) + hi(A, tA)) / 2;
      if (cA < lo(B, tA) || cA > hi(B, tA)) continue;
      const o0 = Math.max(lo(A, k), lo(B, k)), o1 = Math.min(hi(A, k), hi(B, k)), len = o1 - o0;
      if (len < 40) continue;
      const e = Math.min(50, len / 4), pos = [o0 + e, o1 - e];
      if (len > 600) pos.push((o0 + o1) / 2);
      if (len > 1200) { pos.push(o0 + len / 3, o0 + 2 * len / 3); pos.splice(2, 1); }
      let kind = "vis", d = 4, depth = B.box[3 + tB];
      const below = touchLow && tB === 1; // A sous B : on ne perce pas le dessus visible
      if (A.shelf) { kind = "taquet"; d = 5; depth = 12; }
      else if (below) { kind = "tourillon"; d = 8; depth = 15; }
      const faceT = A.shelf || below ? (touchLow ? lo(B, tB) : hi(B, tB)) : (touchLow ? hi(B, tB) : lo(B, tB));
      for (const q of pos) {
        const pt = [0, 0, 0];
        pt[tB] = faceT; pt[k] = q;
        pt[tA] = A.shelf ? lo(A, tA) - 6 : cA;
        B.holes.push({ p: pt, axis: tB, d, depth, kind });
      }
    }
  }
}
export function holeLocal(part, h) {
  const d = [part.box[3], part.box[4], part.box[5]], t = d.indexOf(Math.min(...d));
  const ax = [0, 1, 2].filter(i => i !== t).sort((a, b) => d[b] - d[a]);
  return { u: h.p[ax[0]] - part.box[ax[0]], v: h.p[ax[1]] - part.box[ax[1]] };
}
export const HOLE_KINDS = { vis: ["Vis Ø4 traversante", "PERCAGE_VIS_D4"], tourillon: ["Tourillon Ø8 (prof. 15)", "PERCAGE_TOURILLON_D8"], taquet: ["Taquet Ø5 (prof. 12)", "PERCAGE_TAQUET_D5"], charniere: ["Charnière Ø35 (prof. 12)", "PERCAGE_CHARNIERE_D35"] };

