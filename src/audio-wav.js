// Convertit une note vocale (webm, ogg ou mp4 selon le téléphone) en WAV mono 16 kHz,
// format lu par tous les services de reconnaissance (Gemini n'accepte pas le webm).
export async function versWav(blob, frequence = 16000) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || !window.OfflineAudioContext) return blob;
  const ctx = new Ctx();
  try {
    const source = await ctx.decodeAudioData(await blob.arrayBuffer());
    const n = Math.max(1, Math.ceil(source.duration * frequence));
    const hors = new OfflineAudioContext(1, n, frequence);
    const s = hors.createBufferSource(); s.buffer = source; s.connect(hors.destination); s.start();
    const rendu = await hors.startRendering();
    return encoderWav(rendu.getChannelData(0), frequence);
  } finally { ctx.close && ctx.close(); }
}

export function encoderWav(echantillons, frequence) {
  const buf = new ArrayBuffer(44 + echantillons.length * 2), v = new DataView(buf);
  const ecrire = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  ecrire(0, "RIFF"); v.setUint32(4, 36 + echantillons.length * 2, true); ecrire(8, "WAVE");
  ecrire(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, frequence, true); v.setUint32(28, frequence * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ecrire(36, "data"); v.setUint32(40, echantillons.length * 2, true);
  for (let i = 0; i < echantillons.length; i++) { const x = Math.max(-1, Math.min(1, echantillons[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([buf], { type: "audio/wav" });
}
