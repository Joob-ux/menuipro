import { describe, it, expect } from "vitest";
import { RECIPES, buildRecipe, pack } from "../src/engine/index.js";
import { MODELES_KILIFEU, FAMILLES_KILIFEU } from "../src/kilifeu.js";

const R = id => RECIPES.find(r => r.id === id);
const construire = m => {
  const r = R(m.recette), o = {};
  r.opts.forEach(x => (o[x.k] = x.def));
  Object.assign(o, m.o);
  return buildRecipe(r.id, { L: m.dims[0] * 10, H: m.dims[1] * 10, P: m.dims[2] * 10, ep: 18 }, o);
};

describe("Modèles ETS KILIFEU", () => {
  it("le catalogue est complet, sans doublon, et chaque famille a des modèles", () => {
    expect(MODELES_KILIFEU.length).toBeGreaterThanOrEqual(120);
    expect(new Set(MODELES_KILIFEU.map(m => m.id)).size).toBe(MODELES_KILIFEU.length);
    for (const [f] of FAMILLES_KILIFEU) expect(MODELES_KILIFEU.some(m => m.famille === f)).toBe(true);
  });
  it("chaque modèle ouvre un meuble existant, avec des options et des cotes valides", () => {
    for (const m of MODELES_KILIFEU) {
      const r = R(m.recette);
      expect(r, m.nom).toBeTruthy();
      const mn = r.dimMin || [10, 10, 10];
      m.dims.forEach((v, i) => expect(v, m.nom + " cote " + i).toBeGreaterThanOrEqual(mn[i]));
      for (const [k, v] of Object.entries(m.o)) {
        const opt = r.opts.find(x => x.k === k);
        expect(opt, m.nom + " option " + k).toBeTruthy();
        if (opt.choice) expect(opt.options.map(x => x[0]), m.nom + " " + k).toContain(v);
        else { expect(v).toBeGreaterThanOrEqual(opt.min); expect(v).toBeLessThanOrEqual(opt.max); }
      }
    }
  });
  it("chaque modèle se construit : pas de cote invalide, plus de bois massif, panneaux plaçables", () => {
    for (const m of MODELES_KILIFEU) {
      const c = construire(m);
      expect(c.parts.length, m.nom).toBeGreaterThan(0);
      expect(c.parts.every(p => !p.box || p.box.every(Number.isFinite)), m.nom).toBe(true);
      expect(c.parts.some(p => p.mat === "massif"), m.nom).toBe(false);
      const items = c.parts.filter(p => p.mat === "caisson" && p.cut).flatMap(p => Array.from({ length: p.qty }, () => ({ l: p.cut[0], w: p.cut[1], name: p.name })));
      expect(pack(items, 4, true).over, m.nom).toEqual([]);
    }
  });
  it("un canapé rembourré compte mousse, tissu, sangles et ouate", () => {
    const c = construire(MODELES_KILIFEU.find(m => m.id === "k351"));
    for (const k of ["mousse12", "mousse5", "tissu", "sangles", "ouate", "agrafes"]) expect(c.hw[k], k).toBeTruthy();
    expect(c.hw.tissu.qty).toBeGreaterThan(6);
    expect(c.hw.tissu.qty).toBeLessThan(16);
  });
  it("un salon complet contient bien ses 4 éléments", () => {
    const c = construire(MODELES_KILIFEU.find(m => m.id === "kc-collection-prestige-47"));
    const noms = new Set(c.parts.filter(p => p.mat).map(p => p.name.split(" · ")[0]));
    expect([...noms].filter(n => /Canapé|Fauteuil/.test(n)).length).toBe(4);
    expect(c.hw.boutons.qty).toBeGreaterThan(0);
  });
  it("la vue « structure » enlève le tissu de la 3D sans changer le débit", () => {
    const m = MODELES_KILIFEU.find(x => x.id === "k358");
    const a = construire(m), b = construire({ ...m, o: { ...m.o, vue: "structure" } });
    expect(b.parts.filter(p => p.look === "tissu").length).toBe(0);
    expect(b.parts.filter(p => p.mat).length).toBe(a.parts.filter(p => p.mat).length);
  });
});
