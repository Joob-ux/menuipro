import { describe, it, expect } from "vitest";
import { reponseInitiale, totalReponse, montantRemise, remiseLignes, validerReponse, dateLisible, texteReponse, changements, cleSuivi } from "../src/commandes.js";

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

describe("Prix du catalogue et remise de la quincaillerie", () => {
  const cmd = { meuble: "Commode", lignes: [{ article: "Mélaminé 18 mm blanc", detail: "2 feuilles", qte: 2, pu: 22000, total: 44000 }, { article: "Coulisses 40 cm", detail: "4 paires", total: 10000 }] };
  it("la quincaillerie reçoit la commande à ses prix du catalogue, sans remise", () => {
    const r = reponseInitiale(cmd.lignes);
    expect(r.lignes.map(l => l.prix)).toEqual([44000, 10000]);
    expect(totalReponse(r)).toBe(54000);
    expect(montantRemise(r)).toBe(0);
  });
  it("baisser le prix d'un article est compté comme une remise", () => {
    const r = reponseInitiale(cmd.lignes); r.lignes[0].prix = "42 000";
    expect(remiseLignes(cmd.lignes, r)).toBe(2000);
    expect(totalReponse(r)).toBe(52000);
  });
  it("remise sur le total en pourcentage ou en francs", () => {
    const r = reponseInitiale(cmd.lignes);
    r.remise = { type: "pct", valeur: "10" };
    expect(totalReponse(r)).toBe(48600);
    r.remise = { type: "f", valeur: "4 000" };
    expect(totalReponse(r)).toBe(50000);
  });
  it("valide la remise et la garde à la réouverture", () => {
    const r = reponseInitiale(cmd.lignes); r.lignes[0].prix = 42000; r.remise = { type: "pct", valeur: 10 };
    const v = validerReponse(r, 2);
    expect(v.ok).toBe(true);
    expect(v.reponse.sous_total).toBe(52000);
    expect(v.reponse.remise).toEqual({ type: "pct", pct: 10, montant: 5200 });
    expect(v.reponse.total).toBe(46800);
    expect(reponseInitiale(cmd.lignes, v.reponse).remise).toEqual({ type: "pct", valeur: 10 });
    const f = validerReponse({ ...reponseInitiale(cmd.lignes), remise: { type: "f", valeur: 3000 } }, 2).reponse;
    expect(reponseInitiale(cmd.lignes, f).remise).toEqual({ type: "f", valeur: 3000 });
    expect(totalReponse(f)).toBe(51000);
  });
  it("refuse une remise impossible", () => {
    const r = reponseInitiale(cmd.lignes);
    expect(validerReponse({ ...r, remise: { type: "f", valeur: 60000 } }, 2).erreur).toBe("La remise est plus grande que le total.");
    expect(validerReponse({ ...r, remise: { type: "pct", valeur: 120 } }, 2).ok).toBe(false);
    expect(validerReponse({ ...r, remise: { type: "f", valeur: -5 } }, 2).ok).toBe(false);
  });
  it("le message WhatsApp montre la remise et l'économie", () => {
    const r = reponseInitiale(cmd.lignes); r.lignes[0].prix = 42000; r.remise = { type: "f", valeur: 2000 };
    const t = texteReponse(cmd, validerReponse(r, 2).reponse);
    expect(t).toMatch(/Mélaminé 18 mm blanc : 42\s000 F \(au lieu de 44\s000 F\)/);
    expect(t).toContain("Remise : −2");
    expect(t).toContain("Total : 50");
    expect(t).toContain("Vous économisez 4");
  });
});

import { changerQuantite, prixCatalogue } from "../src/commandes.js";
describe("Modifications de la quincaillerie à la demande du client", () => {
  const cmd = { meuble: "Armoire", lignes: [{ article: "Mélaminé 18 mm", detail: "4 feuilles", qte: 4, pu: 22000, total: 88000 }, { article: "Charnières", detail: "6 pièces", total: 3000 }] };
  it("changer la quantité garde le prix à l'unité ; ce n'est pas une remise", () => {
    const r = reponseInitiale(cmd.lignes);
    expect(r.lignes[0].qte).toBe(4);
    changerQuantite(r.lignes[0], 5);
    expect(r.lignes[0].prix).toBe(110000);
    expect(remiseLignes(cmd.lignes, r)).toBe(0);
    expect(prixCatalogue(cmd.lignes[0], r.lignes[0])).toBe(110000);
    expect(totalReponse(r)).toBe(113000);
  });
  it("articles ajoutés : comptés dans le total, gardés à la validation et à la réouverture", () => {
    const r = reponseInitiale(cmd.lignes);
    r.ajouts.push({ article: "Poignée dorée", qte: 6, unite: "pièce", prix: "9000", pu: 1500 });
    expect(totalReponse(r)).toBe(100000);
    const v = validerReponse(r, 2);
    expect(v.ok).toBe(true);
    expect(v.reponse.ajouts).toEqual([{ article: "Poignée dorée", qte: 6, unite: "pièce", prix: 9000 }]);
    expect(v.reponse.total).toBe(100000);
    expect(reponseInitiale(cmd.lignes, v.reponse).ajouts.length).toBe(1);
  });
  it("refuse un article ajouté sans nom ou sans prix, ou une quantité impossible", () => {
    const r = reponseInitiale(cmd.lignes);
    expect(validerReponse({ ...r, ajouts: [{ article: "", qte: 1, prix: 100 }] }, 2).ok).toBe(false);
    expect(validerReponse({ ...r, ajouts: [{ article: "Vis", qte: 1, prix: "" }] }, 2).ok).toBe(false);
    r.lignes[0].qte = 0;
    expect(validerReponse(r, 2).erreur).toBe("Quantité invalide.");
  });
  it("le message WhatsApp montre la quantité changée et les articles ajoutés", () => {
    const r = reponseInitiale(cmd.lignes); changerQuantite(r.lignes[0], 5);
    r.ajouts.push({ article: "Poignée dorée", qte: 6, prix: 9000 });
    const t = texteReponse(cmd, validerReponse(r, 2).reponse);
    expect(t).toContain("quantité 4 → 5");
    expect(t).toContain("➕ Poignée dorée × 6");
    expect(t).not.toContain("au lieu de");
  });
});
