// MenuiPro — comptes par QR code (sans code PIN).
//   « inscrire »       : nom + numéro (+ code de la quincaillerie scannée) → compte menuisier + carte QR + connexion
//   « carte »          : clé d'une carte QR → connexion sur ce téléphone
//   « nouvelle_carte » : nouvelle carte pour soi, pour un de ses menuisiers (quincaillerie) ou pour tout compte (admin) ;
//                        l'ancienne carte ne marche plus
// La clé d'une carte (32 octets aléatoires) n'est jamais gardée : la base n'en garde que l'empreinte SHA-256.
// La connexion passe par un lien magique généré côté serveur (jamais envoyé par e-mail) que l'appli valide (verifyOtp).
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
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const empreinte = async (cle: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cle)))).map(x => x.toString(16).padStart(2, "0")).join("");
const nouvelleCle = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
// Mot de passe jamais utilisé (connexion par QR) : 43 caractères aléatoires. Supabase refuse au-delà de 72.
const motDePasseInterne = () => nouvelleCle();
const INSCRIPTIONS_HEURE = Number(Deno.env.get("INSCRIPTIONS_HEURE") || 60); // frein contre la création de comptes en masse

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "methode" }, 405);
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return json({ erreur: "requete_invalide" }, 400); }
  const action = String(corps.action ?? "");

  // Ouvre une session pour ce compte : le lien magique reste sur le serveur, l'appli reçoit seulement son jeton.
  const connexion = async (userId: string) => {
    const { data: u, error } = await service.auth.admin.getUserById(userId);
    if (error || !u?.user?.email) throw new Error("compte_inconnu");
    if (u.user.banned_until && new Date(u.user.banned_until) > new Date()) throw new Error("compte_bloque");
    const { data: lien, error: e2 } = await service.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
    if (e2 || !lien?.properties?.hashed_token) throw new Error("connexion_impossible");
    return lien.properties.hashed_token;
  };
  const poserCarte = async (userId: string, par: string | null) => {
    const cle = nouvelleCle();
    const { error } = await service.rpc("svc_poser_carte", { p_user: userId, p_empreinte: await empreinte(cle), p_par: par });
    if (error) throw new Error(error.message);
    return cle;
  };

  try {
    // ---------- Inscription d'un menuisier : nom + numéro, sans code PIN ----------
    if (action === "inscrire") {
      const nom = String(corps.nom ?? "").trim().slice(0, 80);
      const tel = normaliser(corps.telephone);
      const code = String(corps.code ?? "").trim().toUpperCase();
      if (nom.length < 2) return json({ erreur: "nom_manquant" }, 400);
      if (tel.length < 11 || tel.length > 15) return json({ erreur: "telephone_invalide" }, 400);
      if (code && !/^[A-Z0-9]{6}$/.test(code)) return json({ erreur: "code_inconnu" }, 400);
      const depuis = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await service.from("profils").select("id", { count: "exact", head: true }).gte("created_at", depuis);
      if ((count ?? 0) >= INSCRIPTIONS_HEURE) return json({ erreur: "trop_inscriptions" }, 429);
      if (code) {
        const { data: q } = await service.rpc("apercu_invitation", { p_code: code });
        if (!q) return json({ erreur: "code_inconnu" }, 400);
      }
      // Mot de passe aléatoire jamais montré : on se connecte avec la carte (ou un PIN donné plus tard par l'admin).
      const { data: cree, error } = await service.auth.admin.createUser({
        email: `${tel}@menuipro.app`, password: motDePasseInterne(), email_confirm: true, user_metadata: { telephone: tel, nom },
      });
      if (error) return json({ erreur: /already|registered|exists/i.test(error.message) ? "deja_inscrit" : error.message }, 400);
      const id = cree.user.id;
      try {
        const { data: conf, error: eConf } = await service.rpc("svc_configurer_compte", { p_user: id, p_type: "menuisier", p_code: code || null });
        if (eConf) throw new Error(eConf.message);
        const cle = await poserCarte(id, id);
        return json({ ok: true, cle, jeton: await connexion(id), quincaillerie: conf?.quincaillerie ?? null });
      } catch (e) {
        await service.auth.admin.deleteUser(id); // rien à moitié créé
        throw e;
      }
    }

    // ---------- Connexion par la carte ----------
    if (action === "carte") {
      const cle = String(corps.cle ?? "");
      if (!/^[A-Za-z0-9_-]{40,60}$/.test(cle)) return json({ erreur: "carte_inconnue" }, 400);
      const { data: id, error } = await service.rpc("svc_lire_carte", { p_empreinte: await empreinte(cle) });
      if (error) throw new Error(error.message);
      if (!id) return json({ erreur: "carte_inconnue" }, 404);
      return json({ ok: true, jeton: await connexion(id) });
    }

    // ---------- Nouvelle carte (connecté) ----------
    if (action === "nouvelle_carte") {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: qui, error: errQui } = await service.auth.getUser(jwt);
      if (errQui || !qui?.user) return json({ erreur: "non_connecte" }, 401);
      const moi = qui.user.id;
      let cible = String(corps.user ?? moi);
      // L'administrateur peut viser une quincaillerie : la carte est celle de son propriétaire.
      if (corps.quinc) {
        const { data: q } = await service.from("quincailleries").select("owner_id").eq("id", String(corps.quinc)).maybeSingle();
        if (!q) return json({ erreur: "compte_inconnu" }, 404);
        cible = q.owner_id;
      }
      if (!/^[0-9a-f-]{36}$/i.test(cible)) return json({ erreur: "compte_inconnu" }, 400);
      const { data: p } = await service.from("profils").select("role").eq("id", moi).maybeSingle();
      const { data: pc } = await service.from("profils").select("id, nom, telephone, role, quincaillerie_id").eq("id", cible).maybeSingle();
      if (!pc) return json({ erreur: "compte_inconnu" }, 404);
      let permis = cible === moi || p?.role === "admin";
      if (!permis && p?.role === "quincaillerie" && pc.role === "menuisier" && pc.quincaillerie_id) {
        const { data: q } = await service.from("quincailleries").select("owner_id").eq("id", pc.quincaillerie_id).maybeSingle();
        permis = q?.owner_id === moi; // une quincaillerie ne refait la carte que de SES menuisiers
      }
      if (!permis) return json({ erreur: "interdit" }, 403);
      const cle = await poserCarte(cible, moi);
      return json({ ok: true, cle, nom: pc.nom, telephone: pc.telephone, role: pc.role });
    }
    return json({ erreur: "action_inconnue" }, 400);
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error(action, msg);
    const connu = ["compte_inconnu", "compte_bloque", "code_inconnu"].find(k => msg.includes(k));
    return json({ erreur: connu || "erreur_serveur" }, connu === "compte_bloque" ? 403 : 400);
  }
});
