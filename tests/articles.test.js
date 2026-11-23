import { describe, it, expect } from "vitest";
import { ARTICLES, articleLie, prixAccessoire, nouvelArticle, lier, accessoiresSansPrix, normaliserArticles } from "../src/articles.js";

const cat = () => ({ articles: [], prix: {} });

describe("Accessoires : prix fixés uniquement par la quincaillerie", () => {
  it("aucun prix fourni par l'appli", () => {
    const c = cat();
    expect(prixAccessoire(c, "charn")).toBe(0);
    expect(accessoiresSansPrix(c).length).toBe(ARTICLES.length);
    expect(ARTICLES.every(a => typeof a[0] === "string" && a.length <= 5)).toBe(true);
  });

  it("un article lié donne nom et prix à la ligne calculée", () => {
    const c = cat();
    const a = { ...nouvelArticle("charn"), nom: "Charnière Blum 110°", prix: 900 };
    c.articles.push(a);
    expect(articleLie(c, "charn").nom).toBe("Charnière Blum 110°");
    expect(prixAccessoire(c, "charn")).toBe(900);
    expect(accessoiresSansPrix(c).some(([k]) => k === "charn")).toBe(false);
  });

  it("nouvel article pré-rempli : prix vide, unité du calcul", () => {
    const a = nouvelArticle("vis440");
    expect(a).toMatchObject({ id: "std-vis440", calc: "vis440", unite: "boîte de 100", prix: 0 });
    expect(nouvelArticle().calc).toBeUndefined();
  });

  it("un seul article lié par accessoire ; l'unité suit le calcul", () => {
    const c = cat();
    const a = { id: "a", nom: "Poignée A", unite: "lot", prix: 500 }, b = { id: "b", nom: "Poignée B", unite: "pièce", prix: 700 };
    c.articles.push(a, b);
    lier(c, a, "poignees"); expect(a.unite).toBe("pièce");
    lier(c, b, "poignees");
    expect(a.calc).toBeUndefined();
    expect(prixAccessoire(c, "poignees")).toBe(700);
    lier(c, b, ""); expect(prixAccessoire(c, "poignees")).toBe(0);
  });

  it("article sans nom ignoré", () => {
    const c = cat(); c.articles.push({ id: "x", nom: "", calc: "charn", prix: 800 });
    expect(prixAccessoire(c, "charn")).toBe(0);
  });

  it("ancien catalogue : les prix saisis deviennent des articles de la quincaillerie", () => {
    const c = { panneaux: [], prix: { charn: 750, vis440: 1500, colle: 0 } };
    expect(normaliserArticles(c)).toBe(true);
    expect(c.prix).toEqual({});
    expect(c.articles.map(a => a.id).sort()).toEqual(["std-charn", "std-vis440"]);
    expect(prixAccessoire(c, "vis440")).toBe(1500);
    // Idempotent
    expect(normaliserArticles(c)).toBe(false);
    expect(c.articles.length).toBe(2);
  });

  it("migration : un article déjà lié par la quincaillerie garde son prix", () => {
    const c = { prix: { charn: 750 }, articles: [{ id: "q1", nom: "Charnière X", calc: "charn", prix: 1000 }] };
    normaliserArticles(c);
    expect(c.articles.length).toBe(1);
    expect(prixAccessoire(c, "charn")).toBe(1000);
  });
});
