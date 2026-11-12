// MenuiPro — assistant vocal en wolof.
//   1. Google Speech-to-Text v2, modèle Chirp 3, langue wo-SN : note vocale → texte wolof
//   2. Gemini (Vertex AI) : texte → action JSON (meuble, cotes, options) choisie dans le catalogue envoyé
// L'appli contrôle l'action (src/assistant.js) puis répond avec des phrases enregistrées.
// Secrets : GOOGLE_SA_JSON (clé JSON du compte de service), facultatifs GEMINI_MODEL, ASSISTANT_LIMITE_JOUR.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELE = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const LIMITE = Number(Deno.env.get("ASSISTANT_LIMITE_JOUR") || 40);
const AUDIO_MAX = 1_500_000; // octets (≈ 30 s de note vocale)

/* ---------- Jeton Google à partir du compte de service (JWT RS256) ---------- */
let jetonCache: { valeur: string; expire: number } | null = null;
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ""; bytes.forEach(x => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function jetonGoogle(sa: { client_email: string; private_key: string }) {
  if (jetonCache && jetonCache.expire > Date.now() + 60_000) return jetonCache.valeur;
  const now = Math.floor(Date.now() / 1000);
  const entete = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const charge = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const cle = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cle, new TextEncoder().encode(entete + "." + charge));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: entete + "." + charge + "." + b64url(sig) }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error("google_auth: " + (d.error_description || d.error || r.status));
  jetonCache = { valeur: d.access_token, expire: Date.now() + d.expires_in * 1000 };
  return jetonCache.valeur;
}

/* ---------- 1. Transcription wolof (Chirp 3, région eu) ---------- */
async function transcrire(jeton: string, projet: string, audioB64: string) {
  const r = await fetch(`https://eu-speech.googleapis.com/v2/projects/${projet}/locations/eu/recognizers/_:recognize`, {
    method: "POST", headers: { Authorization: "Bearer " + jeton, "Content-Type": "application/json" },
    body: JSON.stringify({
      config: { autoDecodingConfig: {}, languageCodes: ["wo-SN"], model: "chirp_3", features: { enableAutomaticPunctuation: true } },
      content: audioB64,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error("stt: " + (d.error?.message || r.status));
  return (d.results || []).map((x: any) => x.alternatives?.[0]?.transcript || "").join(" ").trim();
}

/* ---------- 2. Compréhension (Gemini) ---------- */
const CONSIGNE = `Tu es l'assistant de MenuiPro, une application pour menuisiers au Sénégal.
Le menuisier a parlé en wolof (souvent mêlé de mots français). Tu reçois la transcription automatique, qui peut contenir des fautes.
Ta tâche : comprendre ce qu'il veut et choisir UNE action dans le catalogue fourni. Tu ne réponds jamais par du texte libre, seulement par le JSON demandé.

Nombres en wolof : benn 1, ñaar 2, ñett 3, ñeent 4, juróom 5, juróom-benn 6, juróom-ñaar 7, juróom-ñett 8, juróom-ñeent 9, fukk 10, fukk ak benn 11, ñaar-fukk 20, ñett-fukk 30, téeméer 100, junni 1000.
« mètre » ou « m » = 100 cm ; « 1 mètre 20 » ou « benn mètre ak ñaar-fukk » = 120 cm. Les cotes sont TOUJOURS en centimètres.
Mots utiles : bunt = porte, palanteer = fenêtre, lal = lit, toogu = chaise, taabal = table, armoire, tiroir, étagère, yaatuwaay = largeur, kawewaay/kowe = hauteur, xóotaay = profondeur, defar = fabriquer, soppi = changer, yokk = augmenter, wàññi = diminuer.

Réponds avec ce JSON exact :
{"action": "meuble" | "modifier" | "aide" | "inconnu",
 "recette": "<id exact du catalogue, ou null>",
 "cotes": {"L": nombre en cm ou null, "H": ..., "P": ...},
 "options": {"<k exact d'une option de cette recette>": valeur},
 "reponse": "compris" | "modifie" | "pas_compris" | "choisir" | "cotes" | "options" | "resultat" | "vue3d" | "plan" | "achat" | "commander" | "devis" | "bois",
 "resume": "ce que tu as compris, en français simple, une phrase"}
- "meuble" : il demande un nouveau meuble → recette + cotes/options citées (reponse "compris").
- "modifier" : il change le meuble affiché (« yokkal ab tiroir », « def ko 1 m 50 ») → recette null = meuble actuel (reponse "modifie").
- "aide" : il demande comment faire quelque chose → reponse = la rubrique d'aide la plus proche.
- "inconnu" : rien de clair → reponse "pas_compris". N'invente jamais de cote non dite.`;

async function comprendre(jeton: string, projet: string, texte: string, catalogue: unknown, contexte: unknown) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${projet}/locations/global/publishers/google/models/${MODELE}:generateContent`;
  const r = await fetch(url, {
    method: "POST", headers: { Authorization: "Bearer " + jeton, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: CONSIGNE }] },
      contents: [{ role: "user", parts: [{ text: "CATALOGUE :\n" + JSON.stringify(catalogue) + "\n\nMEUBLE AFFICHÉ :\n" + JSON.stringify(contexte) + "\n\nTRANSCRIPTION (wolof) :\n" + texte }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 600 },
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error("gemini: " + (d.error?.message || r.status));
  const brut = d.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
  try { return JSON.parse(brut); } catch { return { action: "inconnu", reponse: "pas_compris" }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "methode" }, 405);

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: qui, error: errQui } = await service.auth.getUser(jwt);
  if (errQui || !qui?.user) return json({ erreur: "non_connecte" }, 401);
  const uid = qui.user.id;

  const saBrut = Deno.env.get("GOOGLE_SA_JSON");
  if (!saBrut) return json({ erreur: "assistant_non_configure" }, 503);
  let sa: { client_email: string; private_key: string; project_id: string };
  try { sa = JSON.parse(saBrut); } catch { return json({ erreur: "assistant_non_configure" }, 503); }

  // Quota du jour (protège le budget)
  const depuis = new Date(); depuis.setUTCHours(0, 0, 0, 0);
  const { count } = await service.from("assistant_journal").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", depuis.toISOString());
  if ((count ?? 0) >= LIMITE) return json({ erreur: "limite", action: { action: "inconnu", reponse: "limite" } }, 429);

  let corps: { audio?: string; catalogue?: unknown; contexte?: unknown; duree?: number };
  try { corps = await req.json(); } catch { return json({ erreur: "requete_invalide" }, 400); }
  const audio = String(corps.audio || "");
  if (!audio || audio.length > AUDIO_MAX * 4 / 3 + 16) return json({ erreur: "audio_invalide" }, 400);
  if (JSON.stringify(corps.catalogue ?? []).length > 30000) return json({ erreur: "requete_invalide" }, 400);

  const debut = Date.now();
  try {
    const jeton = await jetonGoogle(sa);
    const texte = await transcrire(jeton, sa.project_id, audio);
    const action = texte ? await comprendre(jeton, sa.project_id, texte, corps.catalogue, corps.contexte) : { action: "inconnu", reponse: "pas_compris" };
    await service.from("assistant_journal").insert({ user_id: uid, duree_s: Math.min(60, Math.round(Number(corps.duree) || 0)), texte: texte.slice(0, 1000), action, ms: Date.now() - debut });
    return json({ texte, action });
  } catch (e) {
    const msg = String((e as Error).message || e);
    await service.from("assistant_journal").insert({ user_id: uid, duree_s: Math.min(60, Math.round(Number(corps.duree) || 0)), texte: "", action: { erreur: msg.slice(0, 300) }, ms: Date.now() - debut });
    console.error(msg);
    return json({ erreur: "service_google" }, 502);
  }
});
