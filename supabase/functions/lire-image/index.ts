// MenuiPro — lire une image de meuble (rendu SketchUp, photo, croquis, image WhatsApp) avec Gemini.
// Renvoie la structure du meuble (colonnes, cases, portes, tiroirs, socle…) et les cotes écrites sur l'image.
// L'appli transforme cette description en meuble MenuiPro (src/engine/lecture.js) : 3D, coupes, devis.
// Mêmes secrets que l'assistant vocal : GEMINI_API_KEY (AI Studio, gratuit) ou GOOGLE_SA_JSON (Vertex AI).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELE_VERTEX = Deno.env.get("GEMINI_MODEL_IMAGE") || "gemini-2.5-flash";
const MODELE_STUDIO = Deno.env.get("GEMINI_MODEL_IMAGE") || "gemini-flash-latest";
const LIMITE = Number(Deno.env.get("IMAGE_LIMITE_JOUR") || 30);
const IMAGE_MAX = 2_500_000; // octets
const MIMES = ["image/jpeg", "image/png", "image/webp"];

const CONSIGNE = `Tu es un menuisier expert. On te montre UNE image d'un meuble en panneaux (rendu 3D SketchUp, photo, croquis ou plan).
Décris sa structure pour que l'application MenuiPro le refabrique à l'identique. Réponds UNIQUEMENT avec le JSON demandé.

Règles :
- Regarde la FAÇADE (le devant). Découpe-la en COLONNES de gauche à droite, séparées par des panneaux verticaux qui vont du bas au haut du corps du meuble.
- Chaque colonne est découpée en CASES du BAS vers le HAUT, séparées par des panneaux horizontaux (étagères fixes ou traverses).
- Une case peut être : "vide" (niche ouverte, sans étagère), "etageres" (avec "nombre" étagères à l'intérieur, en plus des séparations), "tiroirs" ("nombre" tiroirs empilés), "penderie" (tringle pour vêtements).
  Préfère une case par niche visible : 4 niches égales empilées = 4 cases "vide" de même hauteur.
- "portes" : 0, 1 ou 2 portes battantes qui ferment la case.
- "largeur_relative" et "hauteur_relative" : proportions mesurées sur l'image (ex. 1 et 1 pour deux colonnes égales).
- "dimensions_mm" : SEULEMENT les cotes écrites sur l'image (lignes de cote, chiffres). Convertis en mm. Sinon null. N'invente jamais une cote.
  Sur un rendu 3D en perspective : la cote horizontale le long de la façade = largeur, celle qui part vers l'arrière = profondeur, la verticale = hauteur.
- "socle_mm" : hauteur de la plinthe en retrait en bas (estime-la), 0 s'il n'y en a pas.
- "pieds_mm" : hauteur des pieds si le meuble est sur pieds, sinon 0.
- "dos" : true si on voit un panneau de fond, false si on voit à travers le meuble.
- "type" : le nom du meuble en français (bibliothèque, armoire, meuble TV, commode, buffet…).
- "confiance" : 0 à 1. "remarque" : en français simple, ce que MenuiPro ne pourra pas reproduire (formes courbes, verre, pieds tournés…), sinon "".
- Si l'image ne montre pas un meuble : colonnes [] et confiance 0.`;

const SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string" },
    dimensions_mm: { type: "object", nullable: true, properties: { largeur: { type: "number", nullable: true }, hauteur: { type: "number", nullable: true }, profondeur: { type: "number", nullable: true } } },
    socle_mm: { type: "number" }, pieds_mm: { type: "number" }, dos: { type: "boolean" },
    colonnes: { type: "array", items: { type: "object", properties: {
      largeur_relative: { type: "number" },
      cases: { type: "array", items: { type: "object", properties: {
        hauteur_relative: { type: "number" }, type: { type: "string", enum: ["vide", "etageres", "tiroirs", "penderie"] },
        nombre: { type: "integer" }, portes: { type: "integer" } }, required: ["hauteur_relative", "type", "nombre", "portes"] } } },
      required: ["largeur_relative", "cases"] } },
    confiance: { type: "number" }, remarque: { type: "string" },
  },
  required: ["type", "socle_mm", "pieds_mm", "dos", "colonnes", "confiance", "remarque"],
};

/* ---------- Jeton Google à partir du compte de service (Vertex AI) ---------- */
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ""; bytes.forEach(x => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function jetonGoogle(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const entete = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const charge = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), c => c.charCodeAt(0));
  const cle = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cle, new TextEncoder().encode(entete + "." + charge));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: entete + "." + charge + "." + b64url(sig) }) });
  const d = await r.json();
  if (!r.ok) throw new Error("google_auth: " + (d.error_description || d.error || r.status));
  return d.access_token as string;
}

async function demanderGemini(image: string, mime: string, note: string) {
  const corps = JSON.stringify({
    systemInstruction: { parts: [{ text: CONSIGNE }] },
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: note ? "Précision du menuisier : " + note : "Décris ce meuble." }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.1, maxOutputTokens: 2000 },
  });
  const cle = Deno.env.get("GEMINI_API_KEY") || "";
  let r: Response;
  if (cle) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELE_STUDIO}:generateContent`, { method: "POST", headers: { "x-goog-api-key": cle, "Content-Type": "application/json" }, body: corps });
  } else {
    const sa = JSON.parse(Deno.env.get("GOOGLE_SA_JSON") || "null");
    if (!sa) throw new Error("non_configure");
    const jeton = await jetonGoogle(sa);
    r = await fetch(`https://aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/global/publishers/google/models/${MODELE_VERTEX}:generateContent`,
      { method: "POST", headers: { Authorization: "Bearer " + jeton, "Content-Type": "application/json" }, body: corps });
  }
  const d = await r.json();
  if (!r.ok) throw new Error("gemini: " + (d.error?.status || "") + " " + (d.error?.message || r.status));
  const brut = d.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}";
  return JSON.parse(brut);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "methode" }, 405);
  if (!Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("GOOGLE_SA_JSON")) return json({ erreur: "non_configure" }, 503);

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: qui, error: errQui } = await service.auth.getUser(jwt);
  if (errQui || !qui?.user) return json({ erreur: "non_connecte" }, 401);
  const uid = qui.user.id;

  // Quota du jour (protège le budget), compté dans le même journal que l'assistant vocal.
  const depuis = new Date(); depuis.setUTCHours(0, 0, 0, 0);
  const { count } = await service.from("assistant_journal").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("texte", "[image]").gte("created_at", depuis.toISOString());
  if ((count ?? 0) >= LIMITE) return json({ erreur: "limite" }, 429);

  let corps: { image?: string; mime?: string; note?: string };
  try { corps = await req.json(); } catch { return json({ erreur: "requete_invalide" }, 400); }
  const image = String(corps.image || "");
  if (!image || image.length > IMAGE_MAX * 4 / 3 + 16) return json({ erreur: "image_invalide" }, 400);
  const mime = MIMES.includes(String(corps.mime)) ? String(corps.mime) : "image/jpeg";

  const debut = Date.now();
  try {
    const lecture = await demanderGemini(image, mime, String(corps.note || "").slice(0, 300));
    await service.from("assistant_journal").insert({ user_id: uid, duree_s: 0, texte: "[image]", action: { image: lecture }, ms: Date.now() - debut });
    return json({ lecture });
  } catch (e) {
    const msg = String((e as Error).message || e);
    await service.from("assistant_journal").insert({ user_id: uid, duree_s: 0, texte: "[image]", action: { erreur: msg.slice(0, 300) }, ms: Date.now() - debut });
    console.error(msg);
    return json({ erreur: msg === "non_configure" ? "non_configure" : "service_google" }, msg === "non_configure" ? 503 : 502);
  }
});
