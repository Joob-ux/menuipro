// MenuiPro — cuisine en I (un mur) ou en L (deux murs), caissons comptés par le menuisier, électroménager placé.
/* Le menuisier choisit :
   1. la forme : en I ou en L (retour à gauche ou à droite) ;
   2. les dimensions d'un caisson bas (cotes du meuble) et d'un caisson haut (options) ;
   3. le nombre de caissons en bas et en haut, mur par mur ;
   4. l'électroménager : cuisinière ou plaque + four, hotte, frigo, lave-vaisselle, micro-ondes.
   L'appli place tout sans trou : évier, lave-vaisselle à côté, cuisson à l'écart de l'évier, frigo au bout,
   caisson d'angle dans le coin du L ; les caissons hauts s'alignent en évitant hotte, frigo et (par défaut) l'évier.

   Mur 1 : le long de x, dos contre le mur (z = 0). Mur 2 (retour du L) : construit dans son propre repère
   comme un mur droit, puis tourné de 90° (champ « rep » des pièces : la 3D le place, les perçages
   ne mélangent pas les deux murs). L'électroménager est en 3D seulement : il n'entre ni dans la découpe
   ni dans la liste d'achat (le client l'achète). */
import { add3d, hw, caisse, planTravail } from "./blocs.js";
import { RECIPES, stp, chx, basCuisine, hautCuisine, evierCuisine, traversesHaut, CAISSON_BAS, HAUT_FINI, PDT_CUISINE, profCorps, DIMS_CAISSON } from "./recettes.js";

const PDT = PDT_CUISINE; // épaisseur du plan de travail (mm)
export const ELECTRO = {
  cuisiniere60: { W: 600, nom: "Cuisinière 60 cm" },
  cuisiniere90: { W: 900, nom: "Cuisinière 90 cm" },
  plaque: { W: 600, nom: "Plaque de cuisson + four encastré" },
  frigo: { W: 600, nom: "Réfrigérateur 60 cm" },
  americain: { W: 900, nom: "Réfrigérateur américain 90 cm" }
};

/* ---------- Placement des modules d'un mur ----------
   n : caissons de rangement ; o : options. Renvoie [{ type, W }] dans l'ordre, du début à la fin du mur.
   Types : bas, tiroirs, evier, lv (lave-vaisselle), cuisson, frigo, angle. */
export function modulesMur(n, o, mur) {
  const L = o.forme === "L", Wb = o.Wb, cuissonIci = o.cuisson !== "aucune" && (mur === 2 ? L && o.murCuisson === "mur2" : !L || o.murCuisson !== "mur2");
  const core = Array.from({ length: Math.max(0, n) }, () => ({ type: "bas", W: Wb }));
  let ie = -1;
  if (mur === 1 && +o.evier > 0) {
    ie = o.position === "gauche" ? 0 : o.position === "droite" ? core.length : Math.floor(core.length / 2);
    const ev = [{ type: "evier", W: +o.evier }];
    if (o.lv) ev.push({ type: "lv", W: 600 });
    core.splice(ie, 0, ...ev);
  }
  // Tiroirs : les caissons les plus proches de l'évier (ou du milieu s'il n'y a pas d'évier sur ce mur).
  const ref = ie >= 0 ? ie : Math.floor(core.length / 2), proches = core.map((m, i) => [i, Math.abs(i - ref)]).filter(([i]) => core[i].type === "bas").sort((a, b) => a[1] - b[1] || b[0] - a[0]);
  proches.slice(0, mur === 1 ? o.tiroirs || 0 : 0).forEach(([i]) => core[i].type = "tiroirs");
  if (cuissonIci) {
    const cu = { type: "cuisson", W: ELECTRO[o.cuisson].W };
    if (ie < 0) core.splice(Math.ceil(core.length / 2), 0, cu);
    else {
      // Côté qui a le plus de caissons, au milieu de ce côté : au moins un caisson entre évier et cuisson si possible.
      const fin = ie + (o.lv ? 2 : 1), gauche = ie, droite = core.length - fin;
      if (droite >= gauche) core.splice(fin + Math.min(droite, Math.max(1, Math.ceil(droite / 2))), 0, cu);
      else core.splice(Math.max(0, gauche - Math.max(1, Math.ceil(gauche / 2))), 0, cu);
    }
  }
  // Mur 1 : caisson d'angle du côté du retour, frigo à l'autre bout (en I : frigo à gauche).
  const angle = { type: "angle", W: o.Pt + 400 }, frigo = o.frigo !== "aucun" && mur === 1 ? { type: "frigo", W: ELECTRO[o.frigo].W } : null;
  if (mur === 1) {
    if (L && o.retour === "droite") { if (frigo) core.unshift(frigo); core.push(angle); }
    else if (L) { core.unshift(angle); if (frigo) core.push(frigo); }
    else if (frigo) core.unshift(frigo);
  }
  let x = 0; return core.map(m => { const r = { ...m, x }; x += m.W; return r; });
}

/* ---------- Électroménager en 3D ---------- */
function cuisiniere(c, x, W, H) {
  const D = 600, h = H; // la cuisinière posée a la hauteur du plan de travail
  add3d(c, "electro", [x + 2, 0, 0, W - 4, h - 20, D - 10]);
  add3d(c, "noir", [x + 2, h - 20, 0, W - 4, 20, D - 10]);                         // table de cuisson
  const nf = W >= 900 ? 5 : 4, pos = nf === 5 ? [[0.2, 0.3], [0.2, 0.72], [0.5, 0.5], [0.8, 0.3], [0.8, 0.72]] : [[0.27, 0.3], [0.27, 0.72], [0.73, 0.3], [0.73, 0.72]];
  pos.forEach(([u, v]) => add3d(c, "metal", [x + u * W - 50, h, v * D - 50, 100, 12, 100]));      // brûleurs
  add3d(c, "noir", [x + 40, 120, D - 10, W - 80, h - 330, 8]);                    // porte du four
  add3d(c, "glass", [x + 90, 220, D - 4, W - 180, h - 560, 6]);                   // vitre du four
  add3d(c, "metal", [x + 60, h - 170, D - 2, W - 120, 18, 22]);                  // poignée
  for (let k = 0; k < nf; k++) add3d(c, "noir", [x + 50 + k * (W - 100) / nf + (W - 100) / nf / 2 - 15, h - 95, D - 2, 30, 30, 20]); // boutons
}
function plaqueFour(c, x, W, H, D) {
  // Caisson four : ouvert devant (le four se glisse dedans), un tiroir en bas ; plaque posée dans le plan de travail.
  c._debutCaisson = c.parts.length;
  caisse(c, x, 0, 0, W, H - PDT, D, { nom: "Caisson four", socle: CAISSON_BAS.socle, dessus: false, colonnes: [[{ t: "tiroirs", n: 1, h: 120 }, { t: "niche", h: 580 }]] });
  traversesHaut(c, x, W, H - PDT, D, "Caisson four · ");
  hw(c, "decoupePlaque", "🪚", "Découpe de la plaque dans le plan de travail", 1);
  const yf = 100 + c.E + 120 + c.E + 10;
  add3d(c, "electro", [x + 25, yf, D - 20, W - 50, 580, 20]);
  add3d(c, "noir", [x + 60, yf + 60, D, W - 120, 380, 6]);
  add3d(c, "metal", [x + 70, yf + 480, D, W - 140, 18, 24]);
  add3d(c, "noir", [x + 40, H, 30, W - 80, 6, Math.min(420, D)]);              // plaque vitrocéramique
}
function hotte(c, x, W, y, yHaut, Hh) {
  const Wh = Math.min(W, 900);
  add3d(c, "electro", [x + (W - Wh) / 2, y, 0, Wh, 90, 500]);
  add3d(c, "electro", [x + W / 2 - 130, y + 90, 0, 260, Math.max(100, yHaut + Hh - y - 90), 240]);
}
function frigo(c, x, W, H) {
  add3d(c, "electro", [x + 10, 0, 0, W - 20, H, 640]);
  if (W >= 900) { add3d(c, "noir", [x + W / 2 - 2, 20, 640, 4, H - 40, 2]); [-1, 1].forEach(s => add3d(c, "metal", [x + W / 2 + s * 40 - 10, H / 2 - 300, 650, 20, 600, 30])); }
  else { add3d(c, "noir", [x + 20, H * 0.62, 640, W - 40, 4, 2]); add3d(c, "metal", [x + W - 70, H * 0.68, 650, 20, 380, 30]); add3d(c, "metal", [x + W - 70, H * 0.35, 650, 20, 300, 30]); }
}
function laveVaisselle(c, x, H, D) {
  add3d(c, "electro", [x + 2, 100, D - 20, 596, H - PDT - 110, 20]);
  add3d(c, "noir", [x + 2, H - PDT - 110, D, 596, 80, 4]);
  add3d(c, "noir", [x + 2, 0, D - 60, 596, 100, 18]);
}
function microOndes(c, x, W, y) { add3d(c, "electro", [x + (W - 500) / 2, y, 20, 500, 290, 300]); add3d(c, "noir", [x + (W - 500) / 2 + 30, y + 40, 320, 330, 210, 4]); }

/* ---------- Un mur : caissons bas, électroménager, plan de travail, caissons hauts ---------- */
function construireMur(c, mods, o, nHauts, mur, nm) {
  const { H, D, Pt, Wh, Hh, Dh } = o, yHaut = H + 580;
  let nb = 0;
  const pdt = []; // morceaux de plan de travail [début, fin]
  const ouvrir = x => { if (!pdt.length || pdt[pdt.length - 1][1] !== null) pdt.push([x, null]); };
  const fermer = x => { if (pdt.length && pdt[pdt.length - 1][1] === null) pdt[pdt.length - 1][1] = x; };
  for (const m of mods) {
    if (m.type === "frigo") { fermer(m.x); frigo(c, m.x, m.W, 1800); continue; }
    if (m.type === "cuisson" && o.cuisson !== "plaque") { fermer(m.x); cuisiniere(c, m.x, m.W, H); continue; }
    ouvrir(m.x);
    if (m.type === "evier") evierCuisine(c, m.x, m.W, { nom: nm + "Caisson évier" });
    else if (m.type === "lv") laveVaisselle(c, m.x, H, D);
    else if (m.type === "cuisson") plaqueFour(c, m.x, m.W, H, D);
    else if (m.type === "angle") {
      // Caisson d'angle : la partie contre le retour est cachée (façade fixe), une porte sur la partie libre.
      const gauche = o.retour !== "droite", Wl = m.W - Pt;
      c._debutCaisson = c.parts.length;
      caisse(c, m.x, 0, 0, m.W, H - PDT, D, { nom: "Caisson d'angle", socle: CAISSON_BAS.socle, dessus: false, colonnes: gauche ? [[{ t: "etageres", n: 1 }], [{ t: "etageres", n: 1, portes: { n: 1 } }]] : [[{ t: "etageres", n: 1, portes: { n: 1 } }], [{ t: "etageres", n: 1 }]], largeurs: gauche ? [Pt, Wl] : [Wl, Pt] });
      traversesHaut(c, m.x, m.W, H - PDT, D, "Caisson d'angle · ");
    }
    else basCuisine(c, m.x, m.W, { nom: nm + "Caisson bas " + (++nb), tiroirs: m.type === "tiroirs" ? 3 : 0 });
  }
  const fin = mods.length ? mods[mods.length - 1].x + mods[mods.length - 1].W : 0;
  fermer(fin);
  pdt.filter(([a, b]) => b - a > 1).forEach(([a, b]) => planTravail(c, a, H - PDT, 0, b - a, Pt));
  // Hauts : à la suite depuis le début du mur, en sautant la hotte, le frigo et l'évier (fenêtre) sauf si demandé.
  const bloque = mods.filter(m => m.type === "frigo" || (m.type === "cuisson" && o.hotte) || (m.type === "evier" && !o.hautEvier)).map(m => [m.x, m.x + m.W]);
  mods.filter(m => m.type === "cuisson" && o.hotte).forEach(m => hotte(c, m.x, m.W, H + 650, yHaut, Hh));
  // Mur 1 d'un L à droite : on remplit depuis le coin (fin du mur) vers la gauche.
  // Mur 2 : les hauts commencent dans le coin, juste devant ceux du mur 1 (x négatif dans le repère du retour).
  const sens = mur === 1 && o.forme === "L" && o.retour === "droite" ? -1 : 1;
  let x = sens > 0 ? (mur === 2 ? Dh - Pt : 0) : fin, nh = 0, micro = !!o.micro;
  for (let k = 0; k < nHauts; k++) {
    for (let g = 0; g < 50; g++) {
      const a = sens > 0 ? x : x - Wh, b = a + Wh, gene = bloque.find(([u, v]) => a < v - 1 && b > u + 1);
      if (!gene) break;
      x = sens > 0 ? gene[1] : gene[0];
    }
    const a = sens > 0 ? x : x - Wh;
    if (micro && mur === 1) {
      // Micro-ondes : le premier caisson haut garde une niche ouverte en bas.
      caisse(c, a, yHaut, 0, Wh, Hh, Dh, { nom: nm + "Caisson haut micro-ondes", colonnes: [[{ t: "niche", h: 330 }, { t: "etageres", n: 0, portes: { n: Wh > 600 ? 2 : 1 } }]] });
      hw(c, "fixhaut", "🔩", "Fixations meubles hauts", 2);
      microOndes(c, a, Wh, yHaut + c.E + 5); micro = false; nh++;
    } else hautCuisine(c, a, Wh, nm + "Caisson haut " + (++nh), yHaut, Hh, Dh);
    x = sens > 0 ? a + Wh : a;
  }
  return fin;
}

export function construireCuisine(c, p, o0) {
  const o = {
    // Système de caisson unique : hauteur et profondeur fixes, seule la largeur vient des cotes.
    ...o0, H: HAUT_FINI, D: profCorps(c), Pt: CAISSON_BAS.plan, Wb: p.L,
    Wh: (+o0.largeurHaut || 60) * 10, Hh: (+o0.hauteurHaut || 70) * 10, Dh: (+o0.profHaut || 33) * 10
  };
  const L = o.forme === "L";
  const m1 = modulesMur(o.bas1, o, 1);
  const l1 = construireMur(c, m1, o, o.hauts1, 1, L ? "Mur 1 · " : "");
  c.cuisine = { mur1: l1, mur2: 0, modules: [m1] };
  if (!L) return;
  // Retour : construit droit, puis tourné. Il commence au bout du plan de travail du mur 1 (coin).
  const debut = c.parts.length, m2 = modulesMur(o.bas2, o, 2);
  const l2 = construireMur(c, m2, o, o.hauts2, 2, "Mur 2 · ");
  // Gauche : on tourne de +90° (la façade regarde vers +x) ; l'origine du repère est au bout du retour.
  // Droite : -90° (façade vers -x), origine contre le mur de droite, juste après le coin.
  const rep = o.retour === "droite" ? { x: l1, z: o.Pt, rot: -90 } : { x: 0, z: o.Pt + l2, rot: 90 };
  if (o.retour !== "droite") {
    // Le repère tourné de +90° fait courir x vers le fond : on retourne le mur pour que son début soit dans le coin.
    for (const part of c.parts.slice(debut)) if (part.box) { part.box = part.box.slice(); part.box[0] = l2 - part.box[0] - part.box[3]; if (part.hingeLeft !== undefined) part.hingeLeft = !part.hingeLeft; if (part.tiroir) part.tiroir = { ...part.tiroir, x: l2 - part.tiroir.x - part.tiroir.w }; for (const h of part.holes) h.p = [l2 - h.p[0], h.p[1], h.p[2]]; }
  }
  for (const part of c.parts.slice(debut)) part.rep = rep;
  c.cuisine.mur2 = l2; c.cuisine.modules.push(m2);
}

const CUISINE = ({ id: "cuisine", nom: "Cuisine en I ou en L", e: "🍳", cat: "Cuisine", dims: [60, 82, 46], dimMin: [30, 82, 46],
  ...DIMS_CAISSON, dimLabels: ["Largeur d'un caisson bas", "Hauteur (fixe)", "Profondeur façades comprises (fixe)"],
  opts: [
    chx("forme", "Forme de la cuisine", [["I", "▬ En I (un mur)"], ["L", "⌐ En L (deux murs)"]], "I"),
    { ...chx("retour", "Le 2e mur est", [["gauche", "⬅️ À gauche"], ["droite", "➡️ À droite"]], "gauche"), si: o => o.forme === "L" },
    { ...stp("bas1", "Caissons en bas", "⬇️", 4, 0, 12), titre: "⬇️ En bas", labelL: "Caissons en bas · mur 1" },
    { ...stp("bas2", "Caissons en bas · mur 2", "⬇️", 2, 0, 12), si: o => o.forme === "L" },
    stp("tiroirs", "Dont caissons à tiroirs", "🗄️", 1, 0, 12),
    chx("evier", "Caisson évier", [[0, "Sans"], [800, "80 cm"], [1000, "100 cm"], [1200, "120 cm (2 bacs)"]], 1000),
    { ...chx("position", "Place de l'évier", [["gauche", "⬅️ À gauche"], ["milieu", "🚰 Au milieu"], ["droite", "➡️ À droite"]], "milieu"), si: o => +o.evier > 0 },
    { ...stp("hauts1", "Caissons en haut", "⬆️", 3, 0, 12), titre: "⬆️ En haut", labelL: "Caissons en haut · mur 1" },
    { ...stp("hauts2", "Caissons en haut · mur 2", "⬆️", 2, 0, 12), si: o => o.forme === "L" },
    stp("largeurHaut", "Largeur d'un caisson haut (cm)", "↔️", 60, 30, 120, 5),
    stp("hauteurHaut", "Hauteur d'un caisson haut (cm)", "↕️", 70, 30, 100, 5),
    stp("profHaut", "Profondeur d'un caisson haut (cm)", "⤢", 33, 20, 45, 1),
    { ...stp("hautEvier", "Caisson haut au-dessus de l'évier", "🪟", 0, 0, 1), si: o => +o.evier > 0 },
    { ...chx("cuisson", "Cuisson", [["aucune", "Aucune"], ["cuisiniere60", "🔥 Cuisinière 60"], ["cuisiniere90", "🔥 Cuisinière 90"], ["plaque", "🍳 Plaque + four"]], "cuisiniere60"), titre: "🔌 Électroménager" },
    { ...chx("murCuisson", "Cuisson sur le", [["mur1", "Mur 1"], ["mur2", "Mur 2"]], "mur2"), si: o => o.forme === "L" && o.cuisson !== "aucune" },
    { ...stp("hotte", "Hotte au-dessus de la cuisson", "💨", 1, 0, 1), si: o => o.cuisson !== "aucune" },
    chx("frigo", "Réfrigérateur", [["aucun", "Aucun"], ["frigo", "🧊 60 cm"], ["americain", "🧊 Américain 90 cm"]], "frigo"),
    { ...stp("lv", "Lave-vaisselle (à côté de l'évier)", "🍽️", 0, 0, 1), si: o => +o.evier > 0 },
    stp("micro", "Micro-ondes (dans un caisson haut)", "📻", 0, 0, 1)
  ],
  // Phrase affichée sous les options : longueur de chaque mur et place de l'électroménager.
  resume(c) {
    const k = c.cuisine; if (!k) return "";
    const m = v => (v / 1000).toFixed(2).replace(".", ",") + " m", noms = { evier: "évier", lv: "lave-vaisselle", cuisson: "cuisson", frigo: "frigo", angle: "angle" };
    const ordre = mods => mods.map(x => noms[x.type] || null).filter((v, i, a) => v && a.indexOf(v) === i).join(" → ");
    return "📏 Mur 1 : " + m(k.mur1) + (k.mur2 ? " · Mur 2 : " + m(k.mur2) + " (après le coin)" : "") + (ordre(k.modules[0]) ? " · " + ordre(k.modules[0]) : "") + (k.modules[1] && ordre(k.modules[1]) ? " · mur 2 : " + ordre(k.modules[1]) : "");
  },
  build: construireCuisine });
// En tête de la famille Cuisine.
RECIPES.splice(Math.max(0, RECIPES.findIndex(r => r.cat === "Cuisine")), 0, CUISINE);
