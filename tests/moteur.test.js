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
