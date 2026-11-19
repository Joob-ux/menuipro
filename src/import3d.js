// MenuiPro — 3D importée par le menuisier (fichier fait sur SketchUp, Blender, 3ds Max…).
// La 3D importée sert à montrer le meuble au client ; la découpe et le prix viennent toujours du meuble MenuiPro.
import * as THREE from "three";

export const FORMATS = ["glb", "gltf", "obj", "stl", "fbx"];
export const IMAGES = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"];
export const ACCEPT = FORMATS.map(f => "." + f).join(",") + ",image/*";
export const estImage = f => !!f && ((f.type || "").startsWith("image/") || IMAGES.includes(extension(f.name)));
export const TAILLE_MAX = 20 * 1024 * 1024; // 20 Mo (même limite que le stockage en ligne)

export const extension = nom => (String(nom || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";

// Vérifie le fichier choisi : renvoie un message d'erreur simple, ou null si tout va bien.
export function verifierFichier(f) {
  if (!f) return "Aucun fichier choisi.";
  const ext = extension(f.name);
  if (!FORMATS.includes(ext) && !estImage(f)) return "Ce fichier n'est ni une photo ni une 3D. Formats acceptés : photo (JPG, PNG…), GLB, GLTF, OBJ, STL, FBX.";
  if (f.size > TAILLE_MAX) return "Fichier trop lourd (" + Math.round(f.size / 1048576) + " Mo). Maximum 20 Mo : exportez en GLB ou allégez le modèle.";
  if (!f.size) return "Le fichier est vide.";
  return null;
}

/* ---------- Lecture du fichier → objet 3D (chargeurs chargés seulement quand on en a besoin) ---------- */
export async function lireObjet(blob, ext, couleur = 0xd9c7a8) {
  const buf = await blob.arrayBuffer();
  const matDefaut = () => new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.65 });
  if (ext === "glb" || ext === "gltf") {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const g = await new Promise((ok, ko) => new GLTFLoader().parse(buf, "", ok, ko));
    return g.scene;
  }
  if (ext === "obj") {
    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    const o = new OBJLoader().parse(new TextDecoder().decode(buf));
    o.traverse(m => { if (m.isMesh) m.material = matDefaut(); });
    return o;
  }
  if (ext === "stl") {
    const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
    const geo = new STLLoader().parse(buf); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, matDefaut());
    m.rotation.x = -Math.PI / 2; // les STL sont presque toujours « Z vers le haut »
    const g = new THREE.Group(); g.add(m); return g;
  }
  if (ext === "fbx") {
    const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
    return new FBXLoader().parse(buf, "");
  }
  throw new Error("format_inconnu");
}

// Taille brute du modèle (dans ses propres unités) une fois tourné.
export function tailleBrute(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3());
  return [s.x, s.y, s.z];
}

// Devine l'unité du fichier pour proposer une largeur en cm : mm, cm ou m selon la plus grande dimension.
export function devinerLargeurCm(taille) {
  const m = Math.max(...taille);
  if (!(m > 0)) return 100;
  const k = m >= 300 ? 0.1 : m >= 3 ? 1 : 100; // → cm
  return Math.max(1, Math.round(taille[0] * k));
}

/* Prépare le modèle pour la scène MenuiPro (mètres) : tourné, mis à la largeur réelle, posé au sol, centré.
   reglage : { largeur (cm), quart: 0-3 (tour sur lui-même), couche: 0|1 (redresser un modèle couché) } */
export function placer(obj, reglage) {
  const g = new THREE.Group(), pivot = new THREE.Group();
  pivot.add(obj); g.add(pivot);
  pivot.rotation.set(reglage.couche ? -Math.PI / 2 : 0, (reglage.quart || 0) * Math.PI / 2, 0, "YXZ");
  const t = tailleBrute(g);
  const k = t[0] > 0 ? (reglage.largeur || 100) / 100 / t[0] : 1;
  pivot.scale.setScalar(k);
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3());
  pivot.position.set(-c.x, -b.min.y, -c.z);
  g.updateMatrixWorld(true);
  // « Ma 3D » : la 3D prend exactement les dimensions tapées par le menuisier (L × H × P en cm).
  if (reglage.dims) {
    const t0 = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    const [L, H, P] = reglage.dims.map(v => v / 100);
    if (t0.y > 0 && t0.z > 0) { g.scale.set(L / t0.x, H / t0.y, P / t0.z); g.updateMatrixWorld(true); }
  }
  const s = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  return { groupe: g, taille: [s.x, s.y, s.z] }; // taille en mètres
}

/* ---------- Lire les panneaux d'une 3D (pour la découpe) ----------
   1. Chaque morceau séparé de la 3D (objet, ou pièce non reliée) devient une boîte.
   2. Un morceau qui n'est pas une boîte mince (plusieurs panneaux collés dans le même objet, cas courant
      avec SketchUp) est découpé en panneaux : un panneau = deux grandes faces parallèles, face à face,
      à moins de 6 cm l'une de l'autre.
   Boîte mince (≤ 4 cm) = panneau ; étroite et épaisse = bois massif (pied, tasseau) ; le reste est ignoré.
   Le groupe doit sortir de placer() (mètres, posé au sol, centré). Tout est rendu en mm. */
const MAX_TRIANGLES = 400000;
export function classerBoite(t) {
  const tri = t.slice().sort((a, c) => a - c);
  if (tri[0] < 2.5 || tri[2] < 40) return null;                  // face seule, vis, poignée…
  if (tri[0] <= 8 && tri[1] >= 40) return "dos";
  if (tri[0] <= 40 && tri[1] >= 100) return "caisson";
  if (tri[0] <= 150 && tri[1] <= 150) return "massif";            // pied, tasseau, traverse
  return null;                                                    // bloc épais : coussin, électroménager…
}
// Panneaux cachés dans un morceau : on apparie les faces planes opposées (normale −axe / +axe).
export function panneauxParFaces(tris) {
  const plans = new Map(), cleP = p => p.map(v => Math.round(v * 10)).join(",");
  for (const [a, b, c] of tris) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n); if (!(l > 0)) continue;
    const ax = [0, 1, 2].reduce((m, k) => Math.abs(n[k]) > Math.abs(n[m]) ? k : m, 0);
    if (Math.abs(n[ax]) / l < 0.99) continue;                       // face penchée : pas un panneau droit
    const sg = n[ax] > 0 ? 1 : -1, off = Math.round(a[ax] * 2) / 2, k = ax + (sg > 0 ? "+" : "-") + off;
    if (!plans.has(k)) plans.set(k, { ax, sg, off, tris: [] });
    plans.get(k).tris.push([a, b, c]);
  }
  // Dans chaque plan, les triangles qui se touchent forment une face rectangulaire.
  const faces = [[], [], []];
  plans.forEach(pl => {
    const parent = pl.tris.map((_, i) => i), trouve = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const parPoint = new Map();
    pl.tris.forEach((t, i) => t.forEach(p => { const k = cleP(p); if (parPoint.has(k)) { const r1 = trouve(i), r2 = trouve(parPoint.get(k)); if (r1 !== r2) parent[r1] = r2; } else parPoint.set(k, i); }));
    const [u, w] = [0, 1, 2].filter(x => x !== pl.ax), rects = new Map();
    pl.tris.forEach((t, i) => {
      const r = trouve(i); let b = rects.get(r);
      if (!b) { b = [Infinity, Infinity, -Infinity, -Infinity]; rects.set(r, b); }
      t.forEach(p => { b[0] = Math.min(b[0], p[u]); b[1] = Math.min(b[1], p[w]); b[2] = Math.max(b[2], p[u]); b[3] = Math.max(b[3], p[w]); });
    });
    rects.forEach(b => faces[pl.ax].push({ sg: pl.sg, off: pl.off, u, w, b }));
  });
  const boites = [];
  faces.forEach((fs, ax) => {
    const moins = fs.filter(f => f.sg < 0), plus = fs.filter(f => f.sg > 0);
    for (const A of moins) for (const B of plus) {
      const e = B.off - A.off; if (e < 2.5 || e > 60) continue;
      const i0 = Math.max(A.b[0], B.b[0]), j0 = Math.max(A.b[1], B.b[1]), i1 = Math.min(A.b[2], B.b[2]), j1 = Math.min(A.b[3], B.b[3]);
      if (i1 - i0 < 30 || j1 - j0 < 30) continue;
      const aire = r => (r[2] - r[0]) * (r[3] - r[1]);
      if ((i1 - i0) * (j1 - j0) < 0.6 * Math.min(aire(A.b), aire(B.b))) continue;
      const box = [0, 0, 0, 0, 0, 0];
      box[ax] = A.off; box[3 + ax] = e; box[A.u] = i0; box[3 + A.u] = i1 - i0; box[A.w] = j0; box[3 + A.w] = j1 - j0;
      boites.push(box);
    }
  });
  return boites;
}
export function lirePanneaux(groupe) {
  groupe.updateMatrixWorld(true);
  const tout = new THREE.Box3().setFromObject(groupe), o = tout.min;
  const brutes = []; let triangles = 0, ignores = 0;
  const v = new THREE.Vector3(), mm = x => Math.round(x * 10000) / 10;
  groupe.traverse(m => {
    if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
    const pos = m.geometry.attributes.position, idx = m.geometry.index ? m.geometry.index.array : null;
    const nt = Math.floor((idx ? idx.length : pos.count) / 3);
    const nom = (m.name || (m.parent && m.parent.name) || "").replace(/[_\-]+/g, " ").replace(/\s*\d+$/, "").trim();
    triangles += nt;
    if (triangles > MAX_TRIANGLES) { const b = new THREE.Box3().setFromObject(m); brutes.push({ nom, box: [b.min.x, b.min.y, b.min.z].map((x, k) => mm(x - [o.x, o.y, o.z][k])).concat([b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map(mm)) }); return; }
    // Sommets en mm depuis le coin de la 3D, fusionnés par position, puis morceaux reliés.
    const P = new Array(pos.count), cle = new Map(), id = new Int32Array(pos.count), parent = [];
    const trouve = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const p = [mm(v.x - o.x), mm(v.y - o.y), mm(v.z - o.z)]; P[i] = p;
      const k = p.map(x => Math.round(x * 10)).join(",");
      let n = cle.get(k); if (n === undefined) { n = parent.length; parent.push(n); cle.set(k, n); }
      id[i] = n;
    }
    const tri = t => idx ? [idx[3 * t], idx[3 * t + 1], idx[3 * t + 2]] : [3 * t, 3 * t + 1, 3 * t + 2];
    for (let t = 0; t < nt; t++) { const [a, b, c] = tri(t); for (const x of [b, c]) { const r1 = trouve(id[a]), r2 = trouve(id[x]); if (r1 !== r2) parent[r2] = r1; } }
    const morceaux = new Map();
    for (let t = 0; t < nt; t++) {
      const [a, b, c] = tri(t), r = trouve(id[a]);
      if (!morceaux.has(r)) morceaux.set(r, []);
      morceaux.get(r).push([P[a], P[b], P[c]]);
    }
    morceaux.forEach(ts => {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      ts.forEach(t => t.forEach(p => { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } }));
      const box = mn.concat(mx.map((x, k) => Math.round((x - mn[k]) * 10) / 10));
      if (classerBoite(box.slice(3)) || ts.length < 12) brutes.push({ nom, box });
      else { const pn = panneauxParFaces(ts); if (pn.length) pn.forEach(b => brutes.push({ nom, box: b })); else ignores++; }
    });
  });
  const vus = new Set(), list = [];
  for (const { nom, box } of brutes) {
    const t = box.slice(3), m = classerBoite(t);
    if (!m) { ignores++; continue; }
    const cleB = box.map(x => Math.round(x / 2)).join(",");
    if (vus.has(cleB)) continue; vus.add(cleB);                    // même panneau en double
    const ep = Math.min(...t);
    list.push({ n: nom, b: box, t: t.indexOf(ep), m, ep: Math.round(ep) });
  }
  // Noms simples quand la 3D n'en donne pas : Côté, Étagère / plateau, Façade / fond, Pied.
  const auto = { 0: "Côté / séparation", 1: "Étagère / plateau", 2: "Façade / fond" }, compte = {};
  list.forEach(p => {
    const base = p.n && !/^(mesh|object|obj|group|geometry|component|composant|groupe|objet|defaultmaterial|material|node|scene)\b/i.test(p.n) ? p.n.slice(0, 40)
      : p.m === "massif" ? "Pied / tasseau" : p.m === "dos" ? "Fond / dos" : auto[p.t];
    compte[base] = (compte[base] || 0) + 1; p.n = base + " " + compte[base];
  });
  const s = tout.getSize(new THREE.Vector3());
  return { base: [mm(s.x), mm(s.y), mm(s.z)], list, ignores };
}

/* ---------- Photo ou image du meuble : réduite avant d'être gardée (1600 px, JPEG) ---------- */
export async function reduireImage(f, max = 1600) {
  let img;
  try { img = await createImageBitmap(f); }
  catch (e) { throw new Error("image_illisible"); }               // ex. HEIC sur un téléphone qui ne sait pas le lire
  const k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
  const blob = await new Promise(ok => cv.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("image_illisible");
  return { blob, l: w, h };
}

/* ---------- Gardé sur le téléphone (IndexedDB) : la 3D s'ouvre même sans Internet ---------- */
const BASE = "menuipro-fichiers", MAG = "modeles3d";
function ouvrir() {
  return new Promise((ok, ko) => {
    if (!globalThis.indexedDB) return ko(new Error("stockage_indisponible"));
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAG);
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
}
async function tx(mode, f) {
  const db = await ouvrir();
  return new Promise((ok, ko) => { const t = db.transaction(MAG, mode), r = f(t.objectStore(MAG)); t.oncomplete = () => ok(r && r.result); t.onerror = () => ko(t.error); });
}
export const garderLocal = (id, blob) => tx("readwrite", s => s.put(blob, id));
export const lireLocal = id => tx("readonly", s => s.get(id)).catch(() => null);
