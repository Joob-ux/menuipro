// MenuiPro — fonction serveur réservée à l'administrateur :
//   « creer » : crée un compte (quincaillerie, menuisier ou administrateur) et sa carte QR ; code PIN facultatif
//   « pin »   : remplace le code PIN d'un compte existant
//   « bloquer » / « debloquer » / « supprimer » : agit sur un compte (jamais un administrateur)
// La clé de service reste sur le serveur ; l'appelant doit être connecté avec un compte « admin ».
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const empreinte = async (cle: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cle)))).map(x => x.toString(16).padStart(2, "0")).join("");
const nouvelleCle = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
const normaliser = (t: unknown) => { let d = String(t ?? "").replace(/\D/g, ""); if (d.length === 9) d = "221" + d; return d; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "methode" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // 1. Qui appelle ? Il doit être administrateur.
  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: qui, error: errQui } = await service.auth.getUser(jeton);
  if (errQui || !qui?.user) return json({ erreur: "non_connecte" }, 401);
  const { data: profil } = await service.from("profils").select("role").eq("id", qui.user.id).maybeSingle();
  if (profil?.role !== "admin") return json({ erreur: "reserve_admin" }, 403);

  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return json({ erreur: "requete_invalide" }, 400); }

  // 2 bis. Bloquer, débloquer ou supprimer un compte (par son identifiant). Jamais un administrateur, jamais soi-même.
  if (["bloquer", "debloquer", "supprimer"].includes(String(corps.action))) {
    const cible = String(corps.user ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(cible)) return json({ erreur: "compte_inconnu" }, 400);
    if (cible === qui.user.id) return json({ erreur: "pas_soi_meme" }, 400);
    const { data: pc } = await service.from("profils").select("role").eq("id", cible).maybeSingle();
    if (!pc) return json({ erreur: "compte_inconnu" }, 404);
    if (pc.role === "admin") return json({ erreur: "pas_un_admin" }, 400);
    const { error } = corps.action === "supprimer"
      ? await service.auth.admin.deleteUser(cible) // projets, commandes et quincaillerie du compte partent avec lui
      : await service.auth.admin.updateUserById(cible, { ban_duration: corps.action === "bloquer" ? "876000h" : "none" });
    if (error) return json({ erreur: error.message }, 400);
    return json({ ok: true });
  }

  const tel = normaliser(corps.telephone);
  const pin = String(corps.pin ?? "");
  if (tel.length < 11 || tel.length > 15) return json({ erreur: "telephone_invalide" }, 400);
  // Code PIN : obligatoire pour le changer, facultatif à la création (la carte QR suffit pour se connecter).
  if (!/^\d{6}$/.test(pin) && !(corps.action === "creer" && pin === "")) return json({ erreur: "pin_invalide" }, 400);
  const email = `${tel}@menuipro.app`;

  // 2. Réinitialiser un code PIN
  if (corps.action === "pin") {
    const { data: p } = await service.from("profils").select("id").eq("telephone", tel).maybeSingle();
    if (!p) return json({ erreur: "compte_inconnu" }, 404);
    const { error } = await service.auth.admin.updateUserById(p.id, { password: pin });
    if (error) return json({ erreur: error.message }, 400);
    return json({ ok: true, telephone: tel });
  }

  // 3. Créer un compte
  if (corps.action === "creer") {
    const type = String(corps.type ?? "");
    if (!["quincaillerie", "menuisier", "admin"].includes(type)) return json({ erreur: "type_inconnu" }, 400);
    const nom = String(corps.nom ?? "").trim().slice(0, 80);
    const { data: cree, error } = await service.auth.admin.createUser({
      email, password: pin || nouvelleCle() + nouvelleCle(), email_confirm: true, user_metadata: { telephone: tel, nom },
    });
    if (error) return json({ erreur: /already|registered|exists/i.test(error.message) ? "deja_inscrit" : error.message }, 400);
    const { data: conf, error: errConf } = await service.rpc("svc_configurer_compte", {
      p_user: cree.user.id, p_type: type,
      p_quinc_nom: corps.quincaillerie ?? null, p_whatsapp: corps.whatsapp ?? null,
      p_commune: corps.commune ?? null, p_code: corps.code ?? null,
    });
    if (errConf) {
      await service.auth.admin.deleteUser(cree.user.id); // on n'en laisse pas à moitié créé
      return json({ erreur: errConf.message }, 400);
    }
    // Carte QR du nouveau compte : la clé n'est montrée qu'ici, la base n'en garde que l'empreinte.
    const cle = nouvelleCle();
    const { error: errCarte } = await service.rpc("svc_poser_carte", { p_user: cree.user.id, p_empreinte: await empreinte(cle), p_par: qui.user.id });
    if (errCarte) { await service.auth.admin.deleteUser(cree.user.id); return json({ erreur: errCarte.message }, 400); }
    return json({ ok: true, telephone: tel, type, cle, ...(conf ?? {}) });
  }
  return json({ erreur: "action_inconnue" }, 400);
});
