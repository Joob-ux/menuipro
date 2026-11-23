// MenuiPro — lire une image de meuble (rendu SketchUp, photo, croquis, image WhatsApp) avec une IA de vision :
// Gemini (Google) ou Qwen3-VL (open source, hébergé par OpenRouter).
// Choix par le secret IA_IMAGE : "gemini", "qwen", ou "auto" (Qwen d'abord, Gemini en secours).
// Par défaut : "auto" si OPENROUTER_API_KEY est réglé, sinon "gemini". L'administrateur peut forcer une IA (écran de test).
// Renvoie la structure du meuble (colonnes, cases, portes, tiroirs, socle…) et les cotes écrites sur l'image.
// L'appli transforme cette description en meuble MenuiPro (src/engine/lecture.js) : 3D, coupes, devis.
// Secrets : GEMINI_API_KEY (AI Studio) ou GOOGLE_SA_JSON (Vertex AI) ; OPENROUTER_API_KEY pour Qwen ; QWEN_MODELE (facultatif).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// LECTURE LONGUE : la lecture tourne en arrière-plan chez Google (Interactions API, « background »).
// La fonction démarre la lecture et rend tout de suite un numéro ; l'appli redemande le résultat toutes les
// quelques secondes. Le modèle peut donc réfléchir aussi longtemps qu'il veut (réflexion « high »), sans la
// coupure de 150 s de Supabase. Si l'Interactions API n'est pas disponible, on retombe sur l'ancien appel direct.
//
// Modèles essayés dans l'ordre : quand Google répond « occupé » (UNAVAILABLE, 503, 429) ou « modèle retiré »
// (NOT_FOUND), on passe au suivant. La liste AI Studio est complétée par les modèles Flash que la clé peut vraiment utiliser.
const MODELE_CHOISI = Deno.env.get("GEMINI_MODEL_IMAGE") || "";
const MODELES_STUDIO = [MODELE_CHOISI, "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean);
const MODELES_VERTEX = [MODELE_CHOISI, "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"].filter(Boolean);
// Réflexion de la lecture en arrière-plan : « high » (la plus précise, sans limite de temps côté Supabase).
// Réglable avec le secret GEMINI_REFLEXION : minimal, low, medium ou high.
const REFLEXION = Deno.env.get("GEMINI_REFLEXION") || "high";
// Appel direct (secours) : il doit finir avant la coupure de Supabase, donc réflexion « medium » et 120 s au total.
const REFLEXION_DIRECTE = "medium", DELAI_TOTAL = 120_000, DELAI_ESSAI = 75_000;
const REVISION_API = Deno.env.get("GEMINI_API_REVISION") || "2026-05-20";
const LECTURE_MAX_MS = 15 * 60_000; // au-delà, on abandonne une lecture en arrière-plan
const LIMITE = Number(Deno.env.get("IMAGE_LIMITE_JOUR") || 30);
const IMAGE_MAX = 2_500_000; // octets
const MIMES = ["image/jpeg", "image/png", "image/webp"];
// Qwen3-VL par OpenRouter (API compatible OpenAI). Appel direct, il doit finir avant la coupure de Supabase.
const CLE_OR = Deno.env.get("OPENROUTER_API_KEY") || "";
const MODELES_QWEN = [Deno.env.get("QWEN_MODELE") || "", "qwen/qwen3-vl-235b-a22b-instruct", "qwen/qwen3-vl-32b-instruct"].filter(Boolean);
const DELAI_QWEN = 100_000;
const IA_DEFAUT = (Deno.env.get("IA_IMAGE") || (CLE_OR ? "auto" : "gemini")).toLowerCase();
// La lecture en arrière-plan de Gemini (Interactions API) échoue (« failed ») depuis le 21/11/2026 : coupée
// par défaut, l'appel direct (réflexion « medium », 1 à 2 min) a toujours marché. GEMINI_ARRIERE_PLAN=1 pour la rallumer.
const ARRIERE_PLAN = Deno.env.get("GEMINI_ARRIERE_PLAN") === "1";

const CONSIGNE = `Tu es un menuisier expert et un dessinateur précis. On te montre UNE image d'un meuble en panneaux
(rendu 3D SketchUp, photo, croquis à la main ou plan). L'application MenuiPro va le refabriquer À L'IDENTIQUE à partir de ta description :
chaque séparation, chaque case, chaque porte et chaque tiroir que tu oublies ou que tu inventes sera faux dans la 3D et dans la découpe.
Prends le temps d'observer : compte les panneaux un par un, suis chaque ligne d'un bout à l'autre, mesure les proportions sur l'image.

MÉTHODE (fais-la dans ta réflexion avant de répondre) :
1. Repère la FAÇADE (le devant). Sur un rendu en perspective, ramène-la à une vue de face (corrige la perspective).
2. Repère le corps du meuble (caisse) : socle/plinthe en retrait en bas, ou pieds, ou rien.
3. Trouve les panneaux VERTICAUX qui vont du bas au haut du corps : ils découpent la façade en COLONNES (de gauche à droite).
4. Dans chaque colonne, trouve les panneaux HORIZONTAUX qui traversent toute la colonne : ils découpent la colonne en CASES (du BAS vers le HAUT).
5. Si dans une case il y a un panneau vertical qui ne monte PAS sur toute la hauteur du meuble (il s'arrête à une étagère),
   cette case est partagée en "sous_colonnes" (casiers côte à côte), chacune avec ses propres cases du bas vers le haut.
   Exemple : meuble TV avec une grande niche en haut et, en bas, deux tiroirs côte à côte = colonne avec 2 cases ; la case du bas a 2 sous_colonnes.
6. Mesure les proportions : "largeur_relative" et "hauteur_relative" en mesurant les distances sur l'image (pixels de la façade redressée),
   pas au jugé. Deux niches qui semblent égales doivent avoir la même valeur ; une niche deux fois plus haute a le double.
7. Vérifie : nombre de colonnes, nombre de cases par colonne, nombre de portes, nombre de tiroirs, tout doit correspondre à l'image.

TYPES DE CASE :
- "vide" : niche ouverte, sans étagère intérieure. Préfère une case par niche visible : 4 niches empilées = 4 cases "vide".
- "etageres" : case fermée par une porte avec "nombre" étagères à l'intérieur (en plus des séparations), ou étagères mobiles visibles.
- "tiroirs" : "nombre" tiroirs empilés dans la case (façades de tiroir). Deux tiroirs côte à côte = 2 sous_colonnes avec 1 tiroir chacune.
- "penderie" : tringle pour vêtements.
PORTES :
- "portes" : 0, 1 ou 2 portes battantes qui ferment la case. Si 2 portes ferment une case partagée en sous_colonnes (ex. armoire :
  penderie à gauche et étagères à droite derrière 2 portes), mets "portes": 2 sur la case partagée et 0 sur les sous-cases.
- "type_porte" : "battante" (par défaut), "vitree" (porte en verre ou à cadre vitré) ou "coulissante".
COTES :
- "dimensions_mm" : SEULEMENT les cotes écrites sur l'image (lignes de cote, chiffres). Convertis en mm. Sinon null. N'invente jamais une cote.
  Sur un rendu en perspective : la cote horizontale le long de la façade = largeur, celle qui part vers l'arrière = profondeur, la verticale = hauteur.
- "rapport_hauteur_largeur" : hauteur totale ÷ largeur totale de la façade, mesuré sur l'image redressée (toujours le remplir).
- "socle_mm" : hauteur de la plinthe en retrait en bas (estime-la), 0 s'il n'y en a pas.
- "pieds_mm" : hauteur des pieds si le meuble est sur pieds, sinon 0.
- "dos" : true si on voit (ou on devine) un panneau de fond, false si on voit à travers le meuble.
AUTRES :
- "type" : le nom du meuble en français (bibliothèque, armoire, meuble TV, commode, buffet…).
- "confiance" : 0 à 1. "remarque" : en français simple et court, ce que MenuiPro ne pourra pas reproduire (formes courbes, verre décoratif,
  pieds tournés, plan de travail, éléments séparés…), sinon "".
- Si l'image montre plusieurs meubles, décris le meuble principal (le plus grand, au premier plan) et dis-le dans "remarque".
- Si l'image ne montre pas un meuble : colonnes [] et confiance 0.`;

const CASE_PROPS = {
  hauteur_relative: { type: "number" }, type: { type: "string", enum: ["vide", "etageres", "tiroirs", "penderie"] },
  nombre: { type: "integer" }, portes: { type: "integer" }, type_porte: { type: "string", enum: ["battante", "vitree", "coulissante"] },
};
const CASE_REQ = ["hauteur_relative", "type", "nombre", "portes"];
const SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string" },
    dimensions_mm: { type: "object", nullable: true, properties: { largeur: { type: "number", nullable: true }, hauteur: { type: "number", nullable: true }, profondeur: { type: "number", nullable: true } } },
    rapport_hauteur_largeur: { type: "number" },
    socle_mm: { type: "number" }, pieds_mm: { type: "number" }, dos: { type: "boolean" },
    colonnes: { type: "array", items: { type: "object", properties: {
      largeur_relative: { type: "number" },
      cases: { type: "array", items: { type: "object", properties: {
        ...CASE_PROPS,
        sous_colonnes: { type: "array", items: { type: "object", properties: {
          largeur_relative: { type: "number" },
          cases: { type: "array", items: { type: "object", properties: CASE_PROPS, required: CASE_REQ } } },
          required: ["largeur_relative", "cases"] } } },
        required: CASE_REQ } } },
      required: ["largeur_relative", "cases"] } },
    confiance: { type: "number" }, remarque: { type: "string" },
  },
  required: ["type", "rapport_hauteur_largeur", "socle_mm", "pieds_mm", "dos", "colonnes", "confiance", "remarque"],
};
// Pour l'Interactions API, la forme JSON attendue est aussi écrite en clair dans la consigne.
const FORME_JSON = `Réponds UNIQUEMENT avec un objet JSON (sans texte autour, sans \`\`\`) de cette forme :
{"type": "...", "dimensions_mm": {"largeur": nombre|null, "hauteur": nombre|null, "profondeur": nombre|null} | null,
 "rapport_hauteur_largeur": nombre, "socle_mm": nombre, "pieds_mm": nombre, "dos": true|false,
 "colonnes": [ {"largeur_relative": nombre, "cases": [ {"hauteur_relative": nombre, "type": "vide"|"etageres"|"tiroirs"|"penderie",
   "nombre": entier, "portes": 0|1|2, "type_porte": "battante"|"vitree"|"coulissante",
   "sous_colonnes": [ {"largeur_relative": nombre, "cases": [ ...cases sans sous_colonnes... ]} ] (seulement si la case est partagée) } ] } ],
 "confiance": nombre, "remarque": "..."}
Les cases vont du BAS vers le HAUT, les colonnes de GAUCHE à DROITE.`;

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

class ErreurGemini extends Error {
  passer: boolean; // vrai : essayer un autre modèle / réessayer
  constructor(msg: string, passer: boolean) { super(msg); this.passer = passer; }
}
const attendre = (ms: number) => new Promise(r => setTimeout(r, ms));
const occupe = (statut: number, texte: string) => [429, 500, 502, 503, 504, 404].includes(statut) || /UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|DEADLINE|NOT_FOUND/.test(texte);

// Lit le JSON rendu par le modèle, même entouré de texte ou de ```json.
function lireJSON(brut: string): any {
  const t = String(brut || "").replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(t); } catch { /* on cherche l'objet */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("json");
}

// Modèles Flash disponibles pour la clé AI Studio (gardé en mémoire tant que la fonction reste chaude).
let modelesClé: string[] | null = null;
async function modelesDisponibles(cle: string): Promise<string[]> {
  if (modelesClé) return modelesClé;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": cle }, signal: AbortSignal.timeout(6000) });
    const d = await r.json();
    const noms = (d.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m: any) => String(m.name || "").replace(/^models\//, ""))
      .filter((n: string) => /^gemini-.*flash/.test(n) && !/image|tts|audio|live|embed|thinking-exp/.test(n));
    const version = (n: string) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    noms.sort((a: string, b: string) => (Number(a.includes("lite")) - Number(b.includes("lite"))) || (version(b) - version(a)) || (Number(a.includes("preview")) - Number(b.includes("preview"))));
    modelesClé = noms.slice(0, 6);
  } catch { modelesClé = []; }
  return modelesClé;
}
// Flash normaux d'abord (précision), puis les « lite » (plus légers, souvent libres quand Google est surchargé).
async function listeModeles(cle: string): Promise<string[]> {
  if (!cle) return [...new Set(MODELES_VERTEX)];
  const trouves = await modelesDisponibles(cle);
  return [...new Set([...MODELES_STUDIO.filter(m => !m.includes("lite")), ...trouves.filter(m => !m.includes("lite")),
    ...MODELES_STUDIO.filter(m => m.includes("lite")), ...trouves.filter(m => m.includes("lite"))])];
}

/* ---------- Lecture longue en arrière-plan (Interactions API) ---------- */
const URL_INTER = "https://generativelanguage.googleapis.com/v1beta/interactions";
const entetesInter = (cle: string) => ({ "x-goog-api-key": cle, "Content-Type": "application/json", "Api-Revision": REVISION_API });

// Démarre la lecture ; renvoie l'identifiant Google de la lecture.
async function demarrerInteraction(cle: string, modele: string, image: string, mime: string, note: string): Promise<string> {
  const corps = {
    model: modele,
    input: [
      { type: "text", text: CONSIGNE + "\n\n" + FORME_JSON },
      { type: "image", data: image, mime_type: mime },
      { type: "text", text: note ? "Précision du menuisier : " + note : "Décris ce meuble." },
    ],
    generation_config: { thinking_level: REFLEXION, max_output_tokens: 32000 },
    background: true, store: true,
  };
  let r: Response;
  try { r = await fetch(URL_INTER, { method: "POST", headers: entetesInter(cle), body: JSON.stringify(corps), signal: AbortSignal.timeout(30_000) }); }
  catch (e) { throw new ErreurGemini(modele + ": réseau " + String((e as Error).message || e), true); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) {
    const statut = String(d.error?.status || r.status);
    throw new ErreurGemini(modele + " (arrière-plan): " + statut + " " + String(d.error?.message || "").slice(0, 160), occupe(r.status, statut));
  }
  return String(d.id);
}

// Texte rendu par une lecture terminée (la forme exacte varie selon la version de l'API : on cherche partout).
function texteInteraction(d: any): string {
  const blocs: string[] = [];
  const prendre = (contenu: any) => (Array.isArray(contenu) ? contenu : [contenu]).forEach((c: any) => { if (c && c.type === "text" && typeof c.text === "string") blocs.push(c.text); });
  (d.steps || []).forEach((st: any) => { if (!st.type || st.type === "model_output") prendre(st.content); });
  (d.outputs || []).forEach((o: any) => prendre(o));
  if (!blocs.length && typeof d.output_text === "string") blocs.push(d.output_text);
  // Le dernier bloc de texte qui contient un objet JSON.
  for (let i = blocs.length - 1; i >= 0; i--) if (blocs[i].includes("{")) return blocs[i];
  return blocs.join("");
}

async function suivreInteraction(cle: string, id: string): Promise<{ etat: "en_cours" | "fini" | "rate"; lecture?: any; erreur?: string }> {
  const r = await fetch(URL_INTER + "/" + encodeURIComponent(id), { headers: entetesInter(cle), signal: AbortSignal.timeout(20_000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const statut = String(d.error?.status || r.status);
    if (occupe(r.status, statut) && r.status !== 404) return { etat: "en_cours" }; // souci passager : on redemandera
    return { etat: "rate", erreur: "suivi: " + statut + " " + String(d.error?.message || "").slice(0, 160) };
  }
  const statut = String(d.status || "");
  if (statut === "in_progress" || statut === "queued" || statut === "pending") return { etat: "en_cours" };
  if (statut === "completed") {
    try { return { etat: "fini", lecture: lireJSON(texteInteraction(d)) }; }
    catch { return { etat: "rate", erreur: "réponse illisible" }; }
  }
  // Google ne met pas toujours la cause au même endroit : on garde la réponse brute (sans l'image) pour comprendre.
  const brut = JSON.stringify({ error: d.error, status_details: d.status_details, steps: (d.steps || []).map((x: any) => ({ type: x.type, error: x.error, status: x.status })) }).slice(0, 600);
  return { etat: "rate", erreur: "statut " + statut + " " + String(d.error?.message || "") .slice(0, 160) + " " + brut };
}

/* ---------- Appel direct (secours, et Vertex AI) ---------- */
async function unEssai(modele: string, image: string, mime: string, note: string, reflexion: string | null, delai: number): Promise<any> {
  const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.1, maxOutputTokens: 16000 };
  if (reflexion) generationConfig.thinkingConfig = { thinkingLevel: reflexion };
  const corps = JSON.stringify({
    systemInstruction: { parts: [{ text: CONSIGNE }] },
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: note ? "Précision du menuisier : " + note : "Décris ce meuble." }] }],
    generationConfig,
  });
  const cle = Deno.env.get("GEMINI_API_KEY") || "";
  let r: Response;
  try {
    if (cle) {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, { method: "POST", headers: { "x-goog-api-key": cle, "Content-Type": "application/json" }, body: corps, signal: AbortSignal.timeout(delai) });
    } else {
      const sa = JSON.parse(Deno.env.get("GOOGLE_SA_JSON") || "null");
      if (!sa) throw new Error("non_configure");
      const jeton = await jetonGoogle(sa);
      r = await fetch(`https://aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/global/publishers/google/models/${modele}:generateContent`,
        { method: "POST", headers: { Authorization: "Bearer " + jeton, "Content-Type": "application/json" }, body: corps, signal: AbortSignal.timeout(delai) });
    }
  } catch (e) {
    const m = String((e as Error).message || e);
    if (m === "non_configure") throw e;
    throw new ErreurGemini(modele + ": " + (/abort|timeout/i.test(m) ? "trop lent" : "réseau " + m), true);
  }
  const d = await r.json().catch(() => ({}));
  const texteErreur = String(d.error?.message || "");
  if (r.status === 400 && reflexion && /think|level|budget/i.test(texteErreur)) return unEssai(modele, image, mime, note, null, delai);
  if (!r.ok) {
    const statut = String(d.error?.status || r.status);
    throw new ErreurGemini(modele + ": " + statut + " " + texteErreur.slice(0, 160), occupe(r.status, statut));
  }
  const brut = d.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  try { return lireJSON(brut); }
  catch { throw new ErreurGemini(modele + ": réponse incomplète (" + (d.candidates?.[0]?.finishReason || "?") + ")", true); }
}

async function demanderDirect(liste: string[], image: string, mime: string, note: string, essais: string[]): Promise<{ lecture: any; modele: string }> {
  const debut = Date.now(), retires = new Set<string>();
  for (let tour = 0; tour < 2; tour++) {
    for (const modele of liste) {
      if (retires.has(modele)) continue;
      const reste = DELAI_TOTAL - (Date.now() - debut);
      if (reste < 8000) break;
      try { return { lecture: await unEssai(modele, image, mime, note, REFLEXION_DIRECTE, Math.min(DELAI_ESSAI, reste - 2000)), modele }; }
      catch (e) {
        if (!(e instanceof ErreurGemini)) throw e;
        essais.push(e.message);
        if (/NOT_FOUND|404/.test(e.message)) retires.add(modele);
        if (!e.passer) throw new Error("gemini: " + essais.join(" | "));
      }
    }
    if (tour === 0) await attendre(2500);
  }
  throw new Error("gemini: " + essais.join(" | "));
}

/* ---------- Qwen3-VL (open source) par OpenRouter ---------- */
async function demanderQwen(image: string, mime: string, note: string, essais: string[]): Promise<{ lecture: any; modele: string }> {
  if (!CLE_OR) throw new Error("non_configure");
  const debut = Date.now();
  for (const modele of MODELES_QWEN) {
    const reste = DELAI_QWEN - (Date.now() - debut);
    if (reste < 10_000) break;
    let r: Response;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", signal: AbortSignal.timeout(reste),
        headers: { Authorization: "Bearer " + CLE_OR, "Content-Type": "application/json", "HTTP-Referer": "https://menuipro.app", "X-Title": "MenuiPro" },
        body: JSON.stringify({
          model: modele, temperature: 0.1, max_tokens: 8000, response_format: { type: "json_object" },
          messages: [
            { role: "system", content: CONSIGNE + "\n\n" + FORME_JSON },
            { role: "user", content: [
              { type: "image_url", image_url: { url: "data:" + mime + ";base64," + image } },
              { type: "text", text: (note ? "Précision du menuisier : " + note + "\n" : "") + "Décris ce meuble. Réponds uniquement avec l'objet JSON." },
            ] },
          ],
        }),
      });
    } catch (e) { essais.push(modele + ": " + (/abort|timeout/i.test(String(e)) ? "trop lent" : "réseau " + String(e).slice(0, 120))); continue; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) { essais.push(modele + ": " + (d.error?.code || r.status) + " " + String(d.error?.message || "").slice(0, 160)); continue; }
    try { return { lecture: lireJSON(d.choices?.[0]?.message?.content || ""), modele }; }
    catch { essais.push(modele + ": réponse illisible (" + (d.choices?.[0]?.finish_reason || "?") + ")"); }
  }
  throw new Error("qwen: " + essais.join(" | "));
}

const codeErreur = (msg: string) => msg === "non_configure" ? "non_configure" : /UNAVAILABLE|RESOURCE_EXHAUSTED|429|503|trop lent/.test(msg) ? "occupe" : "service_google";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "methode" }, 405);
  if (!Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("GOOGLE_SA_JSON") && !CLE_OR) return json({ erreur: "non_configure" }, 503);

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: qui, error: errQui } = await service.auth.getUser(jwt);
  if (errQui || !qui?.user) return json({ erreur: "non_connecte" }, 401);
  const uid = qui.user.id;
  const cle = Deno.env.get("GEMINI_API_KEY") || "";

  let corps: { image?: string; mime?: string; note?: string; tache?: number; exclure?: string[]; ia?: string };
  try { corps = await req.json(); } catch { return json({ erreur: "requete_invalide" }, 400); }

  /* ----- 2. Suivi d'une lecture en arrière-plan ----- */
  if (corps.tache != null) {
    const { data: ligne } = await service.from("assistant_journal").select("id, user_id, created_at, action").eq("id", Number(corps.tache)).eq("user_id", uid).eq("texte", "[image]").maybeSingle();
    const a = ligne?.action as any;
    if (!ligne || !a?.interaction) return json({ erreur: "tache_inconnue" }, 404);
    if (a.image) return json({ lecture: a.image, modele: a.modele });
    if (a.erreur) return json({ erreur: codeErreur(a.erreur), modele: a.modele, relancer: true }, 502);
    const age = Date.now() - new Date(ligne.created_at).getTime();
    let suivi: Awaited<ReturnType<typeof suivreInteraction>>;
    try { suivi = await suivreInteraction(cle, a.interaction); } catch { suivi = { etat: "en_cours" }; }
    if (suivi.etat === "en_cours" && age > LECTURE_MAX_MS) suivi = { etat: "rate", erreur: "trop lent (plus de 15 min)" };
    if (suivi.etat === "en_cours") return json({ en_cours: true, secondes: Math.round(age / 1000), modele: a.modele });
    const action = suivi.etat === "fini" ? { ...a, image: suivi.lecture } : { ...a, erreur: suivi.erreur };
    await service.from("assistant_journal").update({ action, ms: age }).eq("id", ligne.id);
    if (suivi.etat === "fini") {
      fetch(URL_INTER + "/" + encodeURIComponent(a.interaction), { method: "DELETE", headers: entetesInter(cle) }).catch(() => {}); // on ne garde rien chez Google
      return json({ lecture: suivi.lecture, modele: a.modele });
    }
    console.error(suivi.erreur);
    return json({ erreur: codeErreur(String(suivi.erreur)), modele: a.modele, relancer: true }, 502);
  }

  /* ----- 1. Nouvelle lecture ----- */
  // Quota du jour (protège le budget), compté dans le même journal que l'assistant vocal.
  const depuis = new Date(); depuis.setUTCHours(0, 0, 0, 0);
  const { count } = await service.from("assistant_journal").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("texte", "[image]").gte("created_at", depuis.toISOString());
  if ((count ?? 0) >= LIMITE) return json({ erreur: "limite" }, 429);

  const image = String(corps.image || "");
  if (!image || image.length > IMAGE_MAX * 4 / 3 + 16) return json({ erreur: "image_invalide" }, 400);
  const mime = MIMES.includes(String(corps.mime)) ? String(corps.mime) : "image/jpeg";
  const note = String(corps.note || "").slice(0, 300);
  const exclure = new Set((Array.isArray(corps.exclure) ? corps.exclure : []).map(String).slice(0, 10));
  const debut = Date.now(), essais: string[] = [];
  // IA forcée : seulement pour l'administrateur (écran de test de la console).
  let ia = IA_DEFAUT;
  if (corps.ia === "gemini" || corps.ia === "qwen") {
    const { data: profil } = await service.from("profils").select("role").eq("id", uid).maybeSingle();
    if (profil?.role === "admin") ia = corps.ia;
  }
  const journal = (action: Record<string, unknown>) => service.from("assistant_journal")
    .insert({ user_id: uid, duree_s: 0, texte: "[image]", action: { ...action, ia, essais: essais.length ? essais : undefined }, ms: Date.now() - debut });

  // Qwen3-VL (open source) d'abord, si choisi.
  if (ia === "qwen" || (ia === "auto" && CLE_OR)) {
    try {
      const { lecture, modele } = await demanderQwen(image, mime, note, essais);
      await journal({ image: lecture, modele, direct: true });
      return json({ lecture, modele, ia: "qwen", ms: Date.now() - debut });
    } catch (e) {
      const msg = String((e as Error).message || e);
      if (ia === "qwen") {
        await journal({ erreur: msg.slice(0, 800) });
        console.error(msg);
        return json({ erreur: msg === "non_configure" ? "non_configure" : "service_qwen" }, msg === "non_configure" ? 503 : 502);
      }
      essais.push(msg.slice(0, 300)); // « auto » : on passe à Gemini…
      // …seulement s'il reste assez de temps avant la coupure de Supabase (150 s).
      if (Date.now() - debut > 25_000) { await journal({ erreur: msg.slice(0, 800) }); return json({ erreur: "occupe" }, 502); }
    }
  }
  if (!Deno.env.get("GEMINI_API_KEY") && !Deno.env.get("GOOGLE_SA_JSON")) { await journal({ erreur: "gemini non configuré" }); return json({ erreur: "non_configure" }, 503); }

  let liste = await listeModeles(cle);
  if (liste.some(m => !exclure.has(m))) liste = liste.filter(m => !exclure.has(m)); // modèle qui vient d'échouer : un autre d'abord

  // a) Lecture longue en arrière-plan (AI Studio seulement).
  if (cle && ARRIERE_PLAN) {
    for (const modele of liste) {
      try {
        const id = await demarrerInteraction(cle, modele, image, mime, note);
        const { data: ligne, error } = await service.from("assistant_journal")
          .insert({ user_id: uid, duree_s: 0, texte: "[image]", action: { interaction: id, modele, ia: "gemini", reflexion: REFLEXION, essais: essais.length ? essais : undefined }, ms: 0 })
          .select("id").single();
        if (error || !ligne) throw new Error("journal: " + (error?.message || "?"));
        return json({ tache: ligne.id, modele });
      } catch (e) {
        essais.push(String((e as Error).message || e));
        // Interactions API refusée (400, 401, 403…) : inutile d'essayer les autres modèles en arrière-plan.
        if (!(e instanceof ErreurGemini) || !e.passer) break;
      }
    }
  }

  // b) Secours : appel direct, limité à 120 s.
  try {
    const { lecture, modele } = await demanderDirect(liste, image, mime, note, essais);
    await journal({ image: lecture, modele, direct: true });
    return json({ lecture, modele, ia: "gemini", ms: Date.now() - debut });
  } catch (e) {
    const msg = String((e as Error).message || e);
    await journal({ erreur: msg.slice(0, 800) });
    console.error(msg);
    return json({ erreur: codeErreur(msg) }, msg === "non_configure" ? 503 : 502);
  }
});
