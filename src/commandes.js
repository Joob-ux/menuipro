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
      return r ? { ...r } : { i, dispo: "oui", prix: l.total ?? null, remplacement: "", ...(l.qte ? { qte: l.qte } : {}) };
    }),
    // Articles ajoutés par la quincaillerie à la demande du client (le menuisier) : { article, qte, unite, prix }.
    ajouts: existante && Array.isArray(existante.ajouts) ? existante.ajouts.map(a => ({ ...a })) : [],
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
  return (rep.lignes || []).reduce((s, l) => s + (l.dispo === "non" ? 0 : Math.max(0, entier(l.prix) || 0)), 0)
    + (rep.ajouts || []).reduce((s, a) => s + Math.max(0, entier(a.prix) || 0), 0);
}

// Nouvelle quantité d'une ligne : le prix suit (même prix à l'unité). Renvoie le nouveau prix de la ligne.
export function changerQuantite(r, qte) {
  const avant = +r.qte || 1, q = Math.max(0.5, Math.min(9999, Math.round(qte * 2) / 2)), p = entier(r.prix);
  r.qte = q;
  if (p != null) r.prix = Math.round(p / avant * q);
  return r.prix;
}

// Montant de la remise sur le total (jamais plus que le sous-total).
export function montantRemise(rep, sousTotal = sousTotalReponse(rep)) {
  const r = rep.remise; if (!r) return 0;
  if (r.montant != null && r.valeur == null) return Math.min(sousTotal, Math.max(0, r.montant)); // réponse déjà validée
  const v = entier(r.valeur); if (!v || v < 0) return 0;
  return Math.min(sousTotal, r.type === "pct" ? Math.round(sousTotal * Math.min(v, 100) / 100) : v);
}

// Remise faite article par article : prix baissé par rapport au catalogue (même article, pas les remplacements).
// Prix du catalogue d'une ligne pour la quantité de la réponse (la quincaillerie a pu la changer).
export const prixCatalogue = (c, r) => c.total == null ? null : c.pu && r && r.qte && r.qte !== c.qte ? Math.round(c.pu * r.qte) : c.total;
// Quand la quantité a changé, on compare au prix du catalogue pour la nouvelle quantité.
export function remiseLignes(lignesCmd = [], rep) {
  return (rep.lignes || []).reduce((s, l) => {
    const p = entier(l.prix), cat = prixCatalogue(lignesCmd[l.i] || {}, l);
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
    const qte = l.qte == null || l.qte === "" ? null : +String(l.qte).replace(",", ".");
    if (qte != null && !(qte > 0 && qte <= 9999)) return { ok: false, erreur: "Quantité invalide." };
    lignes.push({ i: l.i, dispo: l.dispo, prix, ...(l.dispo === "remplace" ? { remplacement } : {}), ...(qte != null ? { qte } : {}) });
  }
  const ajouts = [];
  for (const a of rep.ajouts || []) {
    const article = String(a.article || "").trim().slice(0, 80), qte = +String(a.qte ?? 1).replace(",", "."), prix = entier(a.prix);
    if (!article) return { ok: false, erreur: "Écrivez le nom de l'article ajouté." };
    if (!(qte > 0 && qte <= 9999)) return { ok: false, erreur: "Quantité invalide pour « " + article + " »." };
    if (prix === null || prix < 0) return { ok: false, erreur: "Entrez le prix de « " + article + " »." };
    ajouts.push({ article, qte, unite: String(a.unite || "pièce").slice(0, 20), prix });
  }
  if (ajouts.length > 30) return { ok: false, erreur: "30 articles ajoutés au maximum." };
  if (!MODES_RETRAIT[rep.mode]) return { ok: false, erreur: "Choisissez retrait ou livraison." };
  if (rep.date && !/^\d{4}-\d{2}-\d{2}$/.test(rep.date)) return { ok: false, erreur: "Date invalide." };
  const propre = { lignes, ...(ajouts.length ? { ajouts } : {}), mode: rep.mode, date: rep.date || "", message: String(rep.message || "").trim().slice(0, 300) };
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
const nb = q => String(q).replace(".", ",");

// Message WhatsApp de la quincaillerie au menuisier, après la réponse.
export function texteReponse(commande, rep, boutique = "", maintenant = new Date()) {
  const lignes = (commande.lignes || []).map((l, i) => {
    const r = rep.lignes.find(x => x.i === i) || { dispo: "oui" };
    const cat = prixCatalogue(l, r), baisse = r.dispo === "oui" && cat != null && r.prix != null && r.prix < cat;
    const qte = r.qte != null && l.qte != null && r.qte !== l.qte ? " (quantité " + nb(l.qte) + " → " + nb(r.qte) + ")" : "";
    return DISPO[r.dispo][0] + " " + l.article + qte + (r.dispo === "remplace" ? " → " + r.remplacement : "") + (r.dispo === "non" ? " : pas disponible" : r.prix != null ? " : " + fmt(r.prix) + " F" + (baisse ? " (au lieu de " + fmt(cat) + " F)" : "") : "");
  });
  (rep.ajouts || []).forEach(a => lignes.push("➕ " + a.article + " × " + nb(a.qte) + " : " + fmt(a.prix) + " F (ajouté à votre demande)"));
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
