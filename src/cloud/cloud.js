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
  "Password should be at least 6 characters": "Le code PIN doit avoir 6 chiffres.",
  "reserve_admin": "Réservé à l'administrateur.",
  "Email not confirmed": "Compte pas encore activé : l'option « Confirm email » doit être désactivée dans Supabase.",
  "row-level security policy for table \"commandes\"": "Commande impossible : la quincaillerie ne reçoit pas de commandes en ce moment (abonnement) ou vous n'y êtes pas rattaché.",
  "annulation_impossible": "Cette commande ne peut plus être annulée (elle est déjà prête ou livrée).",
  "modification_interdite": "Action non autorisée.",
  "quincaillerie_inconnue": "Quincaillerie introuvable.",
  "nom_quincaillerie_manquant": "Entrez le nom de la quincaillerie."
};
export const message = e => { const m = (e && (e.message || e.error_description)) || String(e); for (const k in MESSAGES) if (m.includes(k)) return MESSAGES[k]; return /^Erreur\s*:/.test(m) ? m : "Erreur : " + m; }; // pas de « Erreur : Erreur : »
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
  // Colonnes listées une à une : la note privée de l'administrateur n'est lisible que par lui.
  if (profil && profil.quincaillerie_id) quinc = ok(await sb.from("quincailleries").select("id,owner_id,nom,whatsapp,commune,code,catalogue,actif,abonnement_jusqu,created_at,updated_at").eq("id", profil.quincaillerie_id).maybeSingle());
  return { user: s.user, profil, quinc };
}
export async function majProfil(champs, id) { return ok(await sb.from("profils").update(champs).eq("id", id)); }

export async function creerQuincaillerie(nom, whatsapp, commune) { return ok(await sb.rpc("creer_quincaillerie", { p_nom: nom, p_whatsapp: whatsapp, p_commune: commune })); }
export async function rejoindre(code) { return ok(await sb.rpc("rejoindre_quincaillerie", { p_code: code })); }
// Nom et commune d'une quincaillerie à partir de son code (lien d'invitation, sans compte).
export async function apercuInvitation(code) { return ok(await sb.rpc("apercu_invitation", { p_code: code })); }
export async function quitter() { return ok(await sb.rpc("quitter_quincaillerie")); }
export async function sauverQuincaillerie(id, champs) { return ok(await sb.from("quincailleries").update(champs).eq("id", id)); }

export async function listerProjets() { return ok(await sb.from("projets").select("*").order("updated_at", { ascending: false })); }
export async function sauverProjet(p) {
  const row = { nom: p.nom, recette: p.recipe, config: { cfg: p.cfg, color: p.color, panneau: p.panneau, dv: p.dv, fin: p.fin }, prix: Math.round(p.prix || 0), materiel: Math.round(p.materiel || 0), statut: p.statut || "devis" };
  if (p.cloudId) { ok(await sb.from("projets").update(row).eq("id", p.cloudId)); return p.cloudId; }
  return ok(await sb.from("projets").insert(row).select("id").single()).id;
}
export async function supprimerProjet(cloudId) { return ok(await sb.from("projets").delete().eq("id", cloudId)); }

export async function envoyerCommande(c) { return ok(await sb.from("commandes").insert(c).select("id,statut").single()); }
export async function mesCommandes(uid) { return ok(await sb.from("commandes").select("id,meuble,lignes,total,statut,reponse,repondu_le,created_at").eq("menuisier_id", uid).order("created_at", { ascending: false }).limit(30)); }
// La quincaillerie lit ses commandes par une fonction : nom et téléphone du menuisier, sans ses réglages privés.
export async function commandesRecues() { return ok(await sb.rpc("commandes_recues")) || []; }
// Réponse de la quincaillerie : disponibilité et prix par ligne, retrait ou livraison, date, message.
export async function repondreCommande(id, reponse, statut) { return ok(await sb.from("commandes").update({ reponse, statut }).eq("id", id)); }
// Le menuisier annule sa commande (tant qu'elle n'est pas prête).
export async function annulerCommande(id) { return ok(await sb.rpc("annuler_commande", { p_id: id })); }
// La quincaillerie : liste de ses menuisiers, et retrait d'un menuisier.
export async function mesMenuisiers() { return ok(await sb.rpc("mes_menuisiers")) || []; }
export async function retirerMenuisier(id) { return ok(await sb.rpc("retirer_menuisier", { p_user: id })); }
// Changer son code PIN : on vérifie d'abord l'ancien en se reconnectant avec.
export async function changerPin(tel, ancien, nouveau) {
  if (!/^\d{6}$/.test(nouveau)) throw new Error("Password should be at least 6 characters");
  await connecter(tel, ancien);
  return ok(await sb.auth.updateUser({ password: nouveau }));
}
export async function changerStatut(id, statut) { return ok(await sb.from("commandes").update({ statut }).eq("id", id)); }

/* ---------- Administration ---------- */
export async function adminVue() { return ok(await sb.rpc("admin_vue")); }
// Modèles retirés de l'appli par l'administrateur (lus par tout le monde, même sans compte).
export async function reglagesPublics() { return ok(await sb.rpc("reglages_publics")); }
export async function adminModelesRetires(ids) { return ok(await sb.rpc("admin_modeles_retires", { p_ids: ids })); }
export async function adminParDefaut(id) { return ok(await sb.rpc("admin_par_defaut", { p_quinc: id || null })); }
export async function adminRattacher(user, quinc) { return ok(await sb.rpc("admin_rattacher", { p_user: user, p_quinc: quinc || null })); }
export async function adminModifierQuincaillerie(id, nom, whatsapp, commune) { return ok(await sb.rpc("admin_modifier_quincaillerie", { p_quinc: id, p_nom: nom, p_whatsapp: whatsapp || "", p_commune: commune || "" })); }
export async function adminAbonnement(id, actif, jusqu, note) { return ok(await sb.rpc("admin_abonnement", { p_quinc: id, p_actif: actif, p_jusqu: jusqu || null, p_note: note || null })); }

/* Création de comptes et réinitialisation de PIN : passe par la fonction serveur « admin-comptes » */
const ERREURS_ADMIN = {
  deja_inscrit: "Ce numéro a déjà un compte.", telephone_invalide: "Numéro de téléphone invalide.",
  pin_invalide: "Le code PIN doit avoir exactement 6 chiffres.", code_inconnu: "Ce code de quincaillerie n'existe pas.",
  compte_inconnu: "Aucun compte avec ce numéro.", reserve_admin: "Réservé à l'administrateur.",
  nom_quincaillerie_manquant: "Entrez le nom de la quincaillerie.", non_connecte: "Reconnectez-vous.",
  pas_soi_meme: "Vous ne pouvez pas faire cela sur votre propre compte.", pas_un_admin: "Impossible sur un compte administrateur."
};
async function appelAdmin(corps) {
  const { data, error } = await sb.functions.invoke("admin-comptes", { body: corps });
  if (error) {
    let code = error.message;
    try { const b = await error.context.json(); code = b.erreur || code; } catch (e) { /* réponse sans JSON */ }
    throw new Error(ERREURS_ADMIN[code] || ("Erreur : " + code));
  }
  return data;
}
export const adminCreerCompte = c => appelAdmin({ action: "creer", ...c });
export const adminNouveauPin = (telephone, pin) => appelAdmin({ action: "pin", telephone, pin });
export const adminBloquer = (user, bloquer) => appelAdmin({ action: bloquer ? "bloquer" : "debloquer", user });
export const adminSupprimer = user => appelAdmin({ action: "supprimer", user });

/* ---------- Voix (fichiers audio publics, bucket « voix ») ---------- */
// Liste des audios disponibles : { clé: version } (la version évite l'ancien fichier en cache).
export async function listeVoix() {
  const { data, error } = await sb.storage.from("voix").list("wo", { limit: 200 });
  if (error) throw error;
  const r = {};
  (data || []).forEach(f => { if (f.name && !f.name.startsWith(".")) r[f.name] = Date.parse(f.updated_at || f.created_at || 0) || 1; });
  return r;
}
export const urlVoix = (cle, v) => URL_SB + "/storage/v1/object/public/voix/wo/" + encodeURIComponent(cle) + "?v=" + v;
export async function adminEnvoyerVoix(cle, blob) {
  const type = String(blob.type || "audio/mpeg").split(";")[0] || "audio/mpeg";
  return ok(await sb.storage.from("voix").upload("wo/" + cle, blob, { upsert: true, contentType: type, cacheControl: "3600" }));
}
export async function adminSupprimerVoix(cle) { return ok(await sb.storage.from("voix").remove(["wo/" + cle])); }

/* ---------- Assistant vocal (fonction serveur « assistant-voix ») ---------- */
const ERREURS_ASSISTANT = {
  non_connecte: "Connectez-vous pour parler à l'assistant.", limite: "Limite du jour atteinte. Réessayez demain.",
  assistant_non_configure: "L'assistant vocal n'est pas encore activé.", audio_invalide: "Note vocale vide ou trop longue (30 s maximum).",
  service_google: "Le service de reconnaissance ne répond pas. Réessayez."
};
const versBase64 = blob => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = ko; r.readAsDataURL(blob); });
export async function assistant(blob, catalogue, contexte, duree) {
  const audio = await versBase64(blob);
  const mime = String(blob.type || "audio/wav").split(";")[0];
  const { data, error } = await sb.functions.invoke("assistant-voix", { body: { audio, mime, catalogue, contexte, duree } });
  if (error) {
    let code = error.message, corps = null;
    try { corps = await error.context.json(); code = corps.erreur || code; } catch (e) { /* réponse sans JSON */ }
    const err = new Error(ERREURS_ASSISTANT[code] || MESSAGES[code] || ("Erreur : " + code));
    err.code = code; err.action = corps && corps.action;
    throw err;
  }
  return data;
}

/* ---------- Fichiers 3D importés (bucket privé « modeles3d », dossier = id du compte) ---------- */
export async function envoyerModele3D(nomFichier, blob) {
  const s = await session();
  if (!s) throw new Error("non_connecte");
  const chemin = s.user.id + "/" + nomFichier;
  ok(await sb.storage.from("modeles3d").upload(chemin, blob, { upsert: true, contentType: blob.type || "application/octet-stream", cacheControl: "31536000" }));
  return chemin;
}
export async function telechargerModele3D(chemin) { return ok(await sb.storage.from("modeles3d").download(chemin)); }

/* ---------- Lire une image de meuble (fonction serveur « lire-image » : Gemini ou Qwen3-VL) ---------- */
const ERREURS_IMAGE = {
  non_configure: "La lecture automatique des images n'est pas encore activée.", non_connecte: "Connectez-vous pour que l'appli lise l'image.",
  limite: "Limite du jour atteinte pour la lecture d'images. Réessayez demain.", image_invalide: "Image vide ou trop lourde.",
  service_google: "Le service de lecture ne répond pas. Réessayez.",
  occupe: "Le service de lecture est très chargé en ce moment. Réessayez dans une minute.",
  tache_inconnue: "Cette lecture est perdue. Relancez-la.",
  service_qwen: "Qwen ne répond pas. Réessayez."
};
/* Lecture d'une image. Le serveur lance une lecture longue chez Google et rend un numéro de tâche :
   on redemande le résultat toutes les 4 secondes, sans limite de temps (l'IA réfléchit autant qu'il faut).
   o : { note, suivi(secondes, modele) appelé pendant l'attente, annule() → true pour arrêter } */
async function appelImage(body) {
  const { data, error } = await sb.functions.invoke("lire-image", { body });
  if (error) {
    let code = error.message, rep = {};
    try { rep = await error.context.json(); code = rep.erreur || code; } catch (e) { /* réponse sans JSON */ }
    const err = new Error(ERREURS_IMAGE[code] || MESSAGES[code] || ("Erreur : " + code)); err.code = code; err.modele = rep.modele; err.relancer = !!rep.relancer; throw err;
  }
  return data;
}
export async function lireImage(blob, o = {}) {
  const image = await versBase64(blob), mime = String(blob.type || "image/jpeg").split(";")[0], exclure = [];
  const debut = Date.now();
  for (let essai = 0; ; essai++) {
    const d = await appelImage({ image, mime, note: o.note || "", exclure });
    if (d.lecture) return d.lecture;
    const tache = d.tache;
    if (tache == null) throw Object.assign(new Error(ERREURS_IMAGE.service_google), { code: "service_google" });
    try {
      for (let ratesSuivi = 0; ;) {
        if (o.annule && o.annule()) throw Object.assign(new Error("annule"), { code: "annule" });
        await new Promise(ok => setTimeout(ok, 4000));
        if (o.annule && o.annule()) throw Object.assign(new Error("annule"), { code: "annule" });
        let r;
        try { r = await appelImage({ tache }); ratesSuivi = 0; }
        catch (e) {
          if (e.relancer || e.code === "tache_inconnue") throw e;
          if (++ratesSuivi >= 5) throw e; // réseau coupé trop longtemps
          continue;
        }
        if (r.lecture) return r.lecture;
        if (o.suivi) o.suivi(Math.round((Date.now() - debut) / 1000), r.modele);
      }
    } catch (e) {
      // La lecture a échoué chez Google : on relance une fois avec un autre modèle.
      if (e.relancer && essai === 0) { if (e.modele) exclure.push(e.modele); continue; }
      throw e;
    }
  }
}

/* ---------- Comptes par QR code (fonction serveur « compte-qr ») ---------- */
const ERREURS_QR = {
  nom_manquant: "Entrez votre nom.", telephone_invalide: "Entrez votre numéro de téléphone (9 chiffres).",
  deja_inscrit: "Ce numéro a déjà un compte. Scannez votre carte MenuiPro, ou demandez une nouvelle carte à votre quincaillerie.",
  code_inconnu: "Ce QR code de quincaillerie n'est plus valable. Demandez-en un nouveau.",
  carte_inconnue: "Cette carte ne marche plus : une nouvelle carte a été faite. Demandez-la à votre quincaillerie ou à MenuiPro.",
  compte_bloque: "Ce compte est bloqué. Contactez MenuiPro.", trop_inscriptions: "Trop d'inscriptions en ce moment. Réessayez dans une heure.",
  interdit: "Vous ne pouvez pas refaire la carte de ce compte.", compte_inconnu: "Compte introuvable.", non_connecte: "Connectez-vous d'abord.",
  reserve_menuisier: "Réservé aux menuisiers.", quincaillerie_fermee: "Cette quincaillerie ne prend pas de nouveaux menuisiers en ce moment."
};
export const messageQR = e => ERREURS_QR[e && e.code] || ERREURS_QR[e && e.message] || message(e);
async function appelQR(body) {
  const { data, error } = await sb.functions.invoke("compte-qr", { body });
  if (error) {
    let code = error.message;
    try { code = (await error.context.json()).erreur || code; } catch (e) { /* réponse sans JSON */ }
    const err = new Error(ERREURS_QR[code] || MESSAGES[code] || ("Erreur : " + code)); err.code = code; throw err;
  }
  return data;
}
// La fonction serveur renvoie un jeton de lien magique : on l'échange ici contre une session.
async function ouvrirSession(jeton) { ok(await sb.auth.verifyOtp({ token_hash: jeton, type: "magiclink" })); }
export async function inscrireQR(nom, telephone, code) {
  const r = await appelQR({ action: "inscrire", nom, telephone, code: code || "" });
  await ouvrirSession(r.jeton);
  return { cle: r.cle, quincaillerie: r.quincaillerie };
}
export async function connecterCarte(cle) {
  await sb.auth.signOut({ scope: "local" }).catch(() => {});
  await ouvrirSession((await appelQR({ action: "carte", cle })).jeton);
}
export const nouvelleCarte = (user, quinc) => appelQR({ action: "nouvelle_carte", ...(user ? { user } : {}), ...(quinc ? { quinc } : {}) });
export async function quincailleriesOuvertes() { return ok(await sb.rpc("quincailleries_ouvertes")) || []; }
export async function choisirQuincaillerie(id) { return ok(await sb.rpc("choisir_quincaillerie", { p_quinc: id })); }

/* Écran de test de l'administrateur : la même image lue par une IA choisie ("gemini" ou "qwen").
   Renvoie { lecture, modele, ia, ms } (ms : temps mesuré par l'appli, attente réseau comprise). */
export async function testerLecture(blob, ia) {
  const image = await versBase64(blob), mime = String(blob.type || "image/jpeg").split(";")[0], debut = Date.now();
  let d = await appelImage({ image, mime, ia });
  while (!d.lecture && d.tache != null) { await new Promise(ok => setTimeout(ok, 4000)); d = await appelImage({ tache: d.tache }); }
  if (!d.lecture) throw Object.assign(new Error(ERREURS_IMAGE.service_google), { code: "service_google" });
  return { lecture: d.lecture, modele: d.modele || "", ia: d.ia || ia, ms: Date.now() - debut };
}
