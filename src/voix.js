// MenuiPro — guide vocal. Phrases fixes, jouées en wolof (fichiers audio générés avec Adia TTS
// ou enregistrés par l'administrateur), sinon lues en français par le téléphone.
import * as cloud from "./cloud/cloud.js";

// Clé → [icône, texte français]. Le texte wolof est dans outils/voix_wolof_adia.ipynb (même clés).
export const PHRASES = {
  bienvenue: ["👋", "Bienvenue sur MenuiPro. Choisis le meuble que tu veux fabriquer."],
  choisir: ["🪑", "Touche l'image du meuble."],
  cotes: ["📏", "Écris la largeur, la hauteur et la profondeur, en centimètres."],
  options: ["➕", "Appuie sur plus ou moins pour changer les tiroirs, les portes et les étagères."],
  resultat: ["🟫", "Ici, tu vois combien de feuilles ou de barres de bois il faut acheter."],
  vue3d: ["🧊", "Touche une porte ou un tiroir pour l'ouvrir. Tourne le meuble avec ton doigt."],
  plan: ["✂️", "Voici le plan de découpe. Chaque rectangle est une pièce à couper."],
  achat: ["🛒", "Voici tout ce qu'il faut acheter, avec le prix."],
  commander: ["📲", "Appuie sur le bouton vert pour envoyer la commande sur WhatsApp."],
  devis: ["💰", "Écris le nom du client, puis envoie-lui le devis en image."],
  debit: ["📋", "La liste de débit donne la taille de chaque pièce."],
  bois: ["🪵", "Pour le bois massif, l'application calcule les planches, chevrons et madriers à acheter."],
  cnc: ["🤖", "Ce bouton prépare les fichiers pour la machine à commande numérique."],
  projets: ["📁", "Ici, tu retrouves tous tes meubles enregistrés."],
  catalogue: ["🏪", "Ici, on met les prix des panneaux, du bois et des accessoires."],
  atelier: ["⚙️", "Écris ton nom, ton téléphone et ton prix de la journée."],
  compte: ["👤", "Connecte-toi avec ton numéro de téléphone et ton code à six chiffres."],
  code_quinc: ["🔢", "Écris le code donné par ta quincaillerie."],
  ecoute: ["🎙️", "Je t'écoute. Dis-moi le meuble et ses mesures, puis touche encore le micro."],
  compris: ["👍", "D'accord. Voici ton meuble."],
  modifie: ["🔁", "C'est changé."],
  pas_compris: ["🤔", "Je n'ai pas compris. Répète doucement, s'il te plaît."],
  limite: ["⛔", "Tu as beaucoup parlé aujourd'hui. Réessaie demain."],
  enregistre: ["✅", "C'est enregistré."],
  erreur: ["⚠️", "Il y a un problème. Vérifie et réessaie."]
};

let dispo = {}; // clé → version du fichier audio wolof
let lecteur = null;
export const reglage = () => { try { return JSON.parse(localStorage.getItem("menuipro-atelier") || "{}").voix || "wo"; } catch (e) { return "wo"; } };

export async function chargerVoix() {
  if (!cloud.actif) return dispo;
  try { dispo = await cloud.listeVoix(); } catch (e) { dispo = {}; }
  return dispo;
}
export const aUnAudio = cle => Boolean(dispo[cle]);

function direFrancais(texte) {
  if (!("speechSynthesis" in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = "fr-FR"; u.rate = 0.95;
  const v = speechSynthesis.getVoices().find(x => /^fr/i.test(x.lang));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
  return true;
}

// Joue une phrase selon le réglage : wolof (si l'audio existe) → français → rien.
export function parler(cle, bouton, force) {
  const mode = force || reglage(), ph = PHRASES[cle];
  if (!ph || mode === "non") return;
  if (lecteur) { lecteur.pause(); lecteur = null; }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (mode === "wo" && dispo[cle]) {
    lecteur = new Audio(cloud.urlVoix(cle, dispo[cle]));
    if (bouton) { bouton.classList.add("parle"); lecteur.onended = lecteur.onerror = () => bouton.classList.remove("parle"); }
    lecteur.play().catch(() => direFrancais(ph[1]));
    return;
  }
  direFrancais(ph[1]);
}

// Bouton 🔊 à placer à côté d'un titre.
export function boutonVoix(cle, el) {
  const b = el("button", { type: "button", class: "voix", "aria-label": "Écouter : " + PHRASES[cle][1], title: "Écouter" }, "🔊");
  b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); parler(cle, b); });
  return b;
}
