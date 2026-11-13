// MenuiPro — acomptes, paiements et numéros de documents : logique pure (sans DOM), testée.

// Moyens de paiement courants au Sénégal.
export const MODES = [["especes", "💵", "Espèces"], ["wave", "🌊", "Wave"], ["om", "🟠", "Orange Money"], ["virement", "🏦", "Virement / chèque"]];
export const modeNom = k => (MODES.find(m => m[0] === k) || [k, "💵", "Espèces"])[2];

// Montant de l'acompte : pourcentage du prix, arrondi aux 500 F supérieurs (sans dépasser le prix).
export function acompteDu(prix, pct) {
  const p = Math.max(0, Math.round(+prix || 0)), t = Math.max(0, Math.min(100, +pct || 0));
  if (!p || !t) return 0;
  return Math.min(p, Math.ceil(p * t / 100 / 500) * 500);
}

// Ce qui a été payé, ce qui reste, et si c'est soldé.
export function resume(prix, paiements = []) {
  const total = Math.max(0, Math.round(+prix || 0));
  const paye = paiements.reduce((s, x) => s + Math.max(0, Math.round(+x.montant || 0)), 0);
  const reste = Math.max(0, total - paye);
  return { total, paye, reste, solde: total > 0 && reste === 0, trop: Math.max(0, paye - total), pct: total ? Math.min(100, Math.round(paye / total * 100)) : 0 };
}

// Contrôle d'un paiement saisi : montant entier positif, mode connu.
export function validerPaiement(montant, mode) {
  const m = Math.round(+String(montant).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(m) || m <= 0) return { ok: false, erreur: "Entrez un montant." };
  if (m > 100000000) return { ok: false, erreur: "Montant trop grand." };
  if (!MODES.some(x => x[0] === mode)) return { ok: false, erreur: "Choisissez le moyen de paiement." };
  return { ok: true, montant: m, mode };
}

// Numéros de documents : DEV-2026-0001, FAC-2026-0001, REC-2026-0001. Le compteur repart à 1 chaque année.
const PREFIXES = { devis: "DEV", facture: "FAC", recu: "REC" };
export function prochainNumero(compteurs, type, date = new Date()) {
  if (!PREFIXES[type]) throw new Error("type inconnu : " + type);
  const an = date.getFullYear(), c = { ...(compteurs || {}) };
  if (c.annee !== an) { c.annee = an; c.devis = 0; c.facture = 0; c.recu = 0; }
  c[type] = (c[type] || 0) + 1;
  return { num: PREFIXES[type] + "-" + an + "-" + String(c[type]).padStart(4, "0"), compteurs: c };
}
