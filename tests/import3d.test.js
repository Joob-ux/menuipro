// Lecture des panneaux dans une 3D importée (import3d.js) — sans navigateur.
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { lirePanneaux, placer, classerBoite } from "../src/import3d.js";

// Meuble TV 1200 × 600 × 405 mm : 2 côtés, dessous, dessus, étagère, séparation, fond 5 mm, 4 pieds 40 × 40.
const BOITES = [
  [0, 100, 0, 18, 500, 400], [1182, 100, 0, 18, 500, 400], [18, 100, 0, 1164, 18, 400], [18, 582, 0, 1164, 18, 400],
  [18, 341, 0, 1164, 18, 400], [591, 118, 0, 18, 223, 400], [0, 100, -5, 1200, 500, 5],
  [20, 0, 20, 40, 100, 40], [1140, 0, 20, 40, 100, 40], [20, 0, 340, 40, 100, 40], [1140, 0, 340, 40, 100, 40]
];
const geo = ([x, y, z, w, h, d]) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x + w / 2, y + h / 2, z + d / 2); return g; };
const mat = new THREE.MeshStandardMaterial();
const lire = obj => lirePanneaux(placer(obj, { largeur: 120, quart: 0, couche: 0 }).groupe);
const coupes = r => r.list.map(p => p.b.slice(3).map(Math.round).sort((a, b) => b - a).join("×")).sort();
describe("Lire les panneaux d'une 3D", () => {
  it("panneaux collés dans un seul objet (export SketchUp courant) : chaque panneau est retrouvé", () => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(mergeGeometries(BOITES.map(geo)), mat));
    const r = lire(g);
    expect(r.list.length).toBe(11);
    expect(coupes(r)).toEqual(["1164×400×18", "1164×400×18", "1164×400×18", "1200×500×5", "400×223×18", "500×400×18", "500×400×18", "100×40×40", "100×40×40", "100×40×40", "100×40×40"].sort());
    expect(r.list.filter(p => p.m === "caisson").length).toBe(6);
    expect(r.list.filter(p => p.m === "dos").length).toBe(1);
    expect(r.list.filter(p => p.m === "massif").length).toBe(4);
    expect(r.base.map(Math.round)).toEqual([1200, 600, 405]);
  });
  it("un objet par panneau, avec leurs noms : les noms sont gardés", () => {
    const g = new THREE.Group();
    BOITES.forEach((b, i) => { const m = new THREE.Mesh(geo(b), mat); m.name = i === 4 ? "Etagere_12" : "Mesh_" + i; g.add(m); });
    const r = lire(g);
    expect(r.list.length).toBe(11);
    expect(r.list.some(p => p.n === "Etagere 1")).toBe(true);
    expect(r.list.some(p => p.n.startsWith("Côté / séparation"))).toBe(true);
  });
  it("un fichier en centimètres remis à la bonne largeur donne les mêmes coupes", () => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(mergeGeometries(BOITES.map(b => geo(b.map(v => v / 10)))), mat));
    expect(lire(g).list.length).toBe(11);
  });
  it("un bloc épais (coussin, frigo) n'est pas un panneau", () => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(geo([0, 0, 0, 600, 600, 600]), mat));
    const r = lire(g); expect(r.list.length).toBe(0); expect(r.ignores).toBe(1);
    expect(classerBoite([600, 18, 400])).toBe("caisson"); expect(classerBoite([5, 600, 400])).toBe("dos");
    expect(classerBoite([40, 700, 40])).toBe("massif"); expect(classerBoite([10, 10, 30])).toBe(null);
  });
});
