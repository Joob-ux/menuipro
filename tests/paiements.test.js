import { describe, it, expect } from "vitest";
import { acompteDu, resume, validerPaiement, prochainNumero, modeNom } from "../src/paiements.js";

describe("Acompte", () => {
  it("50 % de 126 500 F = 63 500 F (arrondi aux 500 F supérieurs)", () => expect(acompteDu(126500, 50)).toBe(63500));
  it("ne dépasse jamais le prix, et vaut 0 sans prix ou sans pourcentage", () => {
    expect(acompteDu(1200, 100)).toBe(1200);
    expect(acompteDu(0, 50)).toBe(0);
    expect(acompteDu(50000, 0)).toBe(0);
    expect(acompteDu(50000, 150)).toBe(50000);
  });
});

describe("Payé / reste à payer", () => {
  it("acompte puis solde : tout est payé", () => {
    const pays = [{ montant: 63500 }];
    expect(resume(126500, pays)).toMatchObject({ paye: 63500, reste: 63000, solde: false, pct: 50 });
    pays.push({ montant: 63000 });
    expect(resume(126500, pays)).toMatchObject({ paye: 126500, reste: 0, solde: true, pct: 100 });
  });
  it("un trop-payé est signalé sans reste négatif", () => expect(resume(10000, [{ montant: 12000 }])).toMatchObject({ reste: 0, trop: 2000, solde: true }));
  it("sans prix, rien n'est « payé »", () => expect(resume(0, []).solde).toBe(false));
});

describe("Saisie d'un paiement", () => {
  it("accepte « 50 000 » en espèces", () => expect(validerPaiement("50 000", "especes")).toEqual({ ok: true, montant: 50000, mode: "especes" }));
  it("refuse un montant vide, nul ou négatif", () => {
    for (const v of ["", "0", "-500", "abc"]) expect(validerPaiement(v, "wave").ok).toBe(false);
  });
  it("refuse un moyen de paiement inconnu", () => expect(validerPaiement("1000", "bitcoin").ok).toBe(false));
  it("connaît Wave et Orange Money", () => { expect(modeNom("wave")).toBe("Wave"); expect(modeNom("om")).toBe("Orange Money"); });
});

describe("Numéros de documents", () => {
  it("se suivent par type et repartent à 1 chaque année", () => {
    const d26 = new Date(2026, 10, 13), d27 = new Date(2027, 0, 2);
    let n = prochainNumero(undefined, "facture", d26);
    expect(n.num).toBe("FAC-2026-0001");
    n = prochainNumero(n.compteurs, "facture", d26);
    expect(n.num).toBe("FAC-2026-0002");
    const r = prochainNumero(n.compteurs, "recu", d26);
    expect(r.num).toBe("REC-2026-0001");
    expect(prochainNumero(r.compteurs, "facture", d27).num).toBe("FAC-2027-0001");
  });
  it("ne modifie pas les compteurs reçus", () => {
    const c = { annee: 2026, facture: 4 };
    prochainNumero(c, "facture", new Date(2026, 5, 1));
    expect(c.facture).toBe(4);
  });
});
