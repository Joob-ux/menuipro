// MenuiPro — vue de face cotée : projection des pièces sur le plan largeur × hauteur (sans DOM).
// Repère du moteur : x = largeur, y = hauteur (sol = 0), z = profondeur (fond → façade).

const LOOKS = { glass: "verre", mirror: "miroir", top: "plan", metal: "metal", massif: "massif", back: "dos" };

// Nature d'une pièce pour le dessin : porte, tiroir, verre, caisson…
function nature(p) {
  if (p.door || p.slide) return p.look === "glass" ? "verre" : "porte";
  if (p.drawer) return "tiroir";
  if (p.mat === "dos") return "dos";
  return LOOKS[p.look] || "caisson";
}

const arrondi = v => Math.round(v);

// Découpe un intervalle [a, b] en ouvertures séparées par des panneaux (intervalles triés).
function ouvertures(a, b, panneaux, min) {
  const out = []; let pos = a;
  for (const [p0, p1] of panneaux) {
    if (p1 <= pos + 0.5) continue;
    if (p0 - pos >= min) out.push([pos, p0]);
    pos = Math.max(pos, p1);
  }
  if (b - pos >= min) out.push([pos, b]);
  return out;
}
// Fusionne des intervalles qui se chevauchent.
function fusion(iv) {
  const s = [...iv].sort((x, y) => x[0] - y[0]), out = [];
  for (const [a, b] of s) { const l = out[out.length - 1]; if (l && a <= l[1] + 0.5) l[1] = Math.max(l[1], b); else out.push([a, b]); }
  return out;
}

/**
 * Vue de face d'un meuble construit (ctx de buildRecipe).
 * Renvoie : boite (encombrement), rects (du fond vers l'avant), cotes :
 *  - largeur, hauteur, profondeur totales (mm) et hauteur au-dessus du sol (meuble suspendu) ;
 *  - colonnes : largeurs des ouvertures entre panneaux verticaux ;
 *  - niveaux : hauteurs des ouvertures entre panneaux horizontaux, dans la colonne de droite.
 */
export function vueFace(ctx) {
  const E = ctx.E, parts = ctx.parts.filter(p => p.box && p.box[3] > 0 && p.box[4] > 0);
  if (!parts.length) return null;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const { box: [x, y, z, sx, sy, sz] } of parts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
    x1 = Math.max(x1, x + sx); y1 = Math.max(y1, y + sy); z1 = Math.max(z1, z + sz);
  }
  // Du fond vers l'avant : ce qui est devant est dessiné en dernier.
  const rects = parts
    .map(p => ({ x: p.box[0], y: p.box[1], w: p.box[3], h: p.box[4], zf: p.box[2] + p.box[5], nature: nature(p), nom: p.name || "" }))
    .sort((a, b) => a.zf - b.zf);
  const L = x1 - x0, H = y1 - y0;

  // Panneaux du caisson (hors portes, tiroirs, dos, verre) : verticaux et horizontaux.
  const carc = parts.filter(p => !p.door && !p.drawer && !p.slide && p.mat !== "dos" && p.mat && p.box[5] > E * 2);
  const verticaux = fusion(carc.filter(p => p.box[3] <= E + 1 && p.box[4] >= 0.3 * H).map(p => [p.box[0], p.box[0] + p.box[3]]));
  const colonnes = ouvertures(x0, x1, verticaux, 40).map(([a, b]) => ({ a: arrondi(a), b: arrondi(b), v: arrondi(b - a) }));

  // Niveaux mesurés dans la colonne de droite (celle qu'on cote sur le côté droit du dessin).
  const ref = colonnes.length ? colonnes[colonnes.length - 1] : { a: x0, b: x1 };
  const mid = (ref.a + ref.b) / 2;
  const horizontaux = fusion(carc.filter(p => p.box[4] <= E + 1 && p.box[3] >= 60 && p.box[0] <= mid && p.box[0] + p.box[3] >= mid).map(p => [p.box[1], p.box[1] + p.box[4]]));
  const niveaux = ouvertures(y0, y1, horizontaux, 40).map(([a, b]) => ({ a: arrondi(a), b: arrondi(b), v: arrondi(b - a) }));
  // Hauteur de chaque façade de tiroir dans cette même colonne (utile pour la découpe des façades).
  const tiroirs = parts.filter(p => p.drawer && p.box[0] <= mid && p.box[0] + p.box[3] >= mid)
    .map(p => ({ a: arrondi(p.box[1]), b: arrondi(p.box[1] + p.box[4]), v: arrondi(p.box[4]) })).sort((u, w) => u.a - w.a);

  return {
    boite: { x0, y0, x1, y1 },
    rects,
    cotes: { largeur: arrondi(L), hauteur: arrondi(H), profondeur: arrondi(z1 - z0), sol: arrondi(Math.max(0, y0)), colonnes, niveaux, tiroirs }
  };
}
