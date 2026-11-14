// MenuiPro — interface de l'application
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RECIPES, BIENTOT, buildRecipe, pack, outils, SHEET, holeLocal, HOLE_KINDS, SECTIONS_DEF, debitMassif, vueFace } from "./engine/index.js";
import { HCOL, sheetHoles, cncSVG, cncDXF, makeZip, ascii } from "./export/cnc.js";
import * as cloud from "./cloud/cloud.js";
import { PHRASES, parler, boutonVoix, chargerVoix, aUnAudio } from "./voix.js";
import { catalogueIA, validerAction, DUREE_MAX_S } from "./assistant.js";
import { MODES, modeNom, acompteDu, resume, validerPaiement, prochainNumero } from "./paiements.js";
import { DISPO, MODES_RETRAIT, reponseInitiale, totalReponse, validerReponse, dateLisible, texteReponse, cleSuivi, changements } from "./commandes.js";
import qrcode from "qrcode-generator";
import "./styles.css";

const COLORS=[["Blanc","#efefeb"],["Gris","#8b8f90"],["Noir","#2a2a2a"],["Chêne clair","#c9a36b"],["Wengé","#4a3326"]];
const ROOMS=["Tous","Bureau","Chambre","Salon","Cuisine","Boutique","Portes et autres"];
const $=id=>document.getElementById(id);
const el=(t,a={},...c)=>{const n=document.createElement(t);for(const k in a){if(k==="class")n.className=a[k];else if(k.startsWith("on"))n.addEventListener(k.slice(2),a[k]);else n.setAttribute(k,a[k])}c.flat().forEach(x=>x!=null&&n.append(x.nodeType?x:document.createTextNode(x)));return n};
const fmt=n=>Math.round(n).toLocaleString("fr-FR");
const R=id=>RECIPES.find(r=>r.id===id);

let st={id:"armoire-2",per:{},color:0,kerf:4,ep:18,panneau:"mela18",rot:true,room:null,etape:"choisir",dv:{client:"",tel:"",jours:null,pose:0},projId:null};
try{const s=JSON.parse(localStorage.getItem("menuipro-v2")||"null");if(s&&R(s.id))st={...st,...s}}catch(e){}
const save=()=>{try{localStorage.setItem("menuipro-v2",JSON.stringify(st))}catch(e){}};
function cfg(){const r=R(st.id);if(!st.per[r.id]){const o={};r.opts.forEach(x=>o[x.k]=x.def);st.per[r.id]={L:r.dims[0],H:r.dims[1],P:r.dims[2],o}}const c=st.per[r.id];r.opts.forEach(x=>{if(c.o[x.k]===undefined)c.o[x.k]=x.def});return c}

/* ----- Catalogue ----- */
let query="";
// Familles de meubles : gros boutons d'abord, puis les meubles de la famille choisie.
const FAMILLES=[["Chambre","🛏️"],["Salon","🛋️"],["Cuisine","🍳"],["Bureau","🖥️"],["Boutique","🛍️"],["Portes et autres","🚪"]];
function choisirMeuble(id){st.id=id;openState=false;sel=0;save();renderCatalog();renderControls();compute(true);setEtape("regler")}
function tuileMeuble(r){return el("button",{type:"button",class:"meuble","aria-pressed":String(r.id===st.id),onclick:()=>choisirMeuble(r.id)},el("span",{class:"e","aria-hidden":"true"},r.e),r.nom)}
function renderCatalog(){
  // st.room : null = familles, "*" = tous les meubles, sinon le nom de la famille.
  const q=query.trim().toLowerCase(),fam=st.room==="*"||(ROOMS.includes(st.room)&&st.room!=="Tous")?st.room:null;
  const liste=q?RECIPES.filter(r=>r.nom.toLowerCase().includes(q)):fam==="*"?RECIPES:fam?RECIPES.filter(r=>r.cat===fam):[];
  // Sans recherche ni famille : on montre les familles.
  const voirFamilles=!q&&!fam;
  $("familles").hidden=!voirFamilles;
  $("familles").replaceChildren(...FAMILLES.map(([nom,e])=>{const n=RECIPES.filter(r=>r.cat===nom).length;return el("button",{type:"button",class:"famille",onclick:()=>{st.room=nom;save();renderCatalog()}},el("span",{class:"e","aria-hidden":"true"},e),el("b",{},nom),el("span",{class:"nb"},n+" meubles"))}),
    el("button",{type:"button",class:"famille tous",onclick:()=>{st.room="*";save();renderCatalog()}},el("span",{class:"e","aria-hidden":"true"},"📋"),el("b",{},"Tous les meubles"),el("span",{class:"nb"},RECIPES.length)));
  $("famHead").hidden=voirFamilles;
  $("famHead").replaceChildren(...(voirFamilles?[]:[retourFamilles(),el("b",{},q?"Résultats":fam==="*"?"Tous les meubles":fam)]));
  $("meubles").replaceChildren(...liste.map(tuileMeuble));
  if(q&&!liste.length)$("meubles").append(el("p",{class:"note"},"Aucun meuble ne correspond. Essayez un autre mot."));
  $("count-tag").textContent=RECIPES.length+" meubles";
}
function retourFamilles(){return el("button",{type:"button",class:"btn",onclick:()=>{st.room=null;query="";$("search").value="";save();renderCatalog()}},"← Familles")}
$("search").addEventListener("input",e=>{query=e.target.value;renderCatalog()});

/* ----- Étapes du parcours Concevoir ----- */
const ETAPES=[["choisir","🧩","Choisir"],["regler","📏","Régler"],["voir","🧊","3D"],["acheter","🛒","Acheter"],["devis","💰","Devis"]];
function setEtape(e,sansDefil){
  if(!ETAPES.find(x=>x[0]===e))e="choisir";
  st.etape=e;save();
  document.querySelectorAll("#v-concevoir .etape").forEach(n=>n.hidden=n.dataset.etape!==e);
  $("etapes").replaceChildren(...ETAPES.map(([k,ic,l],i)=>el("button",{type:"button",class:"etp","aria-current":k===e?"step":"false",onclick:()=>setEtape(k)},el("span",{class:"ic","aria-hidden":"true"},ic),el("span",{},(i+1)+". "+l))));
  majBarPrix();
  if(!sansDefil)window.scrollTo(0,0);
}
document.querySelectorAll("[data-aller]").forEach(b=>b.addEventListener("click",()=>setEtape(b.dataset.aller)));
// Bandeau du haut : le meuble, les feuilles et le prix, visibles à chaque étape après le choix.
function majBarPrix(){
  const b=$("barPrix");if(!b)return;
  if(st.etape==="choisir"||!lastRes||!lastRes.caisson){b.hidden=true;return}
  const r=R(st.id),n18=lastRes.caisson.sheets.length,nb=lastRes.massif.sections.reduce((t,x)=>t+x.res.sheets.length,0);
  const d=devisCalc(),prix=d.prix&&!lastBuy.missing?fmt(d.prix)+" F":lastBuy.total?fmt(lastBuy.total)+" F":"prix ?";
  b.hidden=false;
  b.replaceChildren(el("div",{class:"wrap"},
    el("button",{type:"button",class:"bp-meuble",onclick:()=>setEtape("choisir"),"aria-label":"Changer de meuble"},el("span",{"aria-hidden":"true"},r.e),el("b",{},r.nom)),
    el("span",{class:"bp-val"},el("b",{},n18||nb),n18?" feuille"+(n18>1?"s":""):" barre"+(nb>1?"s":"")),
    el("span",{class:"bp-val bp-prix"},el("b",{},prix),d.prix&&!lastBuy.missing?" client":lastBuy.total?" matériel":"")));
}

/* ----- Configurateur ----- */
function renderControls(){
  const r=R(st.id),c=cfg();
  $("current").replaceChildren(el("span",{class:"e","aria-hidden":"true"},r.e),el("div",{},el("b",{},r.nom),el("div",{class:"note"},r.cat)));
  const labels=r.dimLabels||["Largeur","Hauteur","Profondeur"];
  $("dims").replaceChildren(...["L","H","P"].map((k,i)=>{const inp=el("input",{id:"d"+k,type:"number",inputmode:"numeric",min:String((r.dimMin||[10,10,10])[i]),max:"2000"});inp.value=c[k];inp.addEventListener("input",e=>{c[k]=parseFloat(e.target.value)||0;compute()});return el("div",{class:"num"},el("label",{for:"d"+k},labels[i]),inp,el("small",{},["↔","↕","⤢"][i]))}));
  $("optsLabel").hidden=!r.opts.length;
  $("opts").replaceChildren(...r.opts.map(x=>{
    if(x.choice)return el("div",{style:"display:grid;gap:6px"},el("span",{class:"name",style:"font-weight:700"},x.label),el("div",{class:"seg"},x.options.map(([v,l])=>el("button",{type:"button","aria-pressed":String(c.o[x.k]===v),onclick:()=>{c.o[x.k]=v;renderControls();compute()}},l))));
    const out=el("output",{},String(c.o[x.k]));
    const chg=d=>{c.o[x.k]=Math.max(x.min,Math.min(x.max,c.o[x.k]+d*(x.step||1)));out.textContent=c.o[x.k];compute()};
    const isBool=x.min===0&&x.max===1;
    if(isBool)return el("div",{class:"step"},el("span",{class:"name"},x.icon+" "+x.label),el("div",{class:"seg"},[[0,"Non"],[1,"Oui"]].map(([v,l])=>el("button",{type:"button","aria-pressed":String(c.o[x.k]===v),onclick:()=>{c.o[x.k]=v;renderControls();compute()}},l))));
    return el("div",{class:"step"},el("span",{class:"name"},x.icon+" "+x.label),el("div",{class:"stepper"},el("button",{type:"button","aria-label":"Moins","onclick":()=>chg(-1)},"−"),out,el("button",{type:"button","aria-label":"Plus",onclick:()=>chg(1)},"+")));
  }));
  $("swatches").replaceChildren(...COLORS.map(([n,col],i)=>el("button",{type:"button",class:"sw",title:n,"aria-label":n,"aria-pressed":String(st.color===i),style:"background:"+col,onclick:()=>{st.color=i;save();renderControls();update3D(lastCtx)}})));
  renderPanSel();$("rot").checked=st.rot;
}
function renderPanSel(){
  const opts=CAT.panneaux.filter(x=>!x.dos);
  if(!opts.find(x=>x.id===st.panneau)&&opts[0])st.panneau=opts[0].id;
  $("panSel").replaceChildren(...opts.map(x=>{const o=el("option",{value:x.id},x.nom+" "+x.ep+" mm"+(x.prix?" · "+fmt(x.prix)+" F":""));if(x.id===st.panneau)o.selected=true;return o}));
}
$("panSel").addEventListener("change",e=>{st.panneau=e.target.value;compute()});
function syncPanel(){const pn=CAT.panneaux.find(x=>x.id===st.panneau&&!x.dos)||CAT.panneaux.find(x=>!x.dos);if(pn){st.panneau=pn.id;st.ep=pn.ep}}
$("rot").addEventListener("change",e=>{st.rot=e.target.checked;compute()});

/* ----- Calcul ----- */
let sel=0,lastCtx=null,lastRes={};
function compute(refit){
  syncPanel();save();
  const r=R(st.id),c=cfg();
  const mn=r.dimMin||[10,10,10];
  if(!(c.L>=mn[0]&&c.H>=mn[1]&&c.P>=mn[2]&&st.ep>=10)){$("kpis").replaceChildren(el("p",{class:"warn"},"Entrez des cotes valides (au moins "+mn.join(" / ")+" cm)."));return}
  let ctx;
  try{ctx=buildRecipe(r.id,{L:c.L*10,H:c.H*10,P:c.P*10,ep:st.ep},c.o)}catch(e){$("kpis").replaceChildren(el("p",{class:"warn"},"Ces cotes ne permettent pas de construire ce meuble. Essayez des valeurs plus grandes."));return}
  lastCtx=ctx;
  const items={caisson:[],dos:[]};let id=0;
  ctx.parts.filter(p=>p.mat&&p.mat!=="massif").forEach(p=>{const hl=p.box?(p.holes||[]).map(h=>{const L=holeLocal(p,h);const t=[0,1,2].find(i=>i===h.axis);const face=Math.abs(h.p[t]-p.box[t])<0.6?"A":"B";return {u:L.u,v:L.v,d:h.d,kind:h.kind,face,through:h.kind==="vis"}}):[];for(let q=0;q<p.qty;q++)items[p.mat].push({id:++id,name:p.name,l:p.cut[0],w:p.cut[1],holes:hl})});
  const res={caisson:pack(items.caisson,st.kerf,st.rot),dos:pack(items.dos,st.kerf,true),massif:debitMassif(ctx.parts,sectionsBois(),st.kerf)};lastRes=res;
  const nb=res.massif.sections.reduce((t,x)=>t+x.res.sheets.length,0);
  const n18=res.caisson.sheets.length,n5=res.dos.sheets.length;
  const used=res.caisson.sheets.reduce((t,s)=>t+s.parts.reduce((u,p)=>u+p.pw*p.ph,0),0);
  const util=n18?used/(n18*SHEET.w*SHEET.h)*100:0;
  const bl=buyLines(ctx);lastBuy=bl;
  const npb=res.massif.sections.reduce((t,x)=>t+x.items.length,0);
  const k=[];
  res.massif.sections.forEach((x,i)=>k.push(el("div",{class:"kpi"+(i===0&&!n18?" main":"")},el("div",{class:"v"},x.res.sheets.length+" "+x.section.nom.toLowerCase()+(x.res.sheets.length>1?"s":"")),el("div",{class:"k"},"bois "+secTxt(x.section)))));
  if(n18||!nb)k.push(el("div",{class:"kpi"+(nb?"":" main")},el("div",{class:"v"},n18+" feuille"+(n18>1?"s":"")),el("div",{class:"k"},panLabel())));
  if(n5||!nb)k.push(el("div",{class:"kpi"},el("div",{class:"v"},n5+" feuille"+(n5>1?"s":"")),el("div",{class:"k"},"contreplaqué 5 mm"+(nb?" (parements)":" (dos, fonds)"))));
  if(n18)k.push(el("div",{class:"kpi"},el("div",{class:"v"},Math.round(util)+" %"),el("div",{class:"k"},"de la matière utilisée")));
  k.push(el("div",{class:"kpi"},el("div",{class:"v"},items.caisson.length+items.dos.length+npb),el("div",{class:"k"},"pièces à couper")));
  k.push(el("div",{class:"kpi"},el("div",{class:"v"},bl.total?fmt(bl.total):"—"),el("div",{class:"k"},bl.total?"FCFA de matériel"+(bl.missing?" (incomplet)":""):"matériel : prix à saisir")));
  const over=[...res.caisson.over,...res.dos.over],trop=res.massif.trop;
  $("kpis").replaceChildren(...k,...(over.length?[el("p",{class:"warn",style:"grid-column:1/-1"},"⚠️ Trop grand pour une feuille : "+over.map(o=>o.name+" ("+o.l+" × "+o.w+")").join(", ")+". Réduisez les cotes ou prévoyez un joint.")]:[]),
    ...(trop.length?[el("p",{class:"warn",style:"grid-column:1/-1"},"⚠️ Aucune section de bois ne convient : "+trop.map(o=>o.name+" ("+o.L+" × "+o.W+" × "+o.T+" mm)").join(", ")+". Ajoutez une section plus grosse ou plus longue dans le catalogue.")]:[]));
  renderPlan();renderFacade(ctx);renderDebit(ctx);renderKit(ctx);renderDevis();
  update3D(ctx,refit);majBarPrix();
}

let planEtat=null;
const planDebout=()=>window.innerWidth<600;
window.addEventListener("resize",()=>{if(lastRes&&planEtat!==null&&planEtat!==planDebout())renderPlan()});
function renderPlan(){
  const all=[...lastRes.caisson.sheets.map((s,i)=>({s,label:"Feuille panneau "+(i+1),dim:SHEET})),...lastRes.dos.sheets.map((s,i)=>({s,label:"Feuille 5 mm "+(i+1),dim:SHEET})),
    ...lastRes.massif.sections.map(x=>({groupes:grouperBarres(x.res.sheets),label:"🪵 "+x.section.nom+" ("+x.res.sheets.length+")",bois:x.section,dim:{w:x.section.long,h:x.section.larg,trim:0}}))];
  if(sel>=all.length)sel=0;
  $("sheetTabs").replaceChildren(...all.map((x,i)=>el("button",{type:"button",class:"btn","aria-pressed":String(i===sel),onclick:()=>{sel=i;renderPlan()}},x.label)));
  const cur=all[sel];if(!cur){$("plan").replaceChildren();$("sheetInfo").textContent="";return}
  const D=cur.dim,T=D.trim,NS="http://www.w3.org/2000/svg";
  // Sur téléphone, la feuille est dessinée debout (x ↔ y) : elle tient dans l'écran et le texte reste lisible.
  const debout=!cur.bois&&planDebout();planEtat=debout;
  const W=debout?D.h:D.w,Hs=debout?D.w:D.h,tr=(x,y,w,h)=>debout?[y,x,h,w]:[x,y,w,h];
  // Une barre de bois est très fine : on l'affiche plus haute (échelle verticale ×k) pour qu'on puisse lire les pièces.
  const ky=cur.bois?Math.max(1,Math.min(8,(D.w/4)/D.h)):1,capY=Hs*ky+60;
  const svg=document.createElementNS(NS,"svg");svg.setAttribute("viewBox",`-20 -20 ${W+40} ${capY+30}`);if(debout)svg.setAttribute("class","debout");svg.setAttribute("role","img");svg.setAttribute("aria-label","Plan de découpe, "+cur.label);
  const mk=(t,a)=>{const n=document.createElementNS(NS,t);for(const k in a)n.setAttribute(k,a[k]);return n};
  svg.append(mk("rect",{x:0,y:0,width:W,height:Hs*ky,fill:"var(--waste)",rx:6}));
  if(cur.bois){
    // Chaque ligne = une barre (ou un groupe de barres identiques « × n »).
    const hb=D.h*ky,pas=hb+150;svg.setAttribute("viewBox",`-20 -20 ${D.w+40} ${cur.groupes.length*pas+120}`);svg.replaceChildren();
    cur.groupes.forEach((gr,r)=>{
      const y0=r*pas+110;
      const lb=mk("text",{x:0,y:y0-24,"font-size":90,"font-family":"Atkinson Hyperlegible, sans-serif","font-weight":700,fill:"var(--ink)"});lb.textContent=gr.n>1?"× "+gr.n+" barres identiques":"Barre "+(r+1);svg.append(lb);
      svg.append(mk("rect",{x:0,y:y0,width:D.w,height:hb,fill:"var(--waste)",rx:6}));
      gr.s.parts.forEach(p=>{
        const g=mk("g",{}),y=y0+p.y*ky,h=p.ph*ky;
        g.append(mk("rect",{x:p.x,y,width:p.pw,height:h,fill:"var(--part)",stroke:p.lamelle?"var(--accent, var(--part-line))":"var(--part-line)","stroke-width":p.lamelle?8:4}));
        const fs=Math.max(50,Math.min(110,Math.min(p.pw/7,h/2.4)));
        const nm=p.name.replace(/^.*· /,"");
        const t1=mk("text",{x:p.x+p.pw/2,y:y+h/2-fs*.1,"text-anchor":"middle","font-size":fs,"font-family":"Atkinson Hyperlegible, sans-serif","font-weight":700,fill:"var(--ink)"});t1.textContent=nm.length>26?nm.slice(0,25)+"…":nm;
        const t2=mk("text",{x:p.x+p.pw/2,y:y+h/2+fs,"text-anchor":"middle","font-size":fs*.85,"font-family":"JetBrains Mono, monospace",fill:"var(--muted)"});t2.textContent=p.pw+" × "+p.ph;
        if(p.pw>500&&h>fs*2.2)g.append(t1,t2);else if(p.pw>300){t2.setAttribute("y",y+h/2+fs/3);g.append(t2)}
        svg.append(g);
      });
    });
    const cap=mk("text",{x:0,y:cur.groupes.length*pas+90,"font-size":70,"font-family":"JetBrains Mono, monospace",fill:"var(--muted)"});cap.textContent=cur.bois.nom+" "+secTxt(cur.bois)+" · barre de "+D.w+" mm · trait de scie "+st.kerf+" mm"+(ky>1?" · hauteur agrandie ×"+Math.round(ky):"");svg.append(cap);
    $("plan").replaceChildren(svg);
    const nbar=cur.groupes.reduce((t,g)=>t+g.n,0),np=cur.groupes.reduce((t,g)=>t+g.n*g.s.parts.length,0),used=cur.groupes.reduce((t,g)=>t+g.n*g.s.parts.reduce((u,p)=>u+p.pw,0),0);
    const nl=cur.groupes.reduce((t,g)=>t+g.n*g.s.parts.filter(p=>p.lamelle).length,0);
    $("sheetInfo").textContent=`${nbar} barre${nbar>1?"s":""} · ${np} pièces · ${Math.round(used/(nbar*D.w)*100)} % de la longueur utilisée · +20 mm de surlongueur par pièce`+(nl?` · ${nl} lames à coller (lamellé-collé, bord épais)`:"")+" · en beige : la chute.";
    $("keys").replaceChildren();return;
  }
  cur.s.parts.forEach(p=>{
    const g=mk("g",{});
    const [px,py,pw,ph]=tr(T+p.x,T+p.y,p.pw,p.ph);
    g.append(mk("rect",{x:px,y:py,width:pw,height:ph,fill:"var(--part)",stroke:"var(--part-line)","stroke-width":4}));
    let nm=p.name.replace(/ \(×2\)/,"").replace(/^.*· /,"");if(nm.length>22)nm=nm.slice(0,21)+"…";
    // Pièce longue et étroite : texte écrit dans le sens de la longueur, pour rester lisible.
    const vert=ph>pw*1.6&&pw<500,aw=vert?ph:pw,ah=vert?pw:ph,cx=px+pw/2,cy=py+ph/2;
    // Le nom doit tenir dans la pièce : on réduit la police, puis on coupe le texte si besoin.
    const fs=Math.max(24,Math.min(56,Math.min(aw,ah)/4,(aw-16)/(nm.length*0.56)));
    const maxc=Math.floor((aw-16)/(fs*0.56));if(nm.length>maxc)nm=nm.slice(0,Math.max(1,maxc-1))+"…";
    const rot=vert?{transform:`rotate(-90 ${cx} ${cy})`}:{};
    const t1=mk("text",{x:cx,y:cy,"text-anchor":"middle","font-size":fs,"font-family":"Atkinson Hyperlegible, sans-serif","font-weight":700,fill:"var(--ink)",...rot});t1.textContent=nm;
    const t2=mk("text",{x:cx,y:cy+fs*1.1,"text-anchor":"middle","font-size":fs*.85,"font-family":"JetBrains Mono, monospace",fill:"var(--muted)",...rot});t2.textContent=p.pw+" × "+p.ph;
    if(aw>300&&ah>110)g.append(t1,t2);else if(aw>140&&ah>40){t2.setAttribute("y",cy+fs/3);g.append(t2)}
    sheetHoles(p).forEach(h=>g.append(mk("circle",{cx:debout?h.y:h.x,cy:debout?h.x:h.y,r:Math.max(h.d/2,7),fill:"none",stroke:HCOL[h.kind],"stroke-width":4})));
    svg.append(g);
  });
  const cap=mk("text",{x:0,y:capY,"font-size":40,"font-family":"JetBrains Mono, monospace",fill:"var(--muted)"});cap.textContent=debout?"Feuille 2440 × 1220 · trait "+st.kerf+" mm":"Feuille 2440 × 1220 mm · cotes en mm · trait de scie "+st.kerf+" mm";svg.append(cap);
  $("plan").replaceChildren(svg);
  const used=cur.s.parts.reduce((u,p)=>u+p.pw*p.ph,0);
  const nh=cur.s.parts.reduce((t,p)=>t+(p.holes||[]).length,0);
  $("sheetInfo").textContent=`${cur.s.parts.length} pièces · ${nh} perçages · ${Math.round(used/(SHEET.w*SHEET.h)*100)} % utilisé · en beige : la chute.`;
  $("keys").replaceChildren(...Object.entries(HOLE_KINDS).map(([k,[l]])=>el("span",{style:"color:"+HCOL[k]},el("i",{}),el("span",{style:"color:var(--muted)"},l))));
}

/* ----- Export CNC (état courant) ----- */
function allSheets(){return [...lastRes.caisson.sheets.map((s,i)=>({s,label:"panneau-"+st.ep+"mm-"+(i+1),mat:"Panneau "+st.ep+" mm"})),...lastRes.dos.sheets.map((s,i)=>({s,label:"contreplaque-5mm-"+(i+1),mat:"Contreplaqué 5 mm"}))]}
function debitCSV(){
  const rows=[["Piece","Quantite","Longueur_mm","Largeur_mm","Matiere","Chant_m","Percages"]];
  lastCtx.parts.filter(p=>p.mat).forEach(p=>rows.push([p.name.replace(/ \(×2\)/,""),p.qty,p.cut[0],p.cut[1],ascii(matiere(p)),p.edge?(p.edge*p.qty/1000).toFixed(2):"0",(p.holes||[]).length]));
  return "﻿"+rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(";")).join("\r\n");
}
function slug(){return ascii(R(st.id).nom).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
async function offer(filename,data,fallbackText){
  const sEl=$("expStatus");$("expFallback").hidden=true;
  if(saveFile(filename,data)){sEl.className="status ok";sEl.textContent="✅ Fichier téléchargé : "+filename;return}
  sEl.className="status err";sEl.textContent="Le téléchargement n'a pas fonctionné. Copiez le contenu ci-dessous dans un fichier.";
  $("expFbNote").textContent="Enregistrez ce texte dans un fichier nommé "+fallbackText.name+".";$("expText").value=fallbackText.text;$("expFallback").hidden=false;$("expFallback").open=true;
}
function saveFile(filename,data){
  try{const blob=data instanceof Blob?data:new Blob([data],{type:"application/octet-stream"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);return true}
  catch(e){return false}
}
$("svgBtn").onclick=()=>{const all=allSheets(),cur=all[sel];if(!cur)return;const t=cncSVG(cur);offer(slug()+"-"+cur.label+".svg",t,{name:slug()+"-"+cur.label+".svg",text:t})};
$("zipBtn").onclick=()=>{const all=allSheets();if(!all.length)return;const files=[];
  all.forEach(sh=>{files.push({name:slug()+"/"+sh.label+".dxf",data:cncDXF(sh)},{name:slug()+"/"+sh.label+".svg",data:cncSVG(sh)})});
  files.push({name:slug()+"/liste-de-debit.csv",data:debitCSV()});
  files.push({name:slug()+"/LISEZMOI.txt",data:["MenuiPro - "+ascii(R(st.id).nom),"Feuilles "+SHEET.w+" x "+SHEET.h+" mm, bord retire "+SHEET.trim+" mm, trait de scie "+st.kerf+" mm.","Unites : millimetres. Origine : coin haut gauche de la feuille (SVG), bas gauche (DXF).","Calques : DECOUPE = contours des pieces (cotes finies, compensation de fraise a regler dans la CAO).","PERCAGE_VIS_D4 = traversant ; PERCAGE_TOURILLON_D8 prof. 15 ; PERCAGE_TAQUET_D5 prof. 12 ; PERCAGE_CHARNIERE_D35 prof. 12.","_FACE_A / _FACE_B : face a percer (A = face dessous de la piece telle que posee sur la feuille, B = face dessus). A verifier avec la machine."].join("\r\n")});
  offer(slug()+"-cnc.zip",makeZip(files),{name:all[sel]?slug()+"-"+all[sel].label+".dxf":"feuille.dxf",text:all[sel]?cncDXF(all[sel]):""});
};

function renderDebit(ctx){
  const rows=ctx.parts.filter(p=>p.mat).map(p=>el("tr",{},el("td",{},p.name.replace(/ \(×2\)/,"")),el("td",{class:"n"},String(p.qty)),el("td",{class:"n"},p.mat==="massif"?coteBois(p):p.cut[0]+" × "+p.cut[1]),el("td",{},matiere(p)),el("td",{class:"n"},p.edge?((p.edge*p.qty/1000).toFixed(2)+" m"):"—"),el("td",{class:"n"},(p.holes||[]).length?String(p.holes.length):"—")));
  $("debit").replaceChildren(el("thead",{},el("tr",{},el("th",{},"Pièce"),el("th",{},"Qté"),el("th",{},"Cotes (mm)"),el("th",{},"Matière"),el("th",{},"Chant"),el("th",{},"Perçages"))),el("tbody",{},rows));
}

/* ----- Bois massif ----- */
// Sections du catalogue (prix de la barre) ; à défaut, sections standard du moteur.
function sectionsBois(){return (CAT.sections&&CAT.sections.length?CAT.sections:SECTIONS_DEF).filter(x=>x.ep>0&&x.larg>0&&x.long>0)}
const cm=v=>String(Math.round(v)/10).replace(".",",");
const secTxt=x=>cm(x.ep)+" × "+cm(x.larg)+" cm";
function grouperBarres(sheets){const m=new Map();sheets.forEach(sh=>{const k=sh.parts.map(p=>p.pw+"x"+p.ph+p.name.replace(/[0-9]+/g,"")).join("|");if(m.has(k))m.get(k).n++;else m.set(k,{s:sh,n:1})});return [...m.values()]}
function sectionDe(p){for(const x of (lastRes.massif?lastRes.massif.sections:[]))if(x.items.some(i=>i.src===p))return x.section;return null}
function coteBois(p){const d=[p.box[3],p.box[4],p.box[5]].map(Math.round).sort((a,b)=>b-a);return d[0]+" × "+d[1]+" × "+d[2]}
function matiere(p){if(p.mat==="dos")return "Contreplaqué 5 mm";if(p.mat!=="massif")return "Panneau "+st.ep+" mm";const x=sectionDe(p);return x?"🪵 "+x.nom+" "+secTxt(x):"🪵 bois massif"}

/* ===================== CATALOGUE, PRIX, ATELIER ===================== */
const ARTICLES=[
 ["chant","🎞️","Bande de chant","m"],["vis440","🔩","Vis 4 × 40","boîte de 100",100],["vis3516","🔩","Vis 3,5 × 16","boîte de 200",200],["tourillons","🪵","Tourillons Ø8 × 35","sachet de 100",100],
 ["charn","⭕","Charnière invisible","pièce"],["charnv","⭕","Charnière pour verre","pièce"],["poignees","🚪","Poignée","pièce"],["coulisses","🗄️","Coulisses de tiroir","paire"],
 ["taquets","📌","Taquet d'étagère","pièce"],["tringle","➖","Tringle de penderie","m"],["supports","🔩","Support de tringle","pièce"],["rail","↔️","Rail coulissant","m"],
 ["galets","⚙️","Kit galets coulissants","kit"],["cuvettes","✋","Poignée cuvette","pièce"],["verre","🪟","Verre trempé","m²"],["miroir","🪞","Miroir 60 × 80","pièce"],
 ["pieds","🦵","Pied de table","pièce"],["piedsreg","🦵","Pied réglable cuisine","pièce"],["pdt","🟫","Plan de travail 38 mm","m"],["roulettes","🛞","Roulette","pièce"],
 ["lattes","🪵","Latte de lit","pièce"],["tasseaux","🪵","Tasseau bois","m"],["poutre","🪵","Traverse bois massif","m"],["equerres","📐","Équerre","pièce"],
 ["fixmur","🔩","Fixations murales","lot de 4",4],["fixhaut","🔩","Fixation meuble haut","pièce"],["pointes","🔨","Pointes","boîte de 500",500],["vasque","🚰","Vasque à poser","pièce"],
 ["paumelles","⚙️","Paumelle de porte","pièce"],["serrure","🔒","Serrure + cylindre","pièce"],["espagnolette","🔒","Espagnolette / crémone","pièce"],["pattes","🔩","Patte de scellement","pièce"],
 ["boulons","🔩","Boulon de lit 8 × 120","pièce"],["visbois","🔩","Vis à bois","boîte de 100",100],["chevilles","🔩","Cheville + vis","pièce"],["colle","🧴","Colle à bois","pot"],
 ["patins","⚪","Patin de pied","pièce"],["sangles","🧵","Sangle élastique","m"],["mousse","🟨","Mousse 10 cm","m²"],["tissu","🧶","Tissu d'ameublement","m"],
 ["led","💡","Ruban LED + alimentation","m"],["moraillon","🔒","Moraillon porte-cadenas","pièce"]];
const EX_JOUR=10000; // prix de journée d'exemple (FCFA)
const EX_PRIX={mela18:22000,mela16:20000,cp18:25000,mdf18:20000,cp5:9000,chant:300,vis440:1500,vis3516:1500,tourillons:1500,charn:750,charnv:2500,poignees:500,coulisses:2500,taquets:25,tringle:1500,supports:250,rail:3000,galets:5000,cuvettes:500,verre:15000,miroir:10000,pieds:2000,piedsreg:750,pdt:15000,roulettes:500,lattes:1000,tasseaux:750,poutre:1500,equerres:150,fixmur:1000,fixhaut:1000,pointes:1000,vasque:25000,
  paumelles:500,serrure:6000,espagnolette:3500,pattes:150,boulons:300,visbois:1500,chevilles:50,colle:2500,patins:100,sangles:500,mousse:12000,tissu:3000,led:2500,moraillon:500,
  lame:2500,latte:2000,planche:6000,chevron:5000,madrier:15000};
const DEF_CAT=()=>({boutique:{nom:"",wa:"",commune:""},exemple:false,panneaux:[{id:"mela18",nom:"Mélaminé",ep:18,prix:0},{id:"mela16",nom:"Mélaminé",ep:16,prix:0},{id:"cp18",nom:"Contreplaqué",ep:18,prix:0},{id:"mdf18",nom:"MDF",ep:18,prix:0},{id:"cp5",nom:"Contreplaqué",ep:5,prix:0,dos:true}],sections:SECTIONS_DEF.map(x=>({...x,prix:0})),prix:{}});
let CAT=DEF_CAT(),AT={nom:"",tel:"",jour:0,marge:20,valid:15};
try{const c=JSON.parse(localStorage.getItem("menuipro-catalogue")||"null");if(c&&c.panneaux)CAT={...DEF_CAT(),...c};if(!CAT.sections||!CAT.sections.length)CAT.sections=DEF_CAT().sections}catch(e){}
try{const a=JSON.parse(localStorage.getItem("menuipro-atelier")||"null");if(a)AT={...AT,...a}}catch(e){}
let ME=null; // compte connecté : {user, profil, quinc}
const saveCatLocal=()=>{try{localStorage.setItem("menuipro-catalogue",JSON.stringify(CAT))}catch(e){}};
const saveCat=()=>{saveCatLocal();pousserCatalogue()};
const saveAt=()=>{try{localStorage.setItem("menuipro-atelier",JSON.stringify(AT))}catch(e){}pousserAtelier()};
const artPrice=k=>+(CAT.prix[k]||0);
const hwArticle=k=>k.startsWith("coulisses")?"coulisses":k==="tourillons_ch"?"tourillons":k;
function panLabel(){const pn=CAT.panneaux.find(x=>x.id===st.panneau);return (pn?pn.nom+" "+pn.ep+" mm":"panneau "+st.ep+" mm")+" "+COLORS[st.color][0].toLowerCase()}
let lastBuy={lines:[],total:0,missing:0};
function buyLines(ctx){
  const {chant}=outils(ctx),L=[];
  const n18=lastRes.caisson.sheets.length,n5=lastRes.dos.sheets.length;
  const pn=CAT.panneaux.find(x=>x.id===st.panneau),dos=CAT.panneaux.find(x=>x.dos)||{prix:0};
  const add=(e,label,detail,qty,unit)=>L.push({e,label,detail,total:unit?qty*unit:null});
  if(n18)add("🟫",panLabel(),n18+" feuille"+(n18>1?"s":"")+" 244 × 122",n18,pn?pn.prix:0);
  if(n5)add("🟫","Contreplaqué 5 mm",n5+" feuille"+(n5>1?"s":"")+" (dos, fonds, parements)",n5,dos.prix);
  (lastRes.massif?lastRes.massif.sections:[]).forEach(x=>{const n=x.res.sheets.length;add("🪵",x.section.nom+" "+secTxt(x.section),n+" barre"+(n>1?"s":"")+" de "+cm(x.section.long/10)+" m",n,+x.section.prix||0)});
  if(chant>0){const m=Math.ceil(chant*1.1);add("🎞️","Bande de chant "+COLORS[st.color][0].toLowerCase(),m+" m (marge comprise)",m,artPrice("chant"))}
  const hc={};ctx.parts.forEach(p=>(p.holes||[]).forEach(h=>hc[h.kind]=(hc[h.kind]||0)+p.qty));
  const small=(ctx.hw.charn?ctx.hw.charn.qty:0)*4+Object.keys(ctx.hw).filter(k=>k.startsWith("coulisses")).reduce((t,k)=>t+ctx.hw[k].qty*8,0);
  if(hc.vis){const b=Math.ceil(hc.vis/100);add("🔩","Vis 4 × 40",hc.vis+" vis → "+b+" boîte"+(b>1?"s":"")+" de 100",b,artPrice("vis440"))}
  if(small){const b=Math.ceil(small/200);add("🔩","Vis 3,5 × 16",small+" vis (charnières, coulisses) → "+b+" boîte"+(b>1?"s":""),b,artPrice("vis3516"))}
  if(hc.tourillon){const b=Math.ceil(hc.tourillon/100);add("🪵","Tourillons Ø8 × 35 + colle",hc.tourillon+" tourillons → "+b+" sachet"+(b>1?"s":""),b,artPrice("tourillons"))}
  Object.entries(ctx.hw).forEach(([k,h])=>{
    const a=ARTICLES.find(x=>x[0]===hwArticle(k)),pack=a&&a[4];
    if(h.unit){const q=Math.ceil(h.qty*10)/10;add(h.icon,h.label,String(q).replace(".",",")+" "+h.unit,q,artPrice(hwArticle(k)))}
    else if(pack){const n=Math.ceil(h.qty),b=Math.ceil(n/pack);add(h.icon,h.label,n+" → "+b+" "+a[3],b,artPrice(hwArticle(k)))}
    else{const n=Math.ceil(h.qty);add(h.icon,h.label,n+" pièce"+(n>1?"s":""),n,artPrice(hwArticle(k)))}
  });
  L.forEach(l=>{if(l.total===0)l.total=null});
  return {lines:L,total:L.reduce((t,l)=>t+(l.total||0),0),missing:L.filter(l=>l.total==null).length,hc,n18,n5};
}
function renderKit(ctx){
  const {tools}=outils(ctx),bl=lastBuy;
  $("buy").replaceChildren(...bl.lines.map(l=>el("div",{class:"line"},el("span",{class:"e","aria-hidden":"true"},l.e),el("div",{},el("b",{},l.label),el("span",{},l.detail)),l.total!=null?el("span",{class:"pr"},fmt(l.total)+" F"):el("span",{class:"pr q"},"prix ?"))));
  $("buyTotal").textContent=bl.total?fmt(bl.total)+" FCFA":"—";
  const ban=$("buyBanner");
  if(bl.missing){ban.hidden=false;ban.replaceChildren(document.createTextNode(bl.missing+" article"+(bl.missing>1?"s":"")+" sans prix. "),el("a",{href:"#catalogue"},"Compléter le catalogue"),document.createTextNode(CAT.exemple?" · Les prix actuels sont des exemples.":""),...(!CAT.exemple&&!lectureSeule()?[el("button",{type:"button",class:"btn",style:"margin-top:8px;display:block",onclick:essayerExemple},"🧪 Essayer avec des prix d'exemple")]:[]))}
  else if(CAT.exemple){ban.hidden=false;ban.textContent="Prix d'exemple : remplacez-les par ceux de la quincaillerie (onglet Catalogue)."}
  else ban.hidden=true;
  const txt=orderText(),digits=waDigits(CAT.boutique.wa);
  $("waBtn").href="https://wa.me/"+(digits||"")+"?text="+encodeURIComponent(txt);
  $("waBtn").textContent="📲 Commander"+(CAT.boutique.nom?" chez "+CAT.boutique.nom:" sur WhatsApp");
  $("orderText").value=txt;
  if(bl.hc.tourillon)tools.push(["🪛","Mèche 8 mm + butée","tourillons, prof. 15 mm"]);
  if(bl.hc.vis)tools.push(["🪛","Mèche 4 mm + fraise","vis d'assemblage"]);
  const card=([e,b,s])=>el("div",{class:"item"},el("span",{class:"e","aria-hidden":"true"},e),el("div",{},el("b",{},b),el("span",{},s)));
  $("tools").replaceChildren(...tools.map(card));
}
const waDigits=t=>{let d=String(t||"").replace(/\D/g,"");if(d.length===9)d="221"+d;return d};
function dimsText(){const c=cfg();return c.L+" × "+c.H+" × "+c.P+" cm"}
function optsText(r=R(st.id),c=cfg()){return r.opts.map(x=>x.choice?(x.options.find(o=>o[0]===c.o[x.k])||[,""])[1]:(x.min===0&&x.max===1?(c.o[x.k]?x.label:""):c.o[x.k]+" "+(+c.o[x.k]===1?x.label.replace(/^(\S+?)s\b/,"$1"):x.label).toLowerCase())).filter(Boolean).join(" · ")}
function orderText(){
  const bl=lastBuy,r=R(st.id);
  const lines=bl.lines.map(l=>"- "+l.label+" : "+l.detail.replace(/ \(.*\)$/,""));
  return ["Bonjour"+(CAT.boutique.nom?" "+CAT.boutique.nom:"")+",","Commande pour "+r.nom.toLowerCase()+" ("+dimsText()+") :",...lines,bl.total?"Total estimé : "+fmt(bl.total)+" FCFA"+(bl.missing?" (hors articles sans prix)":""):"",(AT.nom||AT.tel)?"— "+[AT.nom,AT.tel].filter(Boolean).join(" · "):"","(calculé avec MenuiPro)"].filter(Boolean).join("\n");
}
async function copyText(text,statusEl,ta){
  try{await navigator.clipboard.writeText(text);statusEl.className="status ok";statusEl.textContent="✅ Copié. Collez-le dans WhatsApp.";ta.hidden=true}
  catch(e){ta.hidden=false;ta.value=text;ta.focus();ta.select();statusEl.className="status";statusEl.textContent="Texte sélectionné : copiez-le avec le menu du téléphone."}
}
$("copyOrder").onclick=()=>{copyText(orderText(),$("orderStatus"),$("orderText"));enregistrerCommande()};
$("waBtn").addEventListener("click",()=>enregistrerCommande());

/* ----- Devis ----- */
function estimateDays(ctx){
  const pieces=ctx.parts.filter(p=>p.mat).reduce((t,p)=>t+p.qty,0),holes=ctx.parts.reduce((t,p)=>t+(p.holes||[]).length*p.qty,0);
  const doors=ctx.parts.filter(p=>p.door).length,drawers=ctx.parts.filter(p=>p.drawer).length;
  const h=2+pieces*0.3+holes*0.02+drawers*1+doors*0.4;
  return Math.max(0.5,Math.ceil(h/8*2)/2);
}
function devisCalc(){
  const dv=st.dv,jours=dv.jours??(lastCtx?estimateDays(lastCtx):1),mat=lastBuy.total,mo=jours*(+AT.jour||0),pose=+dv.pose||0;
  const sub=mat+mo+pose,marge=sub*(+AT.marge||0)/100,prix=Math.ceil((sub+marge)/500)*500;
  return {jours,mat,mo,pose,marge,prix};
}
function renderDevis(){
  const d=devisCalc(),dv=st.dv;
  const set=(id,v)=>{const e=$(id);if(document.activeElement!==e)e.value=v};
  set("dClient",dv.client);set("dTel",dv.tel);set("dJours",d.jours);set("dPose",dv.pose||"");set("dAcompte",pctAcompte());
  const rows=[["Matériel",fmt(d.mat)+" F"+(lastBuy.missing?" (incomplet)":"")],["Main-d'œuvre : "+String(d.jours).replace(".",",")+" j × "+(AT.jour?fmt(AT.jour)+" F":"tarif à régler"),fmt(d.mo)+" F"],["Transport et pose",fmt(d.pose)+" F"],["Marge "+(AT.marge||0)+" %",fmt(d.marge)+" F"]];
  $("dBreak").replaceChildren(...rows.map(([a,b])=>el("div",{},el("span",{},a),el("span",{},b))),...(!AT.jour?[el("a",{href:"#atelier",class:"note"},"⚙️ Réglez votre prix de journée dans « Mon atelier »")]:[]));
  $("dPrix").textContent=d.prix?fmt(d.prix)+" FCFA":"—";
  const ac=acompteDu(d.prix,pctAcompte());
  $("dAcompteLigne").hidden=!ac;
  $("dAcompteLigne").replaceChildren(el("span",{},"💵 Acompte à la commande ("+pctAcompte()+" %)"),el("b",{},fmt(ac)+" F"));
  majBarPrix();
}
// Pourcentage d'acompte : celui du devis, sinon celui de l'atelier (50 % par défaut).
function pctAcompte(){return st.dv.acompte??AT.acompte??50}
[["dClient","client"],["dTel","tel"],["dJours","jours"],["dPose","pose"],["dAcompte","acompte"]].forEach(([id,k])=>$(id).addEventListener("input",e=>{const v=e.target.value;st.dv[k]=k==="jours"?(v===""?null:parseFloat(v)):k==="pose"?(parseFloat(v)||0):k==="acompte"?(v===""?null:Math.max(0,Math.min(100,parseFloat(v)||0))):v;save();renderDevis()}));
function projetCourant(){return PROJ.find(x=>x.id===st.projId)}
function devisText(){
  const d=devisCalc(),r=R(st.id),pr=projetCourant(),num=pr&&pr.fin&&pr.fin.devis,ac=acompteDu(d.prix,pctAcompte());
  return ["DEVIS"+(num?" N° "+num:"")+(AT.nom?" — "+AT.nom:""),AT.tel?"Tél. "+AT.tel:"","Date : "+new Date().toLocaleDateString("fr-FR"),st.dv.client?"Client : "+st.dv.client:"","",r.nom+" — "+dimsText(),optsText(),"Couleur : "+COLORS[st.color][0]+" · "+panLabel(),"","Prix : "+fmt(d.prix)+" FCFA",ac?"Acompte à la commande : "+fmt(ac)+" FCFA ("+pctAcompte()+" %)":"","Devis valable "+(AT.valid||15)+" jours."].filter((x,i,a)=>x!==""||a[i-1]!=="").join("\n");
}
$("dCopy").onclick=()=>copyText(devisText(),$("dStatus"),$("dText"));
function wrapText(c,t,maxW){const w=t.split(" "),out=[];let line="";w.forEach(x=>{const tt=line?line+" "+x:x;if(c.measureText(tt).width>maxW&&line){out.push(line);line=x}else line=tt});if(line)out.push(line);return out}

/* ----- Documents en image (devis, reçu, facture) ----- */
const DOC={bois:"#8a5226",vert:"#1d6b52",encre:"#2b211a",gris:"#6c5f55",creme:"#f6f0e7",vertClair:"#e2f0e9"};
const police=(w,sz)=>`${w} ${sz}px "Atkinson Hyperlegible", Arial, sans-serif`;
// En-tête commun : bandeau bois avec l'atelier, le type de document, son numéro et sa date.
function enteteDoc(c,W,titre,num,date){
  c.fillStyle="#ffffff";c.fillRect(0,0,W,c.canvas.height);
  c.fillStyle=DOC.bois;c.fillRect(0,0,W,170);
  c.fillStyle="#ffffff";c.font=police(700,52);c.fillText(AT.nom||"Mon atelier",60,90);
  c.font=police(400,30);c.fillText([AT.tel,titre+(num?" N° "+num:"")+" du "+new Date(date||Date.now()).toLocaleDateString("fr-FR")].filter(Boolean).join("  ·  "),60,140);
}
function nomFichier(prefixe,txt){return prefixe+"-"+(ascii(txt||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"client")+".png"}
// Partage l'image (WhatsApp…), sinon l'enregistre, sinon l'affiche pour un appui long.
async function partagerImage(cv,name,titre,texte,sEl,hote){
  sEl.className="status";sEl.textContent="Préparation de l'image…";
  const blob=await new Promise(res=>cv.toBlob(res,"image/png"));
  const file=new File([blob],name,{type:"image/png"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:titre,text:texte});sEl.className="status ok";sEl.textContent="✅ "+titre+" partagé.";return}catch(e){if(e&&e.name==="AbortError"){sEl.textContent="Partage annulé.";return}}}
  if(saveFile(name,blob)){sEl.className="status ok";sEl.textContent="✅ Image enregistrée : "+name+". Envoyez-la au client sur WhatsApp.";return}
  hote.querySelectorAll(".apercu-doc").forEach(n=>n.remove());
  hote.append(el("img",{class:"apercu-doc",alt:"Image : "+titre,src:cv.toDataURL("image/png"),style:"max-width:100%;border:1px solid var(--line);border-radius:12px"}));
  sEl.className="status err";sEl.textContent="Appuyez longuement sur l'image pour l'enregistrer.";
}
// Met deux images l'une sous l'autre (devis puis plan).
function empiler(a,b){const cv=document.createElement("canvas");cv.width=Math.max(a.width,b.width);cv.height=a.height+b.height;const c=cv.getContext("2d");c.fillStyle="#fff";c.fillRect(0,0,cv.width,cv.height);c.drawImage(a,0,0);c.drawImage(b,0,a.height);return cv}
$("dImg").onclick=async()=>{
  const d=devisCalc(),r=R(st.id),pr=projetCourant(),num=pr&&pr.fin&&pr.fin.devis,ac=acompteDu(d.prix,pctAcompte());
  const W=1080,H=1540,cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d");
  enteteDoc(c,W,"Devis",num);
  c.fillStyle=DOC.encre;c.font=police(700,40);c.fillText(st.dv.client?"Pour : "+st.dv.client:"Devis",60,240);
  c.fillStyle=DOC.creme;c.fillRect(60,280,W-120,640);
  if(has3D){
    const cvs=renderer.domElement;if(!cvs.width||!cvs.height){renderer.setSize(900,900,false);camera.aspect=1;camera.updateProjectionMatrix();fitCamera()}
    renderer.render(scene,camera);const img=new Image();img.src=renderer.domElement.toDataURL("image/png");await new Promise(res=>{img.onload=res;img.onerror=res});
    if(img.width){const sc=Math.min((W-120)/img.width,640/img.height),iw=img.width*sc,ih=img.height*sc;c.drawImage(img,60+(W-120-iw)/2,280+(640-ih)/2,iw,ih)}}
  c.fillStyle=DOC.encre;c.font=police(700,48);c.fillText(r.nom,60,1000);
  c.font=police(400,34);c.fillStyle=DOC.gris;let y=1050;
  [dimsText(),optsText(),"Couleur : "+COLORS[st.color][0]+" · "+panLabel()].filter(Boolean).forEach(t=>wrapText(c,t,W-120).forEach(l=>{c.fillText(l,60,y);y+=46}));
  c.fillStyle=DOC.vertClair;c.fillRect(60,y+20,W-120,ac?230:170);
  c.fillStyle=DOC.encre;c.font=police(400,32);c.fillText("Prix",90,y+75);
  c.font=police(700,76);c.fillStyle=DOC.vert;c.fillText(fmt(d.prix)+" FCFA",90,y+160);
  if(ac){c.fillStyle=DOC.encre;c.font=police(400,32);c.fillText("Acompte à la commande : "+fmt(ac)+" FCFA ("+pctAcompte()+" %)",90,y+215)}
  c.fillStyle=DOC.gris;c.font=police(400,28);c.fillText("Devis valable "+(AT.valid||15)+" jours · calculé avec MenuiPro",60,H-50);
  const plan=$("facadeDevis").checked?await imageFacade():null;
  await partagerImage(plan?empiler(cv,plan):cv,nomFichier("devis",st.dv.client||r.nom),"Devis",devisText(),$("dStatus"),$("devisPanel"));
};

/* ----- Plan de face coté ----- */
// Couleurs écrites en clair (pas de variables CSS) : le même SVG sert à l'image partagée.
const FAC={encre:"#2b211a",bois:"#8a5226",boisClair:"#f3e4d1",cote:"#1d6b52",gris:"#6c5f55"};
const STYLE_FACE={caisson:["#ffffff",FAC.encre],porte:[FAC.boisClair,FAC.bois],tiroir:[FAC.boisClair,FAC.bois],verre:["#d6e8f0","#5b8aa0"],miroir:["#a9bcc6","#5b7480"],plan:["#6c5f55",FAC.encre],metal:["#9a9a9a","#555"],massif:["#ecd6b0",FAC.bois]};
let lastFace=null;
// Construit le SVG du plan de face (texte), en millimètres, y vers le haut converti pour le SVG.
function svgFacade(v){
  const {x0,y0,x1,y1}=v.boite,c=v.cotes,L=x1-x0,H=y1-y0,big=Math.max(L,H+c.sol);
  const fs=Math.max(36,big/20),sw=Math.max(3,big/400),m=fs*4.2;
  const bas=c.sol>0?0:y0,top=y1;              // le sol est dessiné si le meuble est suspendu
  const X=x=>x-x0+m,Y=y=>top-y+m;              // repère SVG
  const W=L+2*m+(c.tiroirs.length&&c.niveaux.length>1?fs*1.6:0),Hs=top-bas+2*m+fs*1.2; // place pour une 2e chaîne à droite
  const out=[];
  const txt=(x,y,t,o={})=>out.push(`<text x="${x}" y="${y}" font-size="${o.fs||fs}" font-family="Atkinson Hyperlegible, Arial, sans-serif" font-weight="${o.gras?700:400}" fill="${o.col||FAC.cote}" text-anchor="middle"${o.rot?` transform="rotate(-90 ${x} ${y})"`:""}>${t}</text>`);
  const ligne=(xa,ya,xb,yb,col,w)=>out.push(`<line x1="${xa}" y1="${ya}" x2="${xb}" y2="${yb}" stroke="${col}" stroke-width="${w}"/>`);
  // Pièces, du fond vers l'avant
  v.rects.forEach(r=>{if(r.nature==="dos")return;const [f,s]=STYLE_FACE[r.nature]||STYLE_FACE.caisson;
    // Portes et tiroirs en transparence : on voit les étagères cotées derrière.
    const transp=r.nature==="porte"||r.nature==="tiroir"||r.nature==="verre";
    out.push(`<rect x="${X(r.x)}" y="${Y(r.y+r.h)}" width="${r.w}" height="${r.h}" fill="${f}"${transp?' fill-opacity="0.55"':""} stroke="${s}" stroke-width="${transp?sw*1.4:sw}"/>`)});
  // Sol
  if(c.sol>0){ligne(X(x0)-m*0.6,Y(0),X(x1)+m*0.6,Y(0),FAC.gris,sw*1.5);txt(X(x0)-m*0.35,Y(0)-fs*0.3,"sol",{col:FAC.gris,fs:fs*0.8})}
  // Ligne de cote horizontale (avec traits d'attache) et verticale
  const coteH=(a,b,y,t,fort)=>{const ya=Y(y);ligne(X(a),ya,X(b),ya,FAC.cote,sw);[a,b].forEach(x=>ligne(X(x),ya-fs*0.35,X(x),ya+fs*0.35,FAC.cote,sw));if(X(b)-X(a)>fs*1.6)txt((X(a)+X(b))/2,ya-fs*0.3,t,{gras:fort})};
  const coteV=(a,b,x,t,fort)=>{const xa=X(x);ligne(xa,Y(a),xa,Y(b),FAC.cote,sw);[a,b].forEach(y=>ligne(xa-fs*0.35,Y(y),xa+fs*0.35,Y(y),FAC.cote,sw));if(Y(a)-Y(b)>fs*1.6)txt(xa-fs*0.3,(Y(a)+Y(b))/2,t,{gras:fort,rot:true})};
  const bord=fs*1.5;
  // Largeur totale en bas, ouvertures entre panneaux en haut
  coteH(x0,x1,bas-bord,cm(c.largeur),true);
  if(c.colonnes.length&&!(c.colonnes.length===1&&Math.abs(c.colonnes[0].v-c.largeur)<2))c.colonnes.forEach(o=>coteH(o.a,o.b,y1+bord,cm(o.v)));
  // Hauteur totale à gauche (et hauteur au-dessus du sol), niveaux à droite
  coteV(y0,y1,x0-bord,cm(c.hauteur),true);
  if(c.sol>0)coteV(0,y0,x0-bord,cm(c.sol));
  if(c.niveaux.length>1)c.niveaux.forEach(o=>coteV(o.a,o.b,x1+bord*1.2,cm(o.v)));
  // Façades de tiroirs : deuxième chaîne, plus à droite (ou à la place des niveaux s'il n'y en a pas)
  if(c.tiroirs.length)c.tiroirs.forEach(o=>coteV(o.a,o.b,x1+bord*(c.niveaux.length>1?2.6:1.2),cm(o.v)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hs}" role="img" aria-label="Plan de face coté, cotes en centimètres">${out.join("")}</svg>`;
}
function renderFacade(ctx){
  const v=vueFace(ctx);lastFace=v;
  if(!v){$("facade").replaceChildren();$("facadeInfo").textContent="";return}
  $("facade").innerHTML=svgFacade(v);
  const c=v.cotes;
  $("facadeInfo").textContent="Cotes en cm · largeur "+cm(c.largeur)+" × hauteur "+cm(c.hauteur)+" × profondeur "+cm(c.profondeur)+" (façades comprises)"+(c.sol?" · posé à "+cm(c.sol)+" cm du sol":"")+". En haut : largeur des ouvertures ; à droite : hauteur des niveaux.";
}
// Image du plan : en-tête de l'atelier, nom du meuble, plan, profondeur.
async function imageFacade(W=1080){
  if(!lastFace)return null;
  const img=new Image(),svg=svgFacade(lastFace);
  img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
  await new Promise(res=>{img.onload=res;img.onerror=res});
  if(!img.width&&!img.naturalWidth)return null;
  const vb=svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/),ratio=vb?(+vb[2])/(+vb[1]):1;
  const iw=W-120,ih=Math.min(1100,iw*ratio),sc=Math.min(iw,ih/ratio);
  const H=170+120+sc*ratio+140,cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d");
  enteteDoc(c,W,"Plan",null);
  c.fillStyle=DOC.encre;c.font=police(700,40);c.fillText(R(st.id).nom,60,240);
  c.drawImage(img,60+(iw-sc)/2,280,sc,sc*ratio);
  const k=lastFace.cotes;c.fillStyle=DOC.gris;c.font=police(400,28);
  c.fillText("Cotes en cm · profondeur "+cm(k.profondeur)+" cm (façades comprises)"+(k.sol?" · à "+cm(k.sol)+" cm du sol":""),60,H-60);
  return cv;
}
$("facadeImg").onclick=async()=>{
  const cv=await imageFacade();const sEl=$("facadeStatus");
  if(!cv){sEl.className="status err";sEl.textContent="Le plan n'a pas pu être préparé.";return}
  await partagerImage(cv,nomFichier("plan",R(st.id).nom),"Plan","Plan de face : "+R(st.id).nom+" — "+dimsText(),sEl,$("facadePanel"));
};

/* ----- Projets ----- */
let PROJ=[];try{PROJ=JSON.parse(localStorage.getItem("menuipro-projets")||"[]")||[]}catch(e){PROJ=[]}
const saveProj=()=>{try{localStorage.setItem("menuipro-projets",JSON.stringify(PROJ));return true}catch(e){return false}};
const STATUTS=[["devis","Devis"],["commande","Commandé"],["livre","Livré"]];
// Numéro suivant (devis, facture, reçu) : compteurs gardés dans les réglages de l'atelier.
function numero(type){const n=prochainNumero(AT.num,type);AT.num=n.compteurs;saveAt();return n.num}
const finDe=pr=>(pr.fin||(pr.fin={paiements:[]}),pr.fin.paiements||(pr.fin.paiements=[]),pr.fin);
function synchroProjet(pr){if(ME)pousserProjet(pr).catch(e=>toast("En ligne : "+cloud.message(e),true))}
$("dSave").onclick=()=>{
  const d=devisCalc(),r=R(st.id);
  const data={recipe:st.id,cfg:JSON.parse(JSON.stringify(cfg())),color:st.color,panneau:st.panneau,dv:{...st.dv},prix:d.prix,materiel:lastBuy.total,nom:st.dv.client||r.nom,date:new Date().toISOString()};
  let pr=PROJ.find(x=>x.id===st.projId);
  if(pr)Object.assign(pr,data);else{pr={id:"p"+Date.now(),statut:"devis",...data};PROJ.unshift(pr);st.projId=pr.id}
  const fin=finDe(pr);if(!fin.devis)fin.devis=numero("devis");
  const ok=saveProj();save();renderDevis();
  $("dStatus").className="status "+(ok?"ok":"err");$("dStatus").textContent=ok?"✅ Devis N° "+fin.devis+" enregistré dans « Mes projets ».":"Impossible d'enregistrer sur ce téléphone.";
  if(ok&&ME)pousserProjet(pr).then(()=>{$("dStatus").textContent="✅ Devis N° "+fin.devis+" enregistré, aussi en ligne."}).catch(e=>{$("dStatus").className="status err";$("dStatus").textContent="Enregistré sur le téléphone. En ligne : "+cloud.message(e)});
};

// Description du meuble d'un projet (pour le reçu et la facture).
function descProjet(pr){
  const r=R(pr.recipe)||{nom:"Meuble",opts:[]},c=pr.cfg||{L:0,H:0,P:0,o:{}},pn=CAT.panneaux.find(x=>x.id===pr.panneau);
  return {nom:r.nom,dims:c.L+" × "+c.H+" × "+c.P+" cm",opts:r.opts?optsText(r,c):"",couleur:"Couleur : "+(COLORS[pr.color]||COLORS[0])[0]+(pn?" · "+pn.nom+" "+pn.ep+" mm":"")};
}
const dateCourte=d=>new Date(d).toLocaleDateString("fr-FR");

// Bloc « payé / reste » en bas des documents.
function blocSolde(c,W,y,pr){
  const s=resume(pr.prix,finDe(pr).paiements);
  c.fillStyle=s.solde?DOC.vertClair:"#fbeee2";c.fillRect(60,y,W-120,170);
  c.fillStyle=DOC.encre;c.font=police(400,32);c.fillText("Total "+fmt(s.total)+" F  ·  Déjà payé "+fmt(s.paye)+" F",90,y+60);
  c.font=police(700,60);c.fillStyle=s.solde?DOC.vert:DOC.bois;c.fillText(s.solde?"✓ PAYÉ":"Reste à payer : "+fmt(s.reste)+" F",90,y+135);
  return y+170;
}
function signature(c,W,H){c.strokeStyle=DOC.gris;c.lineWidth=2;c.beginPath();c.moveTo(W-460,H-150);c.lineTo(W-60,H-150);c.stroke();c.fillStyle=DOC.gris;c.font=police(400,26);c.fillText("Signature et cachet de l'atelier",W-460,H-115)}

async function recuImage(pr,pay,sEl,hote){
  const W=1080,H=1300,cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d"),ds=descProjet(pr);
  enteteDoc(c,W,"Reçu",pay.recu,pay.date);
  c.fillStyle=DOC.encre;c.font=police(700,44);c.fillText("Reçu de : "+(pr.dv&&pr.dv.client||pr.nom),60,250);
  if(pr.dv&&pr.dv.tel){c.font=police(400,30);c.fillStyle=DOC.gris;c.fillText("Tél. "+pr.dv.tel,60,295)}
  c.fillStyle=DOC.creme;c.fillRect(60,330,W-120,250);
  c.fillStyle=DOC.encre;c.font=police(400,34);c.fillText("La somme de",90,395);
  c.font=police(700,84);c.fillStyle=DOC.vert;c.fillText(fmt(pay.montant)+" FCFA",90,490);
  c.font=police(400,32);c.fillStyle=DOC.encre;c.fillText("Payé par "+modeNom(pay.mode)+", le "+dateCourte(pay.date),90,550);
  c.font=police(700,36);c.fillText("Pour : "+ds.nom,60,650);
  c.font=police(400,30);c.fillStyle=DOC.gris;let y=700;[ds.dims,ds.opts,pr.fin.devis?"Devis N° "+pr.fin.devis:""].filter(Boolean).forEach(t=>wrapText(c,t,W-120).forEach(l=>{c.fillText(l,60,y);y+=42}));
  blocSolde(c,W,y+30,pr);
  signature(c,W,H);
  const s=resume(pr.prix,pr.fin.paiements);
  const texte=["REÇU N° "+pay.recu+(AT.nom?" — "+AT.nom:""),"Reçu de "+(pr.dv&&pr.dv.client||pr.nom)+" : "+fmt(pay.montant)+" FCFA ("+modeNom(pay.mode)+", "+dateCourte(pay.date)+")","Pour : "+ds.nom+" — "+ds.dims,s.solde?"Tout est payé. Merci !":"Reste à payer : "+fmt(s.reste)+" FCFA"].join("\n");
  await partagerImage(cv,nomFichier("recu",pr.dv&&pr.dv.client||pr.nom),"Reçu",texte,sEl,hote);
}

async function factureImage(pr,sEl,hote){
  const fin=finDe(pr);
  if(!fin.facture){fin.facture={num:numero("facture"),date:new Date().toISOString()};saveProj();synchroProjet(pr)}
  const pays=fin.paiements,W=1080,H=1500+Math.max(0,pays.length-4)*46,cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d"),ds=descProjet(pr);
  enteteDoc(c,W,"Facture",fin.facture.num,fin.facture.date);
  c.fillStyle=DOC.encre;c.font=police(700,40);c.fillText("Client : "+(pr.dv&&pr.dv.client||pr.nom),60,245);
  if(pr.dv&&pr.dv.tel){c.font=police(400,30);c.fillStyle=DOC.gris;c.fillText("Tél. "+pr.dv.tel,60,290)}
  // Tableau : désignation / quantité / montant
  let y=350;c.fillStyle=DOC.creme;c.fillRect(60,y,W-120,60);
  c.fillStyle=DOC.gris;c.font=police(700,26);c.fillText("DÉSIGNATION",80,y+40);c.fillText("QTÉ",W-370,y+40);c.textAlign="right";c.fillText("MONTANT",W-80,y+40);c.textAlign="left";
  y+=110;c.fillStyle=DOC.encre;c.font=police(700,36);c.fillText(ds.nom,80,y);c.fillText("1",W-360,y);c.textAlign="right";c.fillText(fmt(pr.prix)+" F",W-80,y);c.textAlign="left";
  c.font=police(400,28);c.fillStyle=DOC.gris;y+=44;
  [ds.dims,ds.opts,ds.couleur,pr.dv&&+pr.dv.pose?"Fabrication, transport et pose compris":"Fabrication comprise"].filter(Boolean).forEach(t=>wrapText(c,t,W-520).forEach(l=>{c.fillText(l,80,y);y+=38}));
  y+=20;c.strokeStyle=DOC.gris;c.lineWidth=2;c.beginPath();c.moveTo(60,y);c.lineTo(W-60,y);c.stroke();
  y+=60;c.fillStyle=DOC.encre;c.font=police(700,40);c.fillText("Total",80,y);c.textAlign="right";c.fillText(fmt(pr.prix)+" FCFA",W-80,y);c.textAlign="left";
  // Paiements reçus
  y+=80;c.font=police(700,30);c.fillText("Paiements reçus",60,y);y+=48;c.font=police(400,28);
  if(!pays.length){c.fillStyle=DOC.gris;c.fillText("Aucun paiement pour l'instant.",60,y);y+=46}
  pays.forEach(p=>{c.fillStyle=DOC.gris;c.fillText(dateCourte(p.date)+"  ·  "+modeNom(p.mode)+(p.recu?"  ·  reçu "+p.recu:""),60,y);c.fillStyle=DOC.encre;c.textAlign="right";c.fillText(fmt(p.montant)+" F",W-80,y);c.textAlign="left";y+=46});
  blocSolde(c,W,y+20,pr);
  signature(c,W,H);
  c.fillStyle=DOC.gris;c.font=police(400,24);c.fillText(fin.devis?"Selon devis N° "+fin.devis:"",60,H-50);
  const s=resume(pr.prix,pays);
  const texte=["FACTURE N° "+fin.facture.num+(AT.nom?" — "+AT.nom:""),"Client : "+(pr.dv&&pr.dv.client||pr.nom),ds.nom+" — "+ds.dims,"Total : "+fmt(pr.prix)+" FCFA","Déjà payé : "+fmt(s.paye)+" FCFA",s.solde?"Tout est payé. Merci !":"Reste à payer : "+fmt(s.reste)+" FCFA"].join("\n");
  await partagerImage(cv,nomFichier("facture",pr.dv&&pr.dv.client||pr.nom),"Facture",texte,sEl,hote);
}

// Formulaire « Encaisser » dans la carte du projet.
function formEncaisser(pr,carte,sEl){
  const fin=finDe(pr),s=resume(pr.prix,fin.paiements);
  const propose=!s.paye?acompteDu(pr.prix,pr.dv&&pr.dv.acompte!=null?pr.dv.acompte:(AT.acompte??50))||s.reste:s.reste;
  let mode="especes";
  const inp=el("input",{type:"number",min:"0",step:"500",inputmode:"numeric","aria-label":"Montant reçu (FCFA)"});inp.value=propose||"";
  const err=el("p",{class:"status err"});
  const modes=el("div",{class:"seg",role:"group","aria-label":"Moyen de paiement"});
  const majModes=()=>modes.replaceChildren(...MODES.map(([k,ic,l])=>el("button",{type:"button","aria-pressed":String(k===mode),onclick:()=>{mode=k;majModes()}},ic+" "+l)));majModes();
  const box=el("div",{class:"encaisser"},
    el("label",{class:"label"},"Montant reçu (FCFA)"),inp,
    el("div",{class:"seg-raccourcis"},...[["Acompte",acompteDu(pr.prix,pr.dv&&pr.dv.acompte!=null?pr.dv.acompte:(AT.acompte??50))],["Tout le reste",s.reste]].filter(([,v])=>v>0).map(([l,v])=>el("button",{type:"button",class:"btn",onclick:()=>{inp.value=v;err.textContent=""}},l+" · "+fmt(v)+" F"))),
    el("label",{class:"label"},"Payé par"),modes,err,
    el("div",{class:"actions"},
      el("button",{type:"button",class:"btn primary",onclick:()=>{
        const v=validerPaiement(inp.value,mode);if(!v.ok){err.textContent=v.erreur;return}
        const pay={id:"pay"+Date.now(),date:new Date().toISOString(),montant:v.montant,mode:v.mode,recu:numero("recu")};
        fin.paiements.push(pay);if(pr.statut==="devis")pr.statut="commande";
        saveProj();synchroProjet(pr);renderProjects();
        const ns=resume(pr.prix,fin.paiements);
        toast("✅ "+fmt(pay.montant)+" F encaissés"+(ns.solde?" · tout est payé":" · reste "+fmt(ns.reste)+" F"));
      }},"✅ Valider"),
      el("button",{type:"button",class:"btn",onclick:()=>box.remove()},"Annuler")));
  inp.addEventListener("input",()=>err.textContent="");
  carte.querySelectorAll(".encaisser").forEach(n=>n.remove());
  sEl.before(box);inp.focus();
}

function renderProjects(){
  const box=$("projList");
  if(!PROJ.length){box.replaceChildren(el("div",{class:"empty",style:"grid-column:1/-1"},"Aucun projet enregistré. Concevez un meuble puis touchez « 💾 Enregistrer le projet » dans le devis."));return}
  box.replaceChildren(...PROJ.map(pr=>{
    const r=R(pr.recipe)||{e:"🪑",nom:"Meuble"},fin=finDe(pr),s=resume(pr.prix,fin.paiements);
    const si=STATUTS.findIndex(x=>x[0]===pr.statut);
    const chip=el("button",{type:"button",class:"chip "+pr.statut,title:"Changer le statut",onclick:()=>{pr.statut=STATUTS[(si+1)%3][0];saveProj();renderProjects();synchroProjet(pr)}},STATUTS[si<0?0:si][1]);
    let armed=false;const del=el("button",{type:"button",class:"btn","aria-label":"Supprimer le projet"},"🗑️");
    del.onclick=()=>{if(!armed){armed=true;del.textContent="Supprimer ?";return}PROJ=PROJ.filter(x=>x!==pr);if(st.projId===pr.id)st.projId=null;saveProj();renderProjects();if(ME&&pr.cloudId)cloud.supprimerProjet(pr.cloudId).catch(e=>toast(cloud.message(e),true))};
    const sEl=el("p",{class:"status",role:"status"});
    const carte=el("div",{class:"pcard"});
    const paiement=pr.prix?el("div",{class:"solde"},
      el("div",{class:"barre","aria-hidden":"true"},el("i",{style:"width:"+s.pct+"%"})),
      el("div",{class:"solde-txt"},s.solde?el("b",{class:"ok"},"✅ Tout est payé"):el("span",{},"Payé ",el("b",{},fmt(s.paye)+" F")," · Reste ",el("b",{class:"reste"},fmt(s.reste)+" F"))),
      ...(fin.paiements.length?[el("div",{class:"paiements"},...fin.paiements.map(p=>el("div",{class:"pay"},
        el("span",{},dateCourte(p.date)+" · "+(MODES.find(m=>m[0]===p.mode)||["","💵"])[1]+" "+modeNom(p.mode)),el("b",{},fmt(p.montant)+" F"),
        el("button",{type:"button",class:"btn mini",onclick:()=>recuImage(pr,p,sEl,carte)},"🧾 Reçu"))))]:[])):null;
    carte.append(
      el("div",{class:"top"},el("span",{class:"e","aria-hidden":"true"},r.e),el("div",{},el("h3",{},pr.nom),el("div",{class:"note"},r.nom+" · "+pr.cfg.L+" × "+pr.cfg.H+" × "+pr.cfg.P+" cm"))),
      el("div",{class:"step"},el("span",{class:"bigprice",style:"font-size:24px"},pr.prix?fmt(pr.prix)+" F":"—"),chip),
      ...(paiement?[paiement]:[]),
      el("div",{class:"note"},[fin.devis?"Devis "+fin.devis:"",fin.facture?"Facture "+fin.facture.num:"","Enregistré le "+dateCourte(pr.date)].filter(Boolean).join(" · ")),
      el("div",{class:"actions"},
        el("button",{type:"button",class:"btn primary",onclick:()=>openProject(pr)},"Ouvrir"),
        ...(pr.prix&&!s.solde?[el("button",{type:"button",class:"btn",onclick:()=>formEncaisser(pr,carte,sEl)},"💵 Encaisser")]:[]),
        ...(pr.prix?[el("button",{type:"button",class:"btn",onclick:()=>factureImage(pr,sEl,carte)},"📄 Facture")]:[]),
        del),
      sEl);
    return carte;
  }));
}
function openProject(pr){
  if(!R(pr.recipe))return;
  st.id=pr.recipe;st.per[pr.recipe]=JSON.parse(JSON.stringify(pr.cfg));st.color=pr.color;st.panneau=pr.panneau;st.dv={...pr.dv};st.projId=pr.id;openState=false;sel=0;save();
  go("concevoir");renderCatalog();renderControls();compute(true);setEtape("regler");
}
$("newProj").onclick=()=>{st.projId=null;st.dv={client:"",tel:"",jours:null,pose:0};st.room=null;save();go("concevoir");renderCatalog();renderControls();compute(true);setEtape("choisir")};

/* ----- Écran Catalogue ----- */
function renderCatalogue(){
  $("exBanner").hidden=!CAT.exemple||lectureSeule();
  [["bNom","nom"],["bWa","wa"],["bCom","commune"]].forEach(([id,k])=>$(id).value=CAT.boutique[k]||"");
  const pin=(v,on)=>{const i=el("input",{type:"number",min:"0",step:"500",inputmode:"numeric"});i.value=v||"";i.addEventListener("input",e=>{on(parseFloat(e.target.value)||0);CAT.exemple=false;saveCat();$("exBanner").hidden=true});return i};
  $("panTable").replaceChildren(el("thead",{},el("tr",{},el("th",{},"Panneau"),el("th",{},"Épaisseur"),el("th",{},"Prix (F)"),el("th",{},""))),el("tbody",{},CAT.panneaux.map(pn=>{
    const nm=el("input",{type:"text",style:"text-align:left;font-family:var(--body)"});nm.value=pn.nom;nm.addEventListener("input",e=>{pn.nom=e.target.value;saveCat()});
    const ep=el("input",{type:"number",min:"3",max:"40",style:"max-width:90px"});ep.value=pn.ep;ep.addEventListener("input",e=>{pn.ep=parseFloat(e.target.value)||pn.ep;saveCat()});
    let armed=false;const del=el("button",{type:"button",class:"btn"},"🗑️");del.onclick=()=>{if(pn.dos)return;if(!armed){armed=true;del.textContent="Sûr ?";return}CAT.panneaux=CAT.panneaux.filter(x=>x!==pn);saveCat();renderCatalogue()};
    if(pn.dos)del.disabled=true;
    return el("tr",{},el("td",{},nm,pn.dos?el("div",{class:"note"},"utilisé pour les dos et fonds"):null),el("td",{},ep),el("td",{},pin(pn.prix,v=>pn.prix=v)),el("td",{},del));
  })));
  $("secTable").replaceChildren(el("thead",{},el("tr",{},el("th",{},"Bois"),el("th",{},"Épaisseur × largeur (cm)"),el("th",{},"Longueur (cm)"),el("th",{},"Prix de la barre (F)"))),el("tbody",{},CAT.sections.map(x=>{
    const nm=el("input",{type:"text",style:"text-align:left;font-family:var(--body)"});nm.value=x.nom;nm.addEventListener("input",e=>{x.nom=e.target.value;saveCat()});
    const num=(k,w)=>{const i=el("input",{type:"number",min:"1",step:"0.5",inputmode:"decimal",style:"max-width:"+w+"px"});i.value=x[k]/10;i.addEventListener("input",e=>{const v=parseFloat(String(e.target.value).replace(",","."));if(v>0){x[k]=Math.round(v*10);saveCat()}});return i};
    return el("tr",{},el("td",{},nm),el("td",{},el("div",{class:"row",style:"gap:6px;flex-wrap:nowrap;align-items:center"},num("ep",70),"×",num("larg",70))),el("td",{},num("long",90)),el("td",{},pin(x.prix,v=>x.prix=v)));
  })));
  $("artTable").replaceChildren(el("thead",{},el("tr",{},el("th",{},"Article"),el("th",{},"Vendu par"),el("th",{},"Prix (F)"))),el("tbody",{},ARTICLES.map(([k,e,l,u])=>el("tr",{},el("td",{},e+" "+l),el("td",{},u),el("td",{},pin(CAT.prix[k],v=>CAT.prix[k]=v))))));
  const ro=lectureSeule();
  $("roBanner").hidden=!ro;if(ro)$("roBanner").textContent="🔒 Prix gérés par "+ME.quinc.nom+". Ils se mettent à jour automatiquement ; seule la quincaillerie peut les modifier.";
  $("v-catalogue").querySelectorAll("input,button").forEach(x=>{x.disabled=ro});
  $("ownBanner").hidden=!(estQuinc()&&ME.quinc);
}
[["bNom","nom"],["bWa","wa"],["bCom","commune"]].forEach(([id,k])=>$(id).addEventListener("input",e=>{CAT.boutique[k]=e.target.value;saveCat()}));
$("addPan").onclick=()=>{CAT.panneaux.splice(CAT.panneaux.length-1,0,{id:"pan"+Date.now(),nom:"Nouveau panneau",ep:18,prix:0});saveCat();renderCatalogue()};
function remplirExemple(){CAT.panneaux.forEach(pn=>{if(!pn.prix&&EX_PRIX[pn.id])pn.prix=EX_PRIX[pn.id]});CAT.sections.forEach(x=>{if(!x.prix&&EX_PRIX[x.id])x.prix=EX_PRIX[x.id]});ARTICLES.forEach(([k])=>{if(!CAT.prix[k])CAT.prix[k]=EX_PRIX[k]||0});CAT.exemple=true;saveCat();renderCatalogue()}
$("fillEx").onclick=remplirExemple;
// Depuis la liste d'achat : prix d'exemple + journée d'exemple si elle n'est pas réglée, pour voir tout de suite un devis complet.
function essayerExemple(){remplirExemple();if(!+AT.jour){AT.jour=EX_JOUR;saveAt();renderAtelier()}compute(false)}
let resetArmed=false;$("resetCat").onclick=()=>{if(!resetArmed){resetArmed=true;$("resetCat").textContent="Touchez encore pour tout remettre à zéro";return}resetArmed=false;$("resetCat").textContent="↺ Remettre les prix à zéro";CAT.panneaux.forEach(p=>p.prix=0);CAT.sections.forEach(x=>x.prix=0);CAT.prix={};CAT.exemple=false;saveCat();renderCatalogue()};

/* ----- Écran Mon atelier ----- */
function renderAtelier(){[["aNom","nom"],["aTel","tel"],["aJour","jour"],["aMarge","marge"],["aValid","valid"],["aAcompte","acompte"]].forEach(([id,k])=>$(id).value=AT[k]??(k==="acompte"?50:""));$("aKerf").value=st.kerf;
  const mode=AT.voix||"wo";
  $("aVoix").replaceChildren(...[["wo","🇸🇳 Wolof"],["fr","🇫🇷 Français"],["non","🔇 Aucune"]].map(([k,l])=>el("button",{type:"button","aria-pressed":String(mode===k),onclick:()=>{AT.voix=k;saveAt();appliquerVoix();renderAtelier();if(k!=="non")parler("atelier")}},l)));
}
/* ----- Guide vocal ----- */
function appliquerVoix(){document.body.classList.toggle("sans-voix",(AT.voix||"wo")==="non")}
document.querySelectorAll("[data-voix]").forEach(n=>n.append(boutonVoix(n.dataset.voix,el)));
appliquerVoix();chargerVoix();
[["aNom","nom"],["aTel","tel"],["aJour","jour"],["aMarge","marge"],["aValid","valid"],["aAcompte","acompte"]].forEach(([id,k])=>$(id).addEventListener("input",e=>{AT[k]=["jour","marge","valid","acompte"].includes(k)?(parseFloat(e.target.value)||0):e.target.value;saveAt()}));
$("aKerf").addEventListener("input",e=>{st.kerf=parseFloat(e.target.value)||0;save()});

/* ----- Navigation ----- */
// [vue, icône, libellé, libellé court (téléphone)]
const VIEWS=[["concevoir","🪚","Concevoir","Concevoir"],["projets","📁","Mes projets","Projets"],["catalogue","🏪","Catalogue & prix","Prix"],["atelier","⚙️","Mon atelier","Atelier"],["compte","👤","Compte","Compte"]];
function go(v){if(location.hash!=="#"+v){try{history.replaceState(null,"","#"+v)}catch(e){location.hash=v}}show(v)}
function show(v){
  if(!VIEWS.find(x=>x[0]===v))v="concevoir";
  VIEWS.forEach(([k])=>$("v-"+k).hidden=k!==v);
  $("appnav").replaceChildren(...VIEWS.map(([k,ic,l,c])=>el("button",{type:"button",class:"navbtn","aria-current":k===v?"page":"false","aria-label":l,onclick:()=>go(k)},el("span",{class:"ic","aria-hidden":"true"},ic),el("span",{class:"long"},l),el("span",{class:"court","aria-hidden":"true"},c))));
  majPastille();
  if(v==="projets")renderProjects();
  if(v==="catalogue")renderCatalogue();
  if(v==="atelier")renderAtelier();
  if(v==="compte")renderCompte();
  if(v==="concevoir"&&lastCtx){renderPanSel();compute()}
  if(v==="concevoir")setEtape(st.etape,true);
  document.body.classList.toggle("avec-etapes",v==="concevoir");
  majNavH();
  window.scrollTo(0,0);
}
// Hauteur de la barre d'onglets : le bandeau prix se colle juste dessous.
function majNavH(){const n=document.querySelector("nav.appnav");if(n)document.documentElement.style.setProperty("--nav-h",n.offsetHeight+"px")}
window.addEventListener("resize",majNavH);
window.addEventListener("hashchange",()=>show(location.hash.slice(1)));

/* ----- 3D ----- */
let renderer,scene,camera,controls,group,openState=false,movers=[],has3D=false,showHoles=false,markers=[];
function init3D(){
  const host=$("view3d");
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true})}catch(e){host.append(el("div",{class:"nogl"},"La 3D n'est pas disponible sur cet appareil."));return false}
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  host.prepend(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(35,1,0.01,80);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8a7f70,0.9));
  const d=new THREE.DirectionalLight(0xffffff,0.7);d.position.set(2,3,4);scene.add(d);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
  new ResizeObserver(resize).observe(host);resize();
  const loop=()=>{requestAnimationFrame(loop);
    movers.forEach(m=>{if(m.userData.kind==="door")m.rotation.y+=(m.userData.target-m.rotation.y)*0.15;else{const a=m.userData.axis;m.position[a]+=(m.userData.target-m.position[a])*0.15}});
    controls.update();renderer.render(scene,camera)};loop();
  return true;
}
let bbox={size:[1,1,1]};
function fitCamera(){const [sx,sy,sz]=bbox.size,r=Math.max(sx,sy,sz);camera.position.set(r*1.2,sy*0.75+r*0.45,r*1.9);controls.target.set(0,sy/2,0);controls.update()}
function update3D(ctx,refit){
  if(!has3D||!ctx)return;
  if(group)scene.remove(group);
  group=new THREE.Group();movers=[];markers=[];
  const col=new THREE.Color(COLORS[st.color][1]);
  const M={
    case:new THREE.MeshStandardMaterial({color:col,roughness:0.6}),
    back:new THREE.MeshStandardMaterial({color:0xb89870,roughness:0.85}),
    glass:new THREE.MeshStandardMaterial({color:0x9fd3e8,roughness:0.05,metalness:0.1,transparent:true,opacity:0.35}),
    mirror:new THREE.MeshStandardMaterial({color:0xdfe7ea,roughness:0.05,metalness:0.9}),
    metal:new THREE.MeshStandardMaterial({color:0x9a9fa3,roughness:0.35,metalness:0.7}),
    massif:new THREE.MeshStandardMaterial({color:0xb7874f,roughness:0.75}),
    top:new THREE.MeshStandardMaterial({color:0x6b6560,roughness:0.5})
  };
  const lineMat=new THREE.LineBasicMaterial({color:st.color===2||st.color===4?0x888888:0x333333,transparent:true,opacity:0.3});
  const boxes=ctx.parts.filter(p=>p.box);
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  boxes.forEach(p=>{for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],p.box[i]);mx[i]=Math.max(mx[i],p.box[i]+p.box[i+3])}});
  const cx=(mn[0]+mx[0])/2000,cz=(mn[2]+mx[2])/2000;
  bbox.size=[(mx[0]-mn[0])/1000,(mx[1]-mn[1])/1000,(mx[2]-mn[2])/1000];
  boxes.forEach(p=>{
    const [x,y,z,sx,sy,sz]=p.box.map(v=>v/1000);
    const geo=new THREE.BoxGeometry(sx,sy,sz);
    const mesh=new THREE.Mesh(geo,M[p.look]||M.case);
    if(p.look!=="glass")mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),lineMat));
    const px=x+sx/2-cx,py=y+sy/2,pz=z+sz/2-cz;
    (p.holes||[]).forEach(h=>{
      const r=Math.max(h.d/2,4)/1000, g=new THREE.CylinderGeometry(r,r,0.003,16);
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:HCOL[h.kind]}));
      const inside=Math.abs(h.p[h.axis]-p.box[h.axis])<0.6?-1:1;
      const lp=[h.p[0]/1000-(x+sx/2),h.p[1]/1000-(y+sy/2),h.p[2]/1000-(z+sz/2)];
      lp[h.axis]+=inside*0.0016;
      m.position.set(lp[0],lp[1],lp[2]);
      if(h.axis===0)m.rotation.z=Math.PI/2;else if(h.axis===2)m.rotation.x=Math.PI/2;
      m.visible=showHoles;m.userData.marker=true;mesh.add(m);markers.push(m);
    });
    if(p.door){
      const pivot=new THREE.Group();const hx=(p.hingeLeft?x:x+sx)-cx;
      pivot.position.set(hx,0,pz);mesh.position.set(px-hx,py,0);
      pivot.userData={kind:"door",open:p.hingeLeft?-1.3:1.3,target:openState?(p.hingeLeft?-1.3:1.3):0};
      pivot.add(mesh);group.add(pivot);movers.push(pivot);
    }else{
      mesh.position.set(px,py,pz);
      if(p.drawer){const a=p.axis||"z",dir=p.dir||1,base=a==="x"?px:pz;mesh.userData={kind:"slide",axis:a,base,open:base+dir*(p.travel||300)/1000,target:base};if(openState)mesh.userData.target=mesh.userData.open;movers.push(mesh)}
      if(p.slide){const base=px;mesh.userData={kind:"slide",axis:"x",base,open:base+p.slide*(p.travel||400)/1000,target:openState?base+p.slide*(p.travel||400)/1000:base};movers.push(mesh)}
      group.add(mesh);
    }
  });
  scene.add(group);
  $("openBtn").hidden=!movers.length;$("hint3d").hidden=!movers.length;
  if(refit)fitCamera();
}
$("openBtn").onclick=()=>{openState=!openState;$("openBtn").setAttribute("aria-pressed",String(openState));$("openBtn").textContent=openState?"🚪 Fermer":"🚪 Ouvrir";
  movers.forEach(m=>{m.userData.target=openState?m.userData.open:(m.userData.kind==="door"?0:m.userData.base)})};
$("resetCam").onclick=()=>has3D&&fitCamera();
$("holesBtn").onclick=()=>{showHoles=!showHoles;$("holesBtn").setAttribute("aria-pressed",String(showHoles));markers.forEach(m=>m.visible=showHoles)};
function setupTap(){
  if(!has3D)return;
  const cv=renderer.domElement,ray=new THREE.Raycaster(),v=new THREE.Vector2();let down=null;
  cv.addEventListener("pointerdown",e=>{down=[e.clientX,e.clientY]});
  cv.addEventListener("pointerup",e=>{
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;down=null;
    const r=cv.getBoundingClientRect();v.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
    ray.setFromCamera(v,camera);
    const hits=ray.intersectObjects(group.children,true).filter(h=>h.object.isMesh&&!h.object.userData.marker);
    for(const h of hits){let o=h.object;while(o&&!movers.includes(o))o=o.parent;
      if(o){const isOpen=Math.abs(o.userData.target-o.userData.open)<1e-6;o.userData.target=isOpen?(o.userData.kind==="door"?0:o.userData.base):o.userData.open;$("hint3d").hidden=true;return}
      break;}
  });
}

/* ----- Invitation d'une quincaillerie (lien ?invite=CODE) ----- */
const lienInvitation=code=>location.origin+"/?invite="+encodeURIComponent(code);
let INVITE=null;try{INVITE=localStorage.getItem("menuipro-invitation")}catch(e){}
// Le lien ouvre l'appli sur « Compte » ; le code est gardé jusqu'à la connexion.
(function lireInvitation(){
  try{const u=new URL(location.href),c=(u.searchParams.get("invite")||"").trim().toUpperCase();
    if(!/^[0-9A-Z]{6}$/.test(c))return;
    INVITE=c;try{localStorage.setItem("menuipro-invitation",c)}catch(e){}
    u.searchParams.delete("invite");history.replaceState(null,"",u.pathname+u.search+"#compte");
  }catch(e){}
})();
function oublierInvitation(){INVITE=null;try{localStorage.removeItem("menuipro-invitation")}catch(e){}}
// Après la connexion : rattachement automatique (ou question si déjà rattaché ailleurs).
let invitationEnCours=false;
async function traiterInvitation(){
  if(!INVITE||!ME||invitationEnCours)return;
  if(estQuinc()||estAdmin()){oublierInvitation();toast("Ce lien d'invitation est fait pour les menuisiers.",true);return}
  if(ME.quinc&&ME.quinc.code===INVITE){oublierInvitation();return}
  if(ME.quinc)return; // déjà rattaché à une autre : on demande dans l'écran Compte
  invitationEnCours=true;
  try{const r=await cloud.rejoindre(INVITE);oublierInvitation();ME=await cloud.chargerCompte();appliquerCompte();toast("✅ Vous êtes rattaché à "+r.nom+" : ses prix sont dans vos listes d'achat");if(!$("v-compte").hidden)renderCompte()}
  catch(e){oublierInvitation();toast(cloud.message(e),true)}
  finally{invitationEnCours=false}
}
// Bandeau en haut de l'écran Compte quand une invitation attend.
async function bandeauInvitation(){
  if(!INVITE||!cloud.actif)return null;
  let a=null;try{a=await cloud.apercuInvitation(INVITE)}catch(e){}
  if(!a){oublierInvitation();return el("div",{class:"banner"},"Ce lien d'invitation n'est plus valable. Demandez un nouveau lien à votre quincaillerie.")}
  const nom=a.nom+(a.commune?" ("+a.commune+")":"");
  if(!ME)return el("section",{class:"panel invitation"},el("div",{class:"inv-ic","aria-hidden":"true"},"🏪"),el("div",{},el("b",{},nom+" vous invite"),el("p",{class:"note"},"Connectez-vous ou créez votre compte ci-dessous : vous serez rattaché automatiquement et vous verrez ses prix.")));
  if(ME.quinc&&ME.quinc.code!==INVITE&&!estQuinc())return el("section",{class:"panel invitation"},el("div",{class:"inv-ic","aria-hidden":"true"},"🏪"),
    el("div",{},el("b",{},nom+" vous invite"),el("p",{class:"note"},"Vous êtes rattaché à "+ME.quinc.nom+". Changer de quincaillerie ?"),
      el("div",{class:"actions"},el("button",{type:"button",class:"btn primary",onclick:async()=>{try{const r=await cloud.rejoindre(INVITE);oublierInvitation();ME=await cloud.chargerCompte();appliquerCompte();toast("✅ Vous êtes rattaché à "+r.nom);renderCompte()}catch(e){toast(cloud.message(e),true)}}},"Oui, changer"),
        el("button",{type:"button",class:"btn",onclick:()=>{oublierInvitation();renderCompte()}},"Non, garder "+ME.quinc.nom))));
  return null;
}
// QR code du lien (bibliothèque qrcode-generator, licence MIT).
function qrSvg(texte){const q=qrcode(0,"M");q.addData(texte);q.make();return q.createSvgTag({cellSize:6,margin:2,scalable:true})}
function panneauInviter(q){
  const lien=lienInvitation(q.code),msg="Bonjour, c'est "+q.nom+(q.commune?" ("+q.commune+")":"")+". Pour voir mes prix et me commander vos matériaux depuis MenuiPro, ouvrez ce lien : "+lien;
  const qr=el("div",{class:"qr",role:"img","aria-label":"QR code du lien d'invitation"});qr.innerHTML=qrSvg(lien);
  const st=el("p",{class:"status",role:"status"});
  return el("section",{class:"panel"},el("h2",{},"📲 Inviter mes menuisiers"),
    el("p",{class:"note"},"Envoyez ce lien sur WhatsApp, ou faites scanner le QR code au comptoir. Le menuisier est rattaché tout seul : plus de code à recopier."),
    qr,
    el("div",{class:"actions"},
      el("a",{class:"btn primary",href:"https://wa.me/?text="+encodeURIComponent(msg),target:"_blank",rel:"noopener"},"📲 Envoyer sur WhatsApp"),
      el("button",{type:"button",class:"btn",onclick:async()=>{try{await navigator.clipboard.writeText(lien);st.className="status ok";st.textContent="✅ Lien copié"}catch(e){st.className="status";st.textContent=lien}}},"🔗 Copier le lien")),
    st);
}

/* ----- Commandes : réponse de la quincaillerie ----- */
const STAT_FLUX=["prete","livree"];
function ligneArticles(c){
  const rep=c.reponse;
  return el("ul",{class:"cmd-lignes"},...(c.lignes||[]).map((l,i)=>{const r=rep&&rep.lignes&&rep.lignes.find(x=>x.i===i);
    return el("li",{class:r&&r.dispo==="non"?"barre-txt":""},el("span",{"aria-hidden":"true"},r?DISPO[r.dispo][0]+" ":"• "),el("b",{},l.article),
      " · "+l.detail,r&&r.remplacement?el("span",{class:"rempl"}," → "+r.remplacement):"",
      r?(r.dispo==="non"?el("span",{class:"pr-ligne"},"pas dispo"):el("span",{class:"pr-ligne"},fmt(r.prix)+" F")):(l.total!=null?el("span",{class:"pr-ligne estime"},"~"+fmt(l.total)+" F"):""))}));
}
function resumeReponse(c){
  const r=c.reponse;if(!r)return null;
  const m=MODES_RETRAIT[r.mode]||MODES_RETRAIT.retrait,ecart=c.total&&r.total!==c.total;
  return el("div",{class:"cmd-rep"},
    el("div",{class:"cmd-total"},el("span",{},"Total confirmé"),el("b",{},fmt(r.total)+" F")),
    ecart?el("div",{class:"note"},"Estimé au départ : "+fmt(c.total)+" F"):null,
    el("div",{},m[0]+" "+m[1]+(r.date?" · "+dateLisible(r.date):"")),
    r.message?el("div",{class:"cmd-msg"},"💬 "+r.message):null);
}
// Carte d'une commande reçue (écran de la quincaillerie)
function carteCommandeRecue(c){
  const carte=el("div",{class:"cmd"});
  const dessiner=()=>{
    const s=STAT_CMD[c.statut]||STAT_CMD.envoyee,tel=c.profils&&c.profils.telephone;
    const who=c.profils?(c.profils.nom||"Menuisier")+(tel?" · "+tel:""):"Menuisier";
    const statuts=el("div",{class:"seg"},...STAT_FLUX.map(k=>el("button",{type:"button","aria-pressed":String(c.statut===k),onclick:async()=>{try{await cloud.changerStatut(c.id,k);c.statut=k;dessiner()}catch(e){toast(cloud.message(e),true)}}},STAT_CMD[k][0]+" "+STAT_CMD[k][1])));
    carte.replaceChildren(
      el("div",{class:"cmd-top"},el("span",{class:"e","aria-hidden":"true"},s[0]),el("div",{},el("b",{},c.meuble),el("div",{class:"note"},who+" · "+new Date(c.created_at).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"}))),el("span",{class:"chip "+c.statut},s[1])),
      ligneArticles(c),
      resumeReponse(c)||el("div",{class:"note"},c.total?"Estimé par le menuisier : "+fmt(c.total)+" F":""),
      el("div",{class:"actions"},
        el("button",{type:"button",class:c.reponse?"btn":"btn primary",onclick:()=>formReponse(c,carte,dessiner)},c.reponse?"✏️ Modifier la réponse":"✍️ Répondre"),
        tel&&c.reponse?el("a",{class:"btn",href:"https://wa.me/"+waDigits(tel)+"?text="+encodeURIComponent(texteReponse(c,c.reponse,ME.quinc&&ME.quinc.nom)),target:"_blank",rel:"noopener"},"📲 Prévenir sur WhatsApp"):null),
      c.reponse?statuts:null);
  };
  dessiner();return carte;
}
// Formulaire de réponse : chaque article disponible / remplacé / pas dispo, prix réel, retrait ou livraison, date.
function formReponse(c,carte,redessiner){
  if(c.statut==="envoyee"){cloud.changerStatut(c.id,"vue").then(()=>{c.statut="vue"}).catch(()=>{})}
  const rep=reponseInitiale(c.lignes||[],c.reponse);
  const err=el("p",{class:"status err",role:"alert"}),total=el("b",{});
  const majTotal=()=>{total.textContent=fmt(totalReponse(rep))+" F"};
  const lignes=(c.lignes||[]).map((l,i)=>{
    const r=rep.lignes[i];
    const prix=el("input",{type:"number",min:"0",step:"500",inputmode:"numeric","aria-label":"Prix : "+l.article});prix.value=r.prix??"";
    prix.addEventListener("input",()=>{r.prix=prix.value;err.textContent="";majTotal()});
    const rempl=el("input",{type:"text",maxlength:"80",placeholder:"Remplacé par…","aria-label":"Remplacé par"});rempl.value=r.remplacement||"";
    rempl.addEventListener("input",()=>{r.remplacement=rempl.value;err.textContent=""});
    const seg=el("div",{class:"seg dispo"});
    const maj=()=>{seg.replaceChildren(...Object.entries(DISPO).map(([k,[ic,lb]])=>el("button",{type:"button","aria-pressed":String(r.dispo===k),title:lb,onclick:()=>{r.dispo=k;err.textContent="";maj();majTotal()}},el("span",{class:"ic","aria-hidden":"true"},ic),el("span",{},lb))));
      rempl.hidden=r.dispo!=="remplace";prix.disabled=r.dispo==="non"};
    maj();
    return el("div",{class:"rep-ligne"},el("div",{},el("b",{},l.article),el("span",{class:"note"}," · "+l.detail)),seg,el("div",{class:"rep-prix"},rempl,el("label",{class:"prix-f"},prix," F")));
  });
  const modes=el("div",{class:"seg"});
  const majModes=()=>modes.replaceChildren(...Object.entries(MODES_RETRAIT).map(([k,[ic,lb]])=>el("button",{type:"button","aria-pressed":String(rep.mode===k),onclick:()=>{rep.mode=k;majModes()}},ic+" "+lb)));majModes();
  const jour=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10)};
  const date=el("input",{type:"date","aria-label":"Date"});date.value=rep.date;
  const dates=el("div",{class:"seg"});
  const majDates=()=>dates.replaceChildren(...[["Aujourd'hui",0],["Demain",1],["Après-demain",2]].map(([lb,d])=>el("button",{type:"button","aria-pressed":String(rep.date===jour(d)),onclick:()=>{rep.date=jour(d);date.value=rep.date;majDates()}},lb)),date);
  date.addEventListener("change",()=>{rep.date=date.value;majDates()});majDates();
  const msg=el("textarea",{maxlength:"300",rows:"2",placeholder:"Message (facultatif) : ex. le blanc est fini, j'ai le chêne."});msg.value=rep.message;msg.addEventListener("input",()=>{rep.message=msg.value});
  majTotal();
  const envoyer=el("button",{type:"button",class:"btn primary"},"📤 Envoyer la réponse");
  envoyer.onclick=async()=>{
    const v=validerReponse(rep,(c.lignes||[]).length);if(!v.ok){err.textContent=v.erreur;return}
    envoyer.disabled=true;envoyer.textContent="⏳ Envoi…";
    try{await cloud.repondreCommande(c.id,v.reponse,["prete","livree"].includes(c.statut)?c.statut:"confirmee");
      c.reponse=v.reponse;if(!["prete","livree"].includes(c.statut))c.statut="confirmee";redessiner();
      toast("✅ Réponse envoyée. Touchez « Prévenir sur WhatsApp » pour lui écrire.")}
    catch(e){err.textContent=cloud.message(e);envoyer.disabled=false;envoyer.textContent="📤 Envoyer la réponse"}
  };
  carte.querySelectorAll(".rep-form").forEach(n=>n.remove());
  carte.append(el("div",{class:"rep-form"},el("div",{class:"label"},"Pour chaque article"),...lignes,
    el("div",{class:"label"},"Le menuisier vient chercher ou vous livrez ?"),modes,
    el("div",{class:"label"},"Prêt pour quand ?"),dates,msg,
    el("div",{class:"cmd-total"},el("span",{},"Total confirmé"),total),err,
    el("div",{class:"actions"},envoyer,el("button",{type:"button",class:"btn",onclick:()=>carte.querySelector(".rep-form").remove()},"Annuler"))));
}
// Carte d'une commande envoyée (écran du menuisier)
function carteCommandeMenuisier(c){
  const s=STAT_CMD[c.statut]||STAT_CMD.envoyee,q=ME&&ME.quinc,wa=q&&waDigits(q.whatsapp);
  return el("div",{class:"cmd"+(c.reponse?" repondue":"")},
    el("div",{class:"cmd-top"},el("span",{class:"e","aria-hidden":"true"},s[0]),el("div",{},el("b",{},c.meuble),el("div",{class:"note"},new Date(c.created_at).toLocaleDateString("fr-FR")+(c.total?" · estimé "+fmt(c.total)+" F":""))),el("span",{class:"chip "+c.statut},s[1])),
    c.reponse?ligneArticles(c):null,
    resumeReponse(c)||el("div",{class:"note"},c.statut==="envoyee"?"⏳ En attente de la réponse de "+(q?q.nom:"la quincaillerie")+".":"👀 "+(q?q.nom:"La quincaillerie")+" a vu votre commande."),
    wa?el("div",{class:"actions"},el("a",{class:"btn",href:"https://wa.me/"+wa+"?text="+encodeURIComponent("Bonjour, à propos de ma commande « "+c.meuble+" » : "),target:"_blank",rel:"noopener"},"📲 Écrire à "+q.nom)):null);
}

/* ----- Prévenir le menuisier quand sa quincaillerie répond ----- */
let ALERTES=0;const DEJA_ANNONCE=new Set();
const lireVu=()=>{try{return JSON.parse(localStorage.getItem("menuipro-cmd-vu")||"{}")||{}}catch(e){return {}}};
const ecrireVu=v=>{try{localStorage.setItem("menuipro-cmd-vu",JSON.stringify(v))}catch(e){}};
function majPastille(){const b=document.querySelector('.navbtn[aria-label="Compte"]');if(!b)return;b.querySelectorAll(".pastille").forEach(n=>n.remove());if(ALERTES)b.append(el("span",{class:"pastille","aria-label":ALERTES+" nouvelle(s) réponse(s)"},String(ALERTES)))}
async function verifierCommandes(){
  if(!cloud.actif||!ME||!ME.quinc||estQuinc()||estAdmin())return;
  let rows;try{rows=await cloud.mesCommandes(ME.user.id)}catch(e){return}
  // Les commandes nouvelles ou changées restent « non vues » jusqu'à l'ouverture de Compte ; les autres sont mémorisées.
  const vu=lireVu(),neuf=changements(rows,vu);
  rows.forEach(c=>{if(!vu[c.id]&&!neuf.includes(c))vu[c.id]=cleSuivi(c)});
  ecrireVu(vu);
  ALERTES=neuf.length;majPastille();
  const aAnnoncer=neuf.filter(c=>!DEJA_ANNONCE.has(c.id+cleSuivi(c)));aAnnoncer.forEach(c=>DEJA_ANNONCE.add(c.id+cleSuivi(c)));
  if(aAnnoncer.length){const c=aAnnoncer[0],r=c.reponse,m=r&&MODES_RETRAIT[r.mode],neuf=aAnnoncer;
    toast("📦 "+ME.quinc.nom+" : "+(c.statut==="prete"?"votre commande est prête":c.statut==="livree"?"commande livrée":r?"réponse reçue · "+fmt(r.total)+" F"+(m?" · "+m[1].toLowerCase()+(r.date?" "+dateLisible(r.date):""):""):STAT_CMD[c.statut][1].toLowerCase())+(neuf.length>1?" (+"+(neuf.length-1)+")":""))}
}
// Les réponses affichées dans « Compte » sont marquées comme vues.
function marquerVues(rows){const vu=lireVu();rows.forEach(c=>vu[c.id]=cleSuivi(c));ecrireVu(vu);ALERTES=0;majPastille()}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")verifierCommandes()});
setInterval(()=>{if(document.visibilityState==="visible")verifierCommandes()},120000);

show(location.hash.slice(1)||"concevoir");
renderCatalog();renderControls();
has3D=init3D();
setupTap();
compute(true);
let lastKey="";setInterval(()=>{const c=cfg();const k=st.id+c.L+c.H+c.P;if(k!==lastKey){if(lastKey&&has3D)fitCamera();lastKey=k}},800);

/* ===================== COMPTE ET SYNCHRONISATION ===================== */
function estQuinc(){return !!(ME&&ME.profil&&ME.profil.role==="quincaillerie")}
function estAdmin(){return !!(ME&&ME.profil&&ME.profil.role==="admin")}
function lectureSeule(){return !!(ME&&ME.quinc&&!estQuinc())}
let toastT=null;
function toast(msg,err){const t=$("toast");t.textContent=msg;t.className="toast"+(err?" err":"");t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3500)}
let tCat=null,tAt=null;
function pousserCatalogue(){
  if(!cloud.actif||!estQuinc()||!ME.quinc)return;
  clearTimeout(tCat);tCat=setTimeout(async()=>{
    try{await cloud.sauverQuincaillerie(ME.quinc.id,{catalogue:{panneaux:CAT.panneaux,sections:CAT.sections,prix:CAT.prix,exemple:CAT.exemple},nom:(CAT.boutique.nom||ME.quinc.nom).slice(0,80),whatsapp:CAT.boutique.wa||null,commune:CAT.boutique.commune||null});
      ME.quinc.nom=CAT.boutique.nom||ME.quinc.nom;toast("✅ Prix enregistrés pour tous vos menuisiers")}
    catch(e){toast(cloud.message(e),true)}},1200);
}
function pousserAtelier(){
  if(!cloud.actif||!ME)return;
  clearTimeout(tAt);tAt=setTimeout(()=>cloud.majProfil({atelier:{...AT,kerf:st.kerf},nom:AT.nom||ME.profil.nom},ME.user.id).catch(()=>{}),1200);
}
async function pousserProjet(pr){const id=await cloud.sauverProjet(pr);pr.cloudId=id;saveProj();return id}
let derniereCommande="";
function enregistrerCommande(){
  if(!cloud.actif||!ME||!ME.quinc||estQuinc()||!lastCtx)return;
  const txt=orderText();if(txt===derniereCommande)return;derniereCommande=txt;
  const pr=PROJ.find(x=>x.id===st.projId);
  cloud.envoyerCommande({quincaillerie_id:ME.quinc.id,projet_id:pr&&pr.cloudId||null,meuble:(R(st.id).nom+" "+dimsText()).slice(0,200),lignes:lastBuy.lines.map(l=>({article:l.label,detail:l.detail,total:l.total})),total:lastBuy.total?Math.round(lastBuy.total):null})
    .then(r=>{if(r&&r.id){const v=lireVu();v[r.id]=cleSuivi(r);ecrireVu(v)}toast("📦 Commande envoyée à "+ME.quinc.nom+" : sa réponse arrivera dans « Compte »")}).catch(e=>{derniereCommande="";toast(cloud.message(e),true)});
}
function appliquerCompte(){
  if(!ME)return;
  const q=ME.quinc;
  if(q){
    const c=q.catalogue||{};
    if(c.panneaux&&c.panneaux.length){CAT.panneaux=c.panneaux;CAT.prix=c.prix||{};CAT.exemple=!!c.exemple;if(c.sections&&c.sections.length)CAT.sections=c.sections}
    else if(estQuinc())pousserCatalogue();
    CAT.boutique={nom:q.nom||"",wa:q.whatsapp||"",commune:q.commune||""};saveCatLocal();
    if(estQuinc()&&!(c.panneaux&&c.panneaux.length))pousserCatalogue();
  }
  const a=ME.profil&&ME.profil.atelier;
  if(a&&Object.keys(a).length){AT={...AT,...a};if(a.kerf)st.kerf=a.kerf;try{localStorage.setItem("menuipro-atelier",JSON.stringify(AT))}catch(e){}}
  else pousserAtelier();
  $("count-tag").textContent=(estAdmin()?"🛡️ ":"👤 ")+(ME.profil&&ME.profil.nom||"Connecté");
  renderPanSel();if(lastCtx)compute();
  traiterInvitation();verifierCommandes();
  synchroniserProjets();
}
async function synchroniserProjets(){
  if(!ME)return;
  try{
    const rows=await cloud.listerProjets();
    rows.forEach(r=>{
      const loc=PROJ.find(p=>p.cloudId===r.id),cfgx=r.config||{};
      const data={cloudId:r.id,recipe:r.recette,cfg:cfgx.cfg,color:cfgx.color||0,panneau:cfgx.panneau,dv:cfgx.dv||{},fin:cfgx.fin||{paiements:[]},prix:r.prix,materiel:r.materiel,nom:r.nom,statut:r.statut,date:r.updated_at};
      if(!data.cfg)return;
      if(!loc)PROJ.push({id:"c"+r.id,...data});
      else if(new Date(r.updated_at)>new Date(loc.date))Object.assign(loc,data);
    });
    for(const p of PROJ.filter(p=>!p.cloudId))await pousserProjet(p);
    PROJ.sort((a,b)=>new Date(b.date)-new Date(a.date));saveProj();
    if(!$("v-projets").hidden)renderProjects();
  }catch(e){toast("Projets en ligne : "+cloud.message(e),true)}
}
const STAT_CMD={envoyee:["📨","Envoyée"],vue:["👀","Vue"],confirmee:["📋","Confirmée"],prete:["✅","Prête"],livree:["🚚","Livrée"],annulee:["✖️","Annulée"]};
async function renderCompte(){
  await renderCompteBase();
  const b=await bandeauInvitation(),box=$("compteBox");
  box.querySelectorAll(".bandeau-inv").forEach(n=>n.remove()); // l'écran peut être dessiné deux fois de suite
  if(b&&!$("v-compte").hidden){b.classList.add("bandeau-inv");box.prepend(b)}
}
async function renderCompteBase(){
  majMicro();
  const box=$("compteBox");
  if(!cloud.actif){box.replaceChildren(el("section",{class:"panel"},el("h2",{},"Connexion en ligne"),el("p",{},"La connexion en ligne n'est pas encore activée sur cette version. L'application fonctionne entièrement sur ce téléphone.")));return}
  if(!ME){
    const tel=el("input",{id:"cTel",type:"tel",inputmode:"tel",autocomplete:"tel",placeholder:"77 000 00 00"});
    const pin=el("input",{id:"cPin",type:"password",inputmode:"numeric",maxlength:"6",autocomplete:"current-password",placeholder:"6 chiffres"});
    const nom=el("input",{id:"cNom",type:"text",autocomplete:"name",placeholder:"Ex. Menuiserie Fall"});
    const status=el("p",{class:"status",role:"status"});
    const run=async(fn,okMsg)=>{status.className="status";status.textContent="⏳ Un instant…";try{await fn();ME=await cloud.chargerCompte();appliquerCompte();toast(okMsg);renderCompte()}catch(e){status.className="status err";status.textContent=cloud.message(e)}};
    box.replaceChildren(el("section",{class:"panel form"},el("h2",{},"Se connecter"),
      el("p",{class:"note"},"Avec un compte, vos projets sont sauvegardés en ligne et vous recevez les prix de votre quincaillerie."),
      el("div",{class:"grid2"},el("div",{class:"field"},el("label",{for:"cTel"},"📱 Numéro de téléphone"),tel),el("div",{class:"field"},el("label",{for:"cPin"},"🔑 Code PIN (6 chiffres)"),pin)),
      el("div",{class:"actions"},el("button",{type:"button",class:"btn primary",onclick:()=>run(()=>cloud.connecter(tel.value,pin.value),"✅ Connecté")},"Me connecter")),
      status,
      el("h2",{style:"margin-top:8px"},"Pas encore de compte ?"),
      el("div",{class:"field"},el("label",{for:"cNom"},"Votre nom ou celui de l'atelier"),nom),
      el("div",{class:"actions"},el("button",{type:"button",class:"btn",onclick:()=>run(()=>cloud.inscrire(tel.value,pin.value,nom.value),"✅ Compte créé")},"➕ Créer mon compte")),
      el("p",{class:"note"},"Choisissez un code PIN facile à retenir pour vous, mais pas votre date de naissance.")));
    return;
  }
  const p=ME.profil||{},q=ME.quinc,parts=[];
  let armedOut=false;const out=el("button",{type:"button",class:"btn"},"🚪 Se déconnecter");
  out.onclick=async()=>{if(!armedOut){armedOut=true;out.textContent="Touchez encore pour vous déconnecter";return}await cloud.deconnecter();ME=null;$("count-tag").textContent="MenuiPro";toast("Déconnecté");renderCompte()};
  parts.push(el("section",{class:"panel"},el("h2",{},(estAdmin()?"🛡️ ":"👤 ")+(p.nom||"Mon compte")),el("p",{class:"note"},"📱 "+(p.telephone||"")+" · "+(estAdmin()?"Administrateur":estQuinc()?"Quincaillerie":"Menuisier")),el("div",{class:"actions"},out)));
  if(estAdmin()){box.replaceChildren(...parts,...await vueAdmin());return}
  if(q&&q.actif===false)parts.push(el("div",{class:"banner"},estQuinc()?"⚠️ Votre abonnement est suspendu : vos menuisiers ne peuvent plus vous envoyer de commandes. Contactez MenuiPro.":"⚠️ "+q.nom+" est suspendue pour le moment : les commandes sont indisponibles."));
  if(estQuinc()&&q){
    const copy=el("button",{type:"button",class:"btn"},"📋 Copier le code");copy.onclick=async()=>{try{await navigator.clipboard.writeText(q.code);toast("Code copié")}catch(e){toast("Code : "+q.code)}};
    parts.push(el("section",{class:"panel"},el("h2",{},"🏪 "+q.nom),q.abonnement_jusqu?el("p",{class:"note"},"Abonnement valable jusqu'au "+new Date(q.abonnement_jusqu).toLocaleDateString("fr-FR")):null,el("p",{},"Code à donner à vos menuisiers :"),el("div",{class:"bigprice",style:"letter-spacing:.15em"},q.code),el("div",{class:"actions"},copy,el("a",{class:"btn",href:"#catalogue"},"🏷️ Gérer mes prix")),el("p",{class:"note"},"Chaque menuisier qui entre ce code reçoit vos prix et peut vous envoyer ses commandes.")));
    parts.push(panneauInviter(q));
    const list=el("div",{class:"cmds"},el("p",{class:"note"},"⏳ Chargement des commandes…"));
    parts.push(el("section",{class:"panel"},el("h2",{},"📥 Commandes reçues"),list));
    box.replaceChildren(...parts);
    try{
      const rows=await cloud.commandesRecues(q.id);
      if(!rows.length){list.replaceChildren(el("p",{class:"note"},"Aucune commande pour l'instant. Elles arrivent ici quand un menuisier touche « Commander »."));return}
      list.replaceChildren(...rows.map(carteCommandeRecue));
    }catch(e){list.replaceChildren(el("p",{class:"status err"},cloud.message(e)))}
    return;
  }
  if(q){
    let armedQ=false;const leave=el("button",{type:"button",class:"btn"},"Quitter cette quincaillerie");
    leave.onclick=async()=>{if(!armedQ){armedQ=true;leave.textContent="Touchez encore pour quitter";return}try{await cloud.quitter();ME=await cloud.chargerCompte();toast("Vous avez quitté la quincaillerie");renderCompte()}catch(e){toast(cloud.message(e),true)}};
    parts.push(el("section",{class:"panel"},el("h2",{},"🏪 Ma quincaillerie"),el("p",{},el("b",{},q.nom),q.commune?" · "+q.commune:""),el("p",{class:"note"},"Vos listes d'achat utilisent ses prix. Vos commandes lui arrivent directement."),el("div",{class:"actions"},leave)));
    const list=el("div",{class:"cmds"},el("p",{class:"note"},"⏳ Chargement…"));
    parts.push(el("section",{class:"panel"},el("h2",{},"📦 Mes commandes"),list));
    box.replaceChildren(...parts);
    try{const rows=await cloud.mesCommandes(ME.user.id);
      list.replaceChildren(...(rows.length?rows.map(carteCommandeMenuisier):[el("p",{class:"note"},"Aucune commande. Touchez « Commander » dans la liste d'achat d'un meuble.")]));marquerVues(rows)}
    catch(e){list.replaceChildren(el("p",{class:"status err"},cloud.message(e)))}
    return;
  }
  const code=el("input",{id:"cCode",type:"text",maxlength:"6",autocomplete:"off",placeholder:"Ex. F93A3E",style:"text-transform:uppercase;letter-spacing:.15em;font-weight:700"});
  const st1=el("p",{class:"status",role:"status"});
  const qn=el("input",{id:"qNom",type:"text",placeholder:"Nom de la quincaillerie"}),qw=el("input",{id:"qWa",type:"tel",inputmode:"tel",placeholder:"WhatsApp"}),qc=el("input",{id:"qCom",type:"text",placeholder:"Commune"});
  const st2=el("p",{class:"status",role:"status"});
  parts.push(el("section",{class:"panel form"},el("h2",{},"🏪 Rejoindre ma quincaillerie"),el("p",{class:"note"},"Demandez le code à 6 caractères à votre quincaillerie."),el("div",{class:"field"},el("label",{for:"cCode"},"Code"),code),
    el("div",{class:"actions"},el("button",{type:"button",class:"btn primary",onclick:async()=>{st1.textContent="⏳";try{const r=await cloud.rejoindre(code.value);ME=await cloud.chargerCompte();appliquerCompte();toast("✅ Vous avez rejoint "+r.nom);renderCompte()}catch(e){st1.className="status err";st1.textContent=cloud.message(e)}}},"Rejoindre")),st1));
  parts.push(el("section",{class:"panel form"},el("h2",{},"Vous êtes une quincaillerie ?"),el("div",{class:"grid2"},el("div",{class:"field"},el("label",{for:"qNom"},"Nom"),qn),el("div",{class:"field"},el("label",{for:"qWa"},"WhatsApp"),qw),el("div",{class:"field"},el("label",{for:"qCom"},"Commune"),qc)),
    el("div",{class:"actions"},el("button",{type:"button",class:"btn",onclick:async()=>{if((qn.value||"").trim().length<2){st2.className="status err";st2.textContent="Entrez le nom de la quincaillerie.";return}st2.textContent="⏳";try{await cloud.creerQuincaillerie(qn.value,qw.value,qc.value);ME=await cloud.chargerCompte();appliquerCompte();pousserCatalogue();toast("✅ Quincaillerie créée");renderCompte()}catch(e){st2.className="status err";st2.textContent=cloud.message(e)}}},"Créer ma quincaillerie")),st2,
    el("p",{class:"note"},"Vous recevrez un code à donner à vos menuisiers. Vos prix actuels deviendront le catalogue partagé.")));
  box.replaceChildren(...parts);
}
/* ----- Administration ----- */
async function vueAdmin(){
  let v;
  try{v=await cloud.adminVue()}catch(e){return [el("p",{class:"status err"},cloud.message(e))]}
  const T=v.totaux,dt=d=>d?new Date(d).toLocaleDateString("fr-FR"):"—";
  const kp=(val,lab,main)=>el("div",{class:"kpi"+(main?" main":"")},el("div",{class:"v"},val),el("div",{class:"k"},lab));
  const kpis=el("div",{class:"kpis"},kp(T.quincailleries_actives+" / "+T.quincailleries,"quincailleries actives",true),kp(T.menuisiers,"menuisiers ("+T.menuisiers_rattaches+" rattachés)"),kp(T.commandes,"commandes ("+T.commandes_30j+" sur 30 jours)"),kp(fmt(T.montant_commandes)+" F","commandés ("+fmt(T.montant_30j)+" F sur 30 j)"),kp(T.projets,"projets enregistrés"));
  const search=el("input",{class:"search",id:"adminSearch",type:"search",placeholder:"🔎 Chercher un nom, une commune, un numéro…",autocomplete:"off"});
  const qBody=el("tbody",{}),mBody=el("tbody",{});
  const expire=d=>d&&new Date(d)<new Date();
  const drawQ=f=>qBody.replaceChildren(...v.quincailleries.filter(q=>!f||[q.nom,q.commune,q.code,q.proprietaire,q.tel_proprietaire].join(" ").toLowerCase().includes(f)).map(q=>{
    const date=el("input",{type:"date",style:"min-width:140px"});date.value=q.abonnement_jusqu||"";
    const note=el("input",{type:"text",placeholder:"Note",style:"min-width:120px;text-align:left;font-family:var(--body)"});note.value=q.note_admin||"";
    const st2=el("span",{class:"note"});
    const saveQ=async(actif)=>{st2.textContent="⏳";try{await cloud.adminAbonnement(q.id,actif,date.value,note.value);q.actif=actif;q.abonnement_jusqu=date.value||null;q.note_admin=note.value;st2.textContent="✅";drawQ(search.value.trim().toLowerCase())}catch(e){st2.textContent=cloud.message(e)}};
    const statut=el("button",{type:"button",class:"chip "+(q.actif?"livre":"commande"),title:q.actif?"Suspendre":"Réactiver",onclick:()=>saveQ(!q.actif)},q.actif?"✅ Active":"⛔ Suspendue");
    return el("tr",{},el("td",{},el("b",{},q.nom),el("div",{class:"note"},[q.commune,q.whatsapp].filter(Boolean).join(" · "))),
      el("td",{},q.proprietaire||"—",el("div",{class:"note"},q.tel_proprietaire||"")),el("td",{class:"n"},q.code),
      el("td",{class:"n"},String(q.menuisiers)),el("td",{class:"n"},String(q.commandes)),el("td",{class:"n"},fmt(q.montant)+" F"),
      el("td",{},date,expire(q.abonnement_jusqu)?el("div",{class:"note",style:"color:var(--warn);font-weight:700"},"expiré"):null),el("td",{},note),
      el("td",{},statut,el("button",{type:"button",class:"btn",style:"margin-left:6px",onclick:()=>saveQ(q.actif)},"💾"),st2));
  }));
  const drawM=f=>mBody.replaceChildren(...v.menuisiers.filter(m=>!f||[m.nom,m.telephone,m.quincaillerie].join(" ").toLowerCase().includes(f)).map(m=>el("tr",{},
    el("td",{},el("b",{},m.nom||"—")),el("td",{class:"n"},m.telephone||"—"),el("td",{},m.quincaillerie||el("span",{class:"note"},"aucune")),
    el("td",{class:"n"},String(m.projets)),el("td",{class:"n"},String(m.commandes)),el("td",{class:"n"},dt(m.cree)),el("td",{class:"n"},dt(m.derniere_activite)))));
  search.addEventListener("input",()=>{const f=search.value.trim().toLowerCase();drawQ(f);drawM(f)});
  drawQ("");drawM("");
  const th=(...h)=>el("thead",{},el("tr",{},h.map(x=>el("th",{},x))));
  /* ----- Créer un compte ----- */
  const genPin=()=>String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
  let type="quincaillerie";
  const cTel=el("input",{id:"acTel",type:"tel",inputmode:"tel",placeholder:"77 000 00 00"}),cNom=el("input",{id:"acNom",type:"text",placeholder:"Nom de la personne"});
  const cPin=el("input",{id:"acPin",type:"text",inputmode:"numeric",maxlength:"6",style:"letter-spacing:.2em;font-weight:700"});cPin.value=genPin();
  const qNom=el("input",{id:"acQNom",type:"text",placeholder:"Nom de la quincaillerie"}),qWa=el("input",{id:"acQWa",type:"tel",inputmode:"tel",placeholder:"WhatsApp"}),qCom=el("input",{id:"acQCom",type:"text",placeholder:"Commune"});
  const qSel=el("select",{id:"acQSel"},el("option",{value:""},"— Aucune pour l'instant —"),...v.quincailleries.map(q=>el("option",{value:q.code},q.nom+(q.commune?" ("+q.commune+")":""))));
  const blocQ=el("div",{class:"grid2"},el("div",{class:"field"},el("label",{for:"acQNom"},"Quincaillerie"),qNom),el("div",{class:"field"},el("label",{for:"acQWa"},"WhatsApp"),qWa),el("div",{class:"field"},el("label",{for:"acQCom"},"Commune"),qCom));
  const blocM=el("div",{class:"field"},el("label",{for:"acQSel"},"Rattacher à la quincaillerie"),qSel);
  const typeSeg=el("div",{class:"seg"});
  const drawType=()=>{typeSeg.replaceChildren(...[["quincaillerie","🏪 Quincaillerie"],["menuisier","🪚 Menuisier"],["admin","🛡️ Administrateur"]].map(([k,l])=>el("button",{type:"button","aria-pressed":String(type===k),onclick:()=>{type=k;drawType()}},l)));blocQ.hidden=type!=="quincaillerie";blocM.hidden=type!=="menuisier"};
  drawType();
  const res=el("div",{class:"form"}),cSt=el("p",{class:"status",role:"status"});
  const creer=el("button",{type:"button",class:"btn primary"},"➕ Créer le compte");
  creer.onclick=async()=>{
    cSt.className="status";cSt.textContent="⏳ Création…";res.replaceChildren();creer.disabled=true;
    try{
      const r=await cloud.adminCreerCompte({type,telephone:cTel.value,pin:cPin.value.trim(),nom:cNom.value,quincaillerie:qNom.value,whatsapp:qWa.value,commune:qCom.value,code:qSel.value});
      cSt.className="status ok";cSt.textContent="✅ Compte créé";
      const msg=["Bonjour"+(cNom.value?" "+cNom.value.trim():"")+", votre compte MenuiPro est prêt.","Application : https://menuipro.onrender.com","Numéro : "+r.telephone.replace(/^221/,""),"Code PIN : "+cPin.value.trim(),r.code?"Code à donner à vos menuisiers : "+r.code:"",r.quincaillerie&&type==="menuisier"?"Quincaillerie : "+r.quincaillerie:"","Ouvrez l'onglet 👤 Compte puis « Me connecter »."].filter(Boolean).join("\n");
      const ta=el("textarea",{class:"copy",readonly:"readonly"});ta.value=msg;
      const wa=el("a",{class:"btn primary",target:"_blank",rel:"noopener",href:"https://wa.me/"+r.telephone+"?text="+encodeURIComponent(msg)},"📲 Envoyer sur WhatsApp");
      const cp=el("button",{type:"button",class:"btn"},"📋 Copier");cp.onclick=()=>copyText(msg,cSt,ta);
      res.replaceChildren(el("div",{class:"banner"},"À transmettre à la personne :"),ta,el("div",{class:"actions"},wa,cp));
      cTel.value="";cNom.value="";qNom.value="";qWa.value="";qCom.value="";cPin.value=genPin();
    }catch(e){cSt.className="status err";cSt.textContent=e.message}
    finally{creer.disabled=false}
  };
  const creation=el("section",{class:"panel form"},el("h2",{},"➕ Créer un compte"),typeSeg,
    el("div",{class:"grid2"},el("div",{class:"field"},el("label",{for:"acTel"},"📱 Numéro"),cTel),el("div",{class:"field"},el("label",{for:"acNom"},"Nom"),cNom),
      el("div",{class:"field"},el("label",{for:"acPin"},"🔑 Code PIN (6 chiffres)"),cPin)),
    blocQ,blocM,el("div",{class:"actions"},creer,el("button",{type:"button",class:"btn",onclick:()=>{cPin.value=genPin()}},"🎲 Autre code PIN")),cSt,res,
    el("p",{class:"note"},"Le compte est utilisable tout de suite. Transmettez le numéro et le code PIN à la personne, de préférence de vive voix ou par WhatsApp."));
  /* ----- Réinitialiser un code PIN ----- */
  const rTel=el("input",{id:"arTel",type:"tel",inputmode:"tel",placeholder:"77 000 00 00"}),rPin=el("input",{id:"arPin",type:"text",inputmode:"numeric",maxlength:"6",style:"letter-spacing:.2em;font-weight:700"});rPin.value=genPin();
  const rSt=el("p",{class:"status",role:"status"});
  const reset=el("button",{type:"button",class:"btn"},"🔑 Changer le code PIN");
  reset.onclick=async()=>{rSt.className="status";rSt.textContent="⏳";reset.disabled=true;try{await cloud.adminNouveauPin(rTel.value,rPin.value.trim());rSt.className="status ok";rSt.textContent="✅ Nouveau code PIN : "+rPin.value.trim()+" (à transmettre)";rPin.value=genPin()}catch(e){rSt.className="status err";rSt.textContent=e.message}finally{reset.disabled=false}};
  const reinit=el("section",{class:"panel form"},el("h2",{},"🔑 Code PIN oublié"),el("div",{class:"grid2"},el("div",{class:"field"},el("label",{for:"arTel"},"📱 Numéro du compte"),rTel),el("div",{class:"field"},el("label",{for:"arPin"},"Nouveau code PIN"),rPin)),el("div",{class:"actions"},reset),rSt);
  return [
    el("section",{class:"panel"},el("h2",{},"🛡️ Vue d'ensemble"),kpis,el("div",{class:"actions"},el("button",{type:"button",class:"btn",onclick:()=>renderCompte()},"🔄 Actualiser")),search),
    creation,reinit,await sectionVoix(),
    el("section",{class:"panel"},el("h2",{},"🏪 Quincailleries ("+v.quincailleries.length+")"),el("p",{class:"note"},"Réglez la date de fin d'abonnement puis 💾. Touchez le statut pour suspendre ou réactiver : une quincaillerie suspendue ne reçoit plus de commandes."),
      el("div",{class:"tablewrap"},el("table",{},th("Quincaillerie","Propriétaire","Code","Menuisiers","Commandes","Montant","Abonnement jusqu'au","Note","Statut"),qBody))),
    el("section",{class:"panel"},el("h2",{},"🪚 Menuisiers ("+v.menuisiers.length+")"),
      el("div",{class:"tablewrap"},el("table",{},th("Nom","Téléphone","Quincaillerie","Projets","Commandes","Inscrit le","Dernière activité"),mBody)))
  ];
}
/* ----- Assistant vocal : note vocale en wolof → meuble rempli ----- */
const CAT_IA=catalogueIA(RECIPES);
let micRec=null;
function bulle(gros,petit){const b=$("micBulle");b.hidden=!gros;b.replaceChildren(el("b",{},gros||""),petit?el("div",{class:"note"},petit):"")}
function appliquerAction(a){
  if(!a)return;
  if(a.recette){
    if(a.recette!==st.id){st.id=a.recette;openState=false;sel=0}
    const c=cfg();if(a.cotes)Object.assign(c,a.cotes);if(a.options)Object.assign(c.o,a.options);
    save();go("concevoir");renderCatalog();renderControls();compute(true);setEtape("regler");
  }
  parler(a.reponse);
}
function majMicro(){const ok=cloud.actif&&ME;$("micBox").hidden=!ok}
$("micBtn").onclick=async()=>{
  const btn=$("micBtn");
  if(micRec){micRec.stop();return}
  if(btn.classList.contains("wait"))return;
  if(!window.MediaRecorder||!navigator.mediaDevices){bulle("⚠️","Ce téléphone ne peut pas enregistrer ici. Essayez avec Chrome.");return}
  let flux;try{flux=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){bulle("🎙️❌","Autorisez le micro pour parler à l'assistant.");return}
  const type=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));
  const r=new MediaRecorder(flux,type?{mimeType:type}:undefined),morceaux=[],t0=Date.now();
  let minuteur=setInterval(()=>{const s=Math.round((Date.now()-t0)/1000);bulle("🔴 "+s+" s","Touchez encore le micro quand vous avez fini.");if(s>=DUREE_MAX_S)r.stop()},500);
  r.ondataavailable=e=>e.data.size&&morceaux.push(e.data);
  r.onstop=async()=>{
    clearInterval(minuteur);flux.getTracks().forEach(t=>t.stop());micRec=null;btn.classList.remove("rec");
    const duree=(Date.now()-t0)/1000;
    if(duree<1){bulle("🤔","Trop court. Appuyez, parlez, puis appuyez encore.");return}
    btn.classList.add("wait");btn.textContent="⏳";bulle("⏳","Je réfléchis…");
    try{
      const res=await cloud.assistant(new Blob(morceaux,{type:r.mimeType||"audio/webm"}),CAT_IA,{recette:st.id,nom:R(st.id).nom,...cfg()},duree);
      const a=validerAction(res.action,RECIPES,st.id)||{action:"inconnu",reponse:"pas_compris"};
      const ic={compris:"👍",modifie:"🔁",pas_compris:"🤔",limite:"⛔"}[a.reponse]||"💡";
      bulle(ic+" "+(a.recette?R(a.recette).nom:""),[res.texte?"« "+res.texte+" »":"",a.resume].filter(Boolean).join(" → "));
      appliquerAction(a);
    }catch(e){bulle("⚠️",e.message);if(e.action)parler(e.action.reponse);else parler("erreur")}
    finally{btn.classList.remove("wait");btn.textContent="🎙️";setTimeout(()=>{if(!micRec)$("micBulle").hidden=true},12000)}
  };
  r.start(1000);micRec=r;btn.classList.add("rec");btn.textContent="⏹️";bulle("🔴 0 s","Parlez maintenant.");parler("ecoute");
};

/* ----- Console : voix en wolof ----- */
async function sectionVoix(){
  const dispo=await chargerVoix().catch(()=>({}));
  const st3=el("p",{class:"status",role:"status"}),liste=el("div",{});
  const envoyer=async(cle,blob)=>{st3.className="status";st3.textContent="⏳ Envoi de « "+cle+" »…";
    try{if(!blob.size)throw new Error("Enregistrement vide : touchez 🎙️, attendez une seconde, parlez, puis touchez ⏹️.");if(blob.size>2*1024*1024)throw new Error("Fichier trop lourd (2 Mo maximum).");await cloud.adminEnvoyerVoix(cle,blob);await chargerVoix();st3.className="status ok";st3.textContent="✅ « "+cle+" » enregistré.";dessiner()}
    catch(e){st3.className="status err";st3.textContent=cloud.message(e)}};
  let rec=null;
  const ligne=(cle,[ic,fr,wo])=>{
    const ok=aUnAudio(cle);
    const ecouter=el("button",{type:"button",class:"btn","aria-label":"Écouter",onclick:()=>parler(cle,null,"wo")},"▶️");ecouter.disabled=!ok;
    const micro=el("button",{type:"button",class:"btn"},"🎙️ Enregistrer");
    micro.onclick=async()=>{
      if(rec&&rec.cle===cle){rec.r.stop();return}
      if(rec){st3.className="status err";st3.textContent="Terminez d'abord l'enregistrement en cours.";return}
      if(!window.MediaRecorder||!navigator.mediaDevices){st3.className="status err";st3.textContent="Ce navigateur ne peut pas enregistrer : importez un fichier audio (note vocale WhatsApp, mp3…).";return}
      try{const flux=await navigator.mediaDevices.getUserMedia({audio:true});const r=new MediaRecorder(flux),morceaux=[];
        r.ondataavailable=e=>{if(e.data&&e.data.size)morceaux.push(e.data)};
        r.onstop=()=>{flux.getTracks().forEach(t=>t.stop());rec=null;micro.textContent="🎙️ Enregistrer";envoyer(cle,new Blob(morceaux,{type:r.mimeType||"audio/webm"}))};
        r.start(1000);rec={cle,r};micro.textContent="⏹️ Arrêter";st3.className="status";st3.textContent="🔴 Parlez maintenant, puis touchez « Arrêter ».";
      }catch(e){st3.className="status err";st3.textContent="Micro refusé ou indisponible."}
    };
    const fichier=el("input",{type:"file",accept:"audio/*",hidden:"hidden"});fichier.onchange=()=>{if(fichier.files[0])envoyer(cle,fichier.files[0])};
    const imp=el("button",{type:"button",class:"btn",onclick:()=>fichier.click()},"📁");
    return el("div",{class:"voixrow"},el("span",{style:"font-size:26px","aria-hidden":"true"},ic),
      el("div",{},el("b",{style:"font-size:18px"},"🗣️ "+wo),el("div",{class:"note"},fr),el("div",{class:"note"},(ok?"✅ audio wolof prêt":"⏳ pas encore d'audio wolof")+" · "+cle)),
      el("div",{class:"acts"},ecouter,micro,imp,fichier));
  };
  const dessiner=()=>{const n=Object.keys(PHRASES).filter(aUnAudio).length;
    liste.replaceChildren(el("p",{class:"note"},n+" / "+Object.keys(PHRASES).length+" phrases ont leur audio wolof."),...Object.entries(PHRASES).map(([k,v])=>ligne(k,v)))};
  dessiner();
  // Import groupé : fichiers nommés <clé>.mp3 (sortie du cahier Colab Adia TTS)
  const lot=el("input",{type:"file",accept:"audio/*",multiple:"multiple",hidden:"hidden"});
  lot.onchange=async()=>{const fs=[...lot.files];let n=0,ign=[];
    for(const f of fs){const cle=f.name.replace(/\.[^.]+$/,"");if(!PHRASES[cle]){ign.push(f.name);continue}await envoyer(cle,f);n++}
    st3.className=ign.length?"status err":"status ok";st3.textContent="✅ "+n+" audio(s) importé(s)"+(ign.length?" · ignorés (nom inconnu) : "+ign.join(", "):"")};
  return el("section",{class:"panel"},el("h2",{},"🎙️ Voix en wolof"),
    el("p",{class:"note"},"Générez les audios avec le cahier Colab « outils/voix_wolof_adia.ipynb » (modèle Adia TTS de CONCREE, licence Apache 2.0), puis importez-les tous d'un coup. Une phrase mal prononcée : refaites-la au micro 🎙️ ou importez une note vocale 📁."),
    el("div",{class:"actions"},el("button",{type:"button",class:"btn primary",onclick:()=>lot.click()},"📦 Importer les audios (plusieurs fichiers)"),lot),st3,liste);
}
if(cloud.actif)cloud.chargerCompte().then(c=>{ME=c;if(c)appliquerCompte();majMicro();if(!$("v-compte").hidden)renderCompte()}).catch(()=>{});

/* ----- Application installable (hors-ligne) ----- */
if("serviceWorker" in navigator&&location.protocol==="https:"){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}
