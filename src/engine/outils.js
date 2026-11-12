// MenuiPro — outils et visserie
/* ===================== OUTILS ===================== */
export function outils(ctx) {
  const P = ctx.parts, has = f => P.some(f);
  const chant = P.reduce((t, p) => t + (p.edge || 0) * (p.qty || 1), 0) / 1000;
  const t = [["📏", "Mètre ruban et équerre", "traçage"], ["🪚", "Scie circulaire + rail", "ou scie à panneaux"], ["🔧", "Visseuse", "mèche à étager 4 mm"], ["🗜️", "Serre-joints", "4 minimum"]];
  if (chant > 0) t.push(["🔥", "Fer à repasser ou plaqueuse", "+ cutter affleureur"]);
  if (has(p => p.door && p.mat)) t.push(["⭕", "Perceuse + mèche Forstner 35 mm", "gabarit charnières"]);
  if (has(p => p.drawer)) t.push(["➖", "Niveau + gabarit", "pose des coulisses"]);
  if (has(p => p.shelf)) t.push(["📐", "Gabarit de perçage + mèche 5 mm", "trous de taquets"]);
  if (has(p => p.look === "glass" || p.look === "mirror")) t.push(["🪟", "Ventouses / pose du verre", "verre coupé par le vitrier"]);
  if (has(p => p.mat === "massif")) {
    t.push(["🪵", "Dégauchisseuse / raboteuse", "mise à l'épaisseur du bois"], ["🪚", "Scie à ruban ou circulaire", "refente des planches"], ["🔨", "Mortaiseuse ou défonceuse", "tenons et mortaises"], ["🧴", "Colle à bois + serre-joints", "lamellé-collé"]);
  } else if (has(p => p.look === "massif")) t.push(["🪚", "Scie à onglet", "lattes et tasseaux"]);
  return { tools: t, chant };
}
export function vis(ctx) {
  const structural = ctx.parts.filter(p => p.mat === "caisson" && p.box && !p.door && !p.drawer && !p.shelf).length;
  const drawers = ctx.parts.filter(p => p.drawer).length;
  return Math.ceil((structural * 6 + drawers * 8) / 10) * 10;
}


