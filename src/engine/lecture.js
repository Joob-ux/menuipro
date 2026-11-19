// MenuiPro — image lue par Gemini (fonction serveur « lire-image ») → « Mon dessin » + cotes.
// Aucun accès au DOM. La lecture n'est jamais crue sur parole : tout est borné et nettoyé.
import { normaliserCroquis, MAX_COLS, MAX_ZONES } from "./croquis.js";

const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };

/* r : { type, dimensions_mm: { largeur, hauteur, profondeur }, socle_mm, pieds_mm, dos,
         colonnes: [ { largeur_relative, cases: [ { hauteur_relative, type, nombre, portes } ] (bas → haut) } ],
         confiance, remarque }
   Renvoie { ok, croquis, dims: { L, H, P } en cm (null si la cote n'est pas écrite sur l'image), nom, remarque, confiance } */
export function depuisLecture(r) {
  const cols = Array.isArray(r && r.colonnes) ? r.colonnes.slice(0, MAX_COLS) : [];
  if (!cols.length) return { ok: false, remarque: String((r && r.remarque) || "Je ne reconnais pas de meuble sur cette image.") };
  const socle = num(r.socle_mm), pieds = num(r.pieds_mm);
  const croquis = normaliserCroquis({
    socle: pieds >= 30 ? 0 : socle >= 40 ? socle : socle > 0 ? 1 : 0,
    pieds: pieds >= 30 ? pieds : 0,
    dos: r.dos === false ? 0 : 1,
    cols: cols.map(c => ({
      f: Math.max(0.05, num(c && c.largeur_relative, 1)),
      zones: (Array.isArray(c && c.cases) && c.cases.length ? c.cases : [{ type: "vide" }]).slice(0, MAX_ZONES).map(z => ({
        f: Math.max(0.05, num(z && z.hauteur_relative, 1)),
        t: z && z.type, n: num(z && z.nombre, z && z.type === "tiroirs" ? 1 : 0), portes: num(z && z.portes)
      }))
    }))
  });
  const d = r.dimensions_mm || {}, cm = (v, a, b) => { v = num(v, NaN); return v > 0 ? Math.max(a, Math.min(b, Math.round(v) / 10)) : null; }; // cm, au mm près
  return {
    ok: true, croquis,
    dims: { L: cm(d.largeur, 30, 600), H: cm(d.hauteur, 30, 300), P: cm(d.profondeur, 20, 120) },
    nom: String(r.type || "Meuble").slice(0, 40), remarque: String(r.remarque || "").slice(0, 300),
    confiance: Math.max(0, Math.min(1, num(r.confiance, 0.5)))
  };
}
