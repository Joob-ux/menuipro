/* Accessoires : l'appli calcule les quantités, la quincaillerie fixe ses articles et ses prix.
 * Aucun prix d'accessoire n'est fourni par l'appli. Un article de la quincaillerie peut être
 * « lié » (champ calc) à un accessoire que l'appli compte : il donne alors le nom et le prix
 * de la ligne correspondante dans la liste d'achat. Sans article lié, la ligne reste « prix ? ».
 * Ce module ne touche pas au DOM. */

// [clé, icône, libellé, unité de calcul, taille du paquet]
export const ARTICLES = [
 ["chant","🎞️","Bande de chant","m"],["chant20","🎞️","Chant 20 mm","m"],["chant40","🎞️","Chant 40 mm","m"],["vis440","🔩","Vis 4 × 40","boîte de 100",100],["vis3516","🔩","Vis 3,5 × 16","boîte de 200",200],["tourillons","🪵","Tourillons Ø8 × 35","sachet de 100",100],
 ["charn","⭕","Charnière invisible","pièce"],["charnv","⭕","Charnière pour verre","pièce"],["poignees","🚪","Poignée","pièce"],["coulisses","🗄️","Coulisses de tiroir","paire"],
 ["taquets","📌","Taquet d'étagère","pièce"],["tringle","➖","Tringle de penderie","m"],["supports","🔩","Support de tringle","pièce"],["rail","↔️","Rail coulissant","m"],
 ["galets","⚙️","Kit galets coulissants","kit"],["cuvettes","✋","Poignée cuvette","pièce"],["verre","🪟","Verre trempé","m²"],["miroir","🪞","Miroir 60 × 80","pièce"],
 ["pieds","🦵","Pied de table","pièce"],["piedsreg","🦵","Pied réglable cuisine","pièce"],["pdt","🟫","Plan de travail 38 mm","m"],["roulettes","🛞","Roulette","pièce"],
 ["lattes","🪵","Latte de lit","pièce"],["tasseaux","🪵","Tasseau bois","m"],["poutre","🪵","Traverse bois (chevron)","m"],["equerres","📐","Équerre","pièce"],
 ["fixmur","🔩","Fixations murales","lot de 4",4],["fixhaut","🔩","Fixation meuble haut","pièce"],["kitfrigo","🧊","Kit porte frigo intégrable","pièce"],["aeration","🌬️","Grille d aération frigo","pièce"],["pointes","🔨","Pointes","boîte de 500",500],["vasque","🚰","Vasque à poser","pièce"],
 ["paumelles","⚙️","Paumelle de porte","pièce"],["serrure","🔒","Serrure + cylindre","pièce"],["espagnolette","🔒","Espagnolette / crémone","pièce"],["pattes","🔩","Patte de scellement","pièce"],
 ["boulons","🔩","Boulon de lit 8 × 120","pièce"],["visbois","🔩","Vis à bois","boîte de 100",100],["chevilles","🔩","Cheville + vis","pièce"],["colle","🧴","Colle à bois","pot"],
 ["patins","⚪","Patin de pied","pièce"],["sangles","🧵","Sangle élastique","m"],["mousse","🟨","Mousse 10 cm","m²"],["tissu","🧶","Tissu d'ameublement","m"],
 ["led","💡","Ruban LED + alimentation","m"],["moraillon","🔒","Moraillon porte-cadenas","pièce"],
 ["supinv","🔩","Support invisible d'étagère","pièce"],["mastic","🧴","Colle mastic de fixation","cartouche"],["vernis","🖌️","Vernis ou peinture","litre"],
 ["mousse12","🟨","Mousse d'assise 12 cm (D35)","m²"],["mousse5","🟨","Mousse 5 cm","m²"],["ouate","☁️","Ouate (dacron)","m"],["toile","▫️","Toile de dessous","m"],
 ["agrafes","📎","Agrafes de tapissier","boîte"],["colleContact","🧴","Colle contact néoprène","pot"],["boutons","🔘","Bouton de capitonnage","pièce"],
 ["piedsBois","🦵","Pied bois tourné","pièce"],["piedsMetal","🦵","Pied métal doré","pièce"]];

export const accessoire = k => ARTICLES.find(x => x[0] === k) || null;

// Article de la quincaillerie lié à l'accessoire calculé k (le premier qui a un nom).
export function articleLie(cat, k) {
  return (cat && Array.isArray(cat.articles) ? cat.articles : []).find(a => a && a.calc === k && a.nom) || null;
}
export const prixAccessoire = (cat, k) => { const a = articleLie(cat, k); return a ? (+a.prix || 0) : 0; };

// Nouvel article de la quincaillerie, pré-rempli pour un accessoire calculé (prix vide : c'est elle qui le met).
export function nouvelArticle(k, id) {
  const s = k && accessoire(k);
  return s ? { id: id || "std-" + k, e: s[1], nom: s[2], unite: s[3], prix: 0, calc: k }
           : { id: id || "art" + Date.now().toString(36), e: "🛍️", nom: "", unite: "pièce", prix: 0 };
}

// Lier un article à un accessoire calculé : un seul article par accessoire, l'unité suit le calcul.
export function lier(cat, art, k) {
  if (!k) { delete art.calc; return art; }
  const s = accessoire(k); if (!s) return art;
  cat.articles.forEach(a => { if (a !== art && a.calc === k) delete a.calc; });
  art.calc = k; art.unite = s[3]; if (!art.nom) art.nom = s[2]; if (!art.e || art.e === "🛍️") art.e = s[1];
  return art;
}

// Accessoires calculés que la quincaillerie n'a pas encore liés à un article avec un prix.
export const accessoiresSansPrix = cat => ARTICLES.filter(([k]) => !prixAccessoire(cat, k));

/* Ancien format : la quincaillerie remplissait une liste fixe CAT.prix[clé].
 * Chaque prix déjà saisi devient un article de la quincaillerie lié au calcul (id stable « std-clé »),
 * pour ne rien perdre. Renvoie true si le catalogue a changé. */
export function normaliserArticles(cat) {
  if (!cat) return false;
  if (!Array.isArray(cat.articles)) cat.articles = [];
  if (!cat.prix || typeof cat.prix !== "object") cat.prix = {};
  let change = false;
  ARTICLES.forEach(([k]) => {
    if (!(k in cat.prix)) return;
    const p = +cat.prix[k] || 0;
    if (p > 0 && !articleLie(cat, k) && !cat.articles.some(a => a.id === "std-" + k)) {
      cat.articles.push({ ...nouvelArticle(k), prix: p });
    }
    delete cat.prix[k]; change = true;
  });
  return change;
}
