// MenuiPro — calcul automatique des chants (20 / 40)
// L'algorithme choisit le chant de chaque côté selon le rôle de la pièce.
// Côtés : L1 = longueur avant (visible), L2 = longueur arrière,
//         l1 = largeur haut/gauche, l2 = largeur bas/droite.
// Ne touche pas au DOM.

// Règles : 40 = côtés et jonctions, 20 = visible simple, 0 = caché ou rainuré
export const REGLES = {
  cote:          { L1: 40, L2: 40, l1: 20, l2: 0  }, // l2 = posé au sol
  dessus:        { L1: 40, L2: 0,  l1: 40, l2: 40 }, // L2 = contre le mur
  dessous:       { L1: 40, L2: 0,  l1: 40, l2: 40 },
  traverse:      { L1: 40, L2: 0,  l1: 0,  l2: 0  },
  separation:    { L1: 40, L2: 0,  l1: 40, l2: 40 }, // montant central
  etagere:       { L1: 20, L2: 0,  l1: 0,  l2: 0  },
  porte:         { L1: 20, L2: 20, l1: 20, l2: 20 },
  facade_tiroir: { L1: 20, L2: 20, l1: 20, l2: 20 },
  cote_tiroir:   { L1: 20, L2: 0,  l1: 0,  l2: 0  },
  plinthe:       { L1: 20, L2: 0,  l1: 0,  l2: 0  },
  fond:          { L1: 0,  L2: 0,  l1: 0,  l2: 0  }, // rainuré
};

// Si "type" n'est pas fourni, on le devine depuis le nom de la pièce
const MOTS_CLES = [
  [/fa[cç]ade.*tiroir|devant.*tiroir/i, "facade_tiroir"],
  [/tiroir/i, "cote_tiroir"],
  [/porte|fa[cç]ade|battant/i, "porte"],
  [/s[ée]paration|montant|refend/i, "separation"],
  [/c[oô]t[ée]|joue/i, "cote"],
  [/dessus|chapeau|plateau/i, "dessus"],
  [/dessous|fond de caisson|socle|bas/i, "dessous"],
  [/[ée]tag[eè]re|tablette|rayon/i, "etagere"],
  [/traverse|lisse/i, "traverse"],
  [/plinthe/i, "plinthe"],
  [/fond|dos/i, "fond"],
];

export function detecterType(p) {
  if (p.type && REGLES[p.type]) return p.type;
  const m = MOTS_CLES.find(([re]) => re.test(p.nom || ""));
  return m ? m[1] : "etagere"; // par défaut : seul l'avant est chanté en 20
}

/** Attribue automatiquement les chants. Options par pièce :
 *  - p.cache : ['L2', 'l1'] -> force ces côtés à 0 (contre un mur, encastré)
 *  - p.chants : valeurs manuelles qui écrasent l'automatique */
export function attribuerChants(p) {
  const type = detecterType(p);
  const chants = { ...REGLES[type] };
  (p.cache || []).forEach(c => { chants[c] = 0; });
  Object.assign(chants, p.chants || {});
  return { ...p, type, chants };
}

/** Calcule les mètres de chant 20 et 40.
 *  @param pieces  [{ nom, L, l, qte, type?, cache?, chants? }] (mm)
 *  @param prix    { 20: F/m, 40: F/m }
 *  @param marge   mm ajoutés par chant posé (chute) */
export function calculChants(pieces, prix = { 20: 0, 40: 0 }, marge = 50) {
  const totalMm = { 20: 0, 40: 0 };
  const detail = pieces.map(brute => {
    const p = attribuerChants(brute);
    const dims = { L1: p.L, L2: p.L, l1: p.l, l2: p.l };
    const piece = { 20: 0, 40: 0 };
    for (const [cote, t] of Object.entries(p.chants)) {
      if (t === 20 || t === 40) piece[t] += (dims[cote] + marge) * (p.qte || 1);
    }
    totalMm[20] += piece[20];
    totalMm[40] += piece[40];
    return { nom: p.nom, type: p.type, chants: p.chants,
             chant20_m: +(piece[20] / 1000).toFixed(2),
             chant40_m: +(piece[40] / 1000).toFixed(2) };
  });
  const m20 = +(totalMm[20] / 1000).toFixed(2);
  const m40 = +(totalMm[40] / 1000).toFixed(2);
  return {
    detail,
    chant20: { metres: m20, prix_m: prix[20], total: Math.round(m20 * prix[20]) },
    chant40: { metres: m40, prix_m: prix[40], total: Math.round(m40 * prix[40]) },
    totalPrix: Math.round(m20 * prix[20] + m40 * prix[40]),
  };
}

/** Texte prêt à afficher dans le résultat */
export function resumeChants(r) {
  return `Chant 20 : ${r.chant20.metres} m × ${r.chant20.prix_m} F = ${r.chant20.total} F\n` +
         `Chant 40 : ${r.chant40.metres} m × ${r.chant40.prix_m} F = ${r.chant40.total} F`;
}

/** Pièces du moteur (ctx.parts) → pièces pour calculChants. Le contreplaqué (dos, fonds) n'est pas chanté. */
export function piecesDepuisCtx(ctx) {
  return ctx.parts.filter(p => p.mat && p.mat !== "massif").map(p => ({
    nom: (p.name || "").replace(/ \(×2\)/, ""), L: Math.max(p.cut[0], p.cut[1]), l: Math.min(p.cut[0], p.cut[1]),
    qte: p.qty || 1, ...(p.mat === "dos" ? { type: "fond" } : {}), ...(p.chantType ? { type: p.chantType } : {}),
  }));
}
export const chantsCtx = (ctx, prix, marge) => calculChants(piecesDepuisCtx(ctx), prix, marge);
