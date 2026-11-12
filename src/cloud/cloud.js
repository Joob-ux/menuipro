// MenuiPro — connexion en ligne (Supabase) : comptes, catalogue partagé, projets, commandes.
// Sans configuration (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), l'application reste 100 % locale.
import { createClient } from "@supabase/supabase-js";

const URL_SB = import.meta.env.VITE_SUPABASE_URL;
const CLE_SB = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const actif = Boolean(URL_SB && CLE_SB);
export const sb = actif ? createClient(URL_SB, CLE_SB, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "menuipro-session" } }) : null;

/* Le menuisier se connecte avec son numéro et un code PIN de 6 chiffres.
   Supabase demande un e-mail : on en fabrique un à partir du numéro (aucun e-mail n'est envoyé). */
export const normaliserTel = t => { let d = String(t || "").replace(/\D/g, ""); if (d.length === 9) d = "221" + d; return d; };
const emailPour = tel => normaliserTel(tel) + "@menuipro.app";

const MESSAGES = {
  "Invalid login credentials": "Numéro ou code PIN incorrect.",
  "User already registered": "Ce numéro a déjà un compte. Touchez « Me connecter ».",
  "code_inconnu": "Ce code de quincaillerie n'existe pas. Vérifiez les 6 caractères.",
  "non_connecte": "Connectez-vous d'abord.",
  "Failed to fetch": "Pas de connexion Internet. Réessayez plus tard.",
  "Password should be at least 6 characters": "Le code PIN doit avoir 6 chiffres."
};
export const message = e => { const m = (e && (e.message || e.error_description)) || String(e); for (const k in MESSAGES) if (m.includes(k)) return MESSAGES[k]; return "Erreur : " + m; };
const ok = ({ data, error }) => { if (error) throw error; return data; };

export async function inscrire(tel, pin, nom) {
  const d = normaliserTel(tel);
  if (d.length < 9) throw new Error("Numéro de téléphone incomplet.");
  if (!/^\d{6}$/.test(pin)) throw new Error("Password should be at least 6 characters");
  return ok(await sb.auth.signUp({ email: emailPour(d), password: pin, options: { data: { telephone: d, nom: (nom || "").trim() } } }));
}
export async function connecter(tel, pin) { return ok(await sb.auth.signInWithPassword({ email: emailPour(tel), password: pin })); }
export async function deconnecter() { await sb.auth.signOut(); }
export async function session() { if (!sb) return null; const { data } = await sb.auth.getSession(); return data.session; }

export async function chargerCompte() {
  const s = await session(); if (!s) return null;
  const profil = ok(await sb.from("profils").select("*").eq("id", s.user.id).maybeSingle());
  let quinc = null;
  if (profil && profil.quincaillerie_id) quinc = ok(await sb.from("quincailleries").select("*").eq("id", profil.quincaillerie_id).maybeSingle());
  return { user: s.user, profil, quinc };
}
export async function majProfil(champs, id) { return ok(await sb.from("profils").update(champs).eq("id", id)); }

export async function creerQuincaillerie(nom, whatsapp, commune) { return ok(await sb.rpc("creer_quincaillerie", { p_nom: nom, p_whatsapp: whatsapp, p_commune: commune })); }
export async function rejoindre(code) { return ok(await sb.rpc("rejoindre_quincaillerie", { p_code: code })); }
export async function quitter() { return ok(await sb.rpc("quitter_quincaillerie")); }
export async function sauverQuincaillerie(id, champs) { return ok(await sb.from("quincailleries").update(champs).eq("id", id)); }

export async function listerProjets() { return ok(await sb.from("projets").select("*").order("updated_at", { ascending: false })); }
export async function sauverProjet(p) {
  const row = { nom: p.nom, recette: p.recipe, config: { cfg: p.cfg, color: p.color, panneau: p.panneau, dv: p.dv }, prix: Math.round(p.prix || 0), materiel: Math.round(p.materiel || 0), statut: p.statut || "devis" };
  if (p.cloudId) { ok(await sb.from("projets").update(row).eq("id", p.cloudId)); return p.cloudId; }
  return ok(await sb.from("projets").insert(row).select("id").single()).id;
}
export async function supprimerProjet(cloudId) { return ok(await sb.from("projets").delete().eq("id", cloudId)); }

export async function envoyerCommande(c) { return ok(await sb.from("commandes").insert(c).select("id").single()); }
export async function mesCommandes(uid) { return ok(await sb.from("commandes").select("id,meuble,total,statut,created_at").eq("menuisier_id", uid).order("created_at", { ascending: false }).limit(30)); }
export async function commandesRecues(qid) { return ok(await sb.from("commandes").select("id,meuble,lignes,total,statut,created_at,profils(nom,telephone)").eq("quincaillerie_id", qid).order("created_at", { ascending: false }).limit(50)); }
export async function changerStatut(id, statut) { return ok(await sb.from("commandes").update({ statut }).eq("id", id)); }
