// MenuiPro — 3D importée par le menuisier (fichier fait sur SketchUp, Blender, 3ds Max…).
// La 3D importée sert à montrer le meuble au client ; la découpe et le prix viennent toujours du meuble MenuiPro.
import * as THREE from "three";

export const FORMATS = ["glb", "gltf", "obj", "stl", "fbx"];
export const ACCEPT = FORMATS.map(f => "." + f).join(",");
export const TAILLE_MAX = 20 * 1024 * 1024; // 20 Mo (même limite que le stockage en ligne)

export const extension = nom => (String(nom || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";

// Vérifie le fichier choisi : renvoie un message d'erreur simple, ou null si tout va bien.
export function verifierFichier(f) {
  if (!f) return "Aucun fichier choisi.";
  const ext = extension(f.name);
  if (!FORMATS.includes(ext)) return "Ce fichier n'est pas une 3D lisible. Formats acceptés : GLB, GLTF, OBJ, STL, FBX.";
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
  const s = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  return { groupe: g, taille: [s.x, s.y, s.z] }; // taille en mètres
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
