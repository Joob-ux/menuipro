import { describe, it, expect } from "vitest";
import { reponseInitiale, totalReponse, validerReponse, dateLisible, texteReponse, changements, cleSuivi } from "../src/commandes.js";

const commande = { meuble: "Commode 100 × 85 × 45 cm", lignes: [{ article: "Mélaminé 18 mm blanc", detail: "2 feuilles", total: 44000 }, { article: "Coulisses 40 cm", detail: "4 paires", total: 10000 }, { article: "Poignées", detail: "4 pièces", total: null }] };

describe("Réponse de la quincaillerie", () => {
  it("part des prix estimés, tout disponible, en retrait", () => {
    const r = reponseInitiale(commande.lignes);
    expect(r.lignes.map(l => [l.dispo, l.prix])).toEqual([["oui", 44000], ["oui", 10000], ["oui", null]]);
    expect(r.mode).toBe("retrait");
  });
  it("reprend une réponse déjà envoyée", () => {
    const r = reponseInitiale(commande.lignes, { lignes: [{ i: 1, dispo: "non", prix: null }], mode: "livraison", date: "2026-11-15" });
    expect(r.lignes[1].dispo).toBe("non"); expect(r.mode).toBe("livraison"); expect(r.date).toBe("2026-11-15");
  });
  it("le total ne compte pas les articles indisponibles", () => {
    expect(totalReponse({ lignes: [{ dispo: "oui", prix: 46000 }, { dispo: "non", prix: 10000 }, { dispo: "remplace", prix: "2 000" }] })).toBe(48000);
  });
  it("refuse une réponse incomplète, avec un message clair", () => {
    const r = reponseInitiale(commande.lignes);
    expect(validerReponse(r, 3).erreur).toBe("Entrez le prix de chaque article disponible.");
    r.lignes[2].prix = 2000; r.lignes[0].dispo = "remplace";
    expect(validerReponse(r, 3).erreur).toBe("Écrivez par quoi l'article est remplacé.");
    expect(validerReponse(r, 2).ok).toBe(false);
  });
  it("accepte une réponse complète et calcule le total", () => {
    const r = reponseInitiale(commande.lignes);
    r.lignes[0] = { i: 0, dispo: "remplace", prix: 46000, remplacement: "  Mélaminé 18 mm chêne " };
    r.lignes[1].dispo = "non"; r.lignes[2].prix = "2000"; r.date = "2026-11-15"; r.message = "Le blanc est fini.";
    const v = validerReponse(r, 3);
    expect(v.ok).toBe(true);
    expect(v.reponse.total).toBe(48000);
    expect(v.reponse.lignes[0].remplacement).toBe("Mélaminé 18 mm chêne");
    expect(v.reponse.lignes[1].prix).toBe(null);
  });
  it("refuse un mode ou une date invalides", () => {
    const r = reponseInitiale(commande.lignes); r.lignes[2].prix = 0;
    expect(validerReponse({ ...r, mode: "poste" }, 3).ok).toBe(false);
    expect(validerReponse({ ...r, date: "15/11" }, 3).ok).toBe(false);
  });
});

describe("Message au menuisier", () => {
  const maintenant = new Date(2026, 10, 14);
  it("dates lisibles", () => {
    expect(dateLisible("2026-11-14", maintenant)).toBe("aujourd'hui");
    expect(dateLisible("2026-11-15", maintenant)).toBe("demain");
    expect(dateLisible("2026-11-16", maintenant)).toBe("après-demain");
  });
  it("résume la réponse ligne par ligne", () => {
    const r = reponseInitiale(commande.lignes);
    r.lignes[0] = { i: 0, dispo: "remplace", prix: 46000, remplacement: "Mélaminé 18 mm chêne" }; r.lignes[1].dispo = "non"; r.lignes[2].prix = 2000; r.date = "2026-11-15";
    const t = texteReponse(commande, validerReponse(r, 3).reponse, "Quincaillerie Test", maintenant);
    expect(t).toContain("🔁 Mélaminé 18 mm blanc → Mélaminé 18 mm chêne : 46");
    expect(t).toContain("❌ Coulisses 40 cm : pas disponible");
    expect(t).toContain("Total : 48");
    expect(t).toContain("Retrait à la boutique demain");
    expect(t).toContain("— Quincaillerie Test");
  });
});

describe("Prévenir le menuisier", () => {
  const rows = [{ id: "a", statut: "envoyee" }, { id: "b", statut: "confirmee", repondu_le: "t1" }];
  it("la première fois, pas d'alerte (on mémorise seulement)", () => expect(changements(rows, {})).toEqual([]));
  it("alerte quand la quincaillerie a répondu ou changé le statut", () => {
    const vu = { a: "envoyee|", b: cleSuivi(rows[1]) };
    expect(changements(rows, vu)).toEqual([]);
    const apres = [{ id: "a", statut: "confirmee", repondu_le: "t2" }, rows[1]];
    expect(changements(apres, vu).map(c => c.id)).toEqual(["a"]);
  });
  it("une commande inconnue déjà traitée donne une alerte, une simple envoi non", () => {
    expect(changements([{ id: "c", statut: "prete" }, { id: "d", statut: "envoyee" }], { a: "x" }).map(c => c.id)).toEqual(["c"]);
  });
});
