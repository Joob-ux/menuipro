import { describe, it, expect } from "vitest";
import { RECIPES, buildRecipe, pack, holeLocal, SHEET } from "../src/engine/index.js";

const variantes = r => {
  const base = {}; r.opts.forEach(x => (base[x.k] = x.def));
  const vals = which => { const o = { ...base }; r.opts.forEach(x => { if (!x.choice) o[x.k] = x[which]; }); return o; };
  return { def: base, min: vals("min"), max: vals("max") };
};
const build = (r, o) => buildRecipe(r.id, { L: r.dims[0] * 10, H: r.dims[1] * 10, P: r.dims[2] * 10, ep: 18 }, o);
const items = ctx => {
  const it = { caisson: [], dos: [] }; let id = 0;
  ctx.parts.filter(p => p.mat).forEach(p => { for (let q = 0; q < p.qty; q++) it[p.mat].push({ id: ++id, name: p.name, l: p.cut[0], w: p.cut[1] }); });
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
});
