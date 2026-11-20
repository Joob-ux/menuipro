// MenuiPro — éditeur « Mon dessin » : le menuisier trace la façade au doigt.
// Trait vertical = nouvelle colonne, trait horizontal = nouvelle case. Puis il remplit chaque case avec un outil.
import { hauteurSocle, normaliserCroquis, lireTrait, appliquerTrait, appliquerOutil, deplacerLigne, enleverLigne, bordsColonnes, bordsZones, bordsSous } from "./engine/index.js";

const NS = "http://www.w3.org/2000/svg";
const S = (t, a = {}, ...c) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); c.forEach(x => x != null && n.append(x)); return n; };
const H = (t, a = {}, ...c) => { const n = document.createElement(t); for (const k in a) { if (k === "class") n.className = a[k]; else if (k.startsWith("on")) n.addEventListener(k.slice(2), a[k]); else n.setAttribute(k, a[k]); } c.forEach(x => x != null && n.append(x)); return n; };

export const OUTILS = [
  ["trait", "✏️", "Tracer"], ["etagere", "📚", "Étagère"], ["tiroir", "🗄️", "Tiroir"], ["porte", "🚪", "Porte"],
  ["penderie", "👔", "Penderie"], ["vide", "⬜", "Vide"], ["gomme", "🧽", "Gomme"]
];
const AIDE = {
  trait: "✏️ De haut en bas : une colonne (ou, dans une seule case, deux casiers côte à côte). De gauche à droite : une case. Glissez une ligne pour la déplacer.",
  etagere: "📚 Touchez une case : une étagère de plus à chaque fois.",
  tiroir: "🗄️ Touchez une case : un tiroir de plus à chaque fois.",
  porte: "🚪 Touchez une case : 1 porte, puis 2 portes, puis aucune.",
  penderie: "👔 Touchez une case pour y mettre une tringle.",
  vide: "⬜ Touchez une case pour la vider (niche ouverte).",
  gomme: "🧽 Touchez une étagère, un tiroir, une porte : ils s'effacent un par un. Touchez une ligne pour l'enlever. Une case vide rejoint sa voisine."
};

/* opts : { croquis, dims: () => ({ L, H, ep }) en cm / mm, onChange(croquis),
           photo: () => ({ url, l, h, cadre: [x0, y0, x1, y1], visible }) | null   (photo du meuble à décalquer)
           onPhoto(changements), ajouterPhoto(), enleverPhoto() } */
export function editeurCroquis(opts) {
  let k = normaliserCroquis(opts.croquis), outil = "trait";
  const histo = [];
  const W = 1000, BORD = 14;
  const svg = S("svg", { class: "croquis-svg", role: "img", "aria-label": "Dessin de la façade du meuble" });
  const aide = H("p", { class: "note croquis-aide" }, AIDE.trait);
  const msg = H("p", { class: "croquis-msg", role: "status", "aria-live": "polite" });
  let geo = null; // géométrie du dernier dessin (pour lire les gestes)

  const changer = (nk, sansHisto) => {
    if (!nk) return false;
    if (!sansHisto) { histo.push(JSON.stringify(k)); if (histo.length > 40) histo.shift(); }
    k = normaliserCroquis(nk); dessiner(); opts.onChange(k); return true;
  };
  const dire = (t, erreur) => { msg.textContent = t || ""; msg.classList.toggle("err", !!erreur); if (t) setTimeout(() => { if (msg.textContent === t) msg.textContent = ""; }, 3500); };

  /* ---------- Dessin ---------- */
  function dessiner() {
    const d = opts.dims(), L = d.L * 10, Hm = d.H * 10, E = d.ep || 18;
    const ratio = Math.max(0.25, Math.min(3, Hm / Math.max(1, L)));
    const Ht = W * ratio, bas = hauteurSocle(k) + (k.pieds || 0), socleF = bas ? Math.min(0.4, bas / Hm) : 0, Hi = Ht * (1 - socleF);
    svg.setAttribute("viewBox", `${-BORD} ${-BORD} ${W + 2 * BORD} ${Ht + 2 * BORD + 60}`);
    const cb = bordsColonnes(k), n = k.cols.length;
    // Vide intérieur réel (cm) pour afficher les cotes.
    const wNet = (L - 2 * E - (n - 1) * E) / 10, sfC = k.cols.reduce((s, c) => s + c.f, 0);
    const hNet = (Hm - bas - 2 * E) / 10;
    const kids = [S("rect", { x: -BORD, y: -BORD, width: W + 2 * BORD, height: Ht + 2 * BORD, rx: 6, class: "cq-caisse" })];
    // Photo du meuble, cadrée sur la façade : le menuisier trace ses colonnes et ses cases par-dessus.
    const ph = opts.photo && opts.photo();
    svg.classList.toggle("avec-photo", !!(ph && ph.visible && ph.url));
    if (ph && ph.visible && ph.url) {
      const c = ph.cadre || [0, 0, 1, 1];
      const cadre = S("svg", { x: -BORD, y: -BORD, width: W + 2 * BORD, height: Ht + 2 * BORD, preserveAspectRatio: "none",
        viewBox: `${c[0] * ph.l} ${c[1] * ph.h} ${(c[2] - c[0]) * ph.l} ${(c[3] - c[1]) * ph.h}` });
      cadre.append(S("image", { href: ph.url, width: ph.l, height: ph.h, preserveAspectRatio: "none", class: "cq-photo" }));
      kids.push(cadre);
    }
    if (socleF && !k.pieds) kids.push(S("rect", { x: 0, y: Hi, width: W, height: Ht - Hi, class: "cq-socle" }));
    if (socleF && k.pieds) { kids.push(S("rect", { x: -BORD, y: Hi, width: W + 2 * BORD, height: Ht - Hi + BORD, class: "cq-vide-bas" }));
      for (const x of [20, W - 60]) kids.push(S("rect", { x, y: Hi, width: 40, height: Ht - Hi + BORD, rx: 4, class: "cq-socle" })); }
    geo = { W, Hi, cb, zb: [], L, Hm };
    k.cols.forEach((col, i) => {
      const [a, b] = cb[i], x0 = a * W, x1 = b * W, zb = bordsZones(col);
      geo.zb.push(zb);
      const hNetCol = hNet - (col.zones.length - 1) * E / 10, sfZ = col.zones.reduce((s, z) => s + z.f, 0);
      col.zones.forEach((z, j) => {
        const [h, bas] = zb[j], y0 = h * Hi, y1 = bas * Hi;
        if (z.sous) {
          // Case partagée : chaque casier est dessiné comme une case, les portes de la case par-dessus.
          const sb = bordsSous(z);
          z.sous.forEach((sc, s) => {
            const sx0 = x0 + sb[s][0] * (x1 - x0), sx1 = x0 + sb[s][1] * (x1 - x0), zz = bordsZones(sc);
            sc.zones.forEach((sz, t) => {
              const sy0 = y0 + zz[t][0] * (y1 - y0), sy1 = y0 + zz[t][1] * (y1 - y0);
              kids.push(cellule(sz, sx0, sy0, sx1, sy1, i, j, s, t));
              if (t > 0) kids.push(S("line", { x1: sx0, y1: sy1, x2: sx1, y2: sy1, class: "cq-ligne" }));
            });
            if (s > 0) kids.push(S("rect", { x: sx0 - 5, y: y0, width: 10, height: y1 - y0, class: "cq-sep cq-sep-int" }));
          });
          if (z.portes) kids.push(portesSvg(z.portes, x0, y0, x1, y1));
        } else kids.push(cellule(z, x0, y0, x1, y1, i, j));
        kids.push(S("text", { x: x1 - 10, y: y1 - 10, class: "cq-cote", "text-anchor": "end" }, String(Math.round(hNetCol * z.f / sfZ))));
        if (j > 0) kids.push(S("line", { x1: x0, y1: y1, x2: x1, y2: y1, class: "cq-ligne" }));
      });
      if (i > 0) kids.push(S("rect", { x: x0 - 7, y: 0, width: 14, height: Hi, class: "cq-sep" }));
      kids.push(S("text", { x: (x0 + x1) / 2, y: Ht + BORD + 42, class: "cq-cote-l", "text-anchor": "middle" }, Math.round(wNet * col.f / sfC) + " cm"));
    });
    kids.push(S("path", { class: "cq-trait", d: "" }));
    svg.replaceChildren(...kids);
  }

  // Portes dessinées devant une case (ou une case partagée entière).
  function portesSvg(n, x0, y0, x1, y1) {
    const g = S("g", { class: "cq-portes" }), w = x1 - x0, h = y1 - y0, m = 10;
    for (let s = 0; s < n; s++) {
      const pw = (w - 2 * m) / n, x = x0 + m + s * pw, gauche = n === 2 ? s === 0 : false;
      g.append(S("rect", { x: x + 2, y: y0 + m, width: pw - 4, height: h - 2 * m, rx: 4, class: "cq-porte" }));
      const hx = gauche || n === 1 ? x + pw - 22 : x + 22;
      g.append(S("line", { x1: hx, y1: y0 + h / 2 - 30, x2: hx, y2: y0 + h / 2 + 30, class: "cq-poignee" }));
    }
    return g;
  }

  function cellule(z, x0, y0, x1, y1, i, j, s, t) {
    const g = S("g", { class: "cq-cell", "data-i": i, "data-j": j });
    const w = x1 - x0, h = y1 - y0, m = 10;
    g.append(S("rect", { x: x0, y: y0, width: w, height: h, class: "cq-fond" }));
    if (z.t === "etageres") for (let s = 1; s <= z.n; s++) { const y = y0 + s * h / (z.n + 1); g.append(S("line", { x1: x0 + 6, y1: y, x2: x1 - 6, y2: y, class: "cq-etagere" })); }
    if (z.t === "tiroirs") for (let s = 0; s < z.n; s++) {
      const fh = (h - 2 * m) / z.n, y = y0 + m + s * fh;
      g.append(S("rect", { x: x0 + m, y: y + 3, width: w - 2 * m, height: fh - 6, rx: 4, class: "cq-tiroir" }));
      g.append(S("line", { x1: x0 + w / 2 - Math.min(40, w / 6), y1: y + fh / 2, x2: x0 + w / 2 + Math.min(40, w / 6), y2: y + fh / 2, class: "cq-poignee" }));
    }
    if (z.t === "penderie") {
      const y = y0 + Math.min(70, h * 0.15);
      g.append(S("line", { x1: x0 + 10, y1: y, x2: x1 - 10, y2: y, class: "cq-tringle" }));
      g.append(S("text", { x: x0 + w / 2, y: y0 + h / 2 + 30, "text-anchor": "middle", class: "cq-emoji" }, "🧥"));
    }
    if (z.portes) g.append(portesSvg(z.portes, x0, y0, x1, y1));
    const nb = z.t === "etageres" || z.t === "tiroirs" ? z.n : 0;
    if (nb) { g.append(S("circle", { cx: x0 + 34, cy: y0 + 34, r: 24, class: "cq-badge" })); g.append(S("text", { x: x0 + 34, y: y0 + 43, "text-anchor": "middle", class: "cq-badge-t" }, String(nb))); }
    return g;
  }

  /* ---------- Gestes ---------- */
  const versDessin = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
  const prop = ([x, y]) => [x / geo.W, y / geo.Hi];
  // Case sous le doigt : [i, j], ou [i, j, s, t] dans un casier d'une case partagée.
  function caseSous([x, y]) {
    const px = x / geo.W, py = y / geo.Hi;
    const i = geo.cb.findIndex(([a, b]) => px >= a && px <= b); if (i < 0) return null;
    const j = geo.zb[i].findIndex(([h, bas]) => py >= h && py <= bas); if (j < 0) return null;
    const z = k.cols[i].zones[j];
    if (!z.sous) return [i, j];
    const [a, b] = geo.cb[i], [h, bas] = geo.zb[i][j], rx = (px - a) / (b - a), ry = (py - h) / (bas - h);
    const sb = bordsSous(z), s = Math.max(0, sb.findIndex(([u, v]) => rx >= u && rx <= v));
    const zz = bordsZones(z.sous[s]), t = Math.max(0, zz.findIndex(([u, v]) => ry >= u && ry <= v));
    return [i, j, s, t];
  }
  // Ligne proche du doigt (pour la déplacer) : entre colonnes, ou entre deux cases d'une colonne.
  function ligneSous([x, y]) {
    const tol = 22;
    for (let i = 0; i < geo.cb.length - 1; i++) if (Math.abs(geo.cb[i][1] * geo.W - x) < tol && y >= 0 && y <= geo.Hi) return { type: "col", i, j: 0 };
    const c = caseSous([x, y]); if (!c) return null;
    const zb = geo.zb[c[0]];
    for (let j = 0; j < zb.length - 1; j++) if (Math.abs(zb[j][0] * geo.Hi - y) < tol) return { type: "zone", i: c[0], j };
    // Lignes intérieures d'une case partagée : entre casiers, ou entre deux cases d'un casier.
    if (c.length === 4) {
      const [i, j, s] = c, z = k.cols[i].zones[j], [a, b] = geo.cb[i], [h, bas] = zb[j];
      const sb = bordsSous(z), X = u => (a + u * (b - a)) * geo.W, Y = v => (h + v * (bas - h)) * geo.Hi;
      for (let q = 0; q < sb.length - 1; q++) if (Math.abs(X(sb[q][1]) - x) < tol) return { type: "sous", i, j, s: q, t: 0 };
      const zz = bordsZones(z.sous[s]);
      for (let q = 0; q < zz.length - 1; q++) if (Math.abs(Y(zz[q][0]) - y) < tol) return { type: "souszone", i, j, s, t: q };
    }
    return null;
  }
  let geste = null;
  svg.addEventListener("pointerdown", e => {
    if (!geo) return;
    const p = versDessin(e);
    svg.setPointerCapture(e.pointerId);
    if (outil === "trait") {
      const l = ligneSous(p);
      if (l) { geste = { type: "ligne", l, avant: JSON.stringify(k) }; return; }
      geste = { type: "trait", pts: [p] };
    } else if (outil === "gomme" && ligneSous(p)) geste = { type: "gommeLigne", l: ligneSous(p) };
    else geste = { type: "outil", p0: p };
  });
  svg.addEventListener("pointermove", e => {
    if (!geste) return;
    const p = versDessin(e);
    if (geste.type === "trait") {
      geste.pts.push(p);
      svg.querySelector(".cq-trait").setAttribute("d", "M" + geste.pts.map(q => q.map(v => v.toFixed(1)).join(" ")).join(" L"));
    } else if (geste.type === "ligne") {
      const l = geste.l, [px, py] = prop(p), nk = deplacerLigne(k, l.type, l.i, l.j, l.type === "col" || l.type === "sous" ? px : py, geo.L, geo.Hm, 120, l.s, l.t);
      if (nk) { k = nk; dessiner(); }
    }
  });
  const fin = e => {
    if (!geste) return;
    const g = geste; geste = null;
    if (g.type === "ligne") { histo.push(g.avant); opts.onChange(k); return; }
    if (g.type === "gommeLigne") { if (!changer(enleverLigne(k, g.l.type, g.l.i, g.l.j, g.l.s, g.l.t))) dire("Rien à effacer ici.", true); return; }
    if (g.type === "outil") {
      const c = caseSous(g.p0);
      if (!c) return;
      if (!changer(appliquerOutil(k, c[0], c[1], outil, c[2], c[3]))) dire(outil === "gomme" ? "Il faut garder au moins une case." : "", true);
      return;
    }
    const t = lireTrait(g.pts.map(prop));
    if (!t) { dessiner(); if (g.pts.length > 3) dire("Trait pas assez droit : tracez bien de haut en bas, ou de gauche à droite.", true); return; }
    if (!changer(appliquerTrait(k, t, geo.L, geo.Hm))) { dessiner(); dire("Case trop petite (moins de 12 cm) : tracez plus loin du bord.", true); }
  };
  svg.addEventListener("pointerup", fin);
  svg.addEventListener("pointercancel", () => { geste = null; dessiner(); });

  /* ---------- Boutons ---------- */
  const barre = H("div", { class: "cq-outils", role: "toolbar", "aria-label": "Outils de dessin" });
  const majOutils = () => barre.replaceChildren(...OUTILS.map(([id, ic, nom]) => H("button", { type: "button", class: "cq-outil", "aria-pressed": String(outil === id), onclick: () => { outil = id; aide.textContent = AIDE[id]; majOutils(); } }, H("span", { class: "ic", "aria-hidden": "true" }, ic), H("span", {}, nom))));
  majOutils();
  const socleBtn = H("button", { type: "button", class: "btn" });
  // Bas du meuble : socle → pieds → rien → socle…
  const majSocle = () => { socleBtn.textContent = k.pieds ? "🦵 Sur pieds" : k.socle ? "🦶 Socle : oui" : "🦶 Socle : non"; socleBtn.setAttribute("aria-pressed", String(!!(k.socle || k.pieds))); };
  socleBtn.onclick = () => { changer(k.pieds ? { ...k, pieds: 0, socle: 0 } : k.socle ? { ...k, socle: 0, pieds: 150 } : { ...k, socle: 1, pieds: 0 }); majSocle(); };
  majSocle();
  const actions = H("div", { class: "actions cq-actions" },
    H("button", { type: "button", class: "btn", onclick: () => { const v = histo.pop(); if (v) { changer(JSON.parse(v), true); majSocle(); } else dire("Rien à annuler."); } }, "↩️ Annuler"),
    socleBtn,
    H("button", { type: "button", class: "btn", onclick: () => { changer({ socle: k.socle, cols: [{ f: 1, zones: [{ f: 1, t: "vide" }] }] }); dire("Feuille blanche : tracez vos colonnes et vos cases."); } }, "🗑️ Recommencer"));

  const zone = H("div", { class: "cq-zone" }, svg);
  const barrePhoto = H("div", { class: "actions cq-actions" });
  const majPhoto = () => {
    const ph = opts.photo && opts.photo();
    if (!opts.photo) return barrePhoto.replaceChildren();
    if (!ph) return barrePhoto.replaceChildren(H("button", { type: "button", class: "btn", onclick: () => opts.ajouterPhoto() }, "🖼️ Mettre une photo dessous"));
    barrePhoto.replaceChildren(
      H("button", { type: "button", class: "btn", "aria-pressed": String(!!ph.visible), onclick: () => { opts.onPhoto({ visible: ph.visible ? 0 : 1 }); dessiner(); majPhoto(); } }, ph.visible ? "🖼️ Photo : visible" : "🖼️ Photo : cachée"),
      H("button", { type: "button", class: "btn", onclick: () => boite.cadrer() }, "✂️ Cadrer la photo"),
      H("button", { type: "button", class: "btn", onclick: () => opts.enleverPhoto() }, "🗑️ Enlever la photo"));
  };
  const boite = H("div", { class: "croquis" }, barre, aide, zone, msg, actions, barrePhoto);
  boite.redessiner = () => { dessiner(); majPhoto(); };
  // Cadrage : le menuisier montre où est le meuble sur la photo (4 coins à glisser).
  boite.cadrer = () => {
    const ph = opts.photo && opts.photo();
    if (!ph || !ph.url) { dire("La photo est encore en chargement…"); return; }
    zone.replaceChildren(cadrage(ph, cadre => {
      zone.replaceChildren(svg);
      if (cadre) opts.onPhoto({ cadre, visible: 1 }); else { dessiner(); majPhoto(); }
    }));
    aide.textContent = "✂️ Glissez les 4 coins verts sur les bords du meuble, puis touchez « Valider ».";
  };
  majPhoto();
  dessiner();
  return boite;
}

/* Cadrer la photo : rectangle à 4 coins sur l'image. ok(cadre) avec cadre = [x0, y0, x1, y1] en proportions, ou ok(null). */
function cadrage(ph, ok) {
  let c = (ph.cadre || [0, 0, 1, 1]).slice();
  const img = H("img", { src: ph.url, alt: "Photo du meuble", class: "cad-img", draggable: "false" });
  const rect = H("div", { class: "cad-rect" });
  const coins = [0, 1, 2, 3].map(i => H("div", { class: "cad-coin", "data-i": i }));
  // Les coins dépassent de la photo : ils restent faciles à attraper au doigt, même tout au bord.
  const scene = H("div", { class: "cad-scene" }, H("div", { class: "cad-cadre" }, H("div", { class: "cad-clip" }, img, rect), ...coins));
  const placer = () => {
    rect.style.cssText = `left:${c[0] * 100}%;top:${c[1] * 100}%;width:${(c[2] - c[0]) * 100}%;height:${(c[3] - c[1]) * 100}%`;
    [[0, 1], [2, 1], [0, 3], [2, 3]].forEach(([x, y], i) => { coins[i].style.left = c[x] * 100 + "%"; coins[i].style.top = c[y] * 100 + "%"; });
  };
  let tire = null;
  scene.addEventListener("pointerdown", e => {
    const t = e.target.closest(".cad-coin"); if (!t) return;
    tire = +t.dataset.i; scene.setPointerCapture(e.pointerId); e.preventDefault();
  });
  scene.addEventListener("pointermove", e => {
    if (tire === null) return;
    const r = img.getBoundingClientRect(), x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const ix = tire % 2 ? 2 : 0, iy = tire > 1 ? 3 : 1, m = 0.05;
    c[ix] = ix === 0 ? Math.min(x, c[2] - m) : Math.max(x, c[0] + m);
    c[iy] = iy === 1 ? Math.min(y, c[3] - m) : Math.max(y, c[1] + m);
    placer();
  });
  const lacher = () => { tire = null; };
  scene.addEventListener("pointerup", lacher); scene.addEventListener("pointercancel", lacher);
  placer();
  return H("div", { class: "cad" }, scene,
    H("div", { class: "actions" },
      H("button", { type: "button", class: "btn primary", onclick: () => ok(c.map(v => Math.round(v * 1000) / 1000)) }, "✅ Valider le cadre"),
      H("button", { type: "button", class: "btn", onclick: () => { c = [0, 0, 1, 1]; placer(); } }, "🔲 Toute la photo"),
      H("button", { type: "button", class: "btn", onclick: () => ok(null) }, "↩️ Retour")));
}
