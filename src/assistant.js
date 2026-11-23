// MenuiPro — assistant vocal : logique pure (sans DOM), partagée par l'appli et testée.
// Le serveur transcrit la note vocale wolof (Google Chirp 3) puis Gemini propose une action ;
// ici on prépare le catalogue envoyé au serveur et on contrôle l'action reçue avant de l'appliquer.

import { libellesCotes } from "./engine/recettes.js";
export const REPONSES = ["compris", "modifie", "pas_compris", "limite", "choisir", "cotes", "options", "resultat", "vue3d", "plan", "achat", "commander", "devis", "bois"];
export const ACTIONS = ["meuble", "modifier", "aide", "inconnu"];
export const DUREE_MAX_S = 30;

// Catalogue compact (quelques Ko) : ce que l'IA a le droit de choisir.
export function catalogueIA(recettes) {
  return recettes.map(r => ({
    id: r.id, nom: r.nom, cat: r.cat,
    cotes: libellesCotes(r).map((l, i) => l + " (défaut " + r.dims[i] + " cm)"),
    options: r.opts.map(x => x.choice ? { k: x.k, nom: x.label, choix: x.options.map(o => o[0]) } : { k: x.k, nom: x.label, min: x.min, max: x.max })
  }));
}

const nombre = v => { const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v; return Number.isFinite(n) ? n : null; };

// Vérifie et borne l'action proposée par l'IA. Renvoie null si rien d'utilisable.
export function validerAction(a, recettes, actuel) {
  if (!a || typeof a !== "object") return null;
  const action = ACTIONS.includes(a.action) ? a.action : "inconnu";
  const reponse = REPONSES.includes(a.reponse) ? a.reponse : (action === "inconnu" ? "pas_compris" : action === "aide" ? "choisir" : "compris");
  const out = { action, reponse, resume: String(a.resume || "").slice(0, 300) };
  if (action !== "meuble" && action !== "modifier") return out;
  const id = action === "modifier" && !a.recette ? actuel : a.recette;
  const r = recettes.find(x => x.id === id);
  if (!r) return { action: "inconnu", reponse: "pas_compris", resume: out.resume };
  out.recette = r.id;
  const mn = r.dimMin || [10, 10, 10];
  const c = a.cotes || {};
  ["L", "H", "P"].forEach((k, i) => { const v = nombre(c[k]); if (v != null && v >= mn[i] && v <= 2000) (out.cotes ||= {})[k] = Math.round(v * 10) / 10; });
  const o = a.options || {};
  r.opts.forEach(x => {
    if (!(x.k in o)) return;
    if (x.choice) { if (x.options.some(p => p[0] === o[x.k])) (out.options ||= {})[x.k] = o[x.k]; return; }
    let v = o[x.k];
    if (typeof v === "boolean") v = v ? 1 : 0;
    v = nombre(v);
    if (v != null) (out.options ||= {})[x.k] = Math.max(x.min, Math.min(x.max, Math.round(v)));
  });
  return out;
}
