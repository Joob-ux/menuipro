// MenuiPro — chambre à coucher complète en un seul projet : lit + tête de lit, chevets, armoire, coiffeuse (+ commode).
/* Comme les chambres vendues au Sénégal : tous les meubles dans le même panneau et la même couleur,
   une seule liste d'achat, un seul plan de découpe, une seule commande, un seul devis.
   Chaque meuble est construit par son propre modèle (lit, chevet, armoire…), puis posé le long du mur :
   armoire · chevet · lit · chevet · coiffeuse · commode. Les noms des pièces disent à quel meuble elles sont. */
import { newCtx } from "./blocs.js";
import { RECIPES, stp, chx } from "./recettes.js";

const ECART = 400; // passage entre deux meubles (mm)

// Construit un meuble existant à part, puis le pose dans la chambre à partir de x (dos contre le mur, z = 0).
// Renvoie le bout droit du meuble posé.
function placer(c, id, [L, H, P], o, x, nom) {
  const r = RECIPES.find(q => q.id === id), d = {};
  r.opts.forEach(q => (d[q.k] = q.def));
  const sub = newCtx({ ...c.p, L, H, P });
  r.build(sub, sub.p, { ...d, ...o });
  const boites = sub.parts.filter(p => p.box);
  if (!boites.length) return x;
  const minx = Math.min(...boites.map(p => p.box[0])), maxx = Math.max(...boites.map(p => p.box[0] + p.box[3])), minz = Math.min(...boites.map(p => p.box[2]));
  const dx = x - minx, dz = -minz;
  for (const p of sub.parts) {
    p.name = nom + " · " + p.name;
    if (p.box) {
      p.box = [p.box[0] + dx, p.box[1], p.box[2] + dz, p.box[3], p.box[4], p.box[5]];
      for (const h of p.holes || []) h.p = [h.p[0] + dx, h.p[1], h.p[2] + dz];
      if (p.tiroir) p.tiroir = { ...p.tiroir, x: p.tiroir.x + dx, front: p.tiroir.front + dz };
    }
    c.parts.push(p);
  }
  for (const [k, v] of Object.entries(sub.hw)) {
    if (!c.hw[k]) c.hw[k] = { ...v, qty: 0 };
    c.hw[k].qty += v.qty;
  }
  return maxx + dx;
}

export function construireChambre(c, p, o) {
  const pieces = [];
  let x = 0;
  // Armoire à gauche.
  if (+o.armoire) {
    const id = +o.armoire === 2 ? "armoire-2" : "armoire-34";
    x = placer(c, id, [o.largeurArmoire * 10, o.hauteurArmoire * 10, 580], { portes: +o.armoire, penderie: 1, tiroirs: o.tiroirsArmoire }, x, "Armoire") + ECART;
    pieces.push("armoire " + o.armoire + " portes " + o.largeurArmoire + " cm");
  }
  const chevet = cote => placer(c, "chevet", [o.largeurChevet * 10, 550, 400], { tiroirs: o.tiroirsChevet }, x, "Chevet " + cote) + 50;
  if (o.chevets >= 1) x = chevet(o.chevets === 2 ? "gauche" : "");
  // Le lit, au centre : en panneau, ou rembourré (tête capitonnée).
  if (o.typeLit === "capitonne") {
    const tissu = o.tissu ? { tissu: o.tissu } : {};
    x = placer(c, "lit-rembourre", [p.L, p.H + 150, p.P], { ...tissu }, x, "Lit");
  } else x = placer(c, o.tiroirsLit ? "lit-tiroirs" : "lit-double", [p.L, p.H, p.P], { tiroirs: o.tiroirsLit }, x, "Lit");
  pieces.unshift("lit " + p.L / 10 + " × " + p.P / 10);
  x += 50;
  if (o.chevets === 2) x = chevet("droit");
  if (o.chevets) pieces.push(o.chevets + " chevet" + (o.chevets > 1 ? "s" : ""));
  // À droite du lit : coiffeuse, puis commode.
  let fin = x - 50, xr = fin + ECART;
  if (o.coiffeuse) { fin = placer(c, "coiffeuse", [1100, 760, 450], { tiroirs: 3 }, xr, "Coiffeuse"); xr = fin + 200; pieces.push("coiffeuse avec miroir"); }
  if (o.commode) { fin = placer(c, "commode", [1000, 850, 450], { tiroirs: 4, colonnes: 1 }, xr, "Commode"); pieces.push("commode"); }
  x = fin;
  c.chambre = { longueur: x, pieces };
}

const r = RECIPES.find(q => q.id === "lit-rembourre"), tissuOpt = r && r.opts.find(q => q.k === "tissu");
const CHAMBRE = { id: "chambre", nom: "Chambre à coucher complète", e: "🛏️", cat: "Chambre", dims: [160, 110, 200], dimMin: [90, 60, 180],
  dimLabels: ["Largeur du matelas", "Hauteur de la tête de lit", "Longueur du matelas"],
  opts: [
    { ...chx("typeLit", "Lit", [["panneau", "🟫 Tête en panneau"], ["capitonne", "🛋️ Tête capitonnée"]], "panneau"), titre: "🛏️ Lit" },
    { ...stp("tiroirsLit", "Tiroirs sous le lit (par côté)", "🗄️", 0, 0, 3), si: o => o.typeLit !== "capitonne" },
    ...(tissuOpt ? [{ ...tissuOpt, si: o => o.typeLit === "capitonne" }] : []),
    { ...stp("chevets", "Tables de chevet", "🌙", 2, 0, 2), titre: "🌙 Chevets" },
    { ...stp("tiroirsChevet", "Tiroirs par chevet", "🗄️", 2, 1, 3), si: o => o.chevets > 0 },
    { ...stp("largeurChevet", "Largeur d'un chevet (cm)", "↔️", 45, 35, 70, 5), si: o => o.chevets > 0 },
    { ...chx("armoire", "Armoire", [[0, "Sans"], [2, "🚪 2 portes"], [3, "🚪 3 portes"], [4, "🚪 4 portes"]], 3), titre: "🚪 Armoire" },
    { ...stp("largeurArmoire", "Largeur de l'armoire (cm)", "↔️", 160, 80, 300, 10), si: o => +o.armoire > 0 },
    { ...stp("hauteurArmoire", "Hauteur de l'armoire (cm)", "↕️", 210, 180, 240, 5), si: o => +o.armoire > 0 },
    { ...stp("tiroirsArmoire", "Tiroirs en bas de l'armoire", "🗄️", 0, 0, 2), si: o => +o.armoire > 0 },
    { ...stp("coiffeuse", "Coiffeuse avec miroir", "🪞", 1, 0, 1), titre: "🪞 Coiffeuse et commode" },
    stp("commode", "Commode", "🗄️", 0, 0, 1)
  ],
  resume(c) {
    const k = c.chambre; if (!k) return "";
    return "📏 Longueur de mur : " + (k.longueur / 1000).toFixed(2).replace(".", ",") + " m · " + k.pieces.join(" · ");
  },
  build: construireChambre };
// En tête de la famille Chambre.
RECIPES.splice(Math.max(0, RECIPES.findIndex(q => q.cat === "Chambre")), 0, CHAMBRE);
