// MenuiPro — export pour CNC : SVG et DXF en millimètres, ZIP sans compression
import { SHEET, HOLE_KINDS } from "../engine/index.js";

export const HCOL = { vis: "#d1453b", tourillon: "#7a4ccf", taquet: "#1e8a4c", charniere: "#1f5fbf" };

export function sheetHoles(p){
  const T=SHEET.trim, rot=p.pw!==p.l;
  return (p.holes||[]).map(h=>({x:T+p.x+(rot?h.v:h.u),y:T+p.y+(rot?p.l-h.u:h.v),d:h.d,kind:h.kind,face:h.face,through:h.through}));
}
export const r2=n=>Math.round(n*100)/100;
export function cncSVG(sh){
  const T=SHEET.trim,o=[`<?xml version="1.0" encoding="UTF-8"?>`,`<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}">`,`<title>MenuiPro ${sh.label}</title>`];
  o.push(`<g id="FEUILLE" fill="none" stroke="#999999" stroke-width="0.5"><rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}"/></g>`);
  o.push(`<g id="DECOUPE" fill="none" stroke="#ff0000" stroke-width="0.5">`);
  sh.s.parts.forEach(p=>o.push(`<rect x="${r2(T+p.x)}" y="${r2(T+p.y)}" width="${p.pw}" height="${p.ph}"/>`));o.push(`</g>`);
  Object.entries(HOLE_KINDS).forEach(([k,[,layer]])=>{
    const hs=sh.s.parts.flatMap(sheetHoles).filter(h=>h.kind===k);if(!hs.length)return;
    o.push(`<g id="${layer}" fill="none" stroke="${HCOL[k]}" stroke-width="0.5">`);
    hs.forEach(h=>o.push(`<circle cx="${r2(h.x)}" cy="${r2(h.y)}" r="${h.d/2}" data-face="${h.through?"traversant":h.face}"/>`));o.push(`</g>`);
  });
  o.push(`<g id="ETIQUETTES" fill="#555555" font-family="Arial" font-size="24">`);
  sh.s.parts.forEach(p=>o.push(`<text x="${r2(T+p.x+12)}" y="${r2(T+p.y+34)}">${esc(p.name.replace(/ \(×2\)/,""))} ${p.pw}x${p.ph}</text>`));
  o.push(`</g></svg>`);return o.join("\n");
}
export const esc=t=>String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export const ascii=t=>String(t).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^\x20-\x7e]/g,"");
export function cncDXF(sh){
  const T=SHEET.trim,H=SHEET.h,o=["0","SECTION","2","HEADER","9","$ACADVER","1","AC1009","0","ENDSEC","0","SECTION","2","ENTITIES"];
  const line=(L,x1,y1,x2,y2)=>o.push("0","LINE","8",L,"10",r2(x1),"20",r2(H-y1),"30","0","11",r2(x2),"21",r2(H-y2),"31","0");
  const rect=(L,x,y,w,h)=>{line(L,x,y,x+w,y);line(L,x+w,y,x+w,y+h);line(L,x+w,y+h,x,y+h);line(L,x,y+h,x,y)};
  rect("FEUILLE",0,0,SHEET.w,SHEET.h);
  sh.s.parts.forEach(p=>{rect("DECOUPE",T+p.x,T+p.y,p.pw,p.ph);
    o.push("0","TEXT","8","ETIQUETTES","10",r2(T+p.x+12),"20",r2(H-(T+p.y+34)),"30","0","40","20","1",ascii(p.name.replace(/ \(×2\)/,""))+" "+p.pw+"x"+p.ph);
    sheetHoles(p).forEach(h=>o.push("0","CIRCLE","8",HOLE_KINDS[h.kind][1]+(h.through?"":"_FACE_"+h.face),"10",r2(h.x),"20",r2(H-h.y),"30","0","40",h.d/2));});
  o.push("0","ENDSEC","0","EOF");return o.join("\r\n")+"\r\n";
}
/* ZIP (sans compression) */
export const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
export function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0}
export function makeZip(files){
  const enc=new TextEncoder(),parts=[],central=[];let off=0;
  files.forEach(f=>{const name=enc.encode(f.name),data=typeof f.data==="string"?enc.encode(f.data):f.data,crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);
    parts.push(new Uint8Array(h.buffer),name,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),name);off+=30+name.length+data.length;});
  const csize=central.reduce((t,a)=>t+a.length,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(e.buffer)],{type:"application/zip"});
}
