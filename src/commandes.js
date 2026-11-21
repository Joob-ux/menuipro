// MenuiPro — réponse d'une quincaillerie à une commande : logique pure (sans DOM), testée.

export const DISPO = { oui: ["✅", "Dispo"], remplace: ["🔁", "Remplacé"], non: ["❌", "Pas dispo"] };
export const MODES_RETRAIT = { retrait: ["🏪", "Retrait à la boutique"], livraison: ["🚚", "Livraison"] };

// Nombre entier saisi (« 46 000 » accepté) ; un champ vide reste vide (null), il ne vaut pas 0.
const entier = v => { const s = String(v ?? "").replace(/\s/g, "").replace(",", "."); if (!s) return null; const n = Math.round(+s); return Number.isFinite(n) ? n : null; };

// Réponse de départ : chaque ligne « disponible » au prix du catalogue de la quincaillerie (envoyé avec la commande).
export function reponseInitiale(lignes = [], existante = null) {
  const rem = existante && existante.remise;
  return {
    lignes: lignes.map((l, i) => {
      const r = existante && existante.lignes && existante.lignes.find(x => x.i === i);
      return r ? { ...r } : { i, dispo: "oui", prix: l.total ?? null, remplacement: "" };
    }),
    mode: existante && existante.mode || "retrait",
    date: existante && existante.date || "",
    message: existante && existante.message || "",
    // Remise sur le total : en pourcentage (5, 10…) ou en francs. Aucune remise par défaut.
    // (une réponse déjà envoyée garde { type, pct, montant } : on la remet en valeur modifiable).
    remise: rem && rem.type === "pct" && rem.pct ? { type: "pct", valeur: rem.pct }
      : rem && (rem.valeur || rem.montant) ? { type: "f", valeur: rem.valeur || rem.montant } : { type: "f", valeur: "" }
  };
}

// Somme des lignes disponibles ou remplacées, avant la remise sur le total.
export function sousTotalReponse(rep) {
  return (rep.lignes || []).reduce((s, l) => s + (l.dispo === "non" ? 0 : Math.max(0, entier(l.prix) || 0)), 0);
}

// Montant de la remise sur le total (jamais plus que le sous-total).
export function montantRemise(rep, sousTotal = sousTotalReponse(rep)) {
  const r = rep.remise; if (!r) return 0;
  if (r.montant != null && r.valeur == null) return Math.min(sousTotal, Math.max(0, r.montant)); // réponse déjà validée
  const v = entier(r.valeur); if (!v || v < 0) return 0;
  return Math.min(sousTotal, r.type === "pct" ? Math.round(sousTotal * Math.min(v, 100) / 100) : v);
}

// Remise faite article par article : prix baissé par rapport au catalogue (même article, pas les remplacements).
export function remiseLignes(lignesCmd = [], rep) {
  return (rep.lignes || []).reduce((s, l) => {
    const cat = lignesCmd[l.i] && lignesCmd[l.i].total, p = entier(l.prix);
    return s + (l.dispo === "oui" && cat != null && p != null && p < cat ? cat - p : 0);
  }, 0);
}

// Total à payer : lignes disponibles ou remplacées, moins la remise sur le total.
export function totalReponse(rep) {
  const st = sousTotalReponse(rep);
  return st - montantRemise(rep, st);
}

// Vérifie la réponse avant l'envoi ; renvoie la réponse nettoyée ou une erreur lisible.
export function validerReponse(rep, nbLignes) {
  if (!rep || !Array.isArray(rep.lignes) || rep.lignes.length !== nbLignes) return { ok: false, erreur: "Répondez pour chaque article." };
  const lignes = [];
  for (const l of rep.lignes) {
    if (!DISPO[l.dispo]) return { ok: false, erreur: "Choisissez ✅, 🔁 ou ❌ pour chaque article." };
    const prix = l.dispo === "non" ? null : entier(l.prix);
    if (l.dispo !== "non" && (prix === null || prix < 0)) return { ok: false, erreur: "Entrez le prix de chaque article disponible." };
    const remplacement = String(l.remplacement || "").trim().slice(0, 80);
    if (l.dispo === "remplace" && !remplacement) return { ok: false, erreur: "Écrivez par quoi l'article est remplacé." };
    lignes.push({ i: l.i, dispo: l.dispo, prix, ...(l.dispo === "remplace" ? { remplacement } : {}) });
  }
  if (!MODES_RETRAIT[rep.mode]) return { ok: false, erreur: "Choisissez retrait ou livraison." };
  if (rep.date && !/^\d{4}-\d{2}-\d{2}$/.test(rep.date)) return { ok: false, erreur: "Date invalide." };
  const propre = { lignes, mode: rep.mode, date: rep.date || "", message: String(rep.message || "").trim().slice(0, 300) };
  propre.sous_total = sousTotalReponse(propre);
  const r = rep.remise || {}, v = entier(r.valeur);
  if (v != null && v !== 0) {
    if (v < 0) return { ok: false, erreur: "La remise ne peut pas être négative." };
    if (r.type === "pct" && v > 100) return { ok: false, erreur: "La remise ne peut pas dépasser 100 %." };
    if (r.type !== "pct" && v > propre.sous_total) return { ok: false, erreur: "La remise est plus grande que le total." };
    propre.remise = { type: r.type === "pct" ? "pct" : "f", ...(r.type === "pct" ? { pct: v } : {}), montant: montantRemise({ remise: { type: r.type, valeur: v } }, propre.sous_total) };
  }
  propre.total = propre.sous_total - (propre.remise ? propre.remise.montant : 0);
  return { ok: true, reponse: propre };
}

// Date lisible : « aujourd'hui », « demain », sinon « samedi 15/11 ».
export function dateLisible(iso, maintenant = new Date()) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-").map(Number), d = new Date(a, m - 1, j);
  const auj = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const ecart = Math.round((d - auj) / 86400000);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  if (ecart === 2) return "après-demain";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
}

const fmt = n => Math.round(n).toLocaleString("fr-FR");

// Message WhatsApp de la quincaillerie au menuisier, après la réponse.
export function texteReponse(commande, rep, boutique = "", maintenant = new Date()) {
  const lignes = (commande.lignes || []).map((l, i) => {
    const r = rep.lignes.find(x => x.i === i) || { dispo: "oui" };
    const baisse = r.dispo === "oui" && l.total != null && r.prix != null && r.prix < l.total;
    return DISPO[r.dispo][0] + " " + l.article + (r.dispo === "remplace" ? " → " + r.remplacement : "") + (r.dispo === "non" ? " : pas disponible" : r.prix != null ? " : " + fmt(r.prix) + " F" + (baisse ? " (au lieu de " + fmt(l.total) + " F)" : "") : "");
  });
  const rem = rep.remise && rep.remise.montant ? rep.remise : null, eco = remiseLignes(commande.lignes, rep) + (rem ? rem.montant : 0);
  const quand = rep.date ? " " + dateLisible(rep.date, maintenant) : "";
  return ["Bonjour, votre commande « " + commande.meuble + " » :", ...lignes,
    rem ? "Sous-total : " + fmt(rep.sous_total ?? sousTotalReponse(rep)) + " F" : "",
    rem ? "🏷️ Remise" + (rem.pct ? " " + rem.pct + " %" : "") + " : −" + fmt(rem.montant) + " F" : "",
    "Total : " + fmt(rep.total ?? totalReponse(rep)) + " FCFA",
    eco ? "🎁 Vous économisez " + fmt(eco) + " F" : "",
    MODES_RETRAIT[rep.mode][0] + " " + MODES_RETRAIT[rep.mode][1] + quand,
    rep.message ? "💬 " + rep.message : "", boutique ? "— " + boutique : ""].filter(Boolean).join("\n");
}

// Clé de suivi : change quand la quincaillerie répond ou change le statut (pour prévenir le menuisier).
export const cleSuivi = c => c.statut + "|" + (c.repondu_le || "");
// Commandes qui ont changé depuis la dernière fois (vu = { id: clé }).
export function changements(rows, vu) {
  const premiere = !vu || !Object.keys(vu).length;
  return premiere ? [] : rows.filter(c => (vu[c.id] ? vu[c.id] !== cleSuivi(c) : c.statut !== "envoyee"));
}
