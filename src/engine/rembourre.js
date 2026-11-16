// MenuiPro — meubles rembourrés : canapés, fauteuils, poufs, banquettes, lits et têtes de lit capitonnés, salons.
// Structure fabriquée en atelier : cadre en bois massif + panneaux (contreplaqué conseillé), puis mousse, ouate et tissu.
// Cotes en mm. Repère : x = largeur, y = hauteur, z = profondeur (z = 0 au dos du meuble).
// Les éléments « tissu » (mousse habillée) ne sont que dans la 3D ; leurs quantités vont dans la liste d'achat.
import { add, add3d, hw } from "./blocs.js";
import { rec, stp, chx } from "./recettes.js";

/* ---------- Tissus (couleur de la 3D) ---------- */
export const TISSUS = [
  ["beige", "Beige", "#cbb89c"], ["creme", "Crème", "#e8e0cf"], ["taupe", "Taupe", "#9a8a7a"], ["gris", "Gris", "#8e9094"],
  ["anthracite", "Anthracite", "#45484d"], ["noir", "Noir", "#28282b"], ["bleu", "Bleu roi", "#2c4f8f"], ["bleu-nuit", "Bleu nuit", "#1f2c48"],
  ["vert", "Vert sapin", "#2f5f4a"], ["vert-olive", "Vert olive", "#7a7d4c"], ["vert-sauge", "Vert sauge", "#a9bfa0"], ["rose", "Rose", "#d4a0a3"],
  ["bordeaux", "Bordeaux", "#6e1f2b"], ["marron", "Marron", "#6b4a35"], ["cognac", "Cognac", "#a0582f"], ["orange", "Orange", "#cc6a2c"],
  ["moutarde", "Jaune moutarde", "#c99a2e"], ["blanc", "Blanc cassé", "#f0ece3"]
];
export const teinte = id => (TISSUS.find(t => t[0] === id) || TISSUS[0])[2];
const CHX_TISSU = def => chx("tissu", "Couleur du tissu", TISSUS.map(t => [t[0], t[1]]), def || "beige");
const CHX_PIEDS = def => chx("pieds", "Pieds", [["bois", "Bois"], ["metal", "Métal"], ["socle", "Socle (sans pieds)"]], def || "bois");
const CHX_VUE = chx("vue", "Voir en 3D", [["habille", "Meuble fini"], ["structure", "Structure bois"]], "habille");
const HAUT_PIEDS = { bois: 150, metal: 170, socle: 60 };

// Repère d'un élément posé dans la pièce : rot 0 = dos au fond (regarde vers l'avant),
// rot 1 = dos à gauche (regarde vers la droite), rot 3 = dos à droite (regarde vers la gauche).
function repere(ox = 0, oz = 0, rot = 0, L = 0) {
  if (rot === 1) return ([x, y, z, sx, sy, sz]) => [ox + z, y, oz + L - x - sx, sz, sy, sx];
  if (rot === 3) return ([x, y, z, sx, sy, sz]) => [ox - z - sz, y, oz + x, sz, sy, sx];
  if (rot === 2) return ([x, y, z, sx, sy, sz]) => [ox + L - x - sx, y, oz - z - sz, sx, sy, sz];
  return ([x, y, z, sx, sy, sz]) => [ox + x, y, oz + z, sx, sy, sz];
}

// Petit atelier de construction : pièces de bois (débit) + volumes habillés (3D) + comptage mousse/tissu.
function atelier(c, o, T, pre) {
  const couleur = teinte(o.tissu), voirTissu = o.vue !== "structure";
  const S = { tissu: 0, mousse12: 0, mousse5: 0, ouate: 0, sangles: 0, boutons: 0, pieds: 0 };
  return {
    S,
    // Vue « meuble fini » : la structure est cachée sous le tissu (elle reste dans le débit) ; vue « structure » : on la montre.
    bois: (nom, b, sec) => add(c, pre + nom, "massif", T(b), { flags: { ...(sec ? { section: sec } : {}), sous3d: voirTissu } }),
    panneau: (nom, b) => add(c, pre + nom, "caisson", T(b), { edge: 0, flags: { sous3d: voirTissu } }),
    fond: (nom, b) => add(c, pre + nom, "dos", T(b), { flags: { sous3d: voirTissu } }),
    habille: (b, rond = 30, extra = {}) => { if (voirTissu) add3d(c, "tissu", T(b), { round: rond, teinte: couleur, ...extra }); },
    bouton: b => { if (voirTissu) add3d(c, "bouton", T(b), { teinte: couleur }); S.boutons++; },
    pied: (b, sorte) => { if (sorte === "socle") return; add3d(c, sorte === "metal" ? "or" : "massif", T(b), sorte === "metal" ? {} : { round: 8 }); S.pieds++; },
    cadre: b => { if (!voirTissu) return; add3d(c, "tissu", T(b), { round: 6, teinte: couleur, sombre: true }); }
  };
}

// Mousse, tissu et fournitures, à partir des surfaces (mm²).
function fournitures(c, S, piedsSorte) {
  const m2 = v => Math.round(v / 1e4) / 100;
  if (S.mousse12) hw(c, "mousse12", "🟨", "Mousse d'assise 12 cm (densité 35)", m2(S.mousse12), "m²");
  if (S.mousse5) hw(c, "mousse5", "🟨", "Mousse 5 cm (dossier, accoudoirs, tête de lit)", m2(S.mousse5), "m²");
  if (S.ouate) hw(c, "ouate", "☁️", "Ouate de rembourrage (dacron)", Math.ceil(S.ouate / 1.5e6 * 10) / 10, "m");
  // Tissu en laize de 1,40 m, avec 25 % de perte pour les raccords et les coutures.
  if (S.tissu) hw(c, "tissu", "🧶", "Tissu d'ameublement (laize 1,40 m)", Math.ceil(S.tissu * 1.25 / 1.4e6 * 10) / 10, "m");
  if (S.sangles) hw(c, "sangles", "🧵", "Sangles élastiques d'assise", Math.ceil(S.sangles / 1000), "m");
  if (S.tissu) {
    hw(c, "agrafes", "📎", "Agrafes de tapissier", Math.max(1, Math.ceil(S.tissu / 6e6)), "boîte");
    hw(c, "colleContact", "🧴", "Colle contact (néoprène) pour mousse", Math.max(1, Math.ceil((S.mousse12 + S.mousse5) / 5e6)), "pot");
    hw(c, "toile", "▫️", "Toile de dessous (non-tissé)", Math.ceil(S.dessous / 1.5e6 * 10) / 10 || 1, "m");
  }
  if (S.boutons) hw(c, "boutons", "🔘", "Boutons de capitonnage", S.boutons);
  if (S.pieds) hw(c, piedsSorte === "metal" ? "piedsMetal" : "piedsBois", "🦵", piedsSorte === "metal" ? "Pied métal doré" : "Pied bois tourné", S.pieds);
  hw(c, "visbois", "🔩", "Vis à bois", 1);
  hw(c, "colle", "🧴", "Colle à bois", 1);
}

/* ---------- Canapé / fauteuil / banquette ---------- */
// p : L (largeur hors tout), H (haut du dossier), P (profondeur). o : places, accoudoirs, dossier, pieds, tissu, angle.
export function canape(c, p, o, place = {}, pre = "") {
  const L = p.L, P = p.P, H = p.H, E = c.E;
  const T = repere(place.ox, place.oz, place.rot, L), A = atelier(c, o, T, pre), S = A.S;
  const sortePieds = o.pieds || "bois", hp = HAUT_PIEDS[sortePieds];
  // Largeur d'accoudoir : celle du style, mais jamais plus de 16 % de la largeur du meuble (fauteuils).
  const a = Math.min({ droits: 160, arrondis: 210, fins: 90, aucun: 0 }[o.accoudoirs || "droits"], Math.round(L * 0.16));
  const n = Math.max(1, o.places || 3), Wi = L - 2 * a;
  const hs = 450, ep = 130;                         // hauteur d'assise, épaisseur du coussin
  const ys = hs - ep;                              // dessus du cadre d'assise
  const hr = Math.max(80, ys - hp - 20);           // hauteur des longerons
  const db = o.dossier === "bas" ? 160 : 220;      // épaisseur du dossier
  const Hd = o.dossier === "bas" ? Math.min(H, hs + 280) : H;
  const Ha = o.accoudoirs === "fins" ? hs + 150 : o.dossier === "capitonne" ? Hd : hs + 190;   // haut des accoudoirs
  const angle = o.angle ? Math.max(1300, Math.min(2000, o.retour || 1600)) : 0;               // profondeur de la méridienne
  const wl = angle ? Math.min(Wi, Math.round(Wi / n) + 150) : 0;

  /* Cadre d'assise en bois massif */
  A.bois("Longeron arrière", [a, hp, 0, Wi, hr, 27]);
  A.bois("Longeron avant", [a, hp, P - 27, Wi - (angle ? wl : 0), hr, 27]);
  const nt = n + 1;
  for (let i = 0; i < nt; i++) A.bois("Traverse d'assise " + (i + 1), [a + i * (Wi - 27) / (nt - 1), hp, 27, 27, hr, P - 54]);
  S.sangles += Math.ceil(Wi / 90) * (P - 54) + Math.ceil((P - db) / 110) * Wi;
  /* Dossier */
  const hd = Hd - ys - 30;
  for (let i = 0; i < nt; i++) A.bois("Montant de dossier " + (i + 1), [a + i * (Wi - 27) / (nt - 1), ys, 0, 27, hd, 70], "latte");
  A.bois("Traverse haute de dossier", [a, Hd - 70, 0, Wi, 70, 27], "latte");
  A.fond("Dos du dossier (5 mm)", [0, hp, -5, L, Hd - hp - 10, 5]);
  /* Accoudoirs : 2 panneaux + chapeau */
  if (a > 0) for (const [cote, x0] of [["gauche", 0], ["droit", L - a]]) {
    A.panneau("Accoudoir " + cote + " (extérieur)", [x0 + (cote === "gauche" ? 0 : a - E), hp, 0, E, Ha - hp - 30, P]);
    A.panneau("Accoudoir " + cote + " (intérieur)", [x0 + (cote === "gauche" ? a - E : 0), hp, 0, E, Ha - hp - 30, P - 40]);
    A.bois("Chapeau d'accoudoir " + cote, [x0, Ha - 30, 0, a, 30, P], a > 120 ? "planche" : null);
    S.mousse5 += 2 * (Ha - hp) * P + a * P;
    S.tissu += 2 * (Ha - hp) * P + a * P + a * (Ha - hp);
    A.habille([x0, hp, 0, a, Ha - hp, P], o.accoudoirs === "arrondis" ? Math.min(a / 2.1, 90) : 22);
  }
  /* Méridienne (canapé d'angle) */
  if (angle) {
    const x0 = a + Wi - wl;
    A.bois("Longeron de méridienne gauche", [x0, hp, P - 27, 27, hr, angle - P]);
    A.bois("Longeron de méridienne droit", [a + Wi - 27, hp, P - 27, 27, hr, angle - P]);
    A.bois("Traverse avant de méridienne", [x0, hp, angle - 27, wl, hr, 27]);
    S.sangles += Math.ceil(wl / 90) * (angle - P);
    S.mousse12 += wl * (angle - P);
    S.tissu += 2 * wl * (angle - P) + 2 * (angle - P) * (ys - hp) + wl * (ys - hp);
    A.habille([x0, hp, P - 10, wl, ys - hp, angle - P + 10], 18);
    A.habille([x0 + 3, ys, P - 20, wl - 6, ep, angle - P + 20], 45);
  }
  /* Habillage : socle tissu, coussins d'assise et de dossier */
  A.habille([a, hp, 0, Wi, ys - hp, P], 18);
  S.tissu += Wi * (ys - hp) + Wi * P;
  S.dessous = (S.dessous || 0) + L * P;
  const w = Wi / n, wa = angle && n > 1 ? (Wi - wl) / (n - 1) : w;   // à côté d'une méridienne, les autres places se partagent le reste
  for (let i = 0; i < n; i++) {
    const meri = angle && i === n - 1, ww = meri ? wl : wa, x = meri ? a + Wi - wl : a + i * wa;
    A.habille([x + 3, ys, db - 40, ww - 6, ep, P - db + 40], 45);
    S.mousse12 += ww * (P - db); S.tissu += 2 * ww * (P - db) + 2 * ep * (ww + P - db);
  }
  if (o.dossier === "coussins" || !o.dossier) {
    A.habille([a, ys, 0, Wi, Hd - ys - 110, 70], 20);
    for (let i = 0; i < n; i++) A.habille([a + i * w + 5, ys + ep - 10, 55, w - 10, Hd - ys - ep, db - 50], 70);
  } else {
    A.habille([a, ys, 0, Wi, Hd - ys, db], o.dossier === "capitonne" ? 35 : 55);
    if (o.dossier === "capitonne") {
      const nx = Math.max(3, Math.round(Wi / 160)), ny = Math.max(2, Math.round((Hd - ys - ep) / 150));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const bx = a + (i + (j % 2 ? 1 : 0.5)) * Wi / (nx + 0.5), by = ys + ep + 60 + j * (Hd - ys - ep - 100) / Math.max(1, ny - 1);
        if (bx < a + Wi - 30) A.bouton([bx - 12, by - 12, db - 2, 24, 24, 10]);
      }
    }
  }
  S.mousse5 += Wi * (Hd - ys); S.tissu += 2 * Wi * (Hd - ys) + 2 * db * (Hd - ys) + Wi * db;
  S.ouate += S.tissu * 0.6;
  /* Pieds */
  const px = [a > 0 ? 40 : 40, L - 40 - (sortePieds === "metal" ? 30 : 50)], pz = [40, P - 40 - (sortePieds === "metal" ? 30 : 50)];
  const tp = sortePieds === "metal" ? 30 : 50;
  if (sortePieds !== "socle") {
    px.forEach(x => pz.forEach(z => A.pied([x, 0, z, tp, hp, tp], sortePieds)));
    if (L > 1700) A.pied([L / 2 - tp / 2, 0, P - 40 - tp, tp, hp, tp], sortePieds);
    if (angle) A.pied([a + Wi - tp - 20, 0, angle - 40 - tp, tp, hp, tp], sortePieds);
  } else A.cadre([30, 0, 30, L - 60, hp, (angle ? angle : P) - 60]);
  return S;
}

/* ---------- Pouf ---------- */
export function pouf(c, p, o) {
  const T = repere(), A = atelier(c, o, T, ""), S = A.S, E = c.E, L = p.L, H = p.H, P = p.P;
  A.panneau("Fond du pouf", [0, 60, 0, L, E, P]);
  A.panneau("Côté avant", [0, 60 + E, 0, L, H * 0.5, E]); A.panneau("Côté arrière", [0, 60 + E, P - E, L, H * 0.5, E]);
  A.panneau("Côté gauche", [0, 60 + E, E, E, H * 0.5, P - 2 * E]); A.panneau("Côté droit", [L - E, 60 + E, E, E, H * 0.5, P - 2 * E]);
  const rond = o.forme === "rond" ? Math.min(L, P) / 2.05 : 60;
  if (o.forme === "citrouille") {
    const nb = 8;
    for (let i = 0; i < nb; i++) A.habille([i * L / nb, 30, 0, L / nb + 20, H - 30, P], Math.min(L / nb, P) / 2.1);
  } else A.habille([0, 30, 0, L, H - 30, P], rond);
  S.mousse12 += L * P; S.mousse5 += 2 * (L + P) * H; S.tissu += 2 * L * P + 2 * (L + P) * H; S.ouate += S.tissu; S.dessous = L * P;
  A.pied([L / 2 - 20, 0, P / 2 - 20, 40, 30, 40], "bois");
  fournitures(c, S, "bois");
}

/* ---------- Tête de lit rembourrée ---------- */
// Styles : simple, capitonne, bandes-v, bandes-h, arches, arc, quilte.
export function teteDeLit(c, W, Ht, o, x0 = 0, z0 = 0, hp = 0) {
  const T = repere(x0, z0), A = atelier(c, o, T, ""), S = A.S, E = c.E, ep = 80;
  // Un panneau trop grand pour une feuille (2440 × 1220) est fait en 2 morceaux, joints sur un montant central.
  const hpan = Ht - hp, k = Math.max(1, W > 2400 || (W > 1200 && hpan > 1200) ? Math.ceil(W / Math.min(2400, W / 2 + 1)) : 1);
  for (let i = 0; i < k; i++) A.panneau("Panneau de tête de lit" + (k > 1 ? " (" + (i + 1) + "/" + k + ")" : ""), [i * W / k, hp, 0, W / k, hpan, E]);
  if (k > 1) A.bois("Montant de jonction", [W / 2 - 35, 0, -27, 70, Ht, 27], "latte");
  A.bois("Montant de tête de lit gauche", [0, 0, -27, 70, Ht, 27], "latte");
  A.bois("Montant de tête de lit droit", [W - 70, 0, -27, 70, Ht, 27], "latte");
  const y0 = Math.max(hp, 300), hv = Ht - y0, st = o.tete || "capitonne";
  if (st === "bandes-v" || st === "arches") {
    const nb = Math.max(3, Math.round(W / 190)), bw = W / nb;
    for (let i = 0; i < nb; i++) A.habille([i * bw + 4, y0, E, bw - 8, hv, ep], Math.min(bw, ep) / 2.1, st === "arches" ? { forme: "arche" } : {});
  } else if (st === "bandes-h") {
    const nb = Math.max(3, Math.round(hv / 200)), bh = hv / nb;
    for (let j = 0; j < nb; j++) A.habille([0, y0 + j * bh + 4, E, W, bh - 8, ep], Math.min(bh, ep) / 2.1);
  } else if (st === "arc") {
    A.habille([0, y0, E, W, hv, ep], 30, { forme: "arche" });
  } else {
    A.habille([0, y0, E, W, hv, ep], st === "simple" ? 35 : 25);
    if (st === "capitonne" || st === "quilte") {
      const pas = st === "quilte" ? 110 : 150, nx = Math.round(W / pas), ny = Math.max(2, Math.round(hv / pas));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const bx = (i + (j % 2 ? 1 : 0.5)) * W / (nx + 0.5), by = y0 + 70 + j * (hv - 140) / Math.max(1, ny - 1);
        if (bx < W - 40) A.bouton([bx - 11, by - 11, E + ep - 4, 22, 22, 10]);
      }
    }
  }
  S.mousse5 += W * hv; S.tissu += W * hv * 1.6 + 2 * (W + hv) * ep; S.ouate += W * hv;
  return S;
}

/* ---------- Lit rembourré (sommier habillé + tête de lit) ---------- */
// p : L = largeur du matelas, H = hauteur de la tête de lit, P = longueur du matelas.
export function litRembourre(c, p, o) {
  const L = p.L, Lg = p.P, e = 70, W = L + 2 * e, sortePieds = o.pieds || "socle", hp = sortePieds === "socle" ? 40 : HAUT_PIEDS[sortePieds];
  const hb = o.base === "fine" ? 180 : 300;           // hauteur de la caisse du lit
  const T = repere(0, 0), A = atelier(c, o, T, ""), S = A.S, E = c.E;
  /* Cadre en bois massif */
  A.bois("Longeron gauche", [e - 27, hp, 80, 27, hb - 40, Lg], "planche");
  A.bois("Longeron droit", [e + L, hp, 80, 27, hb - 40, Lg], "planche");
  A.bois("Traverse de pied", [e - 27, hp, 80 + Lg, L + 54, hb - 40, 27], "planche");
  A.bois("Traverse de tête", [e - 27, hp, 80 - 27, L + 54, hb - 40, 27], "planche");
  if (L > 1000) A.bois("Poutre centrale", [e + L / 2 - 30, hp, 80, 60, hb - 60, Lg], "chevron");
  const nl = Math.round(Lg / 110);
  for (let i = 0; i < nl; i++) add3d(c, "massif", [e, hp + hb - 60, 100 + i * (Lg - 60) / (nl - 1) - 35, L, 20, 70]);
  hw(c, "lattes", "🪵", "Lattes de lit " + Math.round(L / 10) + " cm", nl);
  hw(c, "tasseaux", "🪵", "Tasseaux d'appui des lattes", 2 * Lg / 1000, "m");
  /* Caisse habillée : panneaux puis tissu */
  A.panneau("Côté de caisse gauche", [0, hp, 80, E, hb, Lg + 27]);
  A.panneau("Côté de caisse droit", [W - E, hp, 80, E, hb, Lg + 27]);
  A.panneau("Pied de caisse", [0, hp, 80 + Lg + 27, W, hb, E]);
  A.habille([0, hp, 80, W, hb, Lg + 27 + E], o.base === "boudin" ? hb / 2.1 : 25);
  S.mousse5 += (2 * Lg + W) * hb; S.tissu += (2 * Lg + W) * (hb + 120); S.ouate += (2 * Lg + W) * hb; S.dessous = W * Lg;
  /* Matelas et oreillers (pour la présentation au client, non comptés) */
  if (o.vue !== "structure") {
    add3d(c, "drap", [e, hp + hb - 60, 85, L, 240, Lg], { round: 60 });
    const no = L > 1300 ? 2 : 1;
    for (let i = 0; i < no; i++) add3d(c, "drap", [e + 60 + i * (L - 120) / no, hp + hb + 180, 120, (L - 120) / no - 40, 140, 380], { round: 65 });
  }
  /* Tête de lit */
  const S2 = teteDeLit(c, W + 2 * (o.debord || 0), p.H, o, -(o.debord || 0), 0, hp);
  for (const k in S2) S[k] = (S[k] || 0) + S2[k];
  /* Pieds */
  if (sortePieds !== "socle") [[40, 120], [W - 90, 120], [40, Lg + 40], [W - 90, Lg + 40]].forEach(([x, z]) => A.pied([x, 0, z, sortePieds === "metal" ? 30 : 50, hp, sortePieds === "metal" ? 30 : 50], sortePieds));
  else A.cadre([40, 0, 120, W - 80, hp, Lg - 40]);
  hw(c, "boulons", "🔩", "Boulons de lit 8 × 120 + écrous", 8);
  fournitures(c, S, sortePieds);
}

/* ---------- Salon complet (collection) ---------- */
export const COMPOSITIONS = [["3+2+1+1", "Canapé 3 + canapé 2 + 2 fauteuils"], ["3+2+1", "Canapé 3 + canapé 2 + 1 fauteuil"], ["3+1+1", "Canapé 3 + 2 fauteuils"], ["3+2", "Canapé 3 + canapé 2"], ["3+3", "2 canapés 3 places"]];
export function salon(c, p, o) {
  const a = { droits: 160, arrondis: 210, fins: 90, aucun: 0 }[o.accoudoirs || "droits"];
  const w = (p.L - 2 * a) / 3, gap = 350, P = p.P;
  const largeur = places => Math.round(places * w + 2 * a);
  const [principal, ...autres] = (o.compo || "3+2+1+1").split("+").map(Number);
  const tot = { tissu: 0, mousse12: 0, mousse5: 0, ouate: 0, sangles: 0, boutons: 0, pieds: 0, dessous: 0 };
  const cumul = S => { for (const k in tot) tot[k] += S[k] || 0; };
  const L3 = largeur(principal);
  cumul(canape(c, { L: L3, H: p.H, P }, { ...o, places: principal }, { ox: 0, oz: 0, rot: 0 }, "Canapé " + principal + " places · "));
  // Les autres éléments se placent en U : à gauche, à droite, puis en face.
  const places = [{ rot: 1, ox: -gap - P, oz: P + gap / 2 }, { rot: 3, ox: L3 + gap + P, oz: P + gap / 2 }];
  autres.forEach((nb, i) => {
    const L = nb === 1 ? Math.round(w * 1.15 + 2 * a) : largeur(nb), pl = places[i] || { rot: 2, ox: L3 / 2 - L / 2, oz: P + gap + 1500 + P };
    const nom = nb === 1 ? "Fauteuil " + (autres.slice(0, i + 1).filter(x => x === 1).length) + " · " : "Canapé " + nb + " places · ";
    cumul(canape(c, { L, H: p.H, P }, { ...o, places: nb, angle: 0 }, pl, nom));
  });
  if (o.table) {   // table basse au centre (présentation)
    add3d(c, "top", [L3 / 2 - 550, 380, P + gap + 150, 1100, 30, 650], { round: 8 });
    add3d(c, "or", [L3 / 2 - 500, 0, P + gap + 200, 30, 380, 30]); add3d(c, "or", [L3 / 2 + 470, 0, P + gap + 200, 30, 380, 30]);
    add3d(c, "or", [L3 / 2 - 500, 0, P + gap + 720, 30, 380, 30]); add3d(c, "or", [L3 / 2 + 470, 0, P + gap + 720, 30, 380, 30]);
  }
  fournitures(c, tot, o.pieds || "bois");
}

/* ===================== RECETTES ===================== */
const ACC = def => chx("accoudoirs", "Accoudoirs", [["droits", "Droits"], ["arrondis", "Arrondis (épais)"], ["fins", "Fins"], ["aucun", "Sans accoudoirs"]], def || "droits");
const DOS = def => chx("dossier", "Dossier", [["coussins", "Coussins"], ["fixe", "Fixe (lisse)"], ["capitonne", "Capitonné"], ["bas", "Bas"]], def || "coussins");
const TETE = def => chx("tete", "Tête de lit", [["capitonne", "Capitonnée (boutons)"], ["bandes-v", "Bandes verticales"], ["bandes-h", "Bandes horizontales"], ["arches", "Arches"], ["arc", "Arc"], ["quilte", "Matelassée"], ["simple", "Lisse"]], def || "capitonne");
const DIMS_CANAPE = ["Largeur", "Hauteur du dossier", "Profondeur"];

rec({ id: "canape-tissu", nom: "Canapé rembourré", e: "🛋️", cat: "Salon", rembourre: true, dims: [220, 85, 95], dimMin: [80, 60, 60], dimLabels: DIMS_CANAPE,
  opts: [stp("places", "Places", "🪑", 3, 1, 5), ACC(), DOS(), stp("angle", "Canapé d'angle (méridienne)", "📐", 0, 0, 1), CHX_PIEDS(), CHX_TISSU(), CHX_VUE],
  build(c, p, o) { const S = canape(c, p, o); fournitures(c, S, o.pieds); } });
rec({ id: "fauteuil-tissu", nom: "Fauteuil rembourré", e: "💺", cat: "Salon", rembourre: true, dims: [85, 85, 85], dimMin: [50, 60, 50], dimLabels: DIMS_CANAPE,
  opts: [ACC("arrondis"), DOS("fixe"), CHX_PIEDS(), CHX_TISSU(), CHX_VUE],
  build(c, p, o) { const S = canape(c, p, { ...o, places: 1 }); fournitures(c, S, o.pieds); } });
rec({ id: "banquette-tissu", nom: "Banquette rembourrée", e: "🛋️", cat: "Salon", rembourre: true, dims: [180, 75, 80], dimMin: [80, 50, 50], dimLabels: DIMS_CANAPE,
  opts: [stp("places", "Places", "🪑", 3, 1, 4), ACC("aucun"), DOS("bas"), CHX_PIEDS("metal"), CHX_TISSU("orange"), CHX_VUE],
  build(c, p, o) { const S = canape(c, p, o); fournitures(c, S, o.pieds); } });
rec({ id: "pouf-tissu", nom: "Pouf", e: "🟠", cat: "Salon", rembourre: true, dims: [60, 42, 60], dimMin: [30, 25, 30], dimLabels: ["Largeur", "Hauteur", "Profondeur"],
  opts: [chx("forme", "Forme", [["carre", "Carré"], ["rond", "Rond"], ["citrouille", "Côtes (citrouille)"]], "rond"), CHX_TISSU("moutarde"), CHX_VUE],
  build(c, p, o) { pouf(c, p, o); } });
rec({ id: "salon-complet", nom: "Salon complet", e: "🛋️", cat: "Salon", rembourre: true, dims: [230, 85, 95], dimMin: [150, 60, 60], dimLabels: ["Largeur du canapé 3 places", "Hauteur du dossier", "Profondeur"],
  opts: [chx("compo", "Composition", COMPOSITIONS, "3+2+1+1"), ACC(), DOS(), CHX_PIEDS(), CHX_TISSU(), stp("table", "Table basse au centre", "🟫", 1, 0, 1), CHX_VUE],
  build(c, p, o) { salon(c, p, o); } });
rec({ id: "lit-rembourre", nom: "Lit rembourré (tête capitonnée)", e: "🛏️", cat: "Chambre", rembourre: true, dims: [160, 125, 200], dimMin: [80, 80, 180], dimLabels: ["Largeur du matelas", "Hauteur de la tête de lit", "Longueur du matelas"],
  opts: [TETE(), chx("base", "Caisse du lit", [["coffre", "Haute (coffre)"], ["fine", "Fine"], ["boudin", "Arrondie (boudin)"]], "coffre"), stp("debord", "Débord de la tête (mm de chaque côté)", "↔️", 0, 0, 400, 50), CHX_PIEDS("socle"), CHX_TISSU("creme"), CHX_VUE],
  build(c, p, o) { litRembourre(c, p, o); } });
rec({ id: "tete-de-lit", nom: "Tête de lit rembourrée", e: "🛏️", cat: "Chambre", rembourre: true, dims: [180, 120, 8], dimMin: [80, 60, 4], dimLabels: ["Largeur", "Hauteur", "Épaisseur"],
  opts: [TETE(), CHX_TISSU("creme"), CHX_VUE],
  build(c, p, o) { const S = teteDeLit(c, p.L, p.H, o); fournitures(c, S, "socle"); hw(c, "fixmur", "🔩", "Fixations murales", 1); } });
