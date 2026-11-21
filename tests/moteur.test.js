import { describe, it, expect } from "vitest";
import { catalogueIA, validerAction } from "../src/assistant.js";
import { RECIPES, BIENTOT, buildRecipe, pack, holeLocal, SHEET, vueFace } from "../src/engine/index.js";

const variantes = r => {
  const base = {}; r.opts.forEach(x => (base[x.k] = x.def));
  const vals = which => { const o = { ...base }; r.opts.forEach(x => { if (!x.choice) o[x.k] = x[which]; }); return o; };
  return { def: base, min: vals("min"), max: vals("max") };
};
const build = (r, o) => buildRecipe(r.id, { L: r.dims[0] * 10, H: r.dims[1] * 10, P: r.dims[2] * 10, ep: 18 }, o);
const items = ctx => {
  const it = { caisson: [], dos: [] }; let id = 0;
  ctx.parts.filter(p => p.mat && p.mat !== "massif").forEach(p => { for (let q = 0; q < p.qty; q++) it[p.mat].push({ id: ++id, name: p.name, l: p.cut[0], w: p.cut[1] }); });
  return it;
};
const chevauche = sh => {
  for (let i = 0; i < sh.parts.length; i++) for (let j = i + 1; j < sh.parts.length; j++) {
    const a = sh.parts[i], b = sh.parts[j];
    if (a.x < b.x + b.pw && b.x < a.x + a.pw && a.y < b.y + b.ph && b.y < a.y + a.ph) return true;
  }
  return false;
};

describe("Catalogue de recettes", () => {
  it("contient au moins 37 meubles", () => expect(RECIPES.length).toBeGreaterThanOrEqual(37));
  it("contient les modèles actuels (mur TV, îlot, coiffure…)", () => {
    for (const id of ["tv-suspendu", "mur-tv", "range-chaussures", "console-entree", "vaisselier", "etagere-cubes", "tete-lit-chevets", "bureau-etude", "vestiaire-casiers", "ilot-cuisine", "poste-coiffure"]) expect(RECIPES.find(r => r.id === id)).toBeTruthy();
  });
  it("chaque meuble a un identifiant unique", () => expect(new Set(RECIPES.map(r => r.id)).size).toBe(RECIPES.length));
});

describe.each(RECIPES.map(r => [r.nom, r]))("%s", (_, r) => {
  for (const [nom, o] of Object.entries(variantes(r))) {
    it(`options ${nom} : pièces valides, découpe sans chevauchement, perçages dans les pièces`, () => {
      const ctx = build(r, o);
      for (const p of ctx.parts) {
        if (p.box) expect(p.box.slice(3).every(v => v > 0)).toBe(true);
        if (p.mat) expect(p.cut.every(v => v > 0)).toBe(true);
        for (const h of p.holes || []) {
          const { u, v } = holeLocal(p, h);
          expect(u).toBeGreaterThanOrEqual(-0.5); expect(v).toBeGreaterThanOrEqual(-0.5);
          expect(u).toBeLessThanOrEqual(p.cut[0] + 0.5); expect(v).toBeLessThanOrEqual(p.cut[1] + 0.5);
        }
      }
      const it2 = items(ctx);
      for (const mat of ["caisson", "dos"]) {
        const res = pack(it2[mat], 4, true);
        if (nom === "def") expect(res.over.length).toBe(0);
        for (const sh of res.sheets) {
          expect(chevauche(sh)).toBe(false);
          for (const p of sh.parts) { expect(p.x + p.pw).toBeLessThanOrEqual(SHEET.w - 2 * SHEET.trim); expect(p.y + p.ph).toBeLessThanOrEqual(SHEET.h - 2 * SHEET.trim); }
        }
      }
    });
  }
});

describe("Cas de référence menuisier", () => {
  it("armoire 100 × 200 × 58 : 4 feuilles de 18 mm et 1 feuille de 5 mm", () => {
    const r = RECIPES.find(x => x.id === "armoire-2");
    const ctx = build(r, { etageres: 3, penderie: 0, tiroirs: 0 });
    const it2 = items(ctx);
    expect(pack(it2.caisson, 4, true).sheets.length).toBe(4);
    expect(pack(it2.dos, 4, true).sheets.length).toBe(1);
  });
  it("une porte de plus de 160 cm reçoit 4 charnières", () => {
    const r = RECIPES.find(x => x.id === "armoire-2");
    const ctx = build(r, { etageres: 3, penderie: 0, tiroirs: 0 });
    expect(ctx.hw.charn.qty).toBe(8);
  });
  it("lit 160 × 200 : chant des côtés sur toute la longueur", () => {
    const r = RECIPES.find(x => x.id === "lit-double");
    const ctx = build(r, {});
    ctx.parts.filter(p => p.name.startsWith("Côté de lit")).forEach(p => expect(p.edge).toBe(2000));
  });
});

describe("Déco murale", () => {
  const ids = ["mur-tasseaux", "claustra", "panneau-led", "etageres-flottantes", "niches-murales"];
  const ctxDe = (id, o = {}, dims) => { const r = RECIPES.find(x => x.id === id), d = {}; r.opts.forEach(x => (d[x.k] = x.def)); const [L, H, P] = dims || r.dims; return buildRecipe(id, { L: L * 10, H: H * 10, P: P * 10, ep: 18 }, { ...d, ...o }); };
  it("les 5 modèles sont dans la famille « Déco murale »", () => {
    for (const id of ids) expect(RECIPES.find(r => r.id === id)?.cat).toBe("Déco murale");
  });
  it("mur 200 × 240, tasseaux de 4 cm écartés de 2 cm : 33 tasseaux, centrés", () => {
    const t = ctxDe("mur-tasseaux").parts.filter(p => p.name.startsWith("Tasseau"));
    expect(t.length).toBe(33);
    const gauche = t[0].box[0], droite = 2000 - (t[32].box[0] + t[32].box[3]);
    expect(Math.abs(gauche - droite)).toBeLessThan(1);
  });
  it("tasseaux en MDF plus hauts qu'une feuille : coupés en deux morceaux qui tiennent dans la feuille", () => {
    const ctx = ctxDe("mur-tasseaux", {}, [100, 300, 4]);
    const t = ctx.parts.filter(p => p.name.startsWith("Tasseau"));
    expect(t.every(p => p.cut[0] <= 2420)).toBe(true);
    expect(t.length).toBe(2 * 17); // 17 tasseaux de 4 cm + 16 écarts de 2 cm = 100 cm
  });
  it("fond, finition et fixations sont dans la liste de quincaillerie", () => {
    const hw = ctxDe("mur-tasseaux", { led: 1 }).hw;
    expect(hw.vernis.qty).toBeGreaterThan(0); expect(hw.mastic.qty).toBeGreaterThan(0); expect(hw.led.qty).toBe(5); expect(hw.fixmur.qty).toBeGreaterThan(0);
    expect(ctxDe("etageres-flottantes").hw.supinv.qty).toBe(6);
  });
  it("avec LED, le plan coté garde la largeur du mur ; un panneau de 180 × 120 tient en un seul morceau", () => {
    expect(vueFace(ctxDe("mur-tasseaux", { led: 1 })).cotes.largeur).toBe(2000);
    expect(ctxDe("panneau-led").parts.filter(p => p.name.startsWith("Panneau")).length).toBe(1);
  });
});

describe("Plan de façade coté", () => {
  const vue = (id, o) => { const r = RECIPES.find(x => x.id === id), d = {}; r.opts.forEach(x => (d[x.k] = x.def)); return vueFace(build(r, { ...d, ...o })); };
  it("armoire 100 × 200 : cotes totales, et socle + ouvertures + panneaux = hauteur", () => {
    const v = vue("armoire-2", { etageres: 3, penderie: 0, tiroirs: 0 });
    expect(v.cotes.largeur).toBe(1000); expect(v.cotes.hauteur).toBe(2000); expect(v.cotes.sol).toBe(0);
    expect(v.cotes.colonnes.map(c => c.v)).toEqual([964]);
    const n = v.cotes.niveaux;
    expect(n[0].v).toBe(80);
    // socle, puis une ouverture au-dessus de chaque panneau horizontal (dessous, étagères), le dessus ferme le haut
    expect(n.reduce((s, x) => s + x.v, 0) + n.length * 18).toBeCloseTo(2000, -1);
  });
  it("les portes sont dessinées devant le caisson", () => {
    const v = vue("armoire-2", {});
    const i = v.rects.findIndex(r => r.nature === "porte"), j = v.rects.findIndex(r => r.nom.endsWith("Côté gauche"));
    expect(i).toBeGreaterThan(j);
  });
  it("meuble TV suspendu : hauteur au-dessus du sol indiquée", () => expect(vue("tv-suspendu", {}).cotes.sol).toBe(350));
  it("commode 4 tiroirs : 4 façades cotées, de même hauteur", () => {
    const t = vue("commode", { tiroirs: 4, colonnes: 1 }).cotes.tiroirs;
    expect(t.length).toBe(4); expect(new Set(t.map(x => x.v)).size).toBe(1);
  });
  it("dressing 3 colonnes : 3 ouvertures égales", () => {
    const c = vue("dressing", { colonnes: 3 }).cotes.colonnes;
    expect(c.length).toBe(3); expect(new Set(c.map(x => x.v)).size).toBe(1);
  });
  it("chaque meuble donne une vue de face cohérente", () => {
    for (const r of RECIPES) {
      const v = vue(r.id, {});
      expect(v, r.nom).toBeTruthy();
      expect(v.cotes.largeur, r.nom).toBeGreaterThan(0); expect(v.cotes.hauteur, r.nom).toBeGreaterThan(0);
      for (const k of ["colonnes", "niveaux"]) for (const c of v.cotes[k]) { expect(c.v, r.nom).toBeGreaterThan(0); expect(c.b, r.nom).toBeGreaterThan(c.a); }
    }
  });
});

describe("Plus de bois massif : tout en panneaux", () => {
  it("les menuiseries tout en bois (porte pleine, fenêtre, lambris) sont retirées, plus rien n'est « bientôt »", () => {
    for (const id of ["porte-pleine", "fenetre", "lambris"]) expect(RECIPES.find(r => r.id === id)).toBeFalsy();
    expect(BIENTOT.length).toBe(0);
  });
  it("aucun meuble ne contient de bois massif : les pièces épaisses sont des bandes de panneau collées", () => {
    for (const r of RECIPES.filter(x => !x.dessin && !x.importe)) {
      const o = {}; r.opts.forEach(x => (o[x.k] = x.def));
      expect(build(r, o).parts.some(p => p.mat === "massif"), r.nom).toBe(false);
    }
    const chaise = build(RECIPES.find(r => r.id === "chaise"), { nombre: 4 });
    const pied = chaise.parts.find(p => p.plein && /épaisseurs collées/.test(p.name));
    expect(pied).toBeTruthy(); expect(pied.qty).toBe(4 * 3); // 4 chaises × 3 bandes de 18 mm pour un pied de 4 cm
    expect(pied.holes.length).toBe(0);
  });
  it("canapé rembourré : la structure est comptée en feuilles de panneau", () => {
    const r = RECIPES.find(x => x.id === "canape");
    const o = {}; r.opts.forEach(x => (o[x.k] = x.def));
    const ctx = build(r, o), it2 = items(ctx);
    expect(ctx.parts.filter(p => p.plein).length).toBeGreaterThan(0);
    expect(pack(it2.caisson, 4, true).over.length).toBe(0);
  });
});


describe("Assistant vocal : contrôle des actions de l'IA", () => {
  it("le catalogue envoyé à l'IA contient tous les meubles et reste léger", () => {
    const c = catalogueIA(RECIPES);
    expect(c.length).toBe(RECIPES.length);
    expect(JSON.stringify(c).length).toBeLessThan(28000); // la fonction serveur refuse au-delà de 30 000
  });
  it("une demande valide est appliquée, les valeurs hors limites sont bornées", () => {
    const r = RECIPES.find(x => x.id === "armoire-2");
    const k = r.opts.find(x => !x.choice);
    const a = validerAction({ action: "meuble", recette: "armoire-2", cotes: { L: "120", H: 200, P: 5 }, options: { [k.k]: 99 }, reponse: "compris" }, RECIPES);
    expect(a.recette).toBe("armoire-2");
    expect(a.cotes).toEqual({ L: 120, H: 200 });
    expect(a.options[k.k]).toBe(k.max);
  });
  it("un meuble inconnu ou une réponse inventée deviennent « pas compris »", () => {
    expect(validerAction({ action: "meuble", recette: "fusee" }, RECIPES).reponse).toBe("pas_compris");
    expect(validerAction({ action: "n'importe quoi", reponse: "<script>" }, RECIPES)).toMatchObject({ action: "inconnu", reponse: "pas_compris" });
    expect(validerAction(null, RECIPES)).toBe(null);
  });
  it("« modifier » sans meuble garde le meuble affiché", () => {
    const a = validerAction({ action: "modifier", cotes: { L: 150 } }, RECIPES, "armoire-2");
    expect(a.recette).toBe("armoire-2");
    expect(a.reponse).toBe("compris");
  });
});

import { croquisDefaut, normaliserCroquis, lireTrait, appliquerTrait, appliquerOutil, deplacerLigne, bordsColonnes } from "../src/engine/index.js";
describe("Mon dessin (croquis → meuble)", () => {
  const r = RECIPES.find(x => x.id === "croquis");
  const P = { L: 1200, H: 2000, P: 550, ep: 18 };
  const noms = ctx => ctx.parts.map(p => p.name);
  it("le croquis par défaut donne un meuble complet (caisse, séparation, tiroirs, portes, penderie)", () => {
    const ctx = buildRecipe("croquis", P, { croquis: croquisDefaut() });
    expect(noms(ctx)).toContain("Séparation 1");
    expect(noms(ctx).some(n => n.includes("Façade tiroir"))).toBe(true);
    expect(ctx.hw.tringle).toBeTruthy(); expect(ctx.hw.charn).toBeTruthy();
  });
  it("un croquis abîmé ou vide ne plante jamais", () => {
    for (const k of [null, {}, { cols: [] }, { cols: [{ zones: [{ t: "???", n: -4, f: "x" }] }] }, { cols: Array(30).fill({ f: 1 }) }])
      expect(() => buildRecipe("croquis", P, { croquis: k })).not.toThrow();
    expect(normaliserCroquis({ cols: Array(30).fill({ f: 1 }) }).cols.length).toBe(8);
  });
  it("un trait vertical coupe la colonne, un trait horizontal coupe la case", () => {
    const k = { socle: 0, cols: [{ f: 1, zones: [{ f: 1, t: "vide" }] }] };
    const v = lireTrait([[0.5, 0.1], [0.51, 0.5], [0.49, 0.9]]);
    expect(v.sens).toBe("vertical");
    const k2 = appliquerTrait(k, v, P.L, P.H);
    expect(k2.cols.length).toBe(2);
    const h = lireTrait([[0.05, 0.3], [0.45, 0.31]]);
    expect(h.sens).toBe("horizontal");
    const k3 = appliquerTrait(k2, h, P.L, P.H);
    expect(k3.cols[0].zones.length).toBe(2); expect(k3.cols[1].zones.length).toBe(1);
    // la case du haut fait environ 30 % de la hauteur
    expect(k3.cols[0].zones[1].f / (k3.cols[0].zones[0].f + k3.cols[0].zones[1].f)).toBeCloseTo(0.3, 2);
  });
  it("un gribouillis ou une case trop petite est refusé", () => {
    expect(lireTrait([[0.1, 0.1], [0.4, 0.4]])).toBe(null);
    const k = { cols: [{ f: 1, zones: [{ f: 1, t: "vide" }] }] };
    expect(appliquerTrait(k, { sens: "vertical", pos: 0.02 }, 1200, 2000)).toBe(null);
  });
  it("les outils remplissent la case, la gomme efface puis fusionne", () => {
    let k = { cols: [{ f: 1, zones: [{ f: 1, t: "vide" }, { f: 1, t: "vide" }] }] };
    k = appliquerOutil(k, 0, 0, "tiroir"); k = appliquerOutil(k, 0, 0, "tiroir");
    expect(k.cols[0].zones[0]).toMatchObject({ t: "tiroirs", n: 2 });
    k = appliquerOutil(k, 0, 1, "porte"); k = appliquerOutil(k, 0, 1, "porte");
    expect(k.cols[0].zones[1].portes).toBe(2);
    for (let n = 0; n < 3; n++) k = appliquerOutil(k, 0, 0, "gomme"); // 2 tiroirs → 1 → vide → fusion
    expect(k.cols[0].zones.length).toBe(1);
    const ctx = buildRecipe("croquis", P, { croquis: k });
    expect(ctx.hw.charn).toBeTruthy();
  });
  it("déplacer une séparation garde les bornes", () => {
    const k = { cols: [{ f: 1, zones: [{ f: 1, t: "vide" }] }, { f: 1, zones: [{ f: 1, t: "vide" }] }] };
    const k2 = deplacerLigne(k, "col", 0, 0, 0.75, 1200, 2000);
    expect(bordsColonnes(k2)[0][1]).toBeCloseTo(0.75, 3);
    expect(bordsColonnes(deplacerLigne(k, "col", 0, 0, 0.999, 1200, 2000))[0][1]).toBeLessThan(0.91);
  });
  it("la largeur des colonnes suit le dessin", () => {
    const k = { socle: 0, cols: [{ f: 1, zones: [{ f: 1, t: "etageres", n: 1 }] }, { f: 3, zones: [{ f: 1, t: "etageres", n: 1 }] }] };
    const ctx = buildRecipe("croquis", P, { croquis: k });
    const et = ctx.parts.filter(p => p.name.includes("Étagère"));
    expect(et[1].box[3] / et[0].box[3]).toBeGreaterThan(2.5);
  });
});

import { modulesCuisine } from "../src/engine/recettes.js";
describe("Cuisine en caissons", () => {
  const P = { L: 3000, H: 2200, P: 600, ep: 18 };
  const opts = (o = {}) => ({ position: "milieu", evier: 1000, tiroirs: 1, hauts: 1, hautEvier: 0, ...o });
  it("3 m : l'évier est au milieu, entouré de caissons d'environ 60 cm, sans trou", () => {
    const m = modulesCuisine(3000, opts());
    const ie = m.findIndex(x => x.type === "evier");
    expect(ie).toBeGreaterThan(0); expect(ie).toBeLessThan(m.length - 1);
    expect(m.reduce((s, x) => s + x.W, 0)).toBeCloseTo(3000, 6);
    m.filter(x => x.type !== "evier").forEach(x => { expect(x.W).toBeGreaterThanOrEqual(300); expect(x.W).toBeLessThanOrEqual(900); });
    const gauche = m.slice(0, ie).reduce((s, x) => s + x.W, 0), droite = m.slice(ie + 1).reduce((s, x) => s + x.W, 0);
    expect(Math.abs(gauche - droite)).toBeLessThanOrEqual(10);
  });
  it("l'évier peut aller à gauche ou à droite", () => {
    expect(modulesCuisine(3000, opts({ position: "gauche" }))[0].type).toBe("evier");
    expect(modulesCuisine(3000, opts({ position: "droite" })).at(-1).type).toBe("evier");
  });
  it("les tiroirs sont à côté de l'évier", () => {
    const m = modulesCuisine(3000, opts({ tiroirs: 2 })), ie = m.findIndex(x => x.type === "evier");
    expect(m[ie + 1].type).toBe("tiroirs"); expect(m[ie - 1].type).toBe("tiroirs");
  });
  it("le caisson évier n'a pas de dos ni d'étagère, et apporte évier, robinet et siphon", () => {
    const ctx = buildRecipe("cuisine-complete", P, opts());
    const ev = ctx.parts.filter(p => p.name.startsWith("Caisson évier"));
    expect(ev.some(p => p.name.includes("Dos"))).toBe(false);
    expect(ev.some(p => p.name.includes("Étagère"))).toBe(false);
    expect(ev.some(p => p.name.includes("Traverse avant"))).toBe(true);
    for (const k of ["evier", "robinet", "siphon", "decoupe"]) expect(ctx.hw[k]).toBeTruthy();
    // pas de caisson haut au-dessus de l'évier par défaut
    const nbBas = ctx.parts.filter(p => /^Caisson (bas \d+|évier) · Côté gauche$/.test(p.name)).length;
    const nbHaut = ctx.parts.filter(p => /^Caisson haut \d+ · Côté gauche$/.test(p.name)).length;
    expect(nbHaut).toBe(nbBas - 1);
    expect(buildRecipe("cuisine-complete", P, opts({ hautEvier: 1 })).parts.filter(p => /^Caisson haut \d+ · Côté gauche$/.test(p.name)).length).toBe(nbBas);
  });
  it("évier de 120 cm : 2 bacs", () => {
    expect(buildRecipe("cuisine-complete", P, opts({ evier: 1200 })).hw.evier.label).toContain("2 bacs");
    expect(buildRecipe("caisson-evier", { L: 800, H: 870, P: 560, ep: 18 }, {}).hw.evier.label).toContain("1 bac");
  });
  it("petite cuisine (1,40 m) : évier + un caisson, toujours sans trou", () => {
    const m = modulesCuisine(1400, opts());
    expect(m.reduce((s, x) => s + x.W, 0)).toBeCloseTo(1400, 6);
    expect(m.filter(x => x.type === "evier").length).toBe(1);
    expect(m.length).toBe(2);
  });
});

import { enleverLigne, normaliserModele, etirerPanneau } from "../src/engine/index.js";
describe("Gomme du dessin", () => {
  it("efface un par un : porte, puis étagères, puis la case", () => {
    let k = { cols: [{ f: 1, zones: [{ f: 1, t: "etageres", n: 2, portes: 1 }, { f: 1, t: "tiroirs", n: 2 }] }] };
    k = appliquerOutil(k, 0, 0, "gomme"); expect(k.cols[0].zones[0]).toMatchObject({ portes: 0, n: 2 });
    k = appliquerOutil(k, 0, 0, "gomme"); expect(k.cols[0].zones[0].n).toBe(1);
    k = appliquerOutil(k, 0, 0, "gomme"); expect(k.cols[0].zones[0].n).toBe(0);
    k = appliquerOutil(k, 0, 1, "gomme"); expect(k.cols[0].zones[1]).toMatchObject({ t: "tiroirs", n: 1 });
    k = appliquerOutil(k, 0, 1, "gomme"); expect(k.cols[0].zones[1].t).toBe("vide");
    k = appliquerOutil(k, 0, 1, "gomme"); expect(k.cols[0].zones.length).toBe(1);
  });
  it("la penderie s'efface", () => {
    const k = appliquerOutil({ cols: [{ f: 1, zones: [{ f: 1, t: "penderie" }] }] }, 0, 0, "gomme");
    expect(k.cols[0].zones[0].t).toBe("vide");
  });
  it("enlever une ligne fusionne, la plus grande case garde son contenu", () => {
    const k = { cols: [{ f: 2, zones: [{ f: 1, t: "tiroirs", n: 3 }] }, { f: 1, zones: [{ f: 1, t: "vide" }] }] };
    const k2 = enleverLigne(k, "col", 0, 0);
    expect(k2.cols.length).toBe(1); expect(k2.cols[0].zones[0]).toMatchObject({ t: "tiroirs", n: 3 });
    const k3 = enleverLigne({ cols: [{ f: 1, zones: [{ f: 1, t: "vide" }, { f: 3, t: "etageres", n: 2 }] }] }, "zone", 0, 0);
    expect(k3.cols[0].zones).toEqual([expect.objectContaining({ t: "etageres", n: 2, f: 4 })]);
  });
});

describe("Ma 3D : découpe aux dimensions réelles", () => {
  // caisse lue dans une 3D : 600 × 800 × 400, panneaux de 18
  const base = [600, 800, 400];
  const list = [
    { n: "Côté G", b: [0, 0, 0, 18, 800, 400], t: 0, m: "caisson", ep: 18 },
    { n: "Côté D", b: [582, 0, 0, 18, 800, 400], t: 0, m: "caisson", ep: 18 },
    { n: "Étagère", b: [18, 391, 0, 564, 18, 400], t: 1, m: "caisson", ep: 18 },
    { n: "Dos", b: [0, 0, 0, 600, 800, 5], t: 2, m: "dos", ep: 5 }
  ];
  const m = { base, list };
  it("aux mêmes dimensions, les pièces restent celles de la 3D", () => {
    const ctx = buildRecipe("modele3d", { L: 600, H: 800, P: 400, ep: 18 }, { panneaux: m });
    expect(ctx.parts.map(p => p.cut)).toEqual([[800, 400], [800, 400], [564, 400], [800, 600]]);
  });
  it("le menuisier tape 1200 × 1600 : l'épaisseur ne change pas, le côté droit reste au bord", () => {
    const d = etirerPanneau(list[1], base, [1200, 1600, 400], 18);
    expect(d[0] + d[3]).toBeCloseTo(1200, 6); expect(d[3]).toBe(18); expect(d[4]).toBe(1600);
    const e = etirerPanneau(list[2], base, [1200, 1600, 400], 18);
    expect(e[4]).toBe(18); expect(e[3]).toBeCloseTo(1128, 6); expect(e[1] + 9).toBeCloseTo(800, 6);
  });
  it("le panneau prend l'épaisseur choisie dans l'appli (16 mm)", () => {
    const ctx = buildRecipe("modele3d", { L: 600, H: 800, P: 400, ep: 16 }, { panneaux: m });
    expect(ctx.parts[1].box[3]).toBe(16); expect(ctx.parts[1].box[0] + 16).toBeCloseTo(600, 6);
  });
  it("une 3D abîmée ou absente donne une caisse simple, jamais d'erreur", () => {
    for (const x of [null, {}, { base: [0, 1, 1], list }, { base, list: [{ b: [1, 2] }] }]) {
      expect(normaliserModele(x)).toBe(null);
      expect(buildRecipe("modele3d", { L: 600, H: 800, P: 400, ep: 18 }, { panneaux: x }).parts.length).toBeGreaterThan(3);
    }
  });
});
describe("Ma 3D : bois massif", () => {
  it("un pied 40 × 40 garde sa section, seule sa hauteur suit le meuble", () => {
    const pied = { n: "Pied", b: [20, 0, 20, 40, 100, 40], t: 0, m: "massif", ep: 40 };
    const d = etirerPanneau(pied, [1200, 600, 400], [1500, 700, 500], 18);
    expect(d[3]).toBe(40); expect(d[5]).toBe(40); expect(d[4]).toBeCloseTo(100 * 700 / 600, 6);
  });
});

import { depuisLecture, hauteurSocle } from "../src/engine/index.js";
describe("Image lue → meuble", () => {
  // Ce que Gemini doit rendre pour la bibliothèque SketchUp 850 × 1750 × 448 (2 colonnes, 4 niches, plinthe, fond).
  const biblio = { type: "bibliothèque", dimensions_mm: { largeur: 850, hauteur: 1750, profondeur: 448 }, socle_mm: 60, pieds_mm: 0, dos: true,
    colonnes: [1, 2].map(() => ({ largeur_relative: 1, cases: [1, 2, 3, 4].map(() => ({ hauteur_relative: 1, type: "vide", nombre: 0, portes: 0 })) })),
    confiance: 0.9, remarque: "" };
  it("bibliothèque 2 × 4 niches : cotes lues, 2 colonnes égales, 4 cases chacune, plinthe 6 cm", () => {
    const l = depuisLecture(biblio);
    expect(l.ok).toBe(true); expect(l.dims).toEqual({ L: 85, H: 175, P: 44.8 });
    expect(l.croquis.cols.length).toBe(2); expect(l.croquis.cols.every(c => c.zones.length === 4)).toBe(true);
    expect(hauteurSocle(l.croquis)).toBe(60);
    const ctx = buildRecipe("croquis", { L: 850, H: 1750, P: 448, ep: 18 }, { croquis: l.croquis });
    // 2 côtés, dessus, dessous, plinthe, séparation, 2 × 3 traverses = 12 pièces de 18 mm + le fond
    expect(ctx.parts.filter(p => p.mat === "caisson").length).toBe(12);
    expect(ctx.parts.filter(p => p.mat === "dos").length).toBeGreaterThan(0);
    const sep = ctx.parts.find(p => p.name === "Séparation 1");
    expect(sep.box[0] + 9).toBeCloseTo(425, 0);
  });
  it("sans cote écrite : les cotes restent à taper, rien n'est inventé", () => {
    expect(depuisLecture({ ...biblio, dimensions_mm: null }).dims).toEqual({ L: null, H: null, P: null });
  });
  it("meuble sur pieds sans fond", () => {
    const l = depuisLecture({ ...biblio, socle_mm: 0, pieds_mm: 150, dos: false });
    const ctx = buildRecipe("croquis", { L: 850, H: 1750, P: 448, ep: 18 }, { croquis: l.croquis });
    expect(ctx.hw.pieds).toBeTruthy(); expect(ctx.parts.some(p => p.mat === "dos")).toBe(false);
    expect(Math.min(...ctx.parts.filter(p => p.box && p.mat).map(p => p.box[1]))).toBe(150);
  });
  it("pas de meuble, ou réponse abîmée : pas d'erreur", () => {
    expect(depuisLecture({ colonnes: [], remarque: "Pas un meuble" })).toMatchObject({ ok: false });
    expect(depuisLecture(null).ok).toBe(false);
    const l = depuisLecture({ colonnes: [{ cases: [{ type: "fusée", nombre: 99, portes: 7 }] }] });
    expect(l.ok).toBe(true); expect(() => buildRecipe("croquis", { L: 850, H: 1750, P: 448, ep: 18 }, { croquis: l.croquis })).not.toThrow();
  });
});

import { bordsSous, enleverLigne } from "../src/engine/index.js";
describe("Mon dessin : cases partagées en casiers", () => {
  const P = { L: 1200, H: 2000, P: 550, ep: 18 };
  const deux = () => ({ socle: 0, cols: [{ f: 1, zones: [{ f: 1, t: "tiroirs", n: 2 }, { f: 2, t: "etageres", n: 1 }] }] });
  it("un trait vertical dans une seule case la partage, sans couper toute la colonne", () => {
    const k = appliquerTrait(deux(), { sens: "vertical", pos: 0.5, de: 0.05, a: 0.6 }, P.L, P.H);
    expect(k.cols.length).toBe(1);
    const z = k.cols[0].zones[1];
    expect(z.sous.length).toBe(2); expect(z.sous[0].zones[0]).toMatchObject({ t: "etageres", n: 1 });
    expect(k.cols[0].zones[0].sous).toBeUndefined();
    const ctx = buildRecipe("croquis", P, { croquis: k });
    const sep = ctx.parts.find(p => p.name.includes("Séparation intérieure"));
    expect(sep).toBeTruthy();
    // la séparation intérieure ne monte que sur la case du haut (≈ 2/3 de la hauteur intérieure)
    expect(sep.box[4]).toBeLessThan(1400); expect(sep.box[4]).toBeGreaterThan(1100);
    expect(ctx.parts.filter(p => p.name.includes("Étagère")).length).toBe(2);
  });
  it("un trait vertical sur toute la hauteur fait toujours une nouvelle colonne", () => {
    const k = appliquerTrait(deux(), { sens: "vertical", pos: 0.5, de: 0.05, a: 0.95 }, P.L, P.H);
    expect(k.cols.length).toBe(2);
  });
  it("armoire : 2 portes devant une penderie et une colonne d'étagères", () => {
    const k = normaliserCroquis({ socle: 1, cols: [{ f: 1, zones: [{ f: 1, portes: 2, sous: [
      { f: 1, zones: [{ f: 1, t: "penderie" }] }, { f: 1, zones: [{ f: 1, t: "etageres", n: 4 }] }] }] }] });
    expect(k.cols[0].zones[0].sous.length).toBe(2);
    const ctx = buildRecipe("croquis", P, { croquis: k });
    expect(ctx.parts.filter(p => p.name.includes("Porte")).length).toBe(2);
    expect(ctx.hw.tringle).toBeTruthy(); expect(ctx.parts.filter(p => /Étagère \d/.test(p.name)).length).toBe(4);
    // les portes couvrent toute la largeur
    const portes = ctx.parts.filter(p => p.name.includes("Porte"));
    expect(portes.reduce((s, p) => s + p.box[3], 0)).toBeGreaterThan(1100);
  });
  it("outils et gomme sur un casier ; les portes de la case passent avant", () => {
    let k = normaliserCroquis({ cols: [{ f: 1, zones: [{ f: 1, t: "vide" }, { f: 1, portes: 1, sous: [{ f: 1, zones: [{ f: 1, t: "vide" }] }, { f: 1, zones: [{ f: 1, t: "vide" }] }] }] }] });
    k = appliquerOutil(k, 0, 1, "gomme", 0, 0);           // enlève d'abord la porte de la case
    expect(k.cols[0].zones[1].portes).toBe(0); expect(k.cols[0].zones[1].sous.length).toBe(2);
    k = appliquerOutil(k, 0, 1, "tiroir", 1, 0);
    expect(k.cols[0].zones[1].sous[1].zones[0]).toMatchObject({ t: "tiroirs", n: 1 });
    k = appliquerOutil(k, 0, 1, "gomme", 0, 0);           // casier vide : il rejoint son voisin → plus de partage
    expect(k.cols[0].zones[1].sous).toBeUndefined(); expect(k.cols[0].zones[1].t).toBe("tiroirs");
  });
  it("trait horizontal dans un casier, déplacer et enlever les lignes intérieures", () => {
    let k = appliquerTrait(deux(), { sens: "vertical", pos: 0.5, de: 0.05, a: 0.6 }, P.L, P.H);
    k = appliquerTrait(k, { sens: "horizontal", pos: 0.3, de: 0.05, a: 0.45 }, P.L, P.H);
    expect(k.cols[0].zones[1].sous[0].zones.length).toBe(2); expect(k.cols[0].zones[1].sous[1].zones.length).toBe(1);
    const k2 = deplacerLigne(k, "sous", 0, 1, 0.7, P.L, P.H, 120, 0);
    expect(bordsSous(k2.cols[0].zones[1])[0][1]).toBeCloseTo(0.7, 2);
    expect(enleverLigne(k, "souszone", 0, 1, 0, 0).cols[0].zones[1].sous[0].zones.length).toBe(1);
    expect(enleverLigne(k, "sous", 0, 1, 0).cols[0].zones.length).toBe(3); // casier à 2 cases → la case devient 2 cases
  });
  it("lecture abîmée : partage d'une seule sous-colonne, sous-cases imbriquées, trop de casiers", () => {
    const k = normaliserCroquis({ cols: [{ zones: [{ f: 2, sous: [{ zones: [{ t: "tiroirs", n: 3, sous: [{}, {}] }] }] }, { sous: Array(9).fill({ zones: [{}] }) }] }] });
    expect(k.cols[0].zones[0]).toMatchObject({ t: "tiroirs", n: 3 }); expect(k.cols[0].zones[0].sous).toBeUndefined();
    expect(k.cols[0].zones[1].sous.length).toBe(4);
    expect(() => buildRecipe("croquis", P, { croquis: k })).not.toThrow();
  });
});

describe("Image lue → meuble : casiers, portes, proportions", () => {
  const meubleTV = { type: "meuble TV", dimensions_mm: null, rapport_hauteur_largeur: 0.45, socle_mm: 0, pieds_mm: 120, dos: true, confiance: 0.9, remarque: "",
    colonnes: [{ largeur_relative: 2, cases: [
      { hauteur_relative: 1, type: "vide", nombre: 0, portes: 0, sous_colonnes: [
        { largeur_relative: 1, cases: [{ hauteur_relative: 1, type: "tiroirs", nombre: 1, portes: 0 }] },
        { largeur_relative: 1, cases: [{ hauteur_relative: 1, type: "tiroirs", nombre: 1, portes: 0 }] }] },
      { hauteur_relative: 1.5, type: "vide", nombre: 0, portes: 0 }] },
      { largeur_relative: 1, cases: [{ hauteur_relative: 1, type: "etageres", nombre: 2, portes: 1, type_porte: "vitree" }] }] };
  it("2 tiroirs côte à côte sous une niche, porte vitrée, proportions gardées", () => {
    const l = depuisLecture(meubleTV);
    expect(l.ok).toBe(true); expect(l.rapport).toBeCloseTo(0.45, 3);
    expect(l.croquis.cols[0].zones[0].sous.length).toBe(2);
    expect(l.croquis.cols[1].zones[0]).toMatchObject({ portes: 1, pt: "vitree" });
    const ctx = buildRecipe("croquis", { L: 1800, H: 810, P: 450, ep: 18 }, { croquis: l.croquis });
    expect(ctx.parts.filter(p => p.name.includes("Façade tiroir")).length).toBe(2);
    expect(ctx.hw.verre).toBeTruthy();
    const f = ctx.parts.filter(p => p.name.includes("Façade tiroir")).map(p => p.box[0]).sort((a, b) => a - b);
    expect(f[1] - f[0]).toBeGreaterThan(400); // côte à côte, pas empilés
  });
  it("vieilles réponses (sans sous_colonnes ni rapport) toujours lues", () => {
    const l = depuisLecture({ colonnes: [{ largeur_relative: 1, cases: [{ hauteur_relative: 1, type: "vide", nombre: 0, portes: 0 }] }] });
    expect(l.ok).toBe(true); expect(l.rapport).toBe(null);
  });
});

describe("Mon dessin : le trait fait ce qui est dessiné", () => {
  const P = { L: 1200, H: 2000, P: 550, ep: 18 };
  const une = () => ({ socle: 0, cols: [{ f: 1, zones: [{ f: 1, t: "vide" }] }] });
  it("trait court en bas d'une colonne : coupe la case à la fin du trait, partage seulement le bas", () => {
    const k = appliquerTrait(une(), { sens: "vertical", pos: 0.5, de: 0.6, a: 0.97 }, P.L, P.H);
    expect(k.cols.length).toBe(1); expect(k.cols[0].zones.length).toBe(2);
    expect(k.cols[0].zones[0].sous.length).toBe(2);          // en bas : 2 casiers
    expect(k.cols[0].zones[1].sous).toBeUndefined();        // en haut : la case reste entière
    expect(k.cols[0].zones[0].f / (k.cols[0].zones[0].f + k.cols[0].zones[1].f)).toBeCloseTo(0.4, 2);
  });
  it("trait au milieu sans toucher les bords : 3 cases, celle du milieu partagée", () => {
    const k = appliquerTrait(une(), { sens: "vertical", pos: 0.4, de: 0.3, a: 0.6 }, P.L, P.H);
    expect(k.cols[0].zones.length).toBe(3); expect(k.cols[0].zones[1].sous.length).toBe(2);
    expect(bordsSous(k.cols[0].zones[1])[0][1]).toBeCloseTo(0.4, 3);
  });
  it("trait presque de haut en bas (tracé à la main) : toujours une nouvelle colonne", () => {
    expect(appliquerTrait(une(), { sens: "vertical", pos: 0.5, de: 0.1, a: 0.9 }, P.L, P.H).cols.length).toBe(2);
    expect(appliquerTrait(une(), { sens: "vertical", pos: 0.5, de: 0.2, a: 0.95 }, P.L, P.H).cols.length).toBe(2);
  });
  it("le meuble construit suit le dessin : la séparation intérieure ne monte que sur le morceau tracé", () => {
    const k = appliquerTrait(une(), { sens: "vertical", pos: 0.5, de: 0.6, a: 0.97 }, P.L, P.H);
    const ctx = buildRecipe("croquis", P, { croquis: k });
    const sep = ctx.parts.find(p => p.name.includes("Séparation intérieure"));
    expect(sep.box[1]).toBeLessThan(40); expect(sep.box[4]).toBeGreaterThan(700); expect(sep.box[4]).toBeLessThan(850);
  });
});
describe("Mon dessin : un trait ne multiplie pas les étagères", () => {
  it("case à 3 étagères coupée par un trait court : 3 étagères en tout, pas 9", () => {
    const k0 = { socle: 0, cols: [{ f: 1, zones: [{ f: 1, t: "etageres", n: 3 }] }] };
    const k = appliquerTrait(k0, { sens: "vertical", pos: 0.5, de: 0.8, a: 0.97 }, 1200, 2000);
    const ctx = buildRecipe("croquis", { L: 1200, H: 2000, P: 550, ep: 18 }, { croquis: k });
    expect(ctx.parts.filter(p => /Étagère \d/.test(p.name)).length).toBe(3);
    expect(k.cols[0].zones[0].sous.length).toBe(2);
  });
});
describe("3D réaliste : caisson et coulisses des tiroirs", () => {
  it("chaque façade de tiroir donne les mesures de son caisson et de ses coulisses, dans l'ouverture", () => {
    const ctx = buildRecipe("croquis", { L: 600, H: 800, P: 500, ep: 18 }, { croquis: { socle: 0, cols: [{ f: 1, zones: [{ f: 1, t: "tiroirs", n: 3 }] }] } });
    const f = ctx.parts.filter(p => p.drawer);
    expect(f.length).toBe(3);
    f.forEach(p => {
      const t = p.tiroir;
      expect(t.w).toBeCloseTo(600 - 36, 0); expect(t.coulisse).toBeGreaterThanOrEqual(250); expect(t.coulisse).toBeLessThanOrEqual(t.prof + 50);
      expect(t.y).toBeGreaterThanOrEqual(p.box[1]); expect(t.y + t.h).toBeLessThanOrEqual(p.box[1] + p.box[4]);
    });
  });
});

import { modulesMur, boiteMonde } from "../src/engine/index.js";
describe("Cuisine en I ou en L", () => {
  const r = RECIPES.find(x => x.id === "cuisine");
  const def = {}; r.opts.forEach(x => (def[x.k] = x.def));
  const P = { L: 600, H: 870, P: 560, ep: 18 };
  const cui = o => buildRecipe("cuisine", P, { ...def, ...o });
  const nb = (ctx, re) => ctx.parts.filter(p => re.test(p.name)).length;
  const chevauchent = (a, b) => [0, 1, 2].every(i => a[i] < b[i] + b[i + 3] - 1 && b[i] < a[i] + a[i + 3] - 1);
  it("est en tête de la famille Cuisine, l'ancienne cuisine est cachée", () => {
    expect(RECIPES.find(x => x.cat === "Cuisine").id).toBe("cuisine");
    expect(RECIPES.find(x => x.id === "cuisine-complete").cache).toBe(true);
  });
  it("en I : le nombre de caissons choisi, évier, frigo au bout, cuisson à l'écart de l'évier", () => {
    const m = modulesMur(5, { ...def, Wb: 600, Pt: 600, evier: 1000, frigo: "frigo", cuisson: "cuisiniere60", forme: "I" }, 1);
    expect(m.filter(x => x.type === "bas" || x.type === "tiroirs").length).toBe(5);
    expect(m[0].type).toBe("frigo");
    const ie = m.findIndex(x => x.type === "evier"), ic = m.findIndex(x => x.type === "cuisson");
    expect(Math.abs(ic - ie)).toBeGreaterThan(1);
    expect(m.at(-1).x + m.at(-1).W).toBe(m.reduce((s, x) => s + x.W, 0)); // sans trou
    const ctx = cui({ bas1: 5, hauts1: 3 });
    expect(nb(ctx, /^Caisson bas \d+ · Côté gauche$/)).toBe(5);
    expect(nb(ctx, /^Caisson haut \d+ · Côté gauche$/)).toBe(3);
  });
  it("les caissons hauts évitent la hotte et le frigo", () => {
    const ctx = cui({ bas1: 4, hauts1: 8, hotte: 1 });
    const hauts = ctx.parts.filter(p => /^Caisson haut \d+ · Côté gauche$/.test(p.name));
    const m = ctx.cuisine.modules[0], cu = m.find(x => x.type === "cuisson"), fr = m.find(x => x.type === "frigo");
    for (const h of hauts) for (const z of [cu, fr]) expect(h.box[0] >= z.x + z.W - 1 || h.box[0] + 600 <= z.x + 1).toBe(true);
  });
  for (const retour of ["gauche", "droite"]) it("en L, retour à " + retour + " : le 2e mur est tourné, rien ne se chevauche", () => {
    const ctx = cui({ forme: "L", retour, bas1: 3, bas2: 3, hauts1: 3, hauts2: 3 });
    const mur2 = ctx.parts.filter(p => p.rep), mur1 = ctx.parts.filter(p => p.box && !p.rep);
    expect(mur2.length).toBeGreaterThan(20);
    expect(nb(ctx, /^Mur 2 · Caisson bas \d+ · Côté gauche$/)).toBe(3);
    expect(nb(ctx, /^Mur 2 · Caisson haut \d+ · Côté gauche$/)).toBe(3);
    expect(nb(ctx, /^Caisson d'angle · Côté gauche$/)).toBe(1);
    const corps = l => l.filter(p => p.box && p.mat && !p.door && !p.drawer).map(boiteMonde);
    for (const a of corps(mur2)) for (const b of corps(mur1)) expect(chevauchent(a, b)).toBe(false);
    // Le retour est contre le mur de gauche (x ≈ 0) ou de droite (x ≈ longueur du mur 1), après le coin.
    const xs = corps(mur2).flatMap(b => [b[0], b[0] + b[3]]), zs = corps(mur2).map(b => b[2]);
    if (retour === "gauche") expect(Math.min(...xs)).toBeGreaterThanOrEqual(-6); else expect(Math.max(...xs)).toBeLessThanOrEqual(ctx.cuisine.mur1 + 6);
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(330 - 1);
  });
  it("l'électroménager est en 3D seulement : ni découpe ni liste d'achat ; la plaque demande une découpe du plan", () => {
    const ctx = cui({ cuisson: "plaque", frigo: "americain", lv: 1, micro: 1 });
    expect(ctx.parts.some(p => p.look === "electro" && !p.mat)).toBe(true);
    expect(ctx.parts.some(p => p.look === "electro" && p.mat)).toBe(false);
    expect(ctx.hw.decoupePlaque).toBeTruthy();
    expect(nb(ctx, /^Caisson four · Côté gauche$/)).toBe(1);
    expect(nb(ctx, /^Caisson haut micro-ondes · Côté gauche$/)).toBe(1);
    expect(r.resume(ctx)).toContain("lave-vaisselle");
  });
  it("en L avec tout au maximum : pièces valides et découpe possible", () => {
    const max = { ...def }; r.opts.forEach(x => { if (!x.choice) max[x.k] = x.max; });
    const ctx = cui({ ...max, forme: "L", cuisson: "plaque" });
    for (const p of ctx.parts) if (p.box) expect(p.box.slice(3).every(v => v > 0)).toBe(true);
    const it2 = items(ctx);
    expect(pack(it2.caisson, 4, true).over.length).toBe(0);
  });
});

import { decouperTropGrand } from "../src/engine/decoupe.js";
describe("Grandes cotes : nombre exact de feuilles", () => {
  it("une pièce plus grande que la feuille est coupée en morceaux qui rentrent, trous compris", () => {
    const { items, joints } = decouperTropGrand([{ id: 1, name: "Côté", l: 3000, w: 600, holes: [{ u: 100, v: 50 }, { u: 2900, v: 50 }] }], 2420, 1200);
    expect(items.length).toBe(2); expect(joints[0].n).toBe(2);
    items.forEach(i => expect(i.l).toBeLessThanOrEqual(2420));
    expect(items[0].holes.length).toBe(1); expect(items[1].holes[0].u).toBe(1400);
  });
  it("toute cote donne des feuilles, sans pièce oubliée (armoire 3 m de haut, 4 m de large)", () => {
    for (const [L, H, P] of [[100, 300, 60], [400, 260, 60], [250, 250, 130]]) {
      const r = RECIPES.find(x => x.id === "armoire-2"), o = {}; r.opts.forEach(x => (o[x.k] = x.def));
      const ctx = buildRecipe("armoire-2", { L: L * 10, H: H * 10, P: P * 10, ep: 18 }, o), it2 = items(ctx);
      for (const mat of ["caisson", "dos"]) {
        const res = pack(it2[mat], 4, true);
        expect(res.over.length).toBe(0);
        const surf = it2[mat].reduce((t, p) => t + p.l * p.w, 0), place = res.sheets.reduce((t, s) => t + s.parts.reduce((u, p) => u + p.pw * p.ph, 0), 0);
        expect(place).toBeGreaterThanOrEqual(surf * 0.995); // toute la matière est placée
        expect(res.sheets.length).toBeGreaterThanOrEqual(Math.ceil(surf / (2420 * 1200)));
      }
    }
  });
});

describe("Chambre à coucher complète", () => {
  const r = RECIPES.find(x => x.id === "chambre"), def = {}; r.opts.forEach(x => (def[x.k] = x.def));
  const ch = o => buildRecipe("chambre", { L: 1600, H: 1100, P: 2000, ep: 18 }, { ...def, ...o });
  const meubles = ctx => [...new Set(ctx.parts.filter(p => p.box).map(p => p.name.split(" · ")[0]))];
  it("est en tête de la famille Chambre et contient lit, 2 chevets, armoire, coiffeuse", () => {
    expect(RECIPES.find(x => x.cat === "Chambre").id).toBe("chambre");
    expect(meubles(ch({}))).toEqual(["Armoire", "Chevet gauche", "Lit", "Chevet droit", "Coiffeuse"]);
  });
  it("les meubles sont posés côte à côte sans se toucher, dos au mur", () => {
    for (const o of [{}, { typeLit: "capitonne", commode: 1, armoire: 4, largeurArmoire: 250 }]) {
      const ctx = ch(o), ext = meubles(ctx).map(m => { const b = ctx.parts.filter(p => p.box && p.mat && p.name.startsWith(m + " · ")).map(p => p.box); return [Math.min(...b.map(x => x[0])), Math.max(...b.map(x => x[0] + x[3])), Math.min(...b.map(x => x[2]))]; });
      for (let i = 1; i < ext.length; i++) expect(ext[i][0]).toBeGreaterThan(ext[i - 1][1]);
      ext.forEach(e => expect(e[2]).toBeGreaterThanOrEqual(0));
    }
  });
  it("une seule liste : les fournitures des meubles s'additionnent", () => {
    const seul = buildRecipe("chevet", { L: 450, H: 550, P: 400, ep: 18 }, { tiroirs: 2 });
    const ctx = ch({ armoire: 0, coiffeuse: 0, tiroirsChevet: 2 });
    const k = Object.keys(seul.hw).find(x => /coulisse/i.test(x)) || Object.keys(seul.hw)[0];
    expect(ctx.hw[k].qty).toBeGreaterThanOrEqual(2 * seul.hw[k].qty);
    expect(r.resume(ctx)).toContain("2 chevets");
  });
  it("lit à tiroirs ou capitonné selon le choix", () => {
    expect(ch({ tiroirsLit: 2 }).parts.some(p => /Lit · Façade tiroir de lit/.test(p.name))).toBe(true);
    expect(ch({ typeLit: "capitonne" }).parts.some(p => p.name.startsWith("Lit · ") && /mousse|Mousse|tissu|Tissu/.test(p.name + JSON.stringify(p.look || "")))).toBe(true);
  });
});
