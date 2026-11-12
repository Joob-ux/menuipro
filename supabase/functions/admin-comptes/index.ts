// MenuiPro — fonction serveur réservée à l'administrateur :
//   « creer » : crée un compte (quincaillerie, menuisier ou administrateur) avec numéro + code PIN
//   « pin »   : remplace le code PIN d'un compte existant
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
  const tel = normaliser(corps.telephone);
  const pin = String(corps.pin ?? "");
  if (tel.length < 11 || tel.length > 15) return json({ erreur: "telephone_invalide" }, 400);
  if (!/^\d{6}$/.test(pin)) return json({ erreur: "pin_invalide" }, 400);
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
      email, password: pin, email_confirm: true, user_metadata: { telephone: tel, nom },
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
    return json({ ok: true, telephone: tel, type, ...(conf ?? {}) });
  }
  return json({ erreur: "action_inconnue" }, 400);
});
