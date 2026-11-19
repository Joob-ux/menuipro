import { describe, it, expect } from "vitest";
import { catalogueIA, validerAction } from "../src/assistant.js";
import { RECIPES, BIENTOT, buildRecipe, pack, holeLocal, SHEET, debitMassif, SECTIONS_DEF, vueFace } from "../src/engine/index.js";

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
    const ctx = ctxDe("mur-tasseaux", { matiere: "panneau" }, [100, 300, 4]);
    const t = ctx.parts.filter(p => p.name.startsWith("Tasseau"));
    expect(t.every(p => p.cut[0] <= 2420)).toBe(true);
    expect(t.length).toBe(2 * 17); // 17 tasseaux de 4 cm + 16 écarts de 2 cm = 100 cm
  });
  it("le bois massif de chaque modèle trouve sa section (options mini et maxi)", () => {
    for (const id of ids) for (const which of ["min", "max", "def"]) {
      const r = RECIPES.find(x => x.id === id), o = {}; r.opts.forEach(x => (o[x.k] = x.choice ? x.def : which === "def" ? x.def : x[which]));
      expect(debitMassif(ctxDe(id, o).parts).trop, r.nom + " " + which).toEqual([]);
    }
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

describe("Bois massif", () => {
  const massifs = RECIPES.filter(r => r.massif);
  it("les 7 meubles en bois massif sont disponibles et plus rien n'est « bientôt »", () => {
    expect(massifs.length).toBe(7);
    expect(BIENTOT.length).toBe(0);
  });
  for (const r of massifs) {
    for (const [nom, o] of Object.entries(variantes(r))) {
      it(`${r.nom} (${nom}) : chaque pièce trouve sa section, barres sans chevauchement`, () => {
        const ctx = build(r, o);
        const bois = ctx.parts.filter(p => p.mat === "massif");
        expect(bois.length).toBeGreaterThan(0);
        const d = debitMassif(ctx.parts);
        expect(d.trop).toEqual([]);
        const total = d.sections.reduce((t, s) => t + s.items.length, 0);
        expect(total).toBeGreaterThanOrEqual(bois.reduce((t, p) => t + p.qty, 0));
        for (const { section, res } of d.sections) {
          expect(res.over.length).toBe(0);
          for (const b of res.sheets) {
            expect(chevauche(b)).toBe(false);
            for (const p of b.parts) { expect(p.x + p.pw).toBeLessThanOrEqual(section.long); expect(p.y + p.ph).toBeLessThanOrEqual(section.larg); }
          }
        }
      });
    }
  }
  it("une pièce plus large que la planche devient un panneau lamellé-collé", () => {
    const d = debitMassif([{ name: "Plateau", mat: "massif", qty: 1, box: [0, 0, 0, 800, 27, 600] }]);
    expect(d.trop).toEqual([]);
    const it0 = d.sections[0].items;
    expect(it0.length).toBeGreaterThan(1);
    expect(it0.every(i => i.lamelle)).toBe(true);
    expect(it0[0].l).toBe(820);
  });
  it("une pièce trop épaisse ou trop longue est signalée", () => {
    const d = debitMassif([{ name: "Poteau", mat: "massif", qty: 1, box: [0, 0, 0, 100, 5000, 100] }]);
    expect(d.trop.length).toBe(1);
  });
  it("les sections du catalogue remplacent celles par défaut", () => {
    const sec = SECTIONS_DEF.map(s => ({ ...s, long: 3000 }));
    const d = debitMassif([{ name: "Montant", mat: "massif", qty: 1, box: [0, 0, 0, 65, 3500, 80] }], sec);
    expect(d.trop.length).toBe(1);
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
