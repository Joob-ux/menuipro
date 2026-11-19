// MenuiPro — lecteur de QR code (carte MenuiPro, QR d'une quincaillerie).
// Caméra arrière : BarcodeDetector du navigateur s'il existe, sinon jsQR (licence Apache 2.0).
// Toujours possible aussi : prendre une photo du QR (marche sur tous les téléphones).
import jsQR from "jsqr";

const H = (t, a = {}, ...c) => { const n = document.createElement(t); for (const k in a) { if (k === "class") n.className = a[k]; else if (k.startsWith("on")) n.addEventListener(k.slice(2), a[k]); else n.setAttribute(k, a[k]); } c.forEach(x => x != null && n.append(x)); return n; };

// Lit un QR code dans une image (photo prise ou choisie).
export async function lireQRImage(fichier) {
  const img = await createImageBitmap(fichier);
  const k = Math.min(1, 1400 / Math.max(img.width, img.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, cv.width, cv.height);
  const r = jsQR(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: "attemptBoth" });
  return r ? r.data : null;
}

/* Ouvre le lecteur en plein écran. onTexte(texte) est appelé une seule fois quand un QR est lu. */
export function ouvrirScanner({ titre = "Visez le QR code", aide = "", onTexte }) {
  const video = H("video", { playsinline: "", muted: "", autoplay: "", class: "scan-video" });
  const msg = H("p", { class: "scan-msg", role: "status" }, aide);
  const photo = H("input", { type: "file", accept: "image/*", capture: "environment", hidden: "" });
  let flux = null, fini = false, detecteur = null;
  const fermer = () => { fini = true; if (flux) flux.getTracks().forEach(t => t.stop()); boite.remove(); };
  const trouve = t => { if (fini || !t) return; fermer(); onTexte(t); };
  photo.addEventListener("change", async () => {
    const f = photo.files[0]; if (!f) return;
    msg.textContent = "⏳ Lecture de la photo…";
    try { const t = await lireQRImage(f); if (t) trouve(t); else msg.textContent = "QR code pas trouvé sur la photo. Approchez-vous et reprenez la photo bien nette."; }
    catch (e) { msg.textContent = "Cette photo ne s'ouvre pas. Réessayez."; }
  });
  const boite = H("div", { class: "scanner", role: "dialog", "aria-label": titre },
    H("div", { class: "scan-tete" }, H("b", {}, titre), H("button", { type: "button", class: "btn", onclick: fermer }, "✖ Fermer")),
    H("div", { class: "scan-cadre" }, video, H("div", { class: "scan-viseur", "aria-hidden": "true" })),
    msg,
    H("div", { class: "actions" }, H("button", { type: "button", class: "btn", onclick: () => photo.click() }, "📷 Prendre une photo du QR"), photo));
  document.body.append(boite);

  const cv = document.createElement("canvas"), g = cv.getContext("2d", { willReadFrequently: true });
  const boucle = async () => {
    if (fini) return;
    if (video.readyState >= 2 && video.videoWidth) {
      try {
        if (detecteur) { const r = await detecteur.detect(video); if (r && r[0]) return trouve(r[0].rawValue); }
        else {
          const k = Math.min(1, 640 / video.videoWidth);
          cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
          g.drawImage(video, 0, 0, cv.width, cv.height);
          const r = jsQR(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: "dontInvert" });
          if (r && r.data) return trouve(r.data);
        }
      } catch (e) { /* image suivante */ }
    }
    setTimeout(() => requestAnimationFrame(boucle), 120);
  };
  (async () => {
    try {
      if ("BarcodeDetector" in window) { try { if ((await window.BarcodeDetector.getSupportedFormats()).includes("qr_code")) detecteur = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { detecteur = null; } }
      flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (fini) { flux.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = flux; await video.play().catch(() => {});
      boucle();
    } catch (e) {
      msg.textContent = "La caméra ne s'ouvre pas ici. Touchez « 📷 Prendre une photo du QR », ou ouvrez l'appareil photo du téléphone et visez le QR code.";
    }
  })();
  return { fermer };
}
