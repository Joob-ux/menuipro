// MenuiPro — agencements vus chez les menuisiers (salons, chambres, dressings, bureaux, boutiques).
/* Modèles relevés sur des réalisations d'atelier (photos du 22/11/2026). Pas de mesures fournies :
   les cotes par défaut sont des cotes courantes du métier, modifiables à l'étape « Régler ».
   Tout est en panneaux (mélaminé 18 mm, dos 5 mm) ; un panneau trop grand pour une feuille
   (2420 × 1200 utiles) est fait en plusieurs morceaux. */
import { add, add3d, hw, caisse, plateau, panneauV, lit } from "./blocs.js";
import { RECIPES, rec, stp, chx } from "./recettes.js";
import { teteDeLit, fournitures, TETE, CHX_TISSU, CHX_VUE } from "./rembourre.js";

const FEUILLE_L = 2420, FEUILLE_W = 1200;

// Grand panneau (mur, fond) coupé en morceaux qui tiennent dans une feuille.
function panneauMural(c, nom, mat, x0, y0, z0, W, H, T, o = {}) {
  const fits = (a, b) => Math.max(a, b) <= FEUILLE_L && Math.min(a, b) <= FEUILLE_W;
  let best = null;
  for (let j = 1; j <= 4; j++) for (let k = 1; k <= 10; k++) if (fits(W / k, H / j) && (!best || k * j < best[0] * best[1])) best = [k, j];
  const [k, j] = best || [Math.ceil(W / 1180), Math.ceil(H / 2400)], n = k * j;
  for (let a = 0; a < j; a++) for (let b = 0; b < k; b++)
    add(c, nom + (n > 1 ? " " + (a * k + b + 1) + "/" + n : ""), mat, [x0 + b * W / k, y0 + a * H / j, z0, W / k, H / j, T], { edge: o.edge ? o.edge / n : 0, look: o.look });
  return n;
}

// Tasseaux verticaux en bandes de panneau, de x0 à x1, sur un fond noir facultatif.
function tasseaux(c, nom, x0, x1, y0, H, z0, o = {}) {
  const w = o.larg || 40, e = o.ecart || 15, T = c.E, W = x1 - x0;
  if (W < w) return 0;
  const n = Math.max(1, Math.floor((W + e) / (w + e))), dx = (W - (n * w + (n - 1) * e)) / 2;
  const morceaux = H > FEUILLE_L ? 2 : 1;
  for (let i = 0; i < n; i++) for (let m = 0; m < morceaux; m++)
    add(c, nom + " · Tasseau " + (i + 1) + (morceaux > 1 ? (m ? " (haut)" : " (bas)") : ""), "caisson", [x0 + dx + i * (w + e), y0 + m * H / morceaux, z0, w, H / morceaux, T], { edge: 2 * H / morceaux });
  hw(c, "mastic", "🧴", "Colle mastic de fixation", Math.max(1, Math.ceil(n * H / 1000 / 10)), "cartouche(s)");
  hw(c, "pointes", "🔨", "Pointes sans tête", n * Math.ceil(H / 400) * 2);
  return n;
}

// Meuble bas suspendu (fixé au mur), coupé en modules qui tiennent dans une feuille.
function basSuspendu(c, nom, x0, y0, W, H, D, o = {}) {
  const nm = Math.max(1, Math.ceil(W / (o.maxModule || 2000))), wm = W / nm;
  for (let i = 0; i < nm; i++) {
    const nc = Math.max(1, Math.round(wm / (o.pas || 600))), cols = [];
    for (let k = 0; k < nc; k++) cols.push(o.ouvert && nm * nc > 2 && i === Math.floor(nm / 2) && k === Math.floor(nc / 2) ? [{ t: "niche" }] : [{ t: "tiroirs", n: 1 }]);
    caisse(c, x0 + i * wm, y0, 0, wm, H, D, { nom: nom + (nm > 1 ? " " + (i + 1) : ""), socle: 0, colonnes: cols });
  }
  hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4 * nm);
  if (o.led) { add3d(c, "led", [x0, y0 - 12, D - 60, W, 10, 10]); hw(c, "led", "💡", "Ruban LED + alimentation", Math.ceil(W / 1000), "m"); }
}

const POIGNEE = chx("poignee", "Ouverture", [["poignee", "🚪 Poignées"], ["push", "👆 Sans poignée (push)"]], "poignee");
// Ouverture sans poignée : les poignées comptées sont remplacées par des systèmes « push ».
function ouverture(c, o) {
  if (o.poignee !== "push" || !c.hw.poignees) return;
  const n = c.hw.poignees.qty; delete c.hw.poignees;
  hw(c, "push", "👆", "Systèmes d'ouverture push (sans poignée)", n);
}

/* ----- Salon ----- */
rec({ id: "mur-tv-laque", nom: "Mur TV laqué + meuble bas suspendu", e: "🖼️", cat: "Salon", dims: [360, 260, 40], dimMin: [150, 120, 30],
  opts: [stp("hBas", "Hauteur du meuble bas (cm)", "📏", 30, 20, 50, 5), stp("panneaux", "Panneaux laqués au mur", "▯", 5, 0, 8), stp("niche", "Colonne lumineuse à droite", "💡", 1, 0, 1), stp("led", "LED sous le meuble", "💡", 1, 0, 1), POIGNEE],
  build(c, p, o) {
    const E = c.E, Hb = o.hBas * 10, yb = 300, NW = o.niche ? 250 : 0, Wb = p.L - NW;
    // Panneaux laqués verticaux, séparés par un profilé noir (comme sur la photo).
    if (o.panneaux) {
      const wp = Wb / o.panneaux;
      for (let i = 0; i < o.panneaux; i++) panneauMural(c, "Panneau mural " + (i + 1), "caisson", i * wp, 0, -E, wp - 4, p.H, E, { edge: 2 * p.H });
      if (o.panneaux > 1) hw(c, "profile", "➖", "Profilé alu noir entre panneaux", Math.ceil((o.panneaux - 1) * p.H / 1000), "m");
      hw(c, "mastic", "🧴", "Colle mastic de fixation", Math.ceil(o.panneaux * p.H / 2400), "cartouche(s)");
    }
    basSuspendu(c, "Meuble bas", 0, yb, Wb, Hb, p.P, { led: o.led });
    if (o.niche) {
      caisse(c, Wb, 0, 0, NW, Math.min(p.H, 2400), 300, { nom: "Colonne lumineuse", socle: 0, colonnes: [[{ t: "etageres", n: 6 }]] });
      add3d(c, "led", [Wb + E, 0, 280, 10, Math.min(p.H, 2400), 10]);
      hw(c, "led", "💡", "Ruban LED + alimentation", Math.ceil(Math.min(p.H, 2400) / 1000), "m");
    }
    ouverture(c, o);
  } });

rec({ id: "mur-tv-bibliotheque", nom: "Mur TV + bibliothèque haute", e: "📚", cat: "Salon", dims: [320, 240, 40], dimMin: [200, 150, 30],
  opts: [stp("largeurBiblio", "Largeur de la bibliothèque (cm)", "↔️", 90, 50, 150, 5), stp("etageres", "Étagères de la bibliothèque", "📚", 5, 2, 8), stp("tiroirs", "Tiroirs du meuble bas", "🗄️", 5, 2, 8), stp("tasseaux", "Mur en tasseaux à gauche", "🎋", 1, 0, 1), stp("panneau", "Panneau décor derrière la TV", "▭", 1, 0, 1), POIGNEE],
  build(c, p, o) {
    const E = c.E, BW = Math.min(o.largeurBiblio * 10, p.L - 600), Hb = 300, yb = 200, Hbib = Math.min(p.H, 2400) - yb - Hb;
    // Meuble bas suspendu sur toute la largeur, bibliothèque posée dessus à droite.
    const nm = Math.ceil(p.L / 2000), wm = p.L / nm, parMod = Math.max(1, Math.round(o.tiroirs / nm));
    for (let i = 0; i < nm; i++) caisse(c, i * wm, yb, 0, wm, Hb, p.P, { nom: "Meuble bas" + (nm > 1 ? " " + (i + 1) : ""), socle: 0, colonnes: Array.from({ length: parMod }, () => [{ t: "tiroirs", n: 1 }]) });
    const nc = BW > 1000 ? 3 : 2;
    caisse(c, p.L - BW, yb + Hb, 0, BW, Hbib, Math.min(p.P, 320), { nom: "Bibliothèque", socle: 0, colonnes: Array.from({ length: nc }, () => [{ t: "etageres", n: o.etageres }]) });
    const zMur = -E;
    if (o.tasseaux) { panneauMural(c, "Fond noir des tasseaux", "dos", 0, 0, zMur - 5, 600, p.H, 5, { look: "noir" }); tasseaux(c, "Mur en tasseaux", 0, 600, 0, p.H, zMur); }
    if (o.panneau) {
      const x0 = o.tasseaux ? 600 : 0;
      panneauMural(c, "Panneau décor TV", "caisson", x0, yb + Hb, zMur, p.L - BW - x0, Math.min(1200, Hbib), E, { edge: 0 });
    }
    hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4 * nm + 4);
    ouverture(c, o);
  } });

rec({ id: "mur-tv-colonnes", nom: "Mur TV en tasseaux + 2 colonnes", e: "🎋", cat: "Salon", dims: [360, 240, 40], dimMin: [220, 180, 30],
  opts: [stp("largeurColonne", "Largeur d'une colonne (cm)", "↔️", 50, 30, 80, 5), stp("etageres", "Étagères des colonnes", "📚", 4, 2, 7), stp("portesBas", "Porte en bas des colonnes", "🚪", 1, 0, 1), stp("tiroirs", "Tiroirs du meuble bas", "🗄️", 3, 1, 6), stp("led", "LED dans les colonnes", "💡", 1, 0, 1)],
  build(c, p, o) {
    const E = c.E, CW = o.largeurColonne * 10, H = Math.min(p.H, 2400), Lm = p.L - 2 * CW, Dc = Math.min(p.P, 350);
    [0, p.L - CW].forEach((x, i) => {
      const zones = o.portesBas ? [{ t: "etageres", n: 1, h: 700, portes: { n: 1 } }, { t: "etageres", n: o.etageres - 1 }] : [{ t: "etageres", n: o.etageres }];
      caisse(c, x, 0, 0, CW, H, Dc, { nom: "Colonne " + (i ? "droite" : "gauche"), socle: 60, colonnes: [zones] });
      if (o.led) add3d(c, "led", [x + E, 60, Dc - 30, 10, H - 80, 10]);
    });
    if (o.led) hw(c, "led", "💡", "Ruban LED + alimentation", Math.ceil(2 * H / 1000), "m");
    // Fond en tasseaux entre les colonnes, panneau bois derrière la TV, meuble bas suspendu.
    panneauMural(c, "Fond noir des tasseaux", "dos", CW, 0, -E - 5, Lm, H, 5, { look: "noir" });
    tasseaux(c, "Mur en tasseaux", CW, p.L - CW, 0, H, -E);
    const wTv = Math.min(1800, Lm - 300);
    panneauMural(c, "Panneau bois derrière la TV", "caisson", CW + (Lm - wTv) / 2, 850, 0, wTv, Math.min(1100, H - 1000), E, { edge: 2 * wTv });
    const nm = Math.ceil(Lm / 2000), wm = (Lm - 100) / nm, parMod = Math.max(1, Math.round(o.tiroirs / nm));
    for (let i = 0; i < nm; i++) caisse(c, CW + 50 + i * wm, 300, E, wm, 300, p.P - E, { nom: "Meuble bas" + (nm > 1 ? " " + (i + 1) : ""), socle: 0, colonnes: Array.from({ length: parMod }, () => [{ t: "tiroirs", n: 1 }]) });
    hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 8 + 4 * nm);
  } });

/* ----- Chambre ----- */
rec({ id: "commode-armoire", nom: "Commode + petite armoire", e: "🗄️", cat: "Chambre", cache: true, dims: [100, 110, 45], dimMin: [70, 70, 30],
  opts: [stp("tiroirs", "Tiroirs", "🗄️", 3, 2, 5), stp("etageres", "Étagères de l'armoire", "📚", 3, 1, 5), stp("portes", "Portes de l'armoire", "🚪", 2, 1, 2)],
  build(c, p, o) {
    // Bloc à tiroirs à gauche (plus bas), armoire à droite sur toute la hauteur, socle commun.
    const wT = Math.round(p.L * 0.45), hT = Math.round(p.H * 0.62);
    caisse(c, 0, 0, 0, wT, hT, p.P, { nom: "Bloc tiroirs", socle: 80, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
    caisse(c, wT, 0, 0, p.L - wT, p.H, p.P, { nom: "Armoire", socle: 80, colonnes: [[{ t: "etageres", n: o.etageres, portes: { n: o.portes } }]] });
  } });

rec({ id: "dressing-vitrine", nom: "Dressing avec colonne vitrine LED", e: "✨", cat: "Chambre", cache: true, dims: [240, 240, 58], dimMin: [180, 200, 45],
  opts: [stp("tiroirs", "Tiroirs (colonne de droite)", "🗄️", 3, 0, 4), stp("etageres", "Étagères lumineuses", "📚", 6, 3, 8), stp("porteGauche", "Colonne penderie à gauche", "👔", 1, 0, 1), stp("led", "Ruban LED", "💡", 1, 0, 1)],
  build(c, p, o) {
    const H = Math.min(p.H, 2400), Hh = 450;
    const gauche = [{ t: "penderie", n: 1, portes: { n: 1 } }];
    const vitrine = [{ t: "etageres", n: o.etageres }, { t: "etageres", n: 1, h: Hh }];
    const droite = [...(o.tiroirs ? [{ t: "tiroirs", n: o.tiroirs, h: o.tiroirs * 150 }] : []), { t: "penderie", n: 1, portes: { n: 2 } }, { t: "etageres", n: 0, h: Hh, portes: { n: 2 } }];
    const cols = o.porteGauche ? [gauche, vitrine, droite] : [vitrine, droite], larg = o.porteGauche ? [45, 60, 95] : [60, 95];
    caisse(c, 0, 0, 0, p.L, H, p.P, { socle: 80, colonnes: cols, largeurs: larg });
    if (o.led) {
      const E = c.E, libre = p.L - 2 * E - (cols.length - 1) * E, wv = libre * larg[o.porteGauche ? 1 : 0] / larg.reduce((a, b) => a + b, 0);
      const xv = E + (o.porteGauche ? libre * 45 / 200 + E : 0);
      [xv + 5, xv + wv - 15].forEach(x => add3d(c, "led", [x, 80 + E, p.P - 40, 10, H - Hh - 120, 10]));
      hw(c, "led", "💡", "Ruban LED + alimentation (vitrine)", Math.ceil(2 * (H - Hh) / 1000 + o.etageres * wv / 1000), "m");
    }
  } });

rec({ id: "armoire-colonne-ouverte", nom: "Armoire + colonne d'étagères ouvertes", e: "👟", cat: "Chambre", cache: true, dims: [200, 240, 58], dimMin: [140, 180, 40],
  opts: [stp("tiroirs", "Tiroirs sous l'armoire", "🗄️", 2, 0, 3), stp("etageresColonne", "Étagères de la colonne ouverte", "📚", 9, 4, 12), stp("niche", "Niche ouverte sous la petite armoire", "⬜", 1, 0, 1)],
  build(c, p, o) {
    const H = Math.min(p.H, 2400);
    const grande = [...(o.tiroirs ? [{ t: "tiroirs", n: o.tiroirs, h: o.tiroirs * 200 }] : []), { t: "penderie", n: 1, portes: { n: 2 } }];
    const colonne = [{ t: "etageres", n: o.etageresColonne }];
    const petite = [...(o.niche ? [{ t: "etageres", n: 1, h: 500 }] : []), { t: "etageres", n: 3, portes: { n: 2 } }];
    caisse(c, 0, 0, 0, p.L, H, p.P, { socle: 80, colonnes: [grande, colonne, petite], largeurs: [90, 30, 60] });
  } });

rec({ id: "tete-lit-tasseaux", nom: "Tête de lit murale en tasseaux + chevets suspendus", e: "🎋", cat: "Chambre", dims: [300, 260, 40], dimMin: [180, 120, 30],
  opts: [stp("tiroirs", "Tiroir par chevet (0 = niche ouverte)", "🗄️", 0, 0, 1), stp("appliques", "Bandes noires avec applique LED", "💡", 1, 0, 1)],
  build(c, p, o) {
    const E = c.E, CW = 450, Hc = 200, yc = 450, bande = 250;
    // Fond noir sur tout le mur, tasseaux entre les bandes noires des chevets.
    panneauMural(c, "Fond noir", "dos", 0, 0, -5, p.L, p.H, 5, { look: "noir" });
    const xb = [CW / 2 - bande / 2 + 100, p.L - CW / 2 - bande / 2 - 100];
    if (o.appliques) {
      tasseaux(c, "Tête de lit", xb[0] + bande + 20, xb[1] - 20, 0, p.H, 0);
      tasseaux(c, "Côté gauche", 0, xb[0] - 20, 0, p.H, 0);
      tasseaux(c, "Côté droit", xb[1] + bande + 20, p.L, 0, p.H, 0);
      xb.forEach(x => add3d(c, "led", [x + bande / 2 - 15, yc + Hc + 300, 0, 30, 900, 15]));
      hw(c, "appliques", "💡", "Appliques LED verticales", 2);
    } else tasseaux(c, "Tête de lit", 0, p.L, 0, p.H, 0);
    [0, p.L - CW].forEach((x, i) => caisse(c, x + (i ? -100 : 100), yc, E, CW, Hc, p.P - E, { nom: "Chevet " + (i ? "droit" : "gauche"), dos: false, socle: 0, colonnes: [[o.tiroirs ? { t: "tiroirs", n: 1 } : { t: "niche" }]] }));
    hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 8);
    hw(c, "vernis", "🖌️", "Vernis ou peinture (2 couches)", Math.max(1, Math.ceil(p.L * p.H / 1e6 / 5)), "L");
  } });

rec({ id: "lit-chevets-integres", nom: "Lit avec chevets intégrés + coffre", e: "🛏️", cat: "Chambre", rembourre: true, dims: [160, 130, 200], dimMin: [90, 90, 180],
  opts: [TETE("bandes-h"), stp("tiroirs", "Tiroirs par chevet", "🗄️", 2, 1, 3), stp("coffre", "Coffre en pied de lit", "🧳", 1, 0, 1), stp("appliques", "Appliques murales", "💡", 1, 0, 1), CHX_TISSU("gris"), CHX_VUE],
  build(c, p, o) {
    const E = c.E, CW = 480, Hc = 500, Wt = p.L + 2 * E, zt = -(E + 80 + E);
    // Cadre de lit en panneau (tête basse), tête rembourrée au centre, grand panneau qui encadre lit et chevets.
    lit(c, { ...p, H: 400 });
    const S = teteDeLit(c, Wt, p.H, o, 0, zt, 0);
    fournitures(c, S, "socle");
    const Wtot = Wt + 2 * CW;
    panneauMural(c, "Panneau de fond", "caisson", -CW, 0, zt - E, Wtot, p.H + 200, E, { edge: 2 * Wtot });
    [-CW, Wt].forEach((x, i) => {
      caisse(c, x + E + 5, 0, zt, CW - 2 * E - 10, Hc, 420, { nom: "Chevet " + (i ? "droit" : "gauche"), socle: 60, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
      add(c, "Joue de tête " + (i ? "droite" : "gauche"), "caisson", [i ? Wt + CW - E : -CW, 0, zt, E, p.H + 200, 450], { edge: p.H + 200 });
    });
    if (o.appliques) hw(c, "appliques", "💡", "Appliques murales", 2);
    if (o.coffre) {
      const zc = p.P + E + 80;
      caisse(c, 0, 0, zc, Wt, 450, 400, { nom: "Coffre", socle: 40, dessus: false, colonnes: [[{ t: "niche" }]] });
      plateau(c, "Coffre · Couvercle", 0, 450, zc, Wt, 420);
      hw(c, "verins", "⚙️", "Vérins de couvercle (paire)", 1);
      hw(c, "piano", "➖", "Charnière piano", Wt / 1000, "m");
    }
  } });

/* ----- Bureau ----- */
rec({ id: "bureau-direction-l", nom: "Bureau de direction en L + crédence", e: "👔", cat: "Bureau", dims: [180, 76, 80], dimMin: [120, 70, 60],
  opts: [stp("retour", "Retour (cm)", "↪️", 120, 100, 180, 10), stp("tiroirs", "Tiroirs du caisson", "🗄️", 3, 2, 4), stp("credence", "Crédence ouverte derrière", "📚", 1, 0, 1)],
  build(c, p, o) {
    const E = c.E, R = Math.max(o.retour * 10, p.P + 300), Hp = p.H - E;
    // Plateau principal sur un pied plein à gauche, retour posé sur un caisson à tiroirs.
    plateau(c, "Plateau principal", 0, Hp, 0, p.L, p.P);
    add(c, "Pied plein gauche", "caisson", [0, 0, 0, E, Hp, p.P], { edge: 2 * Hp + p.P });
    add(c, "Voile de façade", "caisson", [E, 150, p.P - E - 60, p.L - 2 * E - 450, Hp - 150, E], { edge: 0 });
    const Dr = 450;
    plateau(c, "Plateau retour", p.L - Dr, Hp, p.P, Dr, R - p.P);
    caisse(c, p.L - Dr, 0, 0, Dr, Hp, p.P, { nom: "Caisson tiroirs", dessus: false, socle: 60, colonnes: [[{ t: "tiroirs", n: o.tiroirs }]] });
    caisse(c, p.L - Dr, 0, p.P, Dr, Hp, R - p.P, { nom: "Caisson du retour", dessus: false, socle: 60, colonnes: [[{ t: "etageres", n: 1, portes: { n: 1 } }]] });
    if (o.credence) caisse(c, 0, 0, -1300, Math.min(p.L, 1600), 750, 400, { nom: "Crédence", socle: 60, colonnes: [[{ t: "etageres", n: 1 }], [{ t: "etageres", n: 1 }], [{ t: "etageres", n: 0, portes: { n: 1 } }]] });
    hw(c, "passeFil", "🔌", "Passe-câbles", 2);
  } });

/* ----- Boutique ----- */
rec({ id: "agencement-boutique", nom: "Agencement de boutique (vitrines murales)", e: "🏬", cat: "Boutique", dims: [320, 240, 45], dimMin: [80, 180, 35],
  opts: [stp("module", "Largeur d'un module (cm)", "↔️", 80, 50, 120, 5), stp("etageres", "Étagères en verre par module", "🪟", 4, 2, 6), stp("comptoir", "Comptoir au milieu", "💰", 1, 0, 1), stp("led", "Ruban LED", "💡", 1, 0, 1)],
  build(c, p, o) {
    const E = c.E, H = Math.min(p.H, 2400), Hb = 850, Dh = 320, n = Math.max(1, Math.round(p.L / (o.module * 10))), w = p.L / n;
    for (let i = 0; i < n; i++) {
      const nm = "Module " + (i + 1);
      caisse(c, i * w, 0, 0, w, Hb, p.P, { nom: nm + " · Bas", socle: 80, colonnes: [[{ t: "etageres", n: 1, portes: { n: 2 } }]] });
      add3d(c, "top", [i * w, Hb, 0, w, 20, p.P + 10]);
      caisse(c, i * w, Hb + 20, 0, w, H - Hb - 20, Dh, { nom: nm + " · Haut", socle: 0, colonnes: [[{ t: "niche" }]] });
      for (let k = 1; k <= o.etageres; k++) add3d(c, "glass", [i * w + E + 2, Hb + 20 + E + k * (H - Hb - 20 - 2 * E) / (o.etageres + 1), 0, w - 2 * E - 4, 8, Dh - 20]);
      if (o.led) add3d(c, "led", [i * w + E + 5, Hb + 20 + E, Dh - 30, 10, H - Hb - 20 - 2 * E, 10]);
    }
    hw(c, "plan", "🟫", "Plan de dessus du bas (mélaminé ou marbre)", p.L / 1000, "m");
    hw(c, "verre", "🪟", "Étagères en verre trempé 8 mm", Math.round(n * o.etageres * (w - 2 * E) * (Dh - 20) / 1e4) / 100, "m²");
    hw(c, "supVerre", "📌", "Supports d'étagère en verre", 4 * n * o.etageres);
    if (o.led) hw(c, "led", "💡", "Ruban LED + alimentation", Math.ceil(n * (H - Hb) / 1000), "m");
    hw(c, "fixmur", "🔩", "Fixations murales + chevilles", 4 * n);
    if (o.comptoir) {
      const Wc = Math.min(1600, p.L), xc = (p.L - Wc) / 2, zc = p.P + 1200;
      caisse(c, xc, 0, zc, Wc, 1000 - E, 500, { nom: "Comptoir", socle: 0, dos: false, colonnes: [[{ t: "etageres", n: 1 }], [{ t: "tiroirs", n: 2, h: 300 }, { t: "etageres", n: 0 }]] });
      add(c, "Comptoir · Façade clients", "caisson", [xc, 0, zc + 525, Wc, 1000 - E, E], { edge: 2 * Wc + 2 * (1000 - E) });
      plateau(c, "Comptoir · Plateau", xc - 20, 1000 - E, zc, Wc + 40, 600);
    }
  } });

/* ----- Un seul modèle par meuble de chambre ----- */
/* La commode, l'armoire et le dressing restent un seul meuble chacun dans le catalogue : les nouvelles formes
   s'y choisissent par « Modèle ». Les réglages communs (tiroirs, étagères) gardent leur bouton ; ceux propres
   à une forme n'apparaissent que pour elle. Les anciens projets (sans « modèle ») restent en « Classique ». */
function variantes(idVisible, classique, liste) {
  const r = RECIPES.find(x => x.id === idVisible), modele = o => (o && o.modele) || "classique";
  const partages = new Set(liste.flatMap(v => v.partages || []));
  r.opts = r.opts.map(x => {
    if (partages.has(x.k)) return x;
    const si = x.si; return { ...x, si: o => modele(o) === "classique" && (!si || si(o)) };
  });
  r.opts.unshift(chx("modele", "Modèle", [["classique", classique], ...liste.map(v => [v.val, v.nom])], "classique"));
  for (const v of liste) {
    const h = RECIPES.find(x => x.id === v.id);
    for (const x of h.opts) if (!(v.partages || []).includes(x.k)) r.opts.push({ ...x, si: o => modele(o) === v.val });
  }
  const build = r.build;
  r.build = (c, p, o) => {
    const v = liste.find(q => q.val === modele(o));
    if (!v) return build(c, p, o);
    const h = RECIPES.find(x => x.id === v.id), d = {};
    h.opts.forEach(x => (d[x.k] = x.def));
    const oo = { ...d, ...o };
    // Un réglage partagé garde la plage de la forme choisie.
    h.opts.forEach(x => { if (!x.choice && oo[x.k] != null) oo[x.k] = Math.max(x.min, Math.min(x.max, oo[x.k])); });
    h.build(c, p, oo);
  };
}
variantes("armoire-2", "🚪 Classique", [
  { val: "colonne", nom: "👟 Avec colonne d'étagères ouvertes", id: "armoire-colonne-ouverte", partages: ["tiroirs"] }
]);
variantes("dressing", "👗 Classique", [
  { val: "vitrine", nom: "✨ Avec colonne vitrine LED", id: "dressing-vitrine", partages: ["tiroirs"] }
]);
variantes("commode", "🗄️ Classique", [
  { val: "armoire", nom: "🚪 Avec petite armoire", id: "commode-armoire", partages: ["tiroirs"] }
]);

/* ----- Lit plateforme (socle en retrait éclairé, grande tête de lit, chevets suspendus) ----- */
/* p : L = largeur du matelas, H = hauteur de la tête de lit, P = longueur du matelas.
   Variantes des photos : tête lisse en 2 panneaux, tête à tasseaux, tête à cadre lumineux ;
   tête large (derrière les chevets) ou à la largeur du lit ; chevets suspendus, posés ou sans ;
   caisse lisse ou habillée de lamelles ; LED sous le socle. */
rec({ id: "lit-plateforme", nom: "Lit plateforme (socle LED, grande tête)", e: "🛏️", cat: "Chambre", dims: [160, 100, 200], dimMin: [90, 60, 180],
  opts: [
    chx("tete", "Tête de lit", [["panneau", "🟫 Lisse (2 panneaux)"], ["tasseaux", "🎋 Tasseaux au centre"], ["cadre", "💡 Cadre lumineux"]], "panneau"),
    stp("largeTete", "Tête large derrière les chevets", "↔️", 1, 0, 1),
    chx("chevets", "Chevets", [["suspendus", "🪝 Suspendus à la tête"], ["poses", "🌙 Posés au sol"], ["aucun", "Sans"]], "suspendus"),
    { ...stp("tiroirChevet", "Tiroir par chevet (0 = niches)", "🗄️", 1, 0, 1), si: o => o.chevets !== "aucun" },
    chx("caisse", "Côtés du lit", [["lisse", "Lisses"], ["lamelles", "🎋 Habillés de lamelles"]], "lisse"),
    stp("led", "LED sous le socle", "💡", 1, 0, 1)
  ],
  build(c, p, o) {
    const E = c.E, L = p.L, Lg = p.P, W = L + 2 * E, hs = 120, r = 100, Hc = 260, yc = hs, CW = 450, ecartC = 60;
    /* Socle en retrait (ombre + LED), puis caisse du lit posée dessus. */
    add(c, "Socle · Côté gauche", "caisson", [r, 0, r, E, hs, Lg - 2 * r], { edge: 0 });
    add(c, "Socle · Côté droit", "caisson", [W - r - E, 0, r, E, hs, Lg - 2 * r], { edge: 0 });
    add(c, "Socle · Avant", "caisson", [r + E, 0, Lg - r - E, W - 2 * r - 2 * E, hs, E], { edge: 0 });
    add(c, "Socle · Arrière", "caisson", [r + E, 0, r, W - 2 * r - 2 * E, hs, E], { edge: 0 });
    add(c, "Socle · Traverse centrale", "caisson", [r + E, 0, Lg / 2, W - 2 * r - 2 * E, hs, E], { edge: 0 });
    add(c, "Plancher de la caisse", "dos", [0, yc - 5, 0, W, 5, Lg]);
    if (W > 1200) c.parts.pop(), [0, 1].forEach(i => add(c, "Plancher de la caisse " + (i + 1) + "/2", "dos", [i * W / 2, yc - 5, 0, W / 2, 5, Lg]));
    panneauV(c, "Côté de lit gauche", 0, yc, 0, Hc, Lg, Lg);
    panneauV(c, "Côté de lit droit", W - E, yc, 0, Hc, Lg, Lg);
    add(c, "Pied de lit", "caisson", [0, yc, Lg, W, Hc, E], { edge: 2 * W });
    add(c, "Traverse de tête", "caisson", [E, yc, 0, L, Hc - 60, E], { edge: 0 });
    // Lattes sur tasseaux d'appui, poutre centrale pour les grands lits.
    const nl = Math.round(Lg / 90);
    for (let i = 0; i < nl; i++) add3d(c, "massif", [E, yc + Hc - 80, E + 40 + i * (Lg - 80 - E) / (nl - 1) - 35, L, 20, 70]);
    hw(c, "lattes", "🪵", "Lattes de lit " + Math.round(L / 10) + " cm", nl);
    hw(c, "tasseaux", "🪵", "Tasseaux d'appui des lattes", 2 * Lg / 1000, "m");
    if (L > 1000) { add(c, "Poutre centrale (bande de panneau)", "caisson", [E + L / 2 - E / 2, yc, E, E, Hc - 80, Lg - E], { edge: 0 }); hw(c, "pieds", "🦵", "Pieds réglables sous la poutre", 2); }
    hw(c, "equerres", "📐", "Équerres d'assemblage", 12);
    if (o.led) { add3d(c, "led", [r - 15, 20, r, 10, 10, Lg - 2 * r]); add3d(c, "led", [W - r + 5, 20, r, 10, 10, Lg - 2 * r]); add3d(c, "led", [r, 20, Lg - r + 5, W - 2 * r, 10, 10]); hw(c, "led", "💡", "Ruban LED + alimentation (sous le socle)", Math.ceil((2 * Lg + W) / 1000), "m"); }
    /* Habillage en lamelles des côtés et du pied. */
    if (o.caisse === "lamelles") {
      const lw = 30, le = 15, z = Lg + E;
      const nPied = Math.floor((W + le) / (lw + le)), dx = (W - (nPied * lw + (nPied - 1) * le)) / 2;
      for (let i = 0; i < nPied; i++) add(c, "Lamelle pied " + (i + 1), "caisson", [dx + i * (lw + le), yc, z, lw, Hc, E], { edge: 2 * Hc });
      const nCote = Math.floor((Lg + E + le) / (lw + le));
      [-E, W].forEach((x, s) => { for (let i = 0; i < nCote; i++) add(c, "Lamelle côté " + (s ? "droit " : "gauche ") + (i + 1), "caisson", [x, yc, i * (lw + le), E, Hc, lw], { edge: 2 * Hc }); });
      hw(c, "colle", "🧴", "Colle à bois", 1);
      hw(c, "pointes", "🔨", "Pointes sans tête", 2 * (nPied + 2 * nCote));
    }
    /* Tête de lit : à la largeur du lit, ou large derrière les chevets. */
    const avecC = o.chevets !== "aucun", large = o.largeTete && avecC, Wt = large ? W + 2 * (CW + ecartC) : W, xt = (W - Wt) / 2, zt = -E;
    if (o.tete === "panneau" || o.tete === "tasseaux") {
      const n = Math.max(2, Math.ceil(Wt / FEUILLE_L));
      for (let i = 0; i < n; i++) add(c, "Tête de lit " + (i + 1) + "/" + n, "caisson", [xt + i * Wt / n, 0, zt, Wt / n - 2, p.H, E], { edge: Wt / n + 2 * p.H / n });
      if (o.tete === "tasseaux") tasseaux(c, "Tête de lit", 0, W, yc + Hc, p.H - yc - Hc, 0, { larg: 30, ecart: 15 });
    } else {
      // Cadre lumineux : panneau de fond, panneau avant en retrait de 5 cm, ruban LED caché entre les deux.
      panneauMural(c, "Tête de lit · Fond", "caisson", xt, 0, zt - E, Wt, p.H, E, { edge: 2 * Wt });
      const m = 50; tasseaux(c, "Tête de lit · Centre", m, W - m, yc + Hc, p.H - yc - Hc - m, zt, { larg: 30, ecart: 15 });
      add3d(c, "led", [xt + 10, p.H - 15, zt - 5, Wt - 20, 10, 10]); add3d(c, "led", [xt + 10, 0, zt - 5, 10, p.H - 20, 10]); add3d(c, "led", [xt + Wt - 20, 0, zt - 5, 10, p.H - 20, 10]);
      hw(c, "led", "💡", "Ruban LED + alimentation (cadre de la tête)", Math.ceil((Wt + 2 * p.H) / 1000), "m");
    }
    hw(c, "fixmur", "🔩", "Fixations murales + chevilles (tête de lit)", 6);
    /* Chevets. */
    if (avecC) {
      const susp = o.chevets === "suspendus", hC = susp ? 260 : 500, y = susp ? 380 : 0, D = 400;
      const zones = o.tiroirChevet ? [{ t: "etageres", n: 0 }, { t: "tiroirs", n: 1, h: susp ? 120 : 180 }] : [{ t: "etageres", n: susp ? 0 : 1 }];
      [W + ecartC, -ecartC - CW].forEach((x, i) => caisse(c, x, y, 0, CW, hC, D, { nom: "Chevet " + (i ? "gauche" : "droit"), dos: false, socle: susp ? 0 : 60, colonnes: [zones] }));
      if (susp) hw(c, "fixChevet", "🔩", "Équerres cachées pour chevets suspendus", 4);
    }
  } });
