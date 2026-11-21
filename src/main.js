// MenuiPro — interface de l'application
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MODELES_KILIFEU as MODELES } from "./kilifeu.js";
import { boiteMonde, RECIPES, BIENTOT, buildRecipe, pack, outils, SHEET, holeLocal, HOLE_KINDS, vueFace, depuisLecture } from "./engine/index.js";
import { HCOL, sheetHoles, cncSVG, cncDXF, makeZip, ascii } from "./export/cnc.js";
import * as cloud from "./cloud/cloud.js";
import { PHRASES, parler, boutonVoix, chargerVoix, aUnAudio } from "./voix.js";
import { catalogueIA, validerAction, DUREE_MAX_S } from "./assistant.js";
import { versWav } from "./audio-wav.js";
import { MODES, modeNom, acompteDu, resume, validerPaiement, prochainNumero } from "./paiements.js";
import { DISPO, MODES_RETRAIT, reponseInitiale, totalReponse, sousTotalReponse, montantRemise, remiseLignes, validerReponse, changerQuantite, prixCatalogue, dateLisible, texteReponse, cleSuivi, changements } from "./commandes.js";
import qrcode from "qrcode-generator";
import { editeurCroquis } from "./croquis-ui.js";
import * as imp3d from "./import3d.js";
import { ouvrirScanner } from "./scanner.js";
import "./styles.css";

const COLORS=[["Blanc","#efefeb"],["Gris","#8b8f90"],["Noir","#2a2a2a"],["Chêne clair","#c9a36b"],["Wengé","#4a3326"]];
const ROOMS=["Tous","Bureau","Chambre","Salon","Cuisine","Boutique","Déco murale","Portes et autres"];
const $=id=>document.getElementById(id);
const el=(t,a={},...c)=>{const n=document.createElement(t);for(const k in a){if(k==="class")n.className=a[k];else if(k.startsWith("on"))n.addEventListener(k.slice(2),a[k]);else n.setAttribute(k,a[k])}c.flat().forEach(x=>x!=null&&n.append(x.nodeType?x:document.createTextNode(x)));return n};
const fmt=n=>Math.round(n).toLocaleString("fr-FR");
const R=id=>RECIPES.find(r=>r.id===id);
// Nom affiché : celui du modèle partenaire (ex. « Lawson Bleu ») s'il a été choisi pour ce meuble.
const modeleActif=()=>st.modele&&st.modele.recette===st.id?st.modele:null;
const nomMeuble=r=>{const m=modeleActif();return m&&(!r||r.id===st.id)?m.nom:(r||R(st.id)).nom};

let VUE=null,RESTAURE=false,PROF=-1,tNoter=0; // écran affiché et historique (bouton retour, plus bas)
let st={id:"armoire-2",per:{},color:0,kerf:4,ep:18,panneau:"mela18",rot:true,room:null,etape:"choisir",dv:{client:"",tel:"",jours:null,pose:0},projId:null};
try{const s=JSON.parse(localStorage.getItem("menuipro-v2")||"null");if(s&&R(s.id))st={...st,...s}}catch(e){}
const save=()=>{try{localStorage.setItem("menuipro-v2",JSON.stringify(st))}catch(e){}};
function cfg(){const r=R(st.id);if(!st.per[r.id]){const o={};r.opts.forEach(x=>o[x.k]=x.def);st.per[r.id]={L:r.dims[0],H:r.dims[1],P:r.dims[2],o}}const c=st.per[r.id];r.opts.forEach(x=>{if(c.o[x.k]===undefined)c.o[x.k]=x.def});return c}

/* ----- Catalogue ----- */
let query="";
// Familles de meubles : gros boutons d'abord, puis les meubles de la famille choisie.
const FAMILLES=[["Chambre","🛏️"],["Salon","🛋️"],["Cuisine","🍳"],["Bureau","🖥️"],["Boutique","🛍️"],["Déco murale","🎨"],["Portes et autres","🚪"]];
function choisirMeuble(id,garderModele){st.id=id;if(!garderModele)st.modele=null;openState=false;sel=0;save();renderCatalog();renderControls();compute(true);setEtape("regler")}
// Modèle partenaire : ouvre le meuble de base avec les cotes, le style et la couleur du modèle.
function choisirModele(m){
  const r=R(m.recette),o={};r.opts.forEach(x=>o[x.k]=x.def);Object.assign(o,m.o);
  st.per[r.id]={L:m.dims[0],H:m.dims[1],P:m.dims[2],o};
  if(m.couleur!=null)st.color=m.couleur;
  st.modele={id:m.id,nom:m.nom,photo:m.photo,page:m.page,recette:r.id};
  choisirMeuble(r.id,true);
}
function tuileModele(m){const actif=modeleActif(),r=R(m.recette);return el("button",{type:"button",class:"meuble","aria-pressed":String(!!actif&&actif.id===m.id),onclick:()=>choisirModele(m)},el("span",{class:"e","aria-hidden":"true"},r.e),m.nom)}
function tuileMeuble(r){return el("button",{type:"button",class:"meuble","aria-pressed":String(r.id===st.id),onclick:()=>choisirMeuble(r.id)},el("span",{class:"e","aria-hidden":"true"},r.e),r.nom)}
function renderCatalog(){
  // st.room : null = familles, "*" = tous les meubles, sinon le nom de la famille.
  const q=query.trim().toLowerCase(),fam=st.room==="*"||(ROOMS.includes(st.room)&&st.room!=="Tous")?st.room:null;
  const VISIBLES=RECIPES.filter(r=>!r.cache),liste=q?VISIBLES.filter(r=>r.nom.toLowerCase().includes(q)):fam==="*"?VISIBLES:fam?VISIBLES.filter(r=>r.cat===fam):[];
  // Les modèles nommés (Lawson, Gatsby…) sont rangés dans la famille de leur meuble de base.
  const famModele=m=>R(m.recette).cat;
  const modelesTrouves=q?MODELES.filter(m=>m.nom.toLowerCase().includes(q)):fam==="*"?MODELES:fam?MODELES.filter(m=>famModele(m)===fam):[];
  // Sans recherche ni famille : on montre les familles.
  const voirFamilles=!q&&!fam;
  $("familles").hidden=!voirFamilles;$("creer").hidden=!voirFamilles;
  $("familles").replaceChildren(...FAMILLES.map(([nom,e])=>{const n=RECIPES.filter(r=>r.cat===nom&&!r.cache).length+MODELES.filter(m=>R(m.recette).cat===nom).length;return el("button",{type:"button",class:"famille",onclick:()=>{st.room=nom;save();renderCatalog()}},el("span",{class:"e","aria-hidden":"true"},e),el("b",{},nom),el("span",{class:"nb"},n+" meubles"))}),
    el("button",{type:"button",class:"famille tous",onclick:()=>{st.room="*";save();renderCatalog()}},el("span",{class:"e","aria-hidden":"true"},"📋"),el("b",{},"Tous les meubles"),el("span",{class:"nb"},RECIPES.length+MODELES.length)));
  $("famHead").hidden=voirFamilles;
  $("famHead").replaceChildren(...(voirFamilles?[]:[retourFamilles(),el("b",{},q?"Résultats":fam==="*"?"Tous les meubles":fam)]));
  // Dans une famille : les modèles nommés d'abord, rangés sous un petit titre (Canapés, Salons complets…), puis les meubles de base.
  if(fam&&!q){
    const groupes=[];
    for(const m of modelesTrouves){let g=groupes.find(x=>x.nom===m.famille);if(!g)groupes.push(g={nom:m.famille,mod:[]});g.mod.push(m)}
    const ORDRE=["Salons complets","Canapés","Fauteuils et poufs","Lits","Armoires de chambre","Mobilier bois"];
    groupes.sort((x,y)=>ORDRE.indexOf(x.nom)-ORDRE.indexOf(y.nom));
    const titre=t=>el("h3",{class:"sousfam"},t);
    $("meubles").replaceChildren(...groupes.flatMap(g=>[titre(g.nom+" ("+g.mod.length+")"),...g.mod.map(tuileModele)]),
      ...(liste.length?[titre(groupes.length?"Autres meubles":""),...liste.map(tuileMeuble)]:[]));
  }else $("meubles").replaceChildren(...liste.map(tuileMeuble),...modelesTrouves.map(tuileModele));
  if(q&&!liste.length&&!modelesTrouves.length)$("meubles").append(el("p",{class:"note"},"Aucun meuble ne correspond. Essayez un autre mot."));
  $("count-tag").textContent=(RECIPES.length+MODELES.length)+" meubles";
  noterEcran();
}
// (la famille ouverte compte comme un écran pour le bouton retour)
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
  noterEcran();
}
document.querySelectorAll("[data-aller]").forEach(b=>b.addEventListener("click",()=>setEtape(b.dataset.aller)));
// Bandeau du haut : le meuble, les feuilles et le prix, visibles à chaque étape après le choix.
function majBarPrix(){
  const b=$("barPrix");if(!b)return;
  if(st.etape==="choisir"||!lastRes||!lastRes.caisson){b.hidden=true;return}
  const r=R(st.id),n18=lastRes.caisson.sheets.length,nb=0;
  const d=devisCalc(),prix=d.prix&&!lastBuy.missing?fmt(d.prix)+" F":lastBuy.total?fmt(lastBuy.total)+" F":"prix ?";
  b.hidden=false;
  b.replaceChildren(el("div",{class:"wrap"},
    el("button",{type:"button",class:"bp-meuble",onclick:()=>setEtape("choisir"),"aria-label":"Changer de meuble"},el("span",{"aria-hidden":"true"},r.e),el("b",{},nomMeuble(r))),
    el("span",{class:"bp-val"},el("b",{},n18||nb),n18?" feuille"+(n18>1?"s":""):" barre"+(nb>1?"s":"")),
    el("span",{class:"bp-val bp-prix"},el("b",{},prix),d.prix&&!lastBuy.missing?" client":lastBuy.total?" matériel":"")));
}

/* ----- « Ma 3D » : ce qui a été lu dans la 3D ----- */
function panneauModele(c){
  const m=c.o.panneaux,f=c.fichier3d,n=(m&&m.list&&m.list.length)||0;
  if(n<1)return el("div",{class:"modele-resume"},
    el("p",{class:"warn"},f?"Je ne trouve pas de panneaux dans cette 3D (objet d'un seul bloc, ou tissu). Pour la découpe, dessinez le meuble ✏️.":"Importez votre 3D : je lis ses panneaux pour faire les coupes."),
    el("div",{class:"actions"},el("button",{type:"button",class:"btn primary",onclick:()=>demanderImport("modele3d",true)},"📤 Importer ma 3D"),f?el("button",{type:"button",class:"btn",onclick:versDessin},"✏️ Dessiner à la place"):null));
  const par={};m.list.forEach(p=>{const k=p.m==="caisson"?"panneaux "+st.ep+" mm":p.m==="dos"?"fonds 5 mm":"pièces épaisses (bandes collées)";par[k]=(par[k]||0)+1});
  const eps=[...new Set(m.list.filter(p=>p.m==="caisson").map(p=>p.ep))].sort((a,b)=>a-b);
  return el("div",{class:"modele-resume"},
    el("p",{class:"imp-ok"},"✂️ "+n+" pièces lues dans votre 3D"),
    el("p",{class:"note"},Object.entries(par).map(([k,v])=>v+" "+k).join(" · ")),
    eps.some(e=>Math.abs(e-st.ep)>1.5)?el("p",{class:"note"},"Épaisseur dans la 3D : "+eps.join(", ")+" mm. Les coupes utilisent "+st.ep+" mm (le panneau choisi)."):null,
    m.ignores?el("p",{class:"note"},m.ignores+" objet(s) laissé(s) de côté : poignées, tissus, déco…"):null,
    el("p",{class:"note"},"Tapez les vraies dimensions plus haut : les coupes s'ajustent, l'épaisseur des panneaux ne change pas."),
    el("div",{class:"actions"},
      f&&cache3D.has(f.id)?el("button",{type:"button",class:"btn",onclick:()=>{lireDecoupe3D(true);save();renderControls();compute()}},"🔍 Relire la 3D"):null,
      el("button",{type:"button",class:"btn",onclick:()=>demanderImport("modele3d",true)},"📤 Autre fichier"),
      el("button",{type:"button",class:"btn",onclick:versDessin},"✏️ Dessiner à la place")));
}

/* ----- Configurateur ----- */
let editeurActif=null; // éditeur « Mon dessin » affiché dans Régler
function renderControls(){
  const r=R(st.id),c=cfg();
  const mod=modeleActif();
  $("current").replaceChildren(el("span",{class:"e","aria-hidden":"true"},r.e),el("div",{},el("b",{},mod?mod.nom:r.nom),el("div",{class:"note"},mod?r.nom:r.cat)));
  const labels=r.dimLabels||["Largeur","Hauteur","Profondeur"];
  $("dims").replaceChildren(...["L","H","P"].map((k,i)=>{const inp=el("input",{id:"d"+k,type:"number",inputmode:"numeric",min:String((r.dimMin||[10,10,10])[i]),max:"2000"});inp.value=c[k];inp.addEventListener("input",e=>{c[k]=parseFloat(e.target.value)||0;
      // Photo cadrée : tant que le menuisier n'a pas tapé la hauteur, elle suit la largeur (proportions de la photo).
      const ph=c.photo;
      if(ph&&r.dessin){if(k==="H")ph.hAuto=0;else if(k==="L"&&ph.hAuto&&c.L>=10){const q=ph.cadre||[0,0,1,1];c.H=Math.max(30,Math.min(300,Math.round(c.L*((q[3]-q[1])*ph.h)/((q[2]-q[0])*ph.l))));const dh=$("dH");if(dh)dh.value=c.H}}
      compute();if(editeurActif&&c[k]>=10)editeurActif.redessiner()});
    if(r.importe&&k==="L"){let avant=c.L;inp.addEventListener("focus",()=>{avant=c.L});
      inp.addEventListener("change",()=>{const q=c.L/(avant||c.L);avant=c.L;if((q>2||q<0.5)&&lireDecoupe3D(true)){save();renderControls();compute()}})}return el("div",{class:"num"},el("label",{for:"d"+k},labels[i]),inp,el("small",{},["↔","↕","⤢"][i]))}));
  $("optsLabel").hidden=!r.opts.length;
  $("optsLabel").textContent=r.dessin?"✏️ Dessinez la façade":r.importe?"📤 Lu dans votre 3D":"Les options";
  editeurActif=null;
  // Options conditionnelles (« si ») et petits titres de groupe (« titre ») : ex. cuisine en I ou en L.
  const optsUI=r.opts.filter(x=>!x.si||x.si(c.o)).flatMap(x=>{const lab=(x.labelL&&c.o.forme==="L")?x.labelL:x.label,y=lab===x.label?x:{...x,label:lab};return x.titre?[el("div",{class:"opt-titre"},x.titre),y]:[y]});
  $("opts").replaceChildren(...optsUI.map(x=>{
    if(x.nodeType)return x;
    if(x.modele)return panneauModele(c);
    if(x.croquis){
      editeurActif=editeurCroquis({croquis:c.o[x.k],dims:()=>({L:c.L,H:c.H,ep:st.ep}),onChange:k=>{c.o[x.k]=k;compute()},
        photo:()=>c.photo?{...c.photo,url:urlPhoto(c.photo)}:null,
        ajouterPhoto:()=>demanderImport("croquis",false),
        enleverPhoto:()=>{delete c.photo;save();renderControls()},
        onPhoto:chg=>{Object.assign(c.photo,chg);
          if(chg.cadre){const k=chg.cadre,ph=c.photo,r=((k[3]-k[1])*ph.h)/((k[2]-k[0])*ph.l);
            c.H=Math.max(30,Math.min(300,Math.round(c.L*r)));c.photo.hAuto=1;toast("📐 Hauteur proposée d'après la photo : "+c.H+" cm. Tapez les vraies cotes si besoin.")}
          save();renderControls();compute()}});
      return editeurActif;
    }
    if(x.choice)return el("div",{style:"display:grid;gap:6px"},el("span",{class:"name",style:"font-weight:700"},x.label),el("div",{class:"seg"},x.options.map(([v,l])=>el("button",{type:"button","aria-pressed":String(c.o[x.k]===v),onclick:()=>{c.o[x.k]=v;renderControls();compute()}},l))));
    const out=el("output",{},String(c.o[x.k]));
    const chg=d=>{c.o[x.k]=Math.max(x.min,Math.min(x.max,c.o[x.k]+d*(x.step||1)));out.textContent=c.o[x.k];compute()};
    const isBool=x.min===0&&x.max===1;
    if(isBool)return el("div",{class:"step"},el("span",{class:"name"},x.icon+" "+x.label),el("div",{class:"seg"},[[0,"Non"],[1,"Oui"]].map(([v,l])=>el("button",{type:"button","aria-pressed":String(c.o[x.k]===v),onclick:()=>{c.o[x.k]=v;renderControls();compute()}},l))));
    return el("div",{class:"step"},el("span",{class:"name"},x.icon+" "+x.label),el("div",{class:"stepper"},el("button",{type:"button","aria-label":"Moins","onclick":()=>chg(-1)},"−"),out,el("button",{type:"button","aria-label":"Plus",onclick:()=>chg(1)},"+")));
  }),...(r.resume?[el("p",{class:"resume-meuble",id:"resumeMeuble"})]:[]));
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
  const rs=$("resumeMeuble");if(rs&&r.resume)rs.textContent=r.resume(ctx);
  const items={caisson:[],dos:[]};let id=0;
  ctx.parts.filter(p=>p.mat).forEach(p=>{const hl=p.box?(p.holes||[]).map(h=>{const L=holeLocal(p,h);const t=[0,1,2].find(i=>i===h.axis);const face=Math.abs(h.p[t]-p.box[t])<0.6?"A":"B";return {u:L.u,v:L.v,d:h.d,kind:h.kind,face,through:h.kind==="vis"}}):[];for(let q=0;q<p.qty;q++)items[p.mat].push({id:++id,name:p.name,l:p.cut[0],w:p.cut[1],holes:hl})});
  const res={caisson:pack(items.caisson,st.kerf,st.rot),dos:pack(items.dos,st.kerf,true)};lastRes=res;
  const n18=res.caisson.sheets.length,n5=res.dos.sheets.length;
  const used=res.caisson.sheets.reduce((t,s)=>t+s.parts.reduce((u,p)=>u+p.pw*p.ph,0),0);
  const util=n18?used/(n18*SHEET.w*SHEET.h)*100:0;
  const bl=buyLines(ctx);lastBuy=bl;
  const k=[];
  k.push(el("div",{class:"kpi main"},el("div",{class:"v"},n18+" feuille"+(n18>1?"s":"")),el("div",{class:"k"},panLabel())));
  k.push(el("div",{class:"kpi"},el("div",{class:"v"},n5+" feuille"+(n5>1?"s":"")),el("div",{class:"k"},"contreplaqué 5 mm (dos, fonds)")));
  if(n18)k.push(el("div",{class:"kpi"},el("div",{class:"v"},Math.round(util)+" %"),el("div",{class:"k"},"de la matière utilisée")));
  k.push(el("div",{class:"kpi"},el("div",{class:"v"},items.caisson.length+items.dos.length),el("div",{class:"k"},"pièces à couper")));
  k.push(el("div",{class:"kpi"},el("div",{class:"v"},bl.total?fmt(bl.total):"—"),el("div",{class:"k"},bl.total?"FCFA de matériel"+(bl.missing?" (incomplet)":""):"matériel : prix à saisir")));
  const over=[...res.caisson.over,...res.dos.over];
  // Pièces plus grandes qu'une feuille (ou qu'une barre) : coupées en morceaux avec un joint, et comptées.
  const joints=[...res.caisson.joints||[],...res.dos.joints||[]];
  $("kpis").replaceChildren(...k,...(joints.length?[el("p",{class:"note",style:"grid-column:1/-1"},"🔗 Plus grand qu'une feuille, coupé en morceaux avec un joint (déjà compté) : "+joints.map(o=>o.name+" ("+Math.round(o.l/10)+" × "+Math.round(o.w/10)+" cm → "+o.n+" morceaux)").join(", ")+".")]:[]),
    ...(over.length?[el("p",{class:"warn",style:"grid-column:1/-1"},"⚠️ Pièce impossible à placer : "+over.map(o=>o.name+" ("+o.l+" × "+o.w+")").join(", ")+".")]:[]));
  renderPlan();renderFacade(ctx);renderDebit(ctx);renderKit(ctx);renderDevis();
  update3D(ctx,refit);majBarPrix();
}

let planEtat=null;
const planDebout=()=>window.innerWidth<600;
window.addEventListener("resize",()=>{if(lastRes&&planEtat!==null&&planEtat!==planDebout())renderPlan()});
function renderPlan(){
  const all=[...lastRes.caisson.sheets.map((s,i)=>({s,label:"Feuille panneau "+(i+1),dim:SHEET})),...lastRes.dos.sheets.map((s,i)=>({s,label:"Feuille 5 mm "+(i+1),dim:SHEET}))];
  if(sel>=all.length)sel=0;
  $("sheetTabs").replaceChildren(...all.map((x,i)=>el("button",{type:"button",class:"btn","aria-pressed":String(i===sel),onclick:()=>{sel=i;renderPlan()}},x.label)));
  const cur=all[sel];if(!cur){$("plan").replaceChildren();$("sheetInfo").textContent="";return}
  const D=cur.dim,T=D.trim,NS="http://www.w3.org/2000/svg";
  // Sur téléphone, la feuille est dessinée debout (x ↔ y) : elle tient dans l'écran et le texte reste lisible.
  const debout=planDebout();planEtat=debout;
  const W=debout?D.h:D.w,Hs=debout?D.w:D.h,tr=(x,y,w,h)=>debout?[y,x,h,w]:[x,y,w,h];
  // Une barre de bois est très fine : on l'affiche plus haute (échelle verticale ×k) pour qu'on puisse lire les pièces.
  const ky=1,capY=Hs*ky+60;
  const svg=document.createElementNS(NS,"svg");svg.setAttribute("viewBox",`-20 -20 ${W+40} ${capY+30}`);if(debout)svg.setAttribute("class","debout");svg.setAttribute("role","img");svg.setAttribute("aria-label","Plan de découpe, "+cur.label);
  const mk=(t,a)=>{const n=document.createElementNS(NS,t);for(const k in a)n.setAttribute(k,a[k]);return n};
  svg.append(mk("rect",{x:0,y:0,width:W,height:Hs*ky,fill:"var(--waste)",rx:6}));
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
function slug(){return ascii(nomMeuble()).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
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
  const rows=ctx.parts.filter(p=>p.mat).map(p=>el("tr",{},el("td",{},p.name.replace(/ \(×2\)/,"")),el("td",{class:"n"},String(p.qty)),el("td",{class:"n"},p.cut[0]+" × "+p.cut[1]),el("td",{},matiere(p)),el("td",{class:"n"},p.edge?((p.edge*p.qty/1000).toFixed(2)+" m"):"—"),el("td",{class:"n"},(p.holes||[]).length?String(p.holes.length):"—")));
  $("debit").replaceChildren(el("thead",{},el("tr",{},el("th",{},"Pièce"),el("th",{},"Qté"),el("th",{},"Cotes (mm)"),el("th",{},"Matière"),el("th",{},"Chant"),el("th",{},"Perçages"))),el("tbody",{},rows));
}

// Cotes et matière d'une pièce (une pièce épaisse est faite de bandes de panneau contrecollées).
const cm=v=>String(Math.round(v)/10).replace(".",",");
function matiere(p){if(p.mat==="dos")return "Contreplaqué 5 mm";return "Panneau "+st.ep+" mm"+(p.plein?" (bandes collées)":"")}

/* ===================== CATALOGUE, PRIX, ATELIER ===================== */
const ARTICLES=[
 ["chant","🎞️","Bande de chant","m"],["vis440","🔩","Vis 4 × 40","boîte de 100",100],["vis3516","🔩","Vis 3,5 × 16","boîte de 200",200],["tourillons","🪵","Tourillons Ø8 × 35","sachet de 100",100],
 ["charn","⭕","Charnière invisible","pièce"],["charnv","⭕","Charnière pour verre","pièce"],["poignees","🚪","Poignée","pièce"],["coulisses","🗄️","Coulisses de tiroir","paire"],
 ["taquets","📌","Taquet d'étagère","pièce"],["tringle","➖","Tringle de penderie","m"],["supports","🔩","Support de tringle","pièce"],["rail","↔️","Rail coulissant","m"],
 ["galets","⚙️","Kit galets coulissants","kit"],["cuvettes","✋","Poignée cuvette","pièce"],["verre","🪟","Verre trempé","m²"],["miroir","🪞","Miroir 60 × 80","pièce"],
 ["pieds","🦵","Pied de table","pièce"],["piedsreg","🦵","Pied réglable cuisine","pièce"],["pdt","🟫","Plan de travail 38 mm","m"],["roulettes","🛞","Roulette","pièce"],
 ["lattes","🪵","Latte de lit","pièce"],["tasseaux","🪵","Tasseau bois","m"],["poutre","🪵","Traverse bois (chevron)","m"],["equerres","📐","Équerre","pièce"],
 ["fixmur","🔩","Fixations murales","lot de 4",4],["fixhaut","🔩","Fixation meuble haut","pièce"],["pointes","🔨","Pointes","boîte de 500",500],["vasque","🚰","Vasque à poser","pièce"],
 ["paumelles","⚙️","Paumelle de porte","pièce"],["serrure","🔒","Serrure + cylindre","pièce"],["espagnolette","🔒","Espagnolette / crémone","pièce"],["pattes","🔩","Patte de scellement","pièce"],
 ["boulons","🔩","Boulon de lit 8 × 120","pièce"],["visbois","🔩","Vis à bois","boîte de 100",100],["chevilles","🔩","Cheville + vis","pièce"],["colle","🧴","Colle à bois","pot"],
 ["patins","⚪","Patin de pied","pièce"],["sangles","🧵","Sangle élastique","m"],["mousse","🟨","Mousse 10 cm","m²"],["tissu","🧶","Tissu d'ameublement","m"],
 ["led","💡","Ruban LED + alimentation","m"],["moraillon","🔒","Moraillon porte-cadenas","pièce"],
 ["supinv","🔩","Support invisible d'étagère","pièce"],["mastic","🧴","Colle mastic de fixation","cartouche"],["vernis","🖌️","Vernis ou peinture","litre"],
 ["mousse12","🟨","Mousse d'assise 12 cm (D35)","m²"],["mousse5","🟨","Mousse 5 cm","m²"],["ouate","☁️","Ouate (dacron)","m"],["toile","▫️","Toile de dessous","m"],
 ["agrafes","📎","Agrafes de tapissier","boîte"],["colleContact","🧴","Colle contact néoprène","pot"],["boutons","🔘","Bouton de capitonnage","pièce"],
 ["piedsBois","🦵","Pied bois tourné","pièce"],["piedsMetal","🦵","Pied métal doré","pièce"]];
const EX_JOUR=10000; // prix de journée d'exemple (FCFA)
const EX_PRIX={mela18:22000,mela16:20000,cp18:25000,mdf18:20000,cp5:9000,chant:300,vis440:1500,vis3516:1500,tourillons:1500,charn:750,charnv:2500,poignees:500,coulisses:2500,taquets:25,tringle:1500,supports:250,rail:3000,galets:5000,cuvettes:500,verre:15000,miroir:10000,pieds:2000,piedsreg:750,pdt:15000,roulettes:500,lattes:1000,tasseaux:750,poutre:1500,equerres:150,fixmur:1000,fixhaut:1000,pointes:1000,vasque:25000,
  paumelles:500,serrure:6000,espagnolette:3500,pattes:150,boulons:300,visbois:1500,chevilles:50,colle:2500,patins:100,sangles:500,mousse:12000,tissu:3000,led:2500,moraillon:500,supinv:1500,mastic:3500,vernis:6000,
  lame:2500,latte:2000,planche:6000,chevron:5000,madrier:15000,
  mousse12:15000,mousse5:6000,ouate:1500,toile:800,agrafes:1500,colleContact:4000,boutons:100,piedsBois:1000,piedsMetal:2500};
const DEF_CAT=()=>({boutique:{nom:"",wa:"",commune:""},exemple:false,panneaux:[{id:"mela18",nom:"Mélaminé",ep:18,prix:0},{id:"mela16",nom:"Mélaminé",ep:16,prix:0},{id:"cp18",nom:"Contreplaqué",ep:18,prix:0},{id:"mdf18",nom:"MDF",ep:18,prix:0},{id:"cp5",nom:"Contreplaqué",ep:5,prix:0,dos:true}],sections:[],articles:[],prix:{}});
let CAT=DEF_CAT(),AT={nom:"",tel:"",jour:0,marge:20,valid:15};
try{const c=JSON.parse(localStorage.getItem("menuipro-catalogue")||"null");if(c&&c.panneaux)CAT={...DEF_CAT(),...c};if(!Array.isArray(CAT.sections))CAT.sections=[];if(!Array.isArray(CAT.articles))CAT.articles=[]}catch(e){}
try{const a=JSON.parse(localStorage.getItem("menuipro-atelier")||"null");if(a)AT={...AT,...a}}catch(e){}
let ME=null; // compte connecté : {user, profil, quinc}
const saveCatLocal=()=>{try{localStorage.setItem("menuipro-catalogue",JSON.stringify(CAT))}catch(e){}};
const saveCat=()=>{if(cloud.actif&&ME&&!estQuinc()&&!CAT.exemple)return;saveCatLocal();pousserCatalogue()}; // un menuisier ne garde pas de prix modifiés
const saveAt=()=>{try{localStorage.setItem("menuipro-atelier",JSON.stringify(AT))}catch(e){}pousserAtelier()};
const artPrice=k=>+(CAT.prix[k]||0);
const hwArticle=k=>k.startsWith("coulisses")?"coulisses":k==="tourillons_ch"?"tourillons":k;
function panLabel(){const pn=CAT.panneaux.find(x=>x.id===st.panneau);return (pn?pn.nom+" "+pn.ep+" mm":"panneau "+st.ep+" mm")+" "+COLORS[st.color][0].toLowerCase()}
let lastBuy={lines:[],total:0,missing:0};
function buyLines(ctx){
  const {chant}=outils(ctx),L=[];
  const n18=lastRes.caisson.sheets.length,n5=lastRes.dos.sheets.length;
  const pn=CAT.panneaux.find(x=>x.id===st.panneau),dos=CAT.panneaux.find(x=>x.dos)||{prix:0};
  const add=(e,label,detail,qty,unit)=>L.push({e,label,detail,qte:qty,pu:unit||null,total:unit?qty*unit:null});
  if(n18)add("🟫",panLabel(),n18+" feuille"+(n18>1?"s":"")+" 244 × 122",n18,pn?pn.prix:0);
  if(n5)add("🟫","Contreplaqué 5 mm",n5+" feuille"+(n5>1?"s":"")+" (dos, fonds, parements)",n5,dos.prix);
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
  // Articles ajoutés à la main par le menuisier (ceux de sa quincaillerie, ou les accessoires standard).
  Object.entries(cfg().extras||{}).forEach(([k,q])=>{if(!(q>0))return;const a=articleExtra(k);if(a)add(a.e,a.nom,"➕ "+q+" "+a.unite+(q>1&&/^(pièce|paire|boîte|feuille|rouleau|sachet|pot|lot)$/.test(a.unite)?"s":""),q,a.prix)});
  L.forEach(l=>{if(l.total===0)l.total=null});
  return {lines:L,total:L.reduce((t,l)=>t+(l.total||0),0),missing:L.filter(l=>l.total==null).length,hc,n18,n5};
}
/* ----- Articles de la quincaillerie ----- */
// Clé « a:id » : article ajouté par la quincaillerie ; « s:clé » : accessoire standard de la liste des prix.
function articleExtra(k){
  if(k.startsWith("a:")){const a=CAT.articles.find(x=>x.id===k.slice(2));return a&&a.nom?{e:a.e||"🛍️",nom:a.nom,unite:a.unite||"pièce",prix:+a.prix||0}:null}
  const s=ARTICLES.find(x=>x[0]===k.slice(2));return s?{e:s[1],nom:s[2],unite:s[3],prix:artPrice(s[0])}:null;
}
function choixArticles(){
  const c=cfg();c.extras=c.extras||{};
  const ligne=(k,a)=>{const q=c.extras[k]||0,out=el("output",{},String(q));
    const chg=d=>{const v=Math.max(0,Math.min(999,(c.extras[k]||0)+d));if(v)c.extras[k]=v;else delete c.extras[k];compute()};
    return el("div",{class:"step art-choix"+(q?" pris":"")},el("span",{class:"name"},a.e+" "+a.nom,el("small",{class:"note"}," · "+(a.prix?fmt(a.prix)+" F / ":"")+a.unite)),
      el("div",{class:"stepper"},el("button",{type:"button","aria-label":"Moins",onclick:()=>chg(-1)},"−"),out,el("button",{type:"button","aria-label":"Plus",onclick:()=>chg(1)},"+")))};
  const perso=CAT.articles.filter(a=>a.nom).map(a=>ligne("a:"+a.id,articleExtra("a:"+a.id)));
  const pris=Object.keys(c.extras).filter(k=>k.startsWith("s:")).length;
  const std=el("details",{class:"art-std",...(pris?{open:""}:{})},el("summary",{},"🧰 Autres accessoires"),...ARTICLES.map(([k])=>ligne("s:"+k,articleExtra("s:"+k))));
  return el("div",{class:"art-extra"},el("div",{class:"sub"},"➕ Ajouter des articles"+(CAT.boutique.nom?" de "+CAT.boutique.nom:"")),
    perso.length?el("div",{class:"art-liste"},...perso):el("p",{class:"note"},"Votre quincaillerie n'a pas encore ajouté ses propres articles."),std);
}
function renderKit(ctx){
  const {tools}=outils(ctx),bl=lastBuy;
  const ex=$("artExtra");if(ex)ex.replaceChildren(choixArticles());
  $("buy").replaceChildren(...bl.lines.map(l=>el("div",{class:"line"},el("span",{class:"e","aria-hidden":"true"},l.e),el("div",{},el("b",{},l.label),el("span",{},l.detail)),l.total!=null?el("span",{class:"pr"},fmt(l.total)+" F"):el("span",{class:"pr q"},"prix ?"))));
  $("buyTotal").textContent=bl.total?fmt(bl.total)+" FCFA":"—";
  const ban=$("buyBanner");
  if(bl.missing){ban.hidden=false;ban.replaceChildren(document.createTextNode(bl.missing+" article"+(bl.missing>1?"s":"")+" sans prix. "),(peutModifierPrix()?el("a",{href:"#catalogue"},"Compléter le catalogue"):document.createTextNode(ME&&ME.quinc?"Demandez à "+ME.quinc.nom+" de les ajouter.":"Rejoignez votre quincaillerie (onglet Compte) pour avoir ses prix.")),document.createTextNode(CAT.exemple?" · Les prix actuels sont des exemples.":""),...(!CAT.exemple&&!lectureSeule()?[el("button",{type:"button",class:"btn",style:"margin-top:8px;display:block",onclick:essayerExemple},"🧪 Essayer avec des prix d'exemple")]:[]))}
  else if(CAT.exemple){ban.hidden=false;ban.textContent=peutModifierPrix()?"Prix d'exemple : remplacez-les par ceux de la quincaillerie (onglet Catalogue).":"Prix d'exemple : les vrais prix arriveront de votre quincaillerie."}
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
function optsText(r=R(st.id),c=cfg()){return r.opts.filter(x=>!x.si||x.si(c.o)).map(x=>x.choice?(x.options.find(o=>o[0]===c.o[x.k])||[,""])[1]:(x.min===0&&x.max===1?(c.o[x.k]?x.label:""):c.o[x.k]+" "+(+c.o[x.k]===1?x.label.replace(/^(\S+?)s\b/,"$1"):x.label).toLowerCase())).filter(Boolean).join(" · ")}
function orderText(){
  const bl=lastBuy,r=R(st.id);
  const lines=bl.lines.map(l=>"- "+l.label+" : "+l.detail.replace(/ \(.*\)$/,""));
  return ["Bonjour"+(CAT.boutique.nom?" "+CAT.boutique.nom:"")+",","Commande pour "+nomMeuble(r)+" ("+dimsText()+") :",...lines,bl.total?"Total estimé : "+fmt(bl.total)+" FCFA"+(bl.missing?" (hors articles sans prix)":""):"",(AT.nom||AT.tel)?"— "+[AT.nom,AT.tel].filter(Boolean).join(" · "):"","(calculé avec MenuiPro)"].filter(Boolean).join("\n");
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
  return ["DEVIS"+(num?" N° "+num:"")+(AT.nom?" — "+AT.nom:""),AT.tel?"Tél. "+AT.tel:"","Date : "+new Date().toLocaleDateString("fr-FR"),st.dv.client?"Client : "+st.dv.client:"","",nomMeuble(r)+" — "+dimsText(),optsText(),"Couleur : "+COLORS[st.color][0]+" · "+panLabel(),"","Prix : "+fmt(d.prix)+" FCFA",ac?"Acompte à la commande : "+fmt(ac)+" FCFA ("+pctAcompte()+" %)":"","Devis valable "+(AT.valid||15)+" jours."].filter((x,i,a)=>x!==""||a[i-1]!=="").join("\n");
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
  c.fillStyle=DOC.encre;c.font=police(700,48);c.fillText(nomMeuble(r),60,1000);
  c.font=police(400,34);c.fillStyle=DOC.gris;let y=1050;
  [dimsText(),optsText(),"Couleur : "+COLORS[st.color][0]+" · "+panLabel()].filter(Boolean).forEach(t=>wrapText(c,t,W-120).forEach(l=>{c.fillText(l,60,y);y+=46}));
  c.fillStyle=DOC.vertClair;c.fillRect(60,y+20,W-120,ac?230:170);
  c.fillStyle=DOC.encre;c.font=police(400,32);c.fillText("Prix",90,y+75);
  c.font=police(700,76);c.fillStyle=DOC.vert;c.fillText(fmt(d.prix)+" FCFA",90,y+160);
  if(ac){c.fillStyle=DOC.encre;c.font=police(400,32);c.fillText("Acompte à la commande : "+fmt(ac)+" FCFA ("+pctAcompte()+" %)",90,y+215)}
  c.fillStyle=DOC.gris;c.font=police(400,28);c.fillText("Devis valable "+(AT.valid||15)+" jours · calculé avec MenuiPro",60,H-50);
  const plan=$("facadeDevis").checked?await imageFacade():null;
  await partagerImage(plan?empiler(cv,plan):cv,nomFichier("devis",st.dv.client||nomMeuble(r)),"Devis",devisText(),$("dStatus"),$("devisPanel"));
};

/* ----- Plan de face coté ----- */
// Couleurs écrites en clair (pas de variables CSS) : le même SVG sert à l'image partagée.
const FAC={encre:"#2b211a",bois:"#8a5226",boisClair:"#f3e4d1",cote:"#1d6b52",gris:"#6c5f55"};
const STYLE_FACE={noir:["#2b2b2b","#111"],caisson:["#ffffff",FAC.encre],porte:[FAC.boisClair,FAC.bois],tiroir:[FAC.boisClair,FAC.bois],verre:["#d6e8f0","#5b8aa0"],miroir:["#a9bcc6","#5b7480"],plan:["#6c5f55",FAC.encre],metal:["#9a9a9a","#555"],massif:["#ecd6b0",FAC.bois],electro:["#eef0f2","#8a9096"]};
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
  v.rects.forEach(r=>{if(r.nature==="dos"||r.nature==="led")return;const [f,s]=STYLE_FACE[r.nature]||STYLE_FACE.caisson;
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
  c.fillStyle=DOC.encre;c.font=police(700,40);c.fillText(nomMeuble(),60,240);
  c.drawImage(img,60+(iw-sc)/2,280,sc,sc*ratio);
  const k=lastFace.cotes;c.fillStyle=DOC.gris;c.font=police(400,28);
  c.fillText("Cotes en cm · profondeur "+cm(k.profondeur)+" cm (façades comprises)"+(k.sol?" · à "+cm(k.sol)+" cm du sol":""),60,H-60);
  return cv;
}
$("facadeImg").onclick=async()=>{
  const cv=await imageFacade();const sEl=$("facadeStatus");
  if(!cv){sEl.className="status err";sEl.textContent="Le plan n'a pas pu être préparé.";return}
  await partagerImage(cv,nomFichier("plan",nomMeuble()),"Plan","Plan de face : "+nomMeuble()+" — "+dimsText(),sEl,$("facadePanel"));
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
  const data={recipe:st.id,cfg:JSON.parse(JSON.stringify(cfg())),color:st.color,panneau:st.panneau,dv:{...st.dv},prix:d.prix,materiel:lastBuy.total,nom:st.dv.client||nomMeuble(r),modele:modeleActif(),date:new Date().toISOString()};
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
  $("artTable").replaceChildren(el("thead",{},el("tr",{},el("th",{},"Article"),el("th",{},"Vendu par"),el("th",{},"Prix (F)"))),el("tbody",{},ARTICLES.map(([k,e,l,u])=>el("tr",{},el("td",{},e+" "+l),el("td",{},u),el("td",{},pin(CAT.prix[k],v=>CAT.prix[k]=v))))));
  // Articles propres à la quincaillerie : icône, nom, vendu par, prix. Les menuisiers les ajoutent à leur liste d'achat.
  const ICONES=["🛍️","🔩","🚪","⭕","🗄️","💡","🔒","🧴","🖌️","🪟","🦵","🧵","📦","🪵","🎞️","🛞"],UNITES=["pièce","paire","m","m²","boîte","sachet","kit","lot","litre","rouleau","pot","feuille"];
  $("persoTable").replaceChildren(...CAT.articles.map(a=>{
    const ic=el("select",{"aria-label":"Icône"},...ICONES.map(x=>{const o=el("option",{value:x},x);if(x===(a.e||"🛍️"))o.selected=true;return o}));ic.addEventListener("change",e=>{a.e=e.target.value;saveCat()});
    const nm=el("input",{type:"text",maxlength:"60",placeholder:"Ex. Poignée dorée 128",style:"text-align:left;font-family:var(--body)"});nm.value=a.nom||"";nm.addEventListener("input",e=>{a.nom=e.target.value.slice(0,60);saveCat()});
    const un=el("select",{"aria-label":"Vendu par"},...UNITES.map(x=>{const o=el("option",{value:x},x);if(x===(a.unite||"pièce"))o.selected=true;return o}));un.addEventListener("change",e=>{a.unite=e.target.value;saveCat()});
    let armed=false;const del=el("button",{type:"button",class:"btn"},"🗑️");del.onclick=()=>{if(!armed){armed=true;del.textContent="Sûr ?";return}CAT.articles=CAT.articles.filter(x=>x!==a);saveCat();renderCatalogue()};
    const px=pin(a.prix,v=>a.prix=v);px.setAttribute("aria-label","Prix en francs");
    return el("div",{class:"art-ligne"},ic,nm,un,el("label",{class:"prix-f"},px," F"),del);
  }));
  $("persoVide").hidden=CAT.articles.length>0;
  const ro=!peutModifierPrix();
  $("roBanner").hidden=!ro;
  if(ro)$("roBanner").textContent=ME&&ME.quinc&&!estAdmin()?"🔒 Prix gérés par "+ME.quinc.nom+". Ils se mettent à jour automatiquement ; seule la quincaillerie peut les modifier."
    :estAdmin()?"🔒 Les prix sont gérés par chaque quincaillerie, depuis son propre compte."
    :"🔒 Les prix viennent de votre quincaillerie. Rejoignez-la (onglet Compte, ou son lien d'invitation) pour avoir ses prix.";
  $("v-catalogue").querySelectorAll("input,button").forEach(x=>{x.disabled=ro});
  $("v-catalogue").querySelectorAll("#fillEx,#resetCat,#addPan,#addArt").forEach(x=>{x.hidden=ro});
  $("ownBanner").hidden=!(estQuinc()&&ME.quinc);
}
[["bNom","nom"],["bWa","wa"],["bCom","commune"]].forEach(([id,k])=>$(id).addEventListener("input",e=>{CAT.boutique[k]=e.target.value;saveCat()}));
$("addArt").onclick=()=>{CAT.articles.push({id:"art"+Date.now().toString(36),e:"🛍️",nom:"",unite:"pièce",prix:0});saveCat();renderCatalogue();const t=$("persoTable").querySelectorAll("input[type=text]");if(t.length)t[t.length-1].focus()};
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
function go(v){show(v)}
// Onglets autorisés selon le compte : chacun ne voit que ce qui le concerne.
//  - Quincaillerie : ses commandes et menuisiers (Compte), ses prix (Catalogue). Pas de conception.
//  - Administrateur : la console (Compte), et Concevoir / Mes projets pour faire des démonstrations.
//  - Menuisier : tout, mais les prix sont en lecture seule (ceux de sa quincaillerie).
const VUES_ROLE={
  quincaillerie:{vues:["compte","catalogue"],accueil:"compte",libelles:{compte:["📥","Commandes & menuisiers","Commandes"],catalogue:["🏷️","Mes prix","Mes prix"]}},
  admin:{vues:["compte","concevoir","projets"],accueil:"compte",libelles:{compte:["🛡️","Console","Console"],concevoir:["🪚","Démo","Démo"]}},
  menuisier:{vues:["concevoir","projets","catalogue","atelier","compte"],accueil:"concevoir",libelles:{catalogue:["🏷️","Prix de ma quincaillerie","Prix"]}}
};
// Sans réseau, ME n'est pas chargé : on reprend le rôle mémorisé à la dernière connexion.
function roleCourant(){
  if(ME)return estAdmin()?"admin":estQuinc()?"quincaillerie":"menuisier";
  if(!cloud.actif)return null;
  try{return localStorage.getItem("menuipro-role")}catch(e){return null}
}
function vuesPermises(){
  const r=VUES_ROLE[roleCourant()];if(!r)return VIEWS;
  return r.vues.map(k=>{const b=VIEWS.find(x=>x[0]===k),l=r.libelles[k];return l?[k,...l]:b});
}
function vueAccueil(){const r=VUES_ROLE[roleCourant()];return r?r.accueil:"concevoir"}
function dessinerNav(v){
  $("appnav").style.setProperty("--nav-n",vuesPermises().length); // 2, 3 ou 5 onglets selon le rôle
  $("appnav").replaceChildren(...vuesPermises().map(([k,ic,l,c])=>el("button",{type:"button",class:"navbtn","data-vue":k,"aria-current":k===v?"page":"false","aria-label":l,onclick:()=>go(k)},el("span",{class:"ic","aria-hidden":"true"},ic),el("span",{class:"long"},l),el("span",{class:"court","aria-hidden":"true"},c))));
  majPastille();majNavH();
}
function show(v){
  const permises=vuesPermises();
  if(!permises.find(x=>x[0]===v))v=vueAccueil();
  VUE=v;
  VIEWS.forEach(([k])=>$("v-"+k).hidden=k!==v);
  dessinerNav(v);
  if(v==="projets")renderProjects();
  if(v==="catalogue")renderCatalogue();
  if(v==="atelier")renderAtelier();
  if(v==="compte")renderCompte();
  if(v==="concevoir"&&lastCtx){renderPanSel();compute()}
  if(v==="concevoir")setEtape(st.etape,true);
  document.body.classList.toggle("avec-etapes",v==="concevoir");
  majNavH();
  window.scrollTo(0,0);
  noterEcran();
}

/* ----- Retour : bouton ← en haut, boutons « ← étape précédente », bouton retour du téléphone ----- */
// Chaque écran (onglet, étape de Concevoir, famille de meubles) devient une entrée d'historique :
// le bouton retour du téléphone revient à l'écran d'avant au lieu de fermer l'appli.
const etatEcran=()=>VUE==="concevoir"?{v:VUE,e:st.etape,f:st.etape==="choisir"&&st.room||null}:{v:VUE};
const memeEcran=(a,b)=>!!a&&a.v===b.v&&(a.e||null)===(b.e||null)&&(a.f||null)===(b.f||null);
// Regroupe les changements faits d'un coup (ex. onglet + étape) en une seule entrée.
function noterEcran(){
  if(RESTAURE||!VUE||tNoter)return;
  tNoter=setTimeout(()=>{tNoter=0;if(RESTAURE||!VUE)return;
    const cur=history.state&&history.state.mp?history.state:null,e=etatEcran(),url=location.pathname+location.search+"#"+e.v;
    try{
      if(memeEcran(cur,e)){if(location.hash.slice(1)!==e.v)history.replaceState(cur,"",url)}
      else if(!cur){PROF++;history.replaceState({mp:1,n:PROF,...e},"",url)} // premier écran, ou lien « #… » touché
      else{PROF=cur.n+1;history.pushState({mp:1,n:PROF,...e},"",url)}
    }catch(err){}
    majRetour();
  },0);
}
// Où mène « ← » quand il n'y a pas d'écran précédent dans l'historique.
function parentLogique(){
  if(VUE==="concevoir"){const i=ETAPES.findIndex(x=>x[0]===st.etape);
    if(i>0)return ()=>setEtape(ETAPES[i-1][0]);
    if(st.room||query)return ()=>{st.room=null;query="";$("search").value="";save();renderCatalog()};}
  if(VUE&&VUE!==vueAccueil())return ()=>go(vueAccueil());
  return null;
}
function retour(){
  const m=document.querySelector(".modal-carte");if(m)return m.remove();
  const s=history.state;
  if(s&&s.mp&&s.n>0)history.back();else{const f=parentLogique();if(f)f()}
}
function majRetour(){
  const b=$("btnRetour");if(!b)return;
  const s=history.state;b.hidden=!((s&&s.mp&&s.n>0)||parentLogique());
}
window.addEventListener("popstate",ev=>{
  const s=ev.state;if(!s||!s.mp)return;
  document.querySelectorAll(".modal-carte").forEach(n=>n.remove());
  PROF=s.n;RESTAURE=true;
  try{
    if(s.v==="concevoir"){
      if(s.e==="choisir"&&(st.room||null)!==(s.f||null)){st.room=s.f||null;query="";$("search").value="";renderCatalog()}
      if(s.e)st.etape=s.e;save();
    }
    show(s.v);
  }finally{RESTAURE=false}
  majRetour();
});
$("btnRetour").addEventListener("click",retour);
// Bas de chaque étape : « ← étape précédente » à côté de « suivant ».
document.querySelectorAll("#v-concevoir .etape").forEach(sec=>{
  const i=ETAPES.findIndex(x=>x[0]===sec.dataset.etape);if(i<1)return;
  const [k,ic,l]=ETAPES[i-1],b=el("button",{type:"button",class:"btn retour-etape",onclick:()=>setEtape(k)},"← "+ic+" "+l);
  const suiv=sec.querySelector(":scope > .suivant"),pied=el("div",{class:"pied-etape"});
  if(suiv){suiv.replaceWith(pied);pied.append(b,suiv)}else{sec.append(pied);pied.append(b)}
});
// Hauteur de la barre d'onglets : le bandeau prix se colle juste dessous.
function majNavH(){const n=document.querySelector("nav.appnav");if(n)document.documentElement.style.setProperty("--nav-h",n.offsetHeight+"px")}
window.addEventListener("resize",majNavH);
window.addEventListener("hashchange",()=>{if(location.hash.slice(1)!==VUE)show(location.hash.slice(1))});

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
function fitCamera(){const [sx,sy,sz]=bbox.size,r=Math.max(sx,sy,sz);camera.position.set(r*1.2,sy*0.75+r*0.45,r*1.9);controls.target.set(0,sy/2,0);
  // Meuble très large (cuisine en L…) sur écran en hauteur : on recule assez pour tout voir.
  const v=Math.tan(camera.fov*Math.PI/360),champ=Math.min(v,v*(camera.aspect||1)),besoin=Math.hypot(sx,sy,sz)/2/champ*1.05;
  const off=camera.position.clone().sub(controls.target);if(off.length()<besoin)camera.position.copy(controls.target).add(off.setLength(besoin));
  controls.update()}
function update3D(ctx,refit){
  if(!has3D||!ctx)return;
  majBarreImport();
  if(vueImportee()){afficherImport(refit);return}
  jetonImport++; // une 3D importée en cours de lecture ne remplacera pas ce meuble
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
    top:new THREE.MeshStandardMaterial({color:0x6b6560,roughness:0.5}),
    noir:new THREE.MeshStandardMaterial({color:0x232323,roughness:0.8}),
    led:new THREE.MeshStandardMaterial({color:0xffe2a0,emissive:0xffb347,emissiveIntensity:1.4}),
    halo:new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:0.55}),
    or:new THREE.MeshStandardMaterial({color:0xc9a14a,roughness:0.3,metalness:0.85}),
    drap:new THREE.MeshStandardMaterial({color:0xf4f2ee,roughness:0.95}),
    electro:new THREE.MeshStandardMaterial({color:0xe6e8ea,roughness:0.3,metalness:0.35})
  };
  // Tissu : un matériau par couleur (velours mat) ; « sombre » pour le socle, « bouton » pour le capitonnage.
  const tissus={};
  const matTissu=(hex,ton=1)=>{const k=hex+ton;if(!tissus[k]){const c=new THREE.Color(hex).multiplyScalar(ton);tissus[k]=new THREE.MeshStandardMaterial({color:c,roughness:0.92,metalness:0})}return tissus[k]};
  const lineMat=new THREE.LineBasicMaterial({color:st.color===2||st.color===4?0x888888:0x333333,transparent:true,opacity:0.3});
  const boxes=ctx.parts.filter(p=>p.box&&!p.sous3d);
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  boxes.forEach(p=>{const b=boiteMonde(p);for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],b[i]);mx[i]=Math.max(mx[i],b[i]+b[i+3])}});
  const cx=(mn[0]+mx[0])/2000,cz=(mn[2]+mx[2])/2000;
  bbox.size=[(mx[0]-mn[0])/1000,(mx[1]-mn[1])/1000,(mx[2]-mn[2])/1000];
  // Pièces dans un repère tourné (retour d'une cuisine en L) : un sous-groupe placé et tourné, coordonnées locales dedans.
  const reps=new Map(),sousGroupe=r=>{if(!reps.has(r)){const g=new THREE.Group();g.position.set(r.x/1000-cx,0,r.z/1000-cz);g.rotation.y=r.rot*Math.PI/180;group.add(g);reps.set(r,g)}return reps.get(r)};
  boxes.forEach(p=>{
    const [x,y,z,sx,sy,sz]=p.box.map(v=>v/1000);
    const parent=p.rep?sousGroupe(p.rep):group,ocx=p.rep?0:cx,ocz=p.rep?0:cz;
    const doux=p.look==="tissu"||p.look==="drap"||p.look==="bouton"||p.round;
    let geo;
    if(p.forme==="arche"){
      // Arche : rectangle surmonté d'un demi-cercle, extrudé sur l'épaisseur.
      const r=Math.min(sx/2,sy*0.6),sh=new THREE.Shape();
      sh.moveTo(-sx/2,-sy/2);sh.lineTo(sx/2,-sy/2);sh.lineTo(sx/2,sy/2-r);sh.absarc(0,sy/2-r,sx/2,0,Math.PI,false);sh.lineTo(-sx/2,-sy/2);
      const b=Math.min(0.02,sz/4,sx/6);
      geo=new THREE.ExtrudeGeometry(sh,{depth:Math.max(0.001,sz-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:4,curveSegments:24});
      geo.translate(0,0,-(sz-2*b)/2);
    }else if(p.round){
      const r=Math.min(p.round/1000,sx/2-1e-4,sy/2-1e-4,sz/2-1e-4);
      geo=r>0.002?new RoundedBoxGeometry(sx,sy,sz,4,r):new THREE.BoxGeometry(sx,sy,sz);
    }else geo=new THREE.BoxGeometry(sx,sy,sz);
    const mat=p.look==="tissu"?matTissu(p.teinte||"#cbb89c",p.sombre?0.55:1):p.look==="bouton"?matTissu(p.teinte||"#cbb89c",0.45):(M[p.look]||M.case);
    const mesh=new THREE.Mesh(geo,mat);
    if(!doux&&p.look!=="glass"&&p.look!=="halo"&&p.look!=="led"&&p.look!=="or")mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),lineMat));
    const px=x+sx/2-ocx,py=y+sy/2,pz=z+sz/2-ocz;
    // Réalisme : poignées sur portes et tiroirs ; caisson du tiroir et coulisses (vus en ouvrant).
    if(p.door||p.drawer||p.slide)ajouterPoignee(mesh,p,M);
    if(p.drawer&&p.tiroir&&(p.axis||"z")==="z")ajouterCaissonTiroir(mesh,p,M,parent,ocx,ocz);
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
      const pivot=new THREE.Group();const hx=(p.hingeLeft?x:x+sx)-ocx;
      pivot.position.set(hx,0,pz);mesh.position.set(px-hx,py,0);
      pivot.userData={kind:"door",open:p.hingeLeft?-1.3:1.3,target:openState?(p.hingeLeft?-1.3:1.3):0};
      pivot.add(mesh);parent.add(pivot);movers.push(pivot);
    }else{
      mesh.position.set(px,py,pz);
      if(p.drawer){const a=p.axis||"z",dir=p.dir||1,base=a==="x"?px:pz;mesh.userData={kind:"slide",axis:a,base,open:base+dir*(p.travel||300)/1000,target:base};if(openState)mesh.userData.target=mesh.userData.open;movers.push(mesh)}
      if(p.slide){const base=px;mesh.userData={kind:"slide",axis:"x",base,open:base+p.slide*(p.travel||400)/1000,target:openState?base+p.slide*(p.travel||400)/1000:base};movers.push(mesh)}
      parent.add(mesh);
    }
  });
  // Meubles accrochés au mur (étagères, niches) : la 3D part du point le plus bas pour rester cadrée.
  group.position.y=-mn[1]/1000;
  scene.add(group);
  $("openBtn").hidden=!movers.length;$("hint3d").hidden=!movers.length;
  // Le meuble a beaucoup grandi ou rétréci (ex. cuisine en I → en L) : on recadre.
  const av=bbox.cadre;if(refit||!av||bbox.size.some((v,i)=>Math.abs(v-av[i])>0.3*Math.max(av[i],0.3))){bbox.cadre=bbox.size.slice();fitCamera()}
}
/* ----- Poignées, caissons de tiroir et coulisses (3D seulement : rien ne change dans la découpe) ----- */
const geoCache={};
const boite3D=(sx,sy,sz)=>{const k=[sx,sy,sz].map(v=>v.toFixed(4)).join();return geoCache[k]||(geoCache[k]=new THREE.BoxGeometry(sx,sy,sz))};
const tube3D=(r,l)=>{const k="t"+r+"_"+l.toFixed(4);return geoCache[k]||(geoCache[k]=new THREE.CylinderGeometry(r,r,l,12))};
// Poignée barre : barre + 2 pattes, posée sur la face avant de la pièce (repère local du maillage, en m).
function poigneeBarre(long,vertical,M){
  const g=new THREE.Group(),r=0.006,dep=0.028,ec=long*0.8;
  const barre=new THREE.Mesh(tube3D(r,long),M.metal);if(!vertical)barre.rotation.z=Math.PI/2;barre.position.z=dep;g.add(barre);
  [-1,1].forEach(s=>{const patte=new THREE.Mesh(tube3D(0.0045,dep),M.metal);patte.rotation.x=Math.PI/2;patte.position.z=dep/2;
    if(vertical)patte.position.y=s*ec/2;else patte.position.x=s*ec/2;g.add(patte)});
  return g;
}
function ajouterPoignee(mesh,p,M){
  const [x,y,z,sx,sy,sz]=p.box.map(v=>v/1000);
  if(p.slide){ // porte coulissante : poignée cuvette encastrée près du bord qui glisse
    const cuv=new THREE.Mesh(boite3D(0.03,0.16,0.004),M.noir);cuv.position.set((p.slide>0?-1:1)*(sx/2-0.06),0,sz/2+0.001);mesh.add(cuv);return}
  if(p.drawer){
    if((p.axis||"z")!=="z"){ // tiroir de lit, qui sort sur le côté
      const h=poigneeBarre(Math.min(0.16,sz*0.4),false,M);h.rotation.y=(p.dir||1)>0?Math.PI/2:-Math.PI/2;h.position.x=(p.dir||1)*sx/2;mesh.add(h);return}
    const long=sx<0.35?0.096:sx<0.6?0.16:0.32,h=poigneeBarre(long,false,M);
    h.position.set(0,sy>0.3?sy/2-0.07:0,sz/2);mesh.add(h);return}
  // Porte : barre verticale côté opposé aux charnières, à hauteur de main.
  const long=Math.min(sy*0.3,sy<0.6?0.128:0.32),bas=y,haut=y+sy;
  let yc=bas+sy/2;
  if(haut<1.0)yc=haut-0.06-long/2;               // meuble bas : poignée en haut de la porte
  else if(bas>1.3)yc=bas+0.06+long/2;            // meuble haut (au mur) : poignée en bas
  else if(sy>1.2)yc=Math.min(haut-long/2-0.05,Math.max(bas+long/2+0.05,1.05)); // grande porte : vers 1,05 m du sol
  const h=poigneeBarre(long,true,M);
  h.position.set((p.hingeLeft?1:-1)*(sx/2-0.045),yc-(y+sy/2),sz/2);mesh.add(h);
}
// Caisson du tiroir (côtés, fond, arrière) et coulisses : la partie mobile suit la façade, le rail fixe reste dans le meuble.
function ajouterCaissonTiroir(mesh,p,M,grp,cx,cz){
  const t=p.tiroir,mm=v=>v/1000,[X,Y,Z,SX,SY,SZ]=p.box;
  const centre=[X+SX/2,Y+SY/2,Z+SZ/2];
  const jeu=12.5,ep=Math.min(t.ep,16),x0=t.x+jeu,bw=t.w-2*jeu,z0=t.front-t.prof,d=t.prof,yb=t.y,h=t.h;
  const local=(bx,by,bz,sx_,sy_,sz_,mat,parent=mesh)=>{const m=new THREE.Mesh(boite3D(mm(sx_),mm(sy_),mm(sz_)),mat);
    m.position.set(mm(bx+sx_/2-centre[0]),mm(by+sy_/2-centre[1]),mm(bz+sz_/2-centre[2]));parent.add(m);return m};
  const bois=M.massif,fond=M.back;
  local(x0,yb,z0,ep,h,d,bois);local(x0+bw-ep,yb,z0,ep,h,d,bois);         // côtés
  local(x0+ep,yb,z0,bw-2*ep,h,ep,bois);local(x0+ep,yb,t.front-ep,bw-2*ep,h-20,ep,bois); // arrière, avant intérieur
  local(x0+ep,yb+10,z0+ep,bw-2*ep,5,d-2*ep,fond);                           // fond
  // Coulisses à billes : rail mobile sur le tiroir, rail fixe vissé dans le meuble.
  const yc=yb+h*0.35,L=t.coulisse,acier=M.rail||(M.rail=new THREE.MeshStandardMaterial({color:0xc9ced2,roughness:0.3,metalness:0.55}));
  [[t.x+1,1],[t.x+t.w-11,-1]].forEach(([xr])=>{
    local(xr,yc-14,t.front-L-5,10,28,L-10,acier);                       // partie mobile (suit le tiroir)
    const fixe=new THREE.Mesh(boite3D(0.011,0.036,mm(L)),acier);        // partie fixe (reste dans le meuble)
    fixe.position.set(mm(xr+5)-cx,mm(yc),mm(t.front-L/2-8)-cz);grp.add(fixe);
  });
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


/* ----- 3D importée par le menuisier (montrer au client) ----- */
const fichierImport=el("input",{type:"file",accept:imp3d.ACCEPT,hidden:"hidden"});document.body.append(fichierImport);
let importCible=null,importCotes=false,jetonImport=0,importIndispo=null,tailleImport=null;
const cache3D=new Map(); // id du fichier → objet 3D déjà lu
const couleurImport=()=>new THREE.Color(COLORS[st.color][1]).getHex();
const vueImportee=()=>{const f=cfg().fichier3d;return !!f&&st.vue3d!=="menuipro"&&importIndispo!==f.id};
function demanderImport(idMeuble,prendreCotes){importCible=idMeuble;importCotes=!!prendreCotes;fichierImport.value="";fichierImport.click()}
fichierImport.onchange=()=>{const f=fichierImport.files[0];if(!f)return;
  if(imp3d.estImage(f))importerPhoto(f,importCotes);else importer3D(f,importCible||st.id,importCotes)};
$("btnDessiner").onclick=()=>choisirMeuble("croquis");
$("btnImporter").onclick=()=>demanderImport("modele3d",true); // « Ma 3D » : la découpe est lue dans la 3D
/* Vraies dimensions du meuble, demandées au moment d'envoyer l'image ou la 3D (toutes facultatives).
   Renvoie {L,H,P} en cm (null pour une cote non tapée) ; tout à null si le menuisier passe. */
function demanderDimensions(titre,urlImage){
  return new Promise(ok=>{
    const champ=(k,ic,lab,min,max)=>{const i=el("input",{type:"number",inputmode:"decimal",step:"0.1",min:String(min),max:String(max),placeholder:"cm","aria-label":lab,id:"dimImp"+k});
      return {k,i,min,max,bloc:el("label",{class:"imp-dim dim-gros"},el("span",{},ic+" "+lab),i)}};
    const ch=[champ("L","↔️","Largeur",5,600),champ("H","↕️","Hauteur",5,300),champ("P","↗️","Profondeur",2,120)];
    const lire=()=>{const d={};ch.forEach(c=>{const v=Math.round(parseFloat(String(c.i.value).replace(",","."))*10)/10;d[c.k]=v>=c.min&&v<=c.max?v:null});return d};
    const fin=d=>{boite.remove();ok(d)};
    const valider=()=>{
      const faux=ch.filter(c=>String(c.i.value).trim()&&lire()[c.k]==null);
      if(faux.length){faux.forEach(c=>c.i.classList.add("err"));toast("Cote impossible : "+faux.map(c=>c.k==="L"?"largeur":c.k==="H"?"hauteur":"profondeur").join(", ")+".",true);return}
      fin(lire())};
    ch.forEach(c=>c.i.addEventListener("keydown",e=>{if(e.key==="Enter")valider()}));
    const boite=el("div",{class:"attente-lecture",role:"dialog","aria-label":"Dimensions du meuble"},el("div",{class:"attente-boite dims-boite"},
      urlImage?el("img",{src:urlImage,alt:"Votre image",class:"dims-image"}):el("span",{class:"e-fixe","aria-hidden":"true"},"📏"),
      el("b",{},titre),
      el("span",{class:"note"},"Tapez les vraies dimensions du meuble (en cm) : la 3D et les coupes seront justes tout de suite. Laissez vide ce que vous ne savez pas."),
      el("div",{class:"dims-champs"},...ch.map(c=>c.bloc)),
      el("div",{class:"choix-echec"},
        el("button",{type:"button",class:"btn primary",onclick:valider},"✅ Valider"),
        el("button",{type:"button",class:"btn",onclick:()=>fin({L:null,H:null,P:null})},"⏭️ Je ne sais pas"))));
    document.body.append(boite);setTimeout(()=>ch[0].i.focus(),50);
  });
}
const aDesDims=d=>!!(d&&(d.L||d.H||d.P));
const noteDims=d=>aDesDims(d)?"Dimensions réelles du meuble données par le menuisier : "+[d.L&&"largeur "+d.L+" cm",d.H&&"hauteur "+d.H+" cm",d.P&&"profondeur "+d.P+" cm"].filter(Boolean).join(", ")+". Utilise-les pour les proportions.":"";

async function importer3D(f,idMeuble,prendreCotes){
  const err=imp3d.verifierFichier(f);if(err){toast(err,true);return}
  const dims=prendreCotes?await demanderDimensions("Dimensions réelles de ce meuble 3D"):null;
  toast("⏳ Lecture de la 3D…");
  const ext=imp3d.extension(f.name);let obj;
  try{obj=await imp3d.lireObjet(f,ext,couleurImport())}catch(e){toast("Impossible de lire ce fichier 3D. Essayez de l'exporter en GLB.",true);return}
  const id="m"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const fi={id,nom:f.name.slice(0,80),ext,octets:f.size,largeur:(dims&&dims.L)||imp3d.devinerLargeurCm(imp3d.tailleBrute(obj)),quart:0,couche:0,chemin:null};
  cache3D.set(id,obj);
  try{await imp3d.garderLocal(id,f)}catch(e){}
  if(st.id!==idMeuble){st.id=idMeuble;st.modele=null;openState=false;sel=0}
  const c=cfg();c.fichier3d=fi;st.vue3d="import";importIndispo=null;
  // « Mon dessin » prend les cotes de la 3D : le menuisier n'a plus qu'à tracer les cases.
  const r=R(st.id);
  if(prendreCotes&&(r.dessin||r.importe)){const t=imp3d.placer(obj,fi).taille.map(v=>Math.max(r.importe?5:30,Math.round(v*100)));c.L=t[0];c.H=t[1];c.P=Math.max(r.importe?5:20,t[2])}
  // Cotes tapées par le menuisier : elles passent avant celles devinées dans le fichier.
  if(dims){if(dims.L)c.L=dims.L;if(dims.H)c.H=dims.H;if(dims.P)c.P=dims.P}
  if(r.importe)lireDecoupe3D(true);
  save();renderCatalog();renderControls();compute(true);setEtape("voir");
  if(r.importe){const n=(c.o.panneaux&&c.o.panneaux.list.length)||0;
    toast(n>=2?"✂️ "+n+" pièces lues dans votre 3D."+(aDesDims(dims)?" Aux dimensions tapées : "+c.L+" × "+c.H+" × "+c.P+" cm.":" Tapez les vraies dimensions sous la 3D : les coupes s'ajustent."):"3D importée, mais je ne trouve pas de panneaux dedans. Pour la découpe, dessinez le meuble ✏️.",n<2)}
  else toast("✅ 3D importée. Réglez la largeur réelle sous la 3D si la taille n'est pas bonne.");
  if(ME)cloud.envoyerModele3D(id+"."+ext,f).then(ch=>{fi.chemin=ch;save();majBarreImport()}).catch(e=>toast("3D gardée sur ce téléphone seulement : "+cloud.message(e),true));
}
/* ----- Photo (ou image) du meuble : on la cadre, on tape les cotes, on décalque dans « Mon dessin » ----- */
const photosURL=new Map(); // id → URL de l'image déjà chargée
function urlPhoto(ph){
  if(photosURL.has(ph.id))return photosURL.get(ph.id);
  photosURL.set(ph.id,null);
  (async()=>{
    let blob=await imp3d.lireLocal(ph.id);
    if(!blob&&ph.chemin&&ME){try{blob=await cloud.telechargerModele3D(ph.chemin);imp3d.garderLocal(ph.id,blob).catch(()=>{})}catch(e){}}
    if(!blob){photosURL.delete(ph.id);return}
    photosURL.set(ph.id,URL.createObjectURL(blob));
    if(editeurActif)editeurActif.redessiner();
  })();
  return null;
}
async function importerPhoto(f,nouveau){
  if(f.size>imp3d.TAILLE_MAX){toast("Photo trop lourde (maximum 20 Mo).",true);return}
  toast("⏳ Préparation de la photo…");
  let r;try{r=await imp3d.reduireImage(f)}catch(e){toast("Cette image ne s'ouvre pas sur ce téléphone. Essayez une photo JPG ou PNG.",true);return}
  const id="p"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  try{await imp3d.garderLocal(id,r.blob)}catch(e){}
  photosURL.set(id,URL.createObjectURL(r.blob));
  const photo={id,nom:f.name.slice(0,80),l:r.l,h:r.h,cadre:[0,0,1,1],visible:1,chemin:null};
  const envoyer=c=>{if(ME)cloud.envoyerModele3D(id+".jpg",r.blob).then(ch=>{c.photo&&c.photo.id===id&&(c.photo.chemin=ch);save()}).catch(()=>{})};
  // Nouveau meuble : les vraies dimensions d'abord (la 3D vient tout de suite à la bonne taille).
  const dims=nouveau?await demanderDimensions("Dimensions réelles du meuble de la photo",photosURL.get(id)):null;
  // 1. L'appli regarde l'image (Gemini) et refait le meuble toute seule.
  // Si Google est occupé, le menuisier choisit : réessayer, ou tracer lui-même.
  if(cloud.actif&&ME){
    for(;;){
      let arret=false;
      const att=attenteLecture(true,()=>{arret=true});
      let msg;
      try{
        const lu=depuisLecture(await cloud.lireImage(r.blob,{suivi:att.suivi,annule:()=>arret,note:noteDims(dims)}));
        attenteLecture(false);
        if(lu.ok){appliquerLecture(lu,photo,dims);envoyer(cfg());return}
        msg=lu.remarque;
      }catch(e){attenteLecture(false);if(e.code==="annule"||e.code==="non_configure"||e.code==="non_connecte")break;msg=e.message}
      if(!(await choixApresEchec(msg)))break;
    }
  }
  // 2. Sinon : le menuisier cadre la photo et décalque le meuble.
  if(st.id!=="croquis"){st.id="croquis";st.modele=null;openState=false;sel=0;nouveau=true}
  const c=cfg();
  c.photo={...photo,hAuto:nouveau?1:0};delete c.lu;
  // Nouveau meuble depuis une photo : feuille blanche, hauteur d'après la photo.
  if(nouveau){c.o.croquis={socle:0,cols:[{f:1,zones:[{f:1,t:"vide"}]}]};
    if(dims&&dims.L)c.L=Math.max(30,dims.L);if(dims&&dims.P)c.P=Math.max(20,dims.P);
    if(dims&&dims.H){c.H=Math.max(30,dims.H);c.photo.hAuto=0}else c.H=Math.max(30,Math.min(300,Math.round(c.L*r.h/r.l)))}
  save();renderCatalog();renderControls();compute(true);setEtape("regler");
  if(editeurActif)editeurActif.cadrer();
  toast("✂️ Cadrez le meuble sur la photo, tapez sa vraie largeur, puis tracez ses colonnes et ses cases.");
  envoyer(c);
}
// Le meuble reconnu devient « Mon dessin » : 3D, coupes et devis tout de suite ; cotes modifiables.
function appliquerLecture(lu,photo,dims){
  st.id="croquis";st.modele=null;openState=false;sel=0;
  const c=cfg();
  c.o.croquis=lu.croquis;
  ["L","H","P"].forEach(k=>{if(lu.dims[k])c[k]=lu.dims[k]});
  // Hauteur pas écrite sur l'image : on garde au moins les proportions de la photo (hauteur = largeur × rapport mesuré).
  // Cotes tapées par le menuisier : elles passent avant celles lues sur l'image.
  if(dims){if(dims.L)c.L=Math.max(30,dims.L);if(dims.H)c.H=Math.max(30,dims.H);if(dims.P)c.P=Math.max(20,dims.P)}
  if(!lu.dims.H&&!(dims&&dims.H)&&lu.rapport)c.H=Math.max(30,Math.min(300,Math.round(c.L*lu.rapport)));
  c.photo={...photo,visible:0,hAuto:0};
  c.lu={nom:lu.nom,remarque:lu.remarque,confiance:lu.confiance,cotes:["L","H","P"].filter(k=>lu.dims[k]||(dims&&dims[k]))};
  delete c.fichier3d;st.vue3d=null;
  save();renderCatalog();renderControls();compute(true);setEtape("voir");
  const nc=lu.croquis.cols.length,nz=nbCases(lu.croquis);
  toast("🪄 "+lu.nom+" reconnu : "+nc+" colonne"+(nc>1?"s":"")+", "+nz+" cases. "+(c.lu.cotes.length===3?"Cotes lues sur l'image.":"Tapez les cotes sous la 3D."));
}
// Pendant la lecture : l'IA prend son temps pour compter chaque panneau. Le menuisier voit le temps passé
// et peut arrêter pour tracer lui-même. Renvoie { suivi(secondes) }.
// Nombre de cases d'un dessin, casiers compris.
const nbCases=k=>(k.cols||[]).reduce((s,x)=>s+x.zones.reduce((t,z)=>t+(z.sous?z.sous.reduce((u,c)=>u+c.zones.length,0):1),0),0);
function attenteLecture(oui,arreter){
  let n=$("lectureImage");
  if(!oui){if(n)n.remove();return}
  if(n)n.remove();
  const temps=el("b",{class:"attente-temps"},"0 s"),etape=el("span",{class:"note"},"🔍 Je compte les colonnes, les cases, les portes et les tiroirs…");
  const ETAPES=["🔍 Je compte les colonnes, les cases, les portes et les tiroirs…","📐 Je mesure les proportions de chaque case…","🧐 Je vérifie que rien ne manque…","✍️ Je prépare le dessin du meuble…"];
  n=el("div",{id:"lectureImage",class:"attente-lecture",role:"status"},el("div",{class:"attente-boite"},
    el("span",{class:"e","aria-hidden":"true"},"🪄"),el("b",{},"Je regarde votre image…"),
    el("span",{},"Je prends le temps de tout bien regarder : 1 à 5 minutes. Vous pouvez poser le téléphone."),
    el("div",{class:"attente-ligne"},el("span",{"aria-hidden":"true"},"⏱️"),temps),etape,
    arreter?el("button",{type:"button",class:"btn",onclick:()=>{arreter();n.remove();toast("✏️ Lecture arrêtée : tracez le meuble vous-même sur la photo.")}},"✋ Arrêter et tracer moi-même"):null));
  document.body.append(n);
  const t0=Date.now(),fmt=s=>s<60?s+" s":Math.floor(s/60)+" min "+String(s%60).padStart(2,"0")+" s";
  const tic=setInterval(()=>{if(!n.isConnected)return clearInterval(tic);const s=Math.round((Date.now()-t0)/1000);temps.textContent=fmt(s);etape.textContent=ETAPES[Math.min(ETAPES.length-1,Math.floor(s/45))]},1000);
  return {suivi:()=>{}};
}
// Lecture ratée : gros boutons « Réessayer » / « Tracer moi-même ». Renvoie true pour réessayer.
function choixApresEchec(msg){
  return new Promise(ok=>{
    const fin=v=>{boite.remove();ok(v)};
    const boite=el("div",{class:"attente-lecture",role:"alertdialog"},el("div",{class:"attente-boite"},
      el("span",{class:"e-fixe","aria-hidden":"true"},"😕"),
      el("b",{},"Je n'ai pas pu lire l'image"),
      el("span",{},msg||"Le service de lecture ne répond pas."),
      el("div",{class:"choix-echec"},
        el("button",{type:"button",class:"btn primary",onclick:()=>fin(true)},"🔁 Réessayer"),
        el("button",{type:"button",class:"btn",onclick:()=>fin(false)},"✏️ Tracer moi-même"))));
    document.body.append(boite);
  });
}
// Sous la 3D : ce qui a été reconnu, l'image d'origine, et les cotes à taper.
function panneauLecture(c){
  const url=c.photo&&urlPhoto(c.photo),k=c.o.croquis||{cols:[]};
  const nz=nbCases(k);
  const champ=(d,lab)=>{const i=el("input",{type:"number",inputmode:"decimal",step:"0.1",min:"10",max:"600",id:"luD"+d,"aria-label":lab});i.value=c[d];
    i.addEventListener("change",()=>{const v=Math.round(parseFloat(String(i.value).replace(",","."))*10)/10;if(!(v>=10&&v<=600)){i.value=c[d];return}c[d]=v;save();renderControls();compute(true)});
    return el("label",{class:"imp-dim"},el("span",{},lab),i)};
  return [
    el("div",{class:"lu-tete"},url?el("img",{src:url,alt:"Votre image",class:"lu-image"}):null,
      el("div",{},el("p",{class:"imp-ok"},"🪄 "+c.lu.nom+" reconnu"),el("p",{class:"note"},(k.cols||[]).length+" colonne(s) · "+nz+" case(s)"+(c.lu.cotes.length?" · cotes lues sur l'image":"")))),
    el("p",{class:"imp-titre"},"📏 Dimensions réelles du meuble (cm)"),
    el("div",{class:"imp-dims"},champ("L","↔️ Largeur"),champ("H","↕️ Hauteur"),champ("P","↗️ Profondeur")),
    c.lu.cotes.length<3?el("p",{class:"warn"},"Certaines cotes ne sont pas écrites sur l'image : vérifiez-les."):null,
    c.lu.remarque?el("p",{class:"note"},"ℹ️ "+c.lu.remarque):null,
    el("div",{class:"actions"},
      el("button",{type:"button",class:"btn primary",onclick:()=>setEtape("acheter")},"✂️ Voir les coupes"),
      el("button",{type:"button",class:"btn",onclick:()=>setEtape("regler")},"✏️ Corriger le dessin"))];
}

// « Ma 3D » : relit les panneaux de la 3D à la largeur du meuble. gardeHP : garder la hauteur et la profondeur tapées.
function lireDecoupe3D(gardeHP){
  const c=cfg(),f=c.fichier3d,obj=f&&cache3D.get(f.id);
  if(!obj||!R(st.id).importe)return false;
  const {groupe,taille}=imp3d.placer(obj,{largeur:c.L,quart:f.quart,couche:f.couche});
  if(!gardeHP){c.H=Math.max(5,Math.round(taille[1]*100));c.P=Math.max(5,Math.round(taille[2]*100))}
  try{c.o.panneaux=imp3d.lirePanneaux(groupe)}catch(e){c.o.panneaux=null}
  return true;
}
// Passer de « Ma 3D » à « Mon dessin » avec les mêmes cotes et la même 3D à montrer.
function versDessin(){
  const c=cfg(),f=c.fichier3d;
  st.id="croquis";st.modele=null;openState=false;sel=0;
  const d=cfg();d.L=Math.max(30,c.L);d.H=Math.max(30,c.H);d.P=Math.max(20,c.P);if(f)d.fichier3d=f;
  save();renderCatalog();renderControls();compute(true);setEtape("regler");
  toast("✏️ Tracez les colonnes et les cases du meuble : la découpe se fait à partir du dessin.");
}
async function afficherImport(refit){
  const f=cfg().fichier3d,j=++jetonImport;
  let obj=cache3D.get(f.id);
  if(!obj){
    $("imp3d").prepend(el("p",{class:"note"},"⏳ Ouverture de votre 3D…"));
    try{
      let blob=await imp3d.lireLocal(f.id);
      if(!blob&&f.chemin&&ME){blob=await cloud.telechargerModele3D(f.chemin);imp3d.garderLocal(f.id,blob).catch(()=>{})}
      if(!blob)throw new Error("absent");
      obj=await imp3d.lireObjet(blob,f.ext,couleurImport());cache3D.set(f.id,obj);
    }catch(e){if(j===jetonImport){importIndispo=f.id;update3D(lastCtx,true)}return}
  }
  if(j!==jetonImport||!vueImportee())return;
  if(f.ext==="obj"||f.ext==="stl")obj.traverse(m=>{if(m.isMesh&&m.material&&m.material.color)m.material.color.setHex(couleurImport())});
  if(group)scene.remove(group);
  const c=cfg(),{groupe,taille}=imp3d.placer(obj,R(st.id).importe?{...f,largeur:c.L,dims:[c.L,c.H,c.P]}:f);
  group=groupe;movers=[];markers=[];scene.add(group);
  bbox.size=taille;tailleImport=taille;
  $("openBtn").hidden=true;$("hint3d").hidden=true;$("holesBtn").hidden=true;
  if(refit)fitCamera();
  majBarreImport();
}
// Barre sous la 3D : importer, basculer « Ma 3D / MenuiPro », régler la taille et le sens.
function majBarreImport(){
  const box=$("imp3d");if(!box)return;
  const c=cfg(),f=c.fichier3d;
  $("holesBtn").hidden=!!f&&vueImportee();
  if(!f&&c.lu&&R(st.id).dessin){box.replaceChildren(...panneauLecture(c).filter(Boolean));return}
  if(!f){box.replaceChildren(el("button",{type:"button",class:"btn",onclick:()=>demanderImport(st.id)},"📤 Mettre ma propre 3D (GLB, OBJ, STL, FBX)"));return}
  const voir=v=>{st.vue3d=v;save();openState=false;update3D(lastCtx,true)};
  const imp=vueImportee();
  const seg=el("div",{class:"seg"},
    el("button",{type:"button","aria-pressed":String(imp),onclick:()=>{importIndispo=null;voir("import")}},"📤 Ma 3D"),
    el("button",{type:"button","aria-pressed":String(!imp),onclick:()=>voir("menuipro")},"🪚 3D MenuiPro"));
  const parts=[seg];
  if(importIndispo===f.id)parts.push(el("p",{class:"warn"},f.chemin||!cloud.actif?"Votre 3D « "+f.nom+" » n'a pas pu être ouverte. Vérifiez Internet ou importez-la à nouveau.":"Votre 3D « "+f.nom+" » est restée sur l'autre téléphone. Importez-la à nouveau ici."));
  const importe=R(st.id).importe;
  if(imp&&importe){
    // Le menuisier tape les vraies dimensions : la 3D et les coupes s'ajustent.
    const champ=(k,lab)=>{const i=el("input",{type:"number",inputmode:"numeric",min:"5",max:"2000",id:"impD"+k,"aria-label":lab});i.value=c[k];
      i.addEventListener("change",()=>{const v=Math.round(parseFloat(i.value));if(!(v>=5&&v<=2000)){i.value=c[k];return}
        if(k==="L"){const q=v/c.L;c.H=Math.max(5,Math.round(c.H*q));c.P=Math.max(5,Math.round(c.P*q));c.L=v;
          // Largeur ×10 ou ÷10 : le fichier n'était pas dans l'unité devinée → on relit les panneaux à la bonne taille.
          // Sinon le moteur étire les coupes et garde l'épaisseur des panneaux.
          if(q>2||q<0.5)lireDecoupe3D(true)}
        else c[k]=v;
        save();renderControls();compute(true)});
      return el("label",{class:"imp-dim"},el("span",{},lab),i)};
    const m=c.o.panneaux,n=(m&&m.list.length)||0;
    parts.push(
      el("p",{class:"imp-titre"},"📏 Dimensions réelles du meuble (cm)"),
      el("div",{class:"imp-dims"},champ("L","↔️ Largeur"),champ("H","↕️ Hauteur"),champ("P","↗️ Profondeur")),
      el("p",{class:"note"},"Changer la largeur garde les proportions. Changez ensuite la hauteur ou la profondeur si besoin."),
      el("p",{class:n>=2?"imp-ok":"warn"},n>=2?"✂️ "+n+" pièces à couper lues dans votre 3D.":"Pas de panneaux trouvés dans cette 3D : pour la découpe, dessinez le meuble ✏️."),
      el("div",{class:"actions"},
        n>=2?el("button",{type:"button",class:"btn primary",onclick:()=>setEtape("acheter")},"✂️ Voir les coupes"):el("button",{type:"button",class:"btn primary",onclick:versDessin},"✏️ Dessiner le meuble"),
        el("button",{type:"button",class:"btn",onclick:()=>{f.quart=((f.quart||0)+1)%4;lireDecoupe3D(false);save();renderControls();compute(true)}},"🔄 Tourner"),
        el("button",{type:"button",class:"btn",onclick:()=>{f.couche=f.couche?0:1;lireDecoupe3D(false);save();renderControls();compute(true)}},"⤴️ Redresser"),
        el("button",{type:"button",class:"btn",onclick:()=>demanderImport(st.id,true)},"📤 Changer de fichier")),
      el("p",{class:"note"},f.chemin?"☁️ 3D sauvegardée en ligne":ME?"⏳ Envoi de la 3D en ligne…":"📱 3D gardée sur ce téléphone"));
  }
  if(imp&&!importe){
    const larg=el("input",{type:"number",inputmode:"numeric",min:"5",max:"2000",id:"impLarg"});larg.value=f.largeur;
    larg.addEventListener("change",()=>{const v=parseFloat(larg.value);if(v>=5&&v<=2000){f.largeur=Math.round(v);save();afficherImport(true)}});
    const t=tailleImport?tailleImport.map(v=>Math.round(v*100)):null;
    parts.push(
      el("div",{class:"imp-ligne"},el("label",{for:"impLarg"},"📏 Largeur réelle (cm)"),larg,
        el("button",{type:"button",class:"btn",onclick:()=>{f.quart=((f.quart||0)+1)%4;save();afficherImport(true)}},"🔄 Tourner"),
        el("button",{type:"button",class:"btn",onclick:()=>{f.couche=f.couche?0:1;save();afficherImport(true)}},"⤴️ Redresser")),
      t?el("p",{class:"note"},"Taille : "+t[0]+" × "+t[1]+" × "+t[2]+" cm · "+(f.chemin?"☁️ sauvegardée en ligne":ME?"⏳ envoi en ligne…":"📱 sur ce téléphone")):null,
      el("p",{class:"note"},"La découpe et le prix viennent du meuble MenuiPro"+(R(st.id).dessin?" : dessinez ses cases à l'étape Régler ✏️.":" (étape Régler).")),
      el("div",{class:"actions"},
        R(st.id).dessin&&t?el("button",{type:"button",class:"btn",onclick:()=>{c.L=Math.max(30,t[0]);c.H=Math.max(30,t[1]);c.P=Math.max(20,t[2]);save();renderControls();compute();toast("📐 Cotes du dessin : "+c.L+" × "+c.H+" × "+c.P+" cm")}},"📐 Prendre ces cotes pour le dessin"):null,
        el("button",{type:"button",class:"btn",onclick:()=>demanderImport(st.id)},"📤 Changer de fichier"),
        el("button",{type:"button",class:"btn",onclick:()=>{delete c.fichier3d;st.vue3d=null;save();update3D(lastCtx,true)}},"🗑️ Retirer ma 3D")));
  }
  box.replaceChildren(...parts.filter(Boolean));
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
    el("p",{class:"note"},"Au comptoir, le menuisier scanne ce QR code : il crée son compte avec son nom et son numéro, et il est rattaché à vous tout de suite. Vous pouvez aussi envoyer le lien sur WhatsApp."),
    qr,
    el("div",{class:"actions"},
      el("a",{class:"btn primary",href:"https://wa.me/?text="+encodeURIComponent(msg),target:"_blank",rel:"noopener"},"📲 Envoyer sur WhatsApp"),
      el("button",{type:"button",class:"btn",onclick:async()=>{try{await navigator.clipboard.writeText(lien);st.className="status ok";st.textContent="✅ Lien copié"}catch(e){st.className="status";st.textContent=lien}}},"🔗 Copier le lien")),
    st);
}

/* ----- Commandes : réponse de la quincaillerie ----- */
const STAT_FLUX=["prete","livree"];
// Lignes d'une commande : prix du catalogue de la quincaillerie, puis prix confirmé (barré si remise).
function ligneArticles(c){
  const rep=c.reponse,nb=q=>String(q).replace(".",",");
  const lignes=(c.lignes||[]).map((l,i)=>{const r=rep&&rep.lignes&&rep.lignes.find(x=>x.i===i);
    const cat=r?prixCatalogue(l,r):l.total,baisse=r&&r.dispo==="oui"&&cat!=null&&r.prix!=null&&r.prix<cat;
    const qteChg=r&&r.qte!=null&&l.qte!=null&&r.qte!==l.qte;
    const prix=r?(r.dispo==="non"?el("span",{class:"pr-ligne"},"pas dispo")
        :el("span",{class:"pr-ligne"},baisse?el("s",{class:"pr-barre"},fmt(cat)+" F"):"",baisse?" ":"",fmt(r.prix)+" F",baisse?el("span",{class:"badge-remise"},"🏷️ −"+fmt(cat-r.prix)):""))
      :(l.total!=null?el("span",{class:"pr-ligne"},fmt(l.total)+" F"):el("span",{class:"pr-ligne estime"},"prix ?"));
    return el("li",{class:r&&r.dispo==="non"?"barre-txt":""},el("span",{"aria-hidden":"true"},r?DISPO[r.dispo][0]+" ":"• "),el("b",{},l.article),
      " · "+l.detail+(l.pu&&l.qte>1?" × "+fmt(l.pu)+" F":""),qteChg?el("span",{class:"modif"}," ✏️ quantité "+nb(l.qte)+" → "+nb(r.qte)):"",r&&r.remplacement?el("span",{class:"rempl"}," → "+r.remplacement):"",prix)});
  // Articles ajoutés par la quincaillerie à la demande du menuisier.
  const ajouts=(rep&&rep.ajouts||[]).map(a=>el("li",{class:"ajout"},el("span",{"aria-hidden":"true"},"➕ "),el("b",{},a.article)," · "+nb(a.qte)+" "+(a.unite||""),el("span",{class:"modif"}," (ajouté à la demande)"),el("span",{class:"pr-ligne"},fmt(a.prix)+" F")));
  return el("ul",{class:"cmd-lignes"},...lignes,...ajouts);
}
// Total au prix du catalogue (avant réponse), sinon total confirmé avec remise et économie.
function resumeReponse(c){
  const r=c.reponse;
  if(!r)return c.total?el("div",{class:"cmd-rep cmd-cat"},el("div",{class:"cmd-total"},el("span",{},"🏷️ Total au prix du catalogue"),el("b",{},fmt(c.total)+" F"))):null;
  const m=MODES_RETRAIT[r.mode]||MODES_RETRAIT.retrait,rem=r.remise&&r.remise.montant?r.remise:null;
  const eco=remiseLignes(c.lignes,r)+(rem?rem.montant:0),ecart=c.total&&r.total!==c.total;
  return el("div",{class:"cmd-rep"},
    rem?el("div",{class:"cmd-total petit"},el("span",{},"Sous-total"),el("span",{},fmt(r.sous_total??sousTotalReponse(r))+" F")):null,
    rem?el("div",{class:"cmd-total petit remise"},el("span",{},"🏷️ Remise"+(rem.pct?" "+rem.pct+" %":"")),el("span",{},"−"+fmt(rem.montant)+" F")):null,
    el("div",{class:"cmd-total"},el("span",{},"Total à payer"),el("b",{},fmt(r.total)+" F")),
    eco?el("div",{class:"eco"},"🎁 Économie : "+fmt(eco)+" F"):null,
    ecart&&!eco?el("div",{class:"note"},"Prix du catalogue : "+fmt(c.total)+" F"):ecart?el("div",{class:"note"},"Au lieu de "+fmt(c.total)+" F (prix du catalogue)"):null,
    el("div",{},m[0]+" "+m[1]+(r.date?" · "+dateLisible(r.date):"")),
    r.message?el("div",{class:"cmd-msg"},"💬 "+r.message):null);
}
// Carte d'une commande reçue (écran de la quincaillerie)
function carteCommandeRecue(c){
  const carte=el("div",{class:"cmd"});
  const dessiner=()=>{
    const s=STAT_CMD[c.statut]||STAT_CMD.envoyee,tel=c.profils&&c.profils.telephone;
    const who=c.profils?(c.profils.nom||"Menuisier")+(tel?" · 📱 "+telLisible(tel):""):"Menuisier";
    const statuts=el("div",{class:"seg"},...STAT_FLUX.map(k=>el("button",{type:"button","aria-pressed":String(c.statut===k),onclick:async()=>{try{await cloud.changerStatut(c.id,k);c.statut=k;dessiner()}catch(e){toast(cloud.message(e),true)}}},STAT_CMD[k][0]+" "+STAT_CMD[k][1])));
    carte.replaceChildren(
      el("div",{class:"cmd-top"},el("span",{class:"e","aria-hidden":"true"},s[0]),el("div",{},el("b",{},c.meuble),el("div",{class:"note"},who+" · "+new Date(c.created_at).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"}))),el("span",{class:"chip "+c.statut},s[1])),
      ligneArticles(c),
      resumeReponse(c),
      el("div",{class:"actions"},
        el("button",{type:"button",class:c.reponse?"btn":"btn primary",onclick:()=>formReponse(c,carte,dessiner)},c.reponse?"✏️ Modifier la réponse":"✍️ Répondre"),
        tel&&c.reponse?el("a",{class:"btn",href:"https://wa.me/"+waDigits(tel)+"?text="+encodeURIComponent(texteReponse(c,c.reponse,ME.quinc&&ME.quinc.nom)),target:"_blank",rel:"noopener"},"📲 Prévenir sur WhatsApp"):null),
      c.reponse?statuts:"");
  };
  dessiner();return carte;
}
// Formulaire de réponse : chaque article disponible / remplacé / pas dispo, prix réel, retrait ou livraison, date.
function formReponse(c,carte,redessiner){
  if(c.statut==="envoyee"){cloud.changerStatut(c.id,"vue").then(()=>{c.statut="vue"}).catch(()=>{})}
  const rep=reponseInitiale(c.lignes||[],c.reponse);
  const err=el("p",{class:"status err",role:"alert"}),total=el("b",{}),sousTot=el("span",{}),remTxt=el("span",{});
  const ligneSous=el("div",{class:"cmd-total petit"},el("span",{},"Sous-total"),sousTot),ligneRem=el("div",{class:"cmd-total petit remise"},el("span",{},"🏷️ Remise"),remTxt);
  const majTotal=()=>{const st=sousTotalReponse(rep),m=montantRemise(rep,st);sousTot.textContent=fmt(st)+" F";remTxt.textContent="−"+fmt(m)+" F";ligneSous.hidden=ligneRem.hidden=!m;total.textContent=fmt(st-m)+" F"};
  // Remise sur toute la commande : boutons rapides en %, ou un montant en francs.
  const remSeg=el("div",{class:"seg"}),remF=el("input",{type:"number",min:"0",step:"500",inputmode:"numeric",placeholder:"Autre montant","aria-label":"Remise en francs"});
  const majRem=()=>{const v=String(rep.remise.valeur||"");
    remSeg.replaceChildren(...[["Aucune",""],["−5 %","5"],["−10 %","10"],["−15 %","15"]].map(([lb,p])=>el("button",{type:"button","aria-pressed":String(p?rep.remise.type==="pct"&&v===p:!v),onclick:()=>{rep.remise={type:p?"pct":"f",valeur:p};remF.value="";err.textContent="";majRem();majTotal()}},lb)),el("label",{class:"prix-f"},remF," F"));
    if(rep.remise.type==="f")remF.value=v};
  remF.addEventListener("input",()=>{rep.remise={type:"f",valeur:remF.value};err.textContent="";majRem();majTotal()});
  majRem();
  const lignes=(c.lignes||[]).map((l,i)=>{
    const r=rep.lignes[i];
    const prix=el("input",{type:"number",min:"0",step:"500",inputmode:"numeric","aria-label":"Prix : "+l.article});prix.value=r.prix??"";
    const badge=el("span",{class:"badge-remise"});
    const majBadge=()=>{const p=Math.round(+String(r.prix).replace(/\s/g,"")),cat=prixCatalogue(l,r);const d=r.dispo==="oui"&&cat!=null&&r.prix!==""&&Number.isFinite(p)?cat-p:0;badge.hidden=!(d>0);badge.textContent="🏷️ −"+fmt(d)+" F"};
    // Quantité : la quincaillerie peut la changer si le menuisier le demande ; le prix suit (même prix à l'unité).
    let qteUI=null;
    if(l.qte!=null){const out=el("output",{},String(r.qte??l.qte).replace(".",","));
      const chg=d=>{changerQuantite(r,(+r.qte||+l.qte)+d);out.textContent=String(r.qte).replace(".",",");prix.value=r.prix??"";modif.hidden=r.qte===l.qte;err.textContent="";majBadge();majTotal()};
      const modif=el("span",{class:"modif"},"✏️ demandé par le client");modif.hidden=(r.qte??l.qte)===l.qte;
      qteUI=el("div",{class:"step"},el("span",{class:"name"},"🔢 Quantité ",modif),el("div",{class:"stepper"},el("button",{type:"button","aria-label":"Moins",onclick:()=>chg(-1)},"−"),out,el("button",{type:"button","aria-label":"Plus",onclick:()=>chg(1)},"+")))}
    prix.addEventListener("input",()=>{r.prix=prix.value;err.textContent="";majBadge();majTotal()});
    const rempl=el("input",{type:"text",maxlength:"80",placeholder:"Remplacé par…","aria-label":"Remplacé par"});rempl.value=r.remplacement||"";
    rempl.addEventListener("input",()=>{r.remplacement=rempl.value;err.textContent=""});
    const seg=el("div",{class:"seg dispo"});
    const maj=()=>{seg.replaceChildren(...Object.entries(DISPO).map(([k,[ic,lb]])=>el("button",{type:"button","aria-pressed":String(r.dispo===k),title:lb,onclick:()=>{r.dispo=k;err.textContent="";maj();majTotal()}},el("span",{class:"ic","aria-hidden":"true"},ic),el("span",{},lb))));
      rempl.hidden=r.dispo!=="remplace";prix.disabled=r.dispo==="non";majBadge()};
    maj();
    return el("div",{class:"rep-ligne"},el("div",{},el("b",{},l.article),el("span",{class:"note"}," · "+l.detail)),
      el("div",{class:"note"},l.total!=null?"🏷️ Votre prix catalogue : "+fmt(l.total)+" F"+(l.pu&&l.qte>1?" ("+fmt(l.pu)+" F × "+String(l.qte).replace(".",",")+")":""):"⚠️ Pas de prix dans votre catalogue : entrez-le."),
      seg,qteUI,el("div",{class:"rep-prix"},rempl,el("label",{class:"prix-f"},prix," F"),badge));
  });
  // Articles ajoutés à la demande du client : ses propres articles (prix rempli) ou un article tapé à la main.
  const boiteAjouts=el("div",{class:"rep-ajouts"});
  const dessinerAjouts=()=>boiteAjouts.replaceChildren(...rep.ajouts.map((a,k)=>{
    const nm=el("input",{type:"text",maxlength:"80",placeholder:"Article","aria-label":"Article ajouté"});nm.value=a.article||"";nm.addEventListener("input",()=>{a.article=nm.value;err.textContent=""});
    const px=el("input",{type:"number",min:"0",step:"500",inputmode:"numeric","aria-label":"Prix"});px.value=a.prix??"";px.addEventListener("input",()=>{a.prix=px.value;err.textContent="";majTotal()});
    const out=el("output",{},String(a.qte).replace(".",","));
    const chg=d=>{const avant=+a.qte||1;a.qte=Math.max(1,avant+d);if(a.pu)a.prix=Math.round(a.pu*a.qte);else if(+a.prix)a.prix=Math.round(+a.prix/avant*a.qte);px.value=a.prix??"";out.textContent=String(a.qte);majTotal()};
    return el("div",{class:"rep-ligne ajout"},el("div",{class:"row",style:"gap:8px;align-items:center"},el("span",{"aria-hidden":"true"},a.e||"➕"),nm,
        el("button",{type:"button",class:"btn mini","aria-label":"Enlever",onclick:()=>{rep.ajouts.splice(k,1);dessinerAjouts();majTotal()}},"🗑️")),
      el("div",{class:"step"},el("span",{class:"name"},"🔢 "+(a.unite||"Quantité")),el("div",{class:"stepper"},el("button",{type:"button","aria-label":"Moins",onclick:()=>chg(-1)},"−"),out,el("button",{type:"button","aria-label":"Plus",onclick:()=>chg(1)},"+"))),
      el("div",{class:"rep-prix"},el("label",{class:"prix-f"},px," F")))}));
  const ajouter=a=>{rep.ajouts.push({article:"",qte:1,unite:"pièce",prix:"",...a});dessinerAjouts();majTotal();const t=boiteAjouts.querySelectorAll("input[type=text]");if(!a.article&&t.length)t[t.length-1].focus()};
  const choixAjout=el("div",{class:"seg ajout-choix"},...CAT.articles.filter(a=>a.nom).map(a=>el("button",{type:"button",onclick:()=>ajouter({e:a.e,article:a.nom,unite:a.unite||"pièce",pu:+a.prix||0,prix:+a.prix||""})},(a.e||"🛍️")+" "+a.nom)),
    el("button",{type:"button",onclick:()=>ajouter({})},"✏️ Autre article"));
  dessinerAjouts();
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
    el("div",{class:"label"},"➕ Le client demande d'autres articles ?"),boiteAjouts,choixAjout,
    el("div",{class:"label"},"Le menuisier vient chercher ou vous livrez ?"),modes,
    el("div",{class:"label"},"Prêt pour quand ?"),dates,msg,
    el("div",{class:"label"},"🏷️ Remise sur toute la commande ?"),remSeg,
    ligneSous,ligneRem,el("div",{class:"cmd-total"},el("span",{},"Total à payer"),total),err,
    el("div",{class:"actions"},envoyer,el("button",{type:"button",class:"btn",onclick:()=>carte.querySelector(".rep-form").remove()},"Annuler"))));
}
// Carte d'une commande envoyée (écran du menuisier)
function carteCommandeMenuisier(c){
  const s=STAT_CMD[c.statut]||STAT_CMD.envoyee,q=ME&&ME.quinc,wa=q&&waDigits(q.whatsapp);
  return el("div",{class:"cmd"+(c.reponse?" repondue":"")},
    el("div",{class:"cmd-top"},el("span",{class:"e","aria-hidden":"true"},s[0]),el("div",{},el("b",{},c.meuble),el("div",{class:"note"},new Date(c.created_at).toLocaleDateString("fr-FR"))),el("span",{class:"chip "+c.statut},s[1])),
    ligneArticles(c),resumeReponse(c),
    c.reponse?null:el("div",{class:"note"},c.statut==="envoyee"?"⏳ En attente de la réponse de "+(q?q.nom:"la quincaillerie")+".":"👀 "+(q?q.nom:"La quincaillerie")+" a vu votre commande."),
    el("div",{class:"actions"},
      wa?el("a",{class:"btn",href:"https://wa.me/"+wa+"?text="+encodeURIComponent("Bonjour, à propos de ma commande « "+c.meuble+" » : "),target:"_blank",rel:"noopener"},"📲 Écrire à "+q.nom):null,
      ["envoyee","vue","confirmee"].includes(c.statut)?boutonAnnuler(c):null));
}
// Annuler : deux touches pour éviter une erreur.
function boutonAnnuler(c){
  let armed=false;const b=el("button",{type:"button",class:"btn"},"✖️ Annuler la commande");
  b.onclick=async()=>{if(!armed){armed=true;b.textContent="Touchez encore pour annuler";return}
    try{await cloud.annulerCommande(c.id);toast("Commande annulée");renderCompte()}catch(e){toast(cloud.message(e),true)}};
  return b;
}

/* ----- Prévenir le menuisier quand sa quincaillerie répond ----- */
let ALERTES=0;const DEJA_ANNONCE=new Set();
const lireVu=()=>{try{return JSON.parse(localStorage.getItem("menuipro-cmd-vu")||"{}")||{}}catch(e){return {}}};
const ecrireVu=v=>{try{localStorage.setItem("menuipro-cmd-vu",JSON.stringify(v))}catch(e){}};
function majPastille(){const b=document.querySelector('.navbtn[data-vue="compte"]');if(!b)return;b.querySelectorAll(".pastille").forEach(n=>n.remove());if(ALERTES)b.append(el("span",{class:"pastille","aria-label":ALERTES+" nouvelle(s) réponse(s)"},String(ALERTES)))}
async function verifierCommandes(){
  if(!cloud.actif||!ME||!ME.quinc||estAdmin())return;
  if(estQuinc())return verifierCommandesRecues();
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

/* ----- Page de connexion : on ne voit l'application qu'après s'être connecté ----- */
// Numéro WhatsApp du support (variable VITE_SUPPORT_WHATSAPP sur Render) pour « Code PIN oublié ».
const SUPPORT_WA=waDigits(import.meta.env.VITE_SUPPORT_WHATSAPP||"");
function entrerDansAppli(){
  document.body.classList.remove("verrou","attente");$("porte").hidden=true;$("porte").replaceChildren();
  show(location.hash.slice(1)||vueAccueil());
}
/* ----- Carte MenuiPro : le QR code personnel qui ouvre le compte sur n'importe quel téléphone ----- */
const lienCarte=cle=>location.origin+"/?carte="+encodeURIComponent(cle);
function carteGardee(){try{const c=JSON.parse(localStorage.getItem("menuipro-carte")||"null");return c&&ME&&c.user===ME.user.id?c.cle:(c&&!ME?c.cle:null)}catch(e){return null}}
function garderCarte(cle,user){try{localStorage.setItem("menuipro-carte",JSON.stringify({cle,user}))}catch(e){}}
const ROLE_NOM={menuisier:"Menuisier",quincaillerie:"Quincaillerie",admin:"Administrateur"};
// Image de la carte (à garder en photo, ou à envoyer sur WhatsApp).
async function imageCarte(nom,role,cle){
  const q=qrcode(0,"M");q.addData(lienCarte(cle));q.make();
  const n=q.getModuleCount(),cell=Math.floor(560/(n+8)),W=cell*(n+8)+80,cv=document.createElement("canvas");cv.width=W;cv.height=W+230;
  const g=cv.getContext("2d");g.fillStyle="#fffaf2";g.fillRect(0,0,cv.width,cv.height);
  g.fillStyle="#8a5226";g.fillRect(0,0,cv.width,120);g.fillStyle="#fff";g.font="bold 44px system-ui,sans-serif";g.textAlign="center";g.fillText("🪚 MenuiPro",W/2,78);
  const x0=40+cell*4,y0=150+cell*4;g.fillStyle="#fff";g.fillRect(40,150,cell*(n+8),cell*(n+8));g.fillStyle="#1b1410";
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))g.fillRect(x0+c*cell,y0+r*cell,cell,cell);
  g.fillStyle="#1b1410";g.font="bold 36px system-ui,sans-serif";g.fillText((nom||"Mon compte").slice(0,28),W/2,W+130);
  g.fillStyle="#6b5a4c";g.font="26px system-ui,sans-serif";g.fillText((ROLE_NOM[role]||"")+" · Ma carte MenuiPro",W/2,W+172);
  g.font="22px system-ui,sans-serif";g.fillText("Scannez-la pour ouvrir votre compte. Ne la montrez à personne.",W/2,W+210);
  return await new Promise(ok=>cv.toBlob(ok,"image/png"));
}
async function partagerCarte(nom,role,cle){
  const blob=await imageCarte(nom,role,cle),f=new File([blob],"carte-menuipro.png",{type:"image/png"});
  try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:"Ma carte MenuiPro"});return}}catch(e){if(e&&e.name==="AbortError")return}
  const a=el("a",{href:URL.createObjectURL(blob),download:"carte-menuipro.png"});document.body.append(a);a.click();a.remove();
  toast("⬇️ Carte enregistrée dans vos téléchargements");
}
// Bloc « carte » : QR code + enregistrer + WhatsApp. tel : numéro à qui l'envoyer (menuisier d'une quincaillerie…).
function blocCarte({nom,role,cle,tel,pourMoi}){
  const qr=el("div",{class:"qr carte-qr",role:"img","aria-label":"QR code de la carte MenuiPro de "+(nom||"ce compte")});qr.innerHTML=qrSvg(lienCarte(cle));
  const msg=(pourMoi?"Ma carte MenuiPro":"Bonjour"+(nom?" "+nom:"")+", voici votre carte MenuiPro")+" : ouvrez ce lien sur votre téléphone pour entrer dans votre compte. Ne l'envoyez à personne d'autre. "+lienCarte(cle);
  const wa=waDigits(tel);
  return el("div",{class:"carte"},
    el("div",{class:"carte-tete"},el("span",{"aria-hidden":"true"},"🪪"),el("div",{},el("b",{},nom||"Carte MenuiPro"),el("span",{class:"note"},(ROLE_NOM[role]||"")+" · carte personnelle"))),
    qr,
    el("div",{class:"actions"},
      el("button",{type:"button",class:"btn primary",onclick:()=>partagerCarte(nom,role,cle)},pourMoi?"⬇️ Garder ma carte (photo)":"⬇️ Image de la carte"),
      el("a",{class:"btn",href:"https://wa.me/"+(wa||"")+"?text="+encodeURIComponent(msg),target:"_blank",rel:"noopener"},pourMoi?"📲 M'envoyer sur WhatsApp":"📲 Envoyer sur WhatsApp")),
    el("p",{class:"note"},pourMoi?"Gardez cette carte : si vous changez de téléphone, scannez-la pour retrouver votre compte et vos projets.":"Cette carte ouvre son compte : ne la donnez qu'à cette personne. L'ancienne carte ne marche plus."));
}
// Fenêtre qui montre une carte (quincaillerie pour un menuisier, administrateur pour tout compte).
function montrerCarte(info){
  const fond=el("div",{class:"modal-carte",role:"dialog","aria-label":"Carte MenuiPro"});
  fond.append(el("div",{class:"modal-boite"},blocCarte(info),el("div",{class:"actions"},el("button",{type:"button",class:"btn",onclick:()=>fond.remove()},"✖ Fermer"))));
  fond.addEventListener("click",e=>{if(e.target===fond)fond.remove()});
  document.body.append(fond);
}
async function refaireCarte(user,infos={}){
  try{const r=await cloud.nouvelleCarte(user,infos.quinc);montrerCarte({nom:r.nom||infos.nom,role:r.role||infos.role,cle:r.cle,tel:r.telephone||infos.tel});return r}
  catch(e){toast(cloud.messageQR(e),true)}
}
// Connexion par la carte : lien ?carte=… (appareil photo du téléphone) ou lecteur de l'appli.
async function entrerAvecCarte(cle,status){
  try{
    if(status){status.className="status";status.textContent="⏳ Ouverture de votre compte…"}
    await cloud.connecterCarte(cle);
    ME=await cloud.chargerCompte();if(!ME)throw new Error("compte_inconnu");
    garderCarte(cle,ME.user.id);
    try{history.replaceState(null,"",location.pathname)}catch(e){}
    $("porte").hidden=true;entrerDansAppli();appliquerCompte();majMicro();
    toast("✅ Bienvenue "+(ME.profil&&ME.profil.nom||""));
    return true;
  }catch(e){if(status){status.className="status err";status.textContent=cloud.messageQR(e)}else toast(cloud.messageQR(e),true);return false}
}
// Texte lu dans un QR : carte personnelle, invitation d'une quincaillerie (lien ou code seul).
function lireTexteQR(t){
  try{const u=new URL(t);const c=u.searchParams.get("carte");if(c)return {carte:c};const i=(u.searchParams.get("invite")||"").trim().toUpperCase();if(/^[0-9A-Z]{6}$/.test(i))return {invite:i}}catch(e){}
  const c=String(t||"").trim().toUpperCase();if(/^[0-9A-Z]{6}$/.test(c))return {invite:c};
  return null;
}

/* ----- Porte d'entrée : créer son compte (nom + numéro) ou scanner sa carte ----- */
// QR code d'une quincaillerie scanné avec l'appareil photo : on va droit à « Créer mon compte ».
let modePorte=INVITE&&!carteGardee()?"inscription":"accueil";
async function ouvrirPorte(horsLigne){
  document.body.classList.remove("attente");document.body.classList.add("verrou");
  const box=$("porte");box.hidden=false;
  const status=el("p",{class:"status",role:"status"});
  if(horsLigne){status.className="status err";status.textContent="Pas de connexion Internet. Vérifiez le réseau puis réessayez."}
  const aller=m=>{modePorte=m;ouvrirPorte()};
  const scanner=()=>ouvrirScanner({titre:"Scannez le QR code",aide:"Visez votre carte MenuiPro, ou le QR code de votre quincaillerie.",onTexte:t=>{
    const r=lireTexteQR(t);
    if(r&&r.carte){entrerAvecCarte(r.carte,status);return}
    if(r&&r.invite){INVITE=r.invite;try{localStorage.setItem("menuipro-invitation",r.invite)}catch(e){}aller("inscription");return}
    status.className="status err";status.textContent="Ce QR code n'est pas un QR MenuiPro.";
  }});
  const champ=(id,lbl,attrs)=>{const i=el("input",{id,...attrs});return [i,el("div",{class:"field"},el("label",{for:id},lbl),i)]};
  const logo=el("div",{class:"porte-logo"},el("div",{class:"porte-ic","aria-hidden":"true"},"🪚"),el("h1",{},"MenuiPro"),el("p",{},"L'atelier du menuisier sur votre téléphone"));
  const invit=await bandeauInvitation();
  let corps;
  if(modePorte==="inscription"){
    const [nom,fNom]=champ("pNom","👤 Votre nom ou celui de l'atelier",{type:"text",autocomplete:"name",placeholder:"Ex. Menuiserie Fall"});
    const [tel,fTel]=champ("pTel","📱 Votre numéro de téléphone",{type:"tel",inputmode:"tel",autocomplete:"tel",placeholder:"77 000 00 00"});
    const valider=el("button",{type:"submit",class:"btn primary porte-ok"},"✅ Créer mon compte");
    const form=el("form",{class:"porte-form",novalidate:"novalidate"},fNom,fTel,status,valider);
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      if(String(nom.value).trim().length<2){status.className="status err";status.textContent="Entrez votre nom.";return}
      if(String(tel.value).replace(/\D/g,"").length<9){status.className="status err";status.textContent="Entrez votre numéro de téléphone (9 chiffres).";return}
      status.className="status";status.textContent="⏳ Création de votre compte…";valider.disabled=true;
      try{
        const r=await cloud.inscrireQR(nom.value,tel.value,INVITE);
        oublierInvitation();
        ME=await cloud.chargerCompte();if(!ME)throw new Error("compte_inconnu");
        garderCarte(r.cle,ME.user.id);
        // Écran « votre carte » avant d'entrer : le menuisier la garde tout de suite.
        box.replaceChildren(el("div",{class:"porte-carte"},logo,
          el("div",{class:"banner ok"},"✅ Compte créé"+(r.quincaillerie?" · rattaché à "+r.quincaillerie:"")+" !"),
          blocCarte({nom:ME.profil.nom,role:"menuisier",cle:r.cle,tel:ME.profil.telephone,pourMoi:true}),
          el("button",{type:"button",class:"btn primary porte-ok",onclick:()=>{box.hidden=true;entrerDansAppli();appliquerCompte();majMicro();
            if(!ME.quinc){go("compte");toast("🏪 Choisissez votre quincaillerie : comparez leurs prix")}}},"Continuer →")));
      }catch(e2){status.className="status err";status.textContent=cloud.messageQR(e2);valider.disabled=false}
    });
    corps=[el("h2",{class:"porte-titre"},"➕ Créer mon compte"),
      ...(invit?[invit]:[el("div",{class:"porte-qr-quinc"},el("p",{class:"note"},"Votre quincaillerie a un QR code ? Scannez-le : vous verrez tout de suite ses prix."),el("button",{type:"button",class:"btn",onclick:scanner},"📷 Scanner le QR de ma quincaillerie"))]),
      form,
      !INVITE?el("p",{class:"note"},"Sans QR : vos prix et vos commandes seront ceux de la quincaillerie partenaire de MenuiPro."):null,
      el("button",{type:"button",class:"lien",onclick:()=>aller("accueil")},"← Retour")];
    box.replaceChildren(el("div",{class:"porte-carte"},logo,...corps.filter(Boolean)));
    nom.focus({preventScroll:true});
    return;
  }
  if(modePorte==="pin"){
    // Secours : numéro + code PIN (administrateur, anciens comptes).
    const [tel,fTel]=champ("pTel","📱 Numéro de téléphone",{type:"tel",inputmode:"tel",autocomplete:"tel",placeholder:"77 000 00 00"});
    const [pin,fPin]=champ("pPin","🔑 Code PIN (6 chiffres)",{type:"password",inputmode:"numeric",maxlength:"6",autocomplete:"current-password",placeholder:"••••••"});
    const valider=el("button",{type:"submit",class:"btn primary porte-ok"},"Me connecter");
    const form=el("form",{class:"porte-form",novalidate:"novalidate"},fTel,fPin,status,valider);
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      if(String(tel.value).replace(/\D/g,"").length<9||!/^\d{6}$/.test(pin.value)){status.className="status err";status.textContent="Entrez le numéro (9 chiffres) et le code PIN (6 chiffres).";return}
      status.className="status";status.textContent="⏳ Un instant…";valider.disabled=true;
      try{await cloud.connecter(tel.value,pin.value);ME=await cloud.chargerCompte();if(!ME)throw new Error("Compte introuvable. Réessayez.");
        try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}
        entrerDansAppli();appliquerCompte();majMicro();toast("✅ Bienvenue "+(ME.profil&&ME.profil.nom||""))}
      catch(e2){status.className="status err";status.textContent=cloud.message(e2);valider.disabled=false}
    });
    box.replaceChildren(el("div",{class:"porte-carte"},logo,el("h2",{class:"porte-titre"},"🔑 Numéro et code PIN"),form,
      el("p",{class:"note"},"Pas de code PIN ? Utilisez votre carte MenuiPro, ou demandez une nouvelle carte à votre quincaillerie."),
      el("button",{type:"button",class:"lien",onclick:()=>aller("accueil")},"← Retour")));
    tel.focus({preventScroll:true});
    return;
  }
  // Accueil : deux gros boutons.
  const garde=carteGardee();
  box.replaceChildren(el("div",{class:"porte-carte"},logo,...(invit?[invit]:[]),
    garde?el("button",{type:"button",class:"porte-choix principal",onclick:()=>entrerAvecCarte(garde,status)},el("span",{class:"e","aria-hidden":"true"},"🪪"),el("b",{},"Ouvrir mon compte"),el("span",{},"avec la carte gardée sur ce téléphone")):null,
    el("button",{type:"button",class:"porte-choix"+(garde?"":" principal"),onclick:()=>aller("inscription")},el("span",{class:"e","aria-hidden":"true"},"➕"),el("b",{},"Créer mon compte"),el("span",{},INVITE?"Juste votre nom et votre numéro":"Nom + numéro, ou QR code de votre quincaillerie")),
    el("button",{type:"button",class:"porte-choix",onclick:scanner},el("span",{class:"e","aria-hidden":"true"},"📷"),el("b",{},"J'ai déjà un compte"),el("span",{},"Scanner ma carte MenuiPro")),
    status,
    el("button",{type:"button",class:"lien",onclick:()=>aller("pin")},"🔑 Se connecter avec numéro et code PIN"),
    el("p",{class:"note porte-quinc"},"🏪 Vous êtes une quincaillerie ? Contactez MenuiPro pour ouvrir votre compte.")));
}

/* ----- Déconnexion : on sauvegarde en ligne, puis on efface les données du compte sur ce téléphone ----- */
const CLES_COMPTE=["menuipro-projets","menuipro-atelier","menuipro-catalogue","menuipro-cmd-vu","menuipro-cmd-recues-vu","menuipro-invitation","menuipro-v2","menuipro-role","menuipro-carte"];
async function quitterCompte(){
  // Projets jamais envoyés : on essaie de les sauvegarder avant d'effacer (sans réseau, on les garde sur le téléphone).
  const restants=PROJ.filter(p=>!p.cloudId);
  try{for(const p of restants)await pousserProjet(p)}catch(e){toast("Pas de réseau : vos projets non envoyés restent sur ce téléphone.",true);return}
  await cloud.deconnecter();
  CLES_COMPTE.forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
  location.replace(location.pathname); // l'appli repart propre, sur la page de connexion
}
/* ----- Ma carte MenuiPro (tous les rôles) ----- */
function panneauMaCarte(p){
  const role=estAdmin()?"admin":estQuinc()?"quincaillerie":"menuisier",zone=el("div",{});
  const dessiner=()=>{
    const cle=carteGardee();
    let arme=false;const refaire=el("button",{type:"button",class:"btn"},cle?"🔄 Refaire ma carte":"🪪 Faire ma carte");
    refaire.onclick=async()=>{
      if(cle&&!arme){arme=true;refaire.textContent="Touchez encore : l'ancienne carte ne marchera plus";return}
      refaire.disabled=true;refaire.textContent="⏳";
      try{const r=await cloud.nouvelleCarte();garderCarte(r.cle,ME.user.id);dessiner();toast("🪪 Nouvelle carte prête : gardez-la en photo")}
      catch(e){toast(cloud.messageQR(e),true);refaire.disabled=false;refaire.textContent=cle?"🔄 Refaire ma carte":"🪪 Faire ma carte"}
    };
    zone.replaceChildren(el("h3",{class:"sous-titre"},"🪪 Ma carte MenuiPro"),
      cle?blocCarte({nom:p.nom,role,cle,tel:p.telephone,pourMoi:true}):el("p",{class:"note"},"Votre carte QR ouvre votre compte sur n'importe quel téléphone, sans code PIN. Faites-la et gardez-la en photo."),
      el("div",{class:"actions"},refaire));
  };
  dessiner();return zone;
}
/* ----- Mon compte : nom, code PIN, déconnexion (tous les rôles) ----- */
function panneauMonCompte(p){
  const role=estAdmin()?"Administrateur":estQuinc()?"Quincaillerie":"Menuisier";
  const zone=el("div",{class:"mon-compte-form"}),st=el("p",{class:"status",role:"status"});
  let armedOut=false;const out=el("button",{type:"button",class:"btn"},"🚪 Se déconnecter");
  out.onclick=async()=>{if(!armedOut){armedOut=true;out.textContent="Touchez encore pour vous déconnecter";return}out.disabled=true;out.textContent="⏳ Déconnexion…";await quitterCompte()};
  const champ=(lbl,attrs)=>{const i=el("input",attrs);return [i,el("label",{class:"field"},el("span",{},lbl),i)]};
  const formNom=()=>{const [i,f]=champ("👤 Nouveau nom",{type:"text",maxlength:"80",autocomplete:"name"});i.value=p.nom||"";
    zone.replaceChildren(f,el("div",{class:"actions"},el("button",{type:"button",class:"btn primary",onclick:async()=>{
      const n=i.value.trim();if(n.length<2){st.className="status err";st.textContent="Entrez au moins 2 lettres.";return}
      st.className="status";st.textContent="⏳";try{await cloud.majProfil({nom:n},ME.user.id);ME.profil.nom=n;p.nom=n;$("count-tag").textContent=(estAdmin()?"🛡️ ":"👤 ")+n;st.className="status ok";st.textContent="✅ Nom changé";zone.replaceChildren();titre.textContent=(estAdmin()?"🛡️ ":"👤 ")+n}catch(e){st.className="status err";st.textContent=cloud.message(e)}}},"💾 Enregistrer"),el("button",{type:"button",class:"btn",onclick:()=>{zone.replaceChildren();st.textContent=""}},"Annuler")));i.focus()};
  const formPin=()=>{
    const [a,fa]=champ("🔑 Code PIN actuel",{type:"password",inputmode:"numeric",maxlength:"6",autocomplete:"current-password"});
    const [b,fb]=champ("🔑 Nouveau code PIN (6 chiffres)",{type:"password",inputmode:"numeric",maxlength:"6",autocomplete:"new-password"});
    const [c,fc]=champ("🔑 Répétez le nouveau code PIN",{type:"password",inputmode:"numeric",maxlength:"6",autocomplete:"new-password"});
    zone.replaceChildren(fa,fb,fc,el("div",{class:"actions"},el("button",{type:"button",class:"btn primary",onclick:async()=>{
      if(!/^\d{6}$/.test(b.value)){st.className="status err";st.textContent="Le nouveau code PIN a exactement 6 chiffres.";return}
      if(b.value!==c.value){st.className="status err";st.textContent="Les deux nouveaux codes PIN ne sont pas les mêmes.";return}
      if(b.value===a.value){st.className="status err";st.textContent="Choisissez un code différent de l'ancien.";return}
      st.className="status";st.textContent="⏳";try{await cloud.changerPin(p.telephone,a.value,b.value);st.className="status ok";st.textContent="✅ Code PIN changé. Retenez-le bien.";zone.replaceChildren()}catch(e){st.className="status err";st.textContent=cloud.message(e)}}},"💾 Changer le code PIN"),el("button",{type:"button",class:"btn",onclick:()=>{zone.replaceChildren();st.textContent=""}},"Annuler")));a.focus()};
  const titre=el("h2",{},(estAdmin()?"🛡️ ":"👤 ")+(p.nom||"Mon compte"));
  return el("section",{class:"panel"},titre,el("p",{class:"note"},"📱 "+(p.telephone||"")+" · "+role),
    el("div",{class:"actions"},el("button",{type:"button",class:"btn",onclick:formNom},"✏️ Changer mon nom"),estAdmin()?el("button",{type:"button",class:"btn",onclick:formPin},"🔑 Changer mon code PIN"):null,out),zone,st,
    panneauMaCarte(p));
}

/* ----- Abonnement de la quincaillerie : alerte avant et après la date de fin (7 jours de grâce) ----- */
const GRACE=7;
function etatAbonnement(q){
  if(!q)return null;
  if(q.actif===false)return {niveau:"bloque",suspendu:true};
  if(!q.abonnement_jusqu)return null;
  const fin=new Date(q.abonnement_jusqu+"T23:59:59"),j=Math.ceil((fin-new Date())/86400000);
  if(j>7)return null;
  if(j>=0)return {niveau:"bientot",jours:j,fin};
  if(j>=-GRACE)return {niveau:"grace",jours:GRACE+j,fin};
  return {niveau:"bloque",fin};
}
function bandeauAbonnement(q){
  const e=etatAbonnement(q);if(!e)return null;
  const d=e.fin?e.fin.toLocaleDateString("fr-FR"):"",pl=n=>n+" jour"+(n>1?"s":"");
  if(estQuinc()){
    const t=e.suspendu?"⛔ Votre compte est suspendu : vos menuisiers ne peuvent plus vous envoyer de commandes. Contactez MenuiPro."
      :e.niveau==="bientot"?"⏰ Votre abonnement se termine le "+d+(e.jours?" (dans "+pl(e.jours)+")":" (aujourd'hui)")+". Pensez à le renouveler auprès de MenuiPro."
      :e.niveau==="grace"?"⚠️ Abonnement terminé le "+d+". Les commandes seront bloquées dans "+pl(e.jours)+" : renouvelez auprès de MenuiPro."
      :"⛔ Abonnement terminé le "+d+" : vos menuisiers ne peuvent plus vous commander. Renouvelez auprès de MenuiPro.";
    return el("div",{class:"banner"+(e.niveau==="bloque"?" banner-fort":"")},t,SUPPORT_WA?el("a",{class:"btn",style:"display:inline-block;margin-top:8px",href:"https://wa.me/"+SUPPORT_WA+"?text="+encodeURIComponent("Bonjour, je souhaite renouveler l'abonnement MenuiPro de "+q.nom+"."),target:"_blank",rel:"noopener"},"📲 Contacter MenuiPro"):null);
  }
  return e.niveau==="bloque"?el("div",{class:"banner banner-fort"},"⚠️ "+q.nom+" ne reçoit pas de commandes en ce moment. Vous pouvez toujours lui écrire sur WhatsApp."):null;
}

/* ----- Quincaillerie : ses menuisiers ----- */
function panneauMesMenuisiers(q){
  const liste=el("div",{class:"lines"},el("p",{class:"note"},"⏳ Chargement…"));
  const sec=el("section",{class:"panel"},el("h2",{},"🪚 Mes menuisiers"),liste);
  cloud.mesMenuisiers(q.id).then(rows=>{
    sec.querySelector("h2").textContent="🪚 Mes menuisiers ("+rows.length+")";
    if(!rows.length){liste.replaceChildren(el("p",{class:"note"},"Aucun menuisier pour l'instant. Envoyez-leur votre lien d'invitation."));return}
    liste.replaceChildren(...rows.map(m=>{
      const wa=waDigits(m.telephone);let armed=false;
      const ret=el("button",{type:"button",class:"btn mini"},"Retirer");
      ret.onclick=async()=>{if(!armed){armed=true;ret.textContent="Touchez encore pour retirer";return}try{await cloud.retirerMenuisier(m.id);toast("✅ "+(m.nom||"Menuisier")+" n'est plus rattaché à votre quincaillerie");renderCompte()}catch(e){toast(cloud.message(e),true)}};
      return el("div",{class:"line menuisier"},el("span",{class:"e","aria-hidden":"true"},"🪚"),
        el("div",{},el("b",{},m.nom||"Menuisier"),el("span",{},"📱 "+telLisible(m.telephone)+" · depuis le "+new Date(m.created_at).toLocaleDateString("fr-FR"))),
        el("div",{class:"acts"},el("button",{type:"button",class:"btn mini",title:"Nouvelle carte MenuiPro",onclick:()=>refaireCarte(m.id,{nom:m.nom,role:"menuisier",tel:m.telephone})},"🪪 Carte"),wa?el("a",{class:"btn mini",href:"https://wa.me/"+wa,target:"_blank",rel:"noopener"},"📲"):null,ret));
    }));
  }).catch(e=>liste.replaceChildren(el("p",{class:"status err"},cloud.message(e))));
  return sec;
}

/* ----- Quincaillerie : commandes reçues, filtrées ----- */
const FILTRES_CMD=[["traiter","À traiter",c=>["envoyee","vue"].includes(c.statut)],["confirmee","Confirmées",c=>c.statut==="confirmee"],["prete","Prêtes",c=>c.statut==="prete"],["livree","Livrées",c=>c.statut==="livree"],["tout","Toutes",()=>true]];
let filtreCmd="traiter";
function afficherCommandesRecues(rows,list){
  marquerRecuesVues(rows);
  if(!rows.length){list.replaceChildren(el("p",{class:"note"},"Aucune commande pour l'instant. Elles arrivent ici quand un menuisier touche « Commander »."));return}
  const seg=el("div",{class:"seg filtres-cmd"}),corps=el("div",{class:"cmds"});
  const dessiner=()=>{
    seg.replaceChildren(...FILTRES_CMD.map(([k,l,f])=>{const n=rows.filter(f).length;return el("button",{type:"button","aria-pressed":String(filtreCmd===k),onclick:()=>{filtreCmd=k;dessiner()}},l+" ("+n+")")}));
    const f=FILTRES_CMD.find(x=>x[0]===filtreCmd)[2],vis=rows.filter(f);
    corps.replaceChildren(...(vis.length?vis.map(carteCommandeRecue):[el("p",{class:"note"},"Rien dans cette liste.")]));
  };
  dessiner();list.replaceChildren(seg,corps);
}
// Alertes de la quincaillerie : nombre de commandes à ouvrir, message à chaque nouvelle commande.
const lireVuQ=()=>{try{return JSON.parse(localStorage.getItem("menuipro-cmd-recues-vu")||"{}")||{}}catch(e){return {}}};
const ecrireVuQ=v=>{try{localStorage.setItem("menuipro-cmd-recues-vu",JSON.stringify(v))}catch(e){}};
function marquerRecuesVues(rows){const vu=lireVuQ();rows.forEach(c=>vu[c.id]=1);ecrireVuQ(vu);ALERTES=rows.filter(c=>c.statut==="envoyee").length;majPastille()}
async function verifierCommandesRecues(){
  let rows;try{rows=await cloud.commandesRecues(ME.quinc.id)}catch(e){return}
  const vu=lireVuQ(),premiere=!Object.keys(vu).length,nouvelles=rows.filter(c=>c.statut==="envoyee"&&!vu[c.id]);
  ALERTES=rows.filter(c=>c.statut==="envoyee").length;majPastille();
  if(!premiere&&nouvelles.length){const c=nouvelles[0];toast("📥 Nouvelle commande"+(c.profils&&c.profils.nom?" de "+c.profils.nom:"")+" : "+c.meuble+(nouvelles.length>1?" (+"+(nouvelles.length-1)+")":""))}
  rows.forEach(c=>vu[c.id]=1);ecrireVuQ(vu);
}

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
// Seule une quincaillerie modifie des prix ; sans connexion en ligne, l'appli locale reste libre.
function peutModifierPrix(){return !cloud.actif||estQuinc()}
let toastT=null;
function toast(msg,err){const t=$("toast");t.textContent=msg;t.className="toast"+(err?" err":"");t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3500)}
let tCat=null,tAt=null;
function pousserCatalogue(){
  if(!cloud.actif||!estQuinc()||!ME.quinc)return;
  clearTimeout(tCat);tCat=setTimeout(async()=>{
    try{await cloud.sauverQuincaillerie(ME.quinc.id,{catalogue:{panneaux:CAT.panneaux,sections:CAT.sections,articles:CAT.articles,prix:CAT.prix,exemple:CAT.exemple},nom:(CAT.boutique.nom||ME.quinc.nom).slice(0,80),whatsapp:CAT.boutique.wa||null,commune:CAT.boutique.commune||null});
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
  cloud.envoyerCommande({quincaillerie_id:ME.quinc.id,projet_id:pr&&pr.cloudId||null,meuble:(nomMeuble()+" "+dimsText()).slice(0,200),lignes:lastBuy.lines.map(l=>({article:l.label,detail:l.detail,total:l.total,...(l.pu?{qte:l.qte,pu:Math.round(l.pu)}:{})})),total:lastBuy.total?Math.round(lastBuy.total):null})
    .then(r=>{if(r&&r.id){const v=lireVu();v[r.id]=cleSuivi(r);ecrireVu(v)}toast("📦 Commande envoyée à "+ME.quinc.nom+" : sa réponse arrivera dans « Compte »")}).catch(e=>{derniereCommande="";toast(cloud.message(e),true)});
}
function appliquerCompte(){
  if(!ME)return;
  const q=ME.quinc;
  if(q){
    const c=q.catalogue||{};
    if(c.panneaux&&c.panneaux.length){CAT.panneaux=c.panneaux;CAT.prix=c.prix||{};CAT.exemple=!!c.exemple;if(c.sections&&c.sections.length)CAT.sections=c.sections;CAT.articles=Array.isArray(c.articles)?c.articles:[]}
    else if(estQuinc())pousserCatalogue();
    CAT.boutique={nom:q.nom||"",wa:q.whatsapp||"",commune:q.commune||""};saveCatLocal();
    if(estQuinc()&&!(c.panneaux&&c.panneaux.length))pousserCatalogue();
  }
  const a=ME.profil&&ME.profil.atelier;
  if(a&&Object.keys(a).length){AT={...AT,...a};if(a.kerf)st.kerf=a.kerf;try{localStorage.setItem("menuipro-atelier",JSON.stringify(AT))}catch(e){}}
  else pousserAtelier();
  $("count-tag").textContent=(estAdmin()?"🛡️ ":estQuinc()?"🏪 ":"👤 ")+(ME.profil&&ME.profil.nom||"Connecté");
  try{localStorage.setItem("menuipro-role",roleCourant())}catch(e){}
  { const h=document.querySelector("h1[data-voix=bienvenue]"),t=h&&h.firstChild; // titre selon le rôle
    if(t&&t.nodeType===3)t.nodeValue=estQuinc()?"🏪 MenuiPro · quincaillerie":estAdmin()?"🛡️ MenuiPro · administration":"🪚 MenuiPro · atelier"; }
  { const cur=location.hash.slice(1); // le menu s'adapte au rôle ; écran interdit → écran d'accueil du rôle
    if(vuesPermises().find(x=>x[0]===cur))dessinerNav(cur);else show(cur); }
  renderPanSel();if(lastCtx)compute();
  traiterInvitation();setTimeout(verifierCommandes,3800); // après les messages de connexion, pour que l'alerte reste visible
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
// 221771234567 → « 77 123 45 67 »
const telLisible=t=>{const d=String(t||"").replace(/\D/g,"").replace(/^221(?=\d{9}$)/,"");return d.length===9?d.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/,"$1 $2 $3 $4"):d};
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
  // Le plus utile en haut ; « Mon compte » (nom, code PIN, déconnexion) en bas pour tous.
  const moi=panneauMonCompte(p);
  if(estAdmin()){box.replaceChildren(...await vueAdmin(),moi);return}
  const ba=bandeauAbonnement(q);if(ba)parts.push(ba);
  if(estQuinc()&&q){
    const copy=el("button",{type:"button",class:"btn"},"📋 Copier le code");copy.onclick=async()=>{try{await navigator.clipboard.writeText(q.code);toast("Code copié")}catch(e){toast("Code : "+q.code)}};
    const list=el("div",{class:"cmds"},el("p",{class:"note"},"⏳ Chargement des commandes…"));
    parts.push(el("section",{class:"panel"},el("h2",{},"📥 Commandes reçues"),list),panneauMesMenuisiers(q));
    parts.push(el("section",{class:"panel"},el("h2",{},"🏪 "+q.nom),q.abonnement_jusqu?el("p",{class:"note"},(new Date(q.abonnement_jusqu+"T23:59:59")>=new Date()?"Abonnement valable jusqu'au ":"Abonnement terminé le ")+new Date(q.abonnement_jusqu).toLocaleDateString("fr-FR")):null,el("p",{},"Code à donner à vos menuisiers :"),el("div",{class:"bigprice",style:"letter-spacing:.15em"},q.code),el("div",{class:"actions"},copy,el("a",{class:"btn",href:"#catalogue"},"🏷️ Gérer mes prix")),el("p",{class:"note"},"Chaque menuisier qui entre ce code reçoit vos prix et peut vous envoyer ses commandes.")));
    parts.push(panneauInviter(q),moi);
    box.replaceChildren(...parts);
    try{
      afficherCommandesRecues(await cloud.commandesRecues(q.id),list);
    }catch(e){list.replaceChildren(el("p",{class:"status err"},cloud.message(e)))}
    return;
  }
  if(q){
    let armedQ=false;const leave=el("button",{type:"button",class:"btn"},"Quitter cette quincaillerie");
    leave.onclick=async()=>{if(!armedQ){armedQ=true;leave.textContent="Touchez encore pour quitter";return}try{await cloud.quitter();ME=await cloud.chargerCompte();toast("Vous avez quitté la quincaillerie");renderCompte()}catch(e){toast(cloud.message(e),true)}};
    parts.push(el("section",{class:"panel"},el("h2",{},"🏪 Ma quincaillerie"),el("p",{},el("b",{},q.nom),q.commune?" · "+q.commune:""),el("p",{class:"note"},"Vos listes d'achat utilisent ses prix. Vos commandes lui arrivent directement."),el("div",{class:"actions"},
      el("button",{type:"button",class:"btn",onclick:e=>{const b=e.currentTarget;b.replaceWith(panneauChoisirQuinc(q))}},"🔄 Comparer les prix des autres quincailleries"),leave)));
    const list=el("div",{class:"cmds"},el("p",{class:"note"},"⏳ Chargement…"));
    parts.push(el("section",{class:"panel"},el("h2",{},"📦 Mes commandes"),list),moi);
    box.replaceChildren(...parts);
    try{const rows=await cloud.mesCommandes(ME.user.id);
      list.replaceChildren(...(rows.length?rows.map(carteCommandeMenuisier):[el("p",{class:"note"},"Aucune commande. Touchez « Commander » dans la liste d'achat d'un meuble.")]));marquerVues(rows)}
    catch(e){list.replaceChildren(el("p",{class:"status err"},cloud.message(e)))}
    return;
  }
  // Menuisier sans quincaillerie : il compare les prix des quincailleries ouvertes et choisit la sienne.
  parts.push(panneauChoisirQuinc(null),moi);
  box.replaceChildren(...parts);
}
/* ----- Choisir sa quincaillerie en comparant les prix ----- */
// Prix de la liste d'achat du meuble actuel avec le catalogue d'une autre quincaillerie.
function prixChez(cat){
  const sauve={panneaux:CAT.panneaux,prix:CAT.prix,sections:CAT.sections,articles:CAT.articles},panSauve=st.panneau;
  try{
    if(cat&&Array.isArray(cat.panneaux)&&cat.panneaux.length){CAT.panneaux=cat.panneaux;CAT.prix=cat.prix||{};if(Array.isArray(cat.sections)&&cat.sections.length)CAT.sections=cat.sections;CAT.articles=Array.isArray(cat.articles)?cat.articles:[]}
    else{CAT.panneaux=sauve.panneaux.map(x=>({...x,prix:0}));CAT.prix={};CAT.articles=[]}
    if(!CAT.panneaux.some(x=>x.id===st.panneau&&!x.dos)){const m=CAT.panneaux.find(x=>!x.dos&&x.ep===st.ep);if(m)st.panneau=m.id}
    const pn=CAT.panneaux.find(x=>x.id===st.panneau&&!x.dos),b=lastCtx&&lastRes&&lastRes.caisson?buyLines(lastCtx):null;
    return {total:b?b.total:0,manque:b?b.missing:0,feuille:pn&&pn.prix?pn.prix:0,nomPan:pn?pn.nom+" "+pn.ep+" mm":"panneau"};
  }catch(e){return {total:0,manque:99,feuille:0,nomPan:""}}
  finally{CAT.panneaux=sauve.panneaux;CAT.prix=sauve.prix;CAT.sections=sauve.sections;CAT.articles=sauve.articles;st.panneau=panSauve}
}
function scannerQuinc(){
  ouvrirScanner({titre:"QR code de la quincaillerie",aide:"Visez le QR code affiché par votre quincaillerie.",onTexte:async t=>{
    const r=lireTexteQR(t);if(!r||!r.invite){toast("Ce n'est pas le QR code d'une quincaillerie.",true);return}
    try{const q=await cloud.rejoindre(r.invite);ME=await cloud.chargerCompte();appliquerCompte();toast("✅ Vous êtes rattaché à "+q.nom+" : ses prix sont dans vos listes d'achat");renderCompte()}
    catch(e){toast(cloud.message(e),true)}
  }});
}
function panneauChoisirQuinc(actuelle){
  const liste=el("div",{class:"quincs"},el("p",{class:"note"},"⏳ Chargement des quincailleries…"));
  const meuble=lastCtx?R(st.id).nom:null;
  const sec=el("section",{class:"panel"},el("h2",{},actuelle?"🔄 Comparer les quincailleries":"🏪 Choisir ma quincaillerie"),
    el("p",{class:"note"},meuble?"Prix de la liste d'achat de votre meuble actuel (« "+meuble+" ») dans chaque quincaillerie.":"Prix d'une feuille de panneau dans chaque quincaillerie. Concevez un meuble pour comparer le prix de toute la liste d'achat."),
    liste,
    el("div",{class:"actions"},el("button",{type:"button",class:"btn",onclick:scannerQuinc},"📷 Scanner le QR de ma quincaillerie")));
  cloud.quincailleriesOuvertes().then(rows=>{
    if(!rows.length){liste.replaceChildren(el("p",{class:"note"},"Aucune quincaillerie n'est ouverte dans l'appli pour l'instant. Demandez à la vôtre son QR code."));return}
    const lignes=rows.map(q=>({q,p:prixChez(q.catalogue)}))
      .sort((a,b)=>(a.p.manque>0)-(b.p.manque>0)||(meuble?(a.p.total||1e12)-(b.p.total||1e12):(a.p.feuille||1e12)-(b.p.feuille||1e12)));
    const moinsCher=lignes.find(x=>!x.p.manque&&(meuble?x.p.total:x.p.feuille));
    liste.replaceChildren(...lignes.map(({q,p})=>{
      const st1=el("span",{class:"note"}),moi=actuelle&&actuelle.id===q.id,wa=waDigits(q.whatsapp);
      const choisir=el("button",{type:"button",class:"btn "+(moi?"":"primary")},moi?"✅ Ma quincaillerie":"Choisir");choisir.disabled=!!moi;
      choisir.onclick=async()=>{choisir.disabled=true;st1.textContent="⏳";try{await cloud.choisirQuincaillerie(q.id);ME=await cloud.chargerCompte();appliquerCompte();toast("✅ Vous êtes rattaché à "+q.nom+" : ses prix sont dans vos listes d'achat");renderCompte()}catch(e){st1.textContent=cloud.messageQR(e);choisir.disabled=false}};
      const prix=meuble?(p.total?fmt(p.total)+" F"+(p.manque?" (+ "+p.manque+" article"+(p.manque>1?"s":"")+" sans prix)":""):"prix pas encore remplis")
        :(p.feuille?fmt(p.feuille)+" F la feuille ("+p.nomPan+")":"prix pas encore remplis");
      return el("div",{class:"quinc-ligne"+(moinsCher&&moinsCher.q===q?" moins-cher":"")},
        el("div",{class:"quinc-info"},el("b",{},"🏪 "+q.nom),el("span",{class:"note"},q.commune||""),
          moinsCher&&moinsCher.q===q?el("span",{class:"chip livre"},"💰 Le moins cher"):null),
        el("div",{class:"quinc-prix"},prix),
        el("div",{class:"acts"},choisir,wa?el("a",{class:"btn mini",href:"https://wa.me/"+wa,target:"_blank",rel:"noopener",title:"Écrire sur WhatsApp"},"📲"):null),st1);
    }));
  }).catch(e=>liste.replaceChildren(el("p",{class:"status err"},cloud.message(e))));
  return sec;
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
    const infos=el("td",{},el("b",{},q.nom),el("div",{class:"note"},[q.commune,q.whatsapp].filter(Boolean).join(" · ")),
      el("button",{type:"button",class:"btn mini",onclick:()=>{
        const n=el("input",{type:"text",maxlength:"80","aria-label":"Nom"}),w=el("input",{type:"tel","aria-label":"WhatsApp",placeholder:"WhatsApp"}),c=el("input",{type:"text","aria-label":"Commune",placeholder:"Commune"});
        n.value=q.nom;w.value=q.whatsapp||"";c.value=q.commune||"";
        infos.replaceChildren(n,w,c,el("button",{type:"button",class:"btn mini",onclick:async()=>{st2.textContent="⏳";try{await cloud.adminModifierQuincaillerie(q.id,n.value,w.value,c.value);q.nom=n.value.trim();q.whatsapp=w.value.trim()||null;q.commune=c.value.trim()||null;drawQ(search.value.trim().toLowerCase())}catch(e){st2.textContent=cloud.message(e)}}},"💾"));
      }},"✏️ Modifier"));
    const voirMenus=el("button",{type:"button",class:"btn mini",title:"Voir ses menuisiers",onclick:()=>{search.value=q.nom;search.dispatchEvent(new Event("input"));mBody.closest("section").scrollIntoView({behavior:"smooth"})}},String(q.menuisiers));
    return el("tr",{},infos,
      el("td",{},q.proprietaire||"—",el("div",{class:"note"},q.tel_proprietaire||""),el("button",{type:"button",class:"btn mini",title:"Nouvelle carte MenuiPro du propriétaire",onclick:()=>refaireCarte(null,{quinc:q.id,nom:q.proprietaire||q.nom,role:"quincaillerie",tel:q.tel_proprietaire})},"🪪 Carte")),el("td",{class:"n"},q.code),
      el("td",{class:"n"},voirMenus),el("td",{class:"n"},String(q.commandes)),el("td",{class:"n"},fmt(q.montant)+" F"),
      el("td",{},date,expire(q.abonnement_jusqu)?el("div",{class:"note",style:"color:var(--warn);font-weight:700"},q.recoit_commandes===false?"expiré · commandes bloquées":"expiré · 7 jours de grâce"):null),el("td",{},note),
      el("td",{},statut,el("button",{type:"button",class:"btn",style:"margin-left:6px",onclick:()=>saveQ(q.actif)},"💾"),st2));
  }));
  const drawM=f=>mBody.replaceChildren(...v.menuisiers.filter(m=>!f||[m.nom,m.telephone,m.quincaillerie].join(" ").toLowerCase().includes(f)).map(m=>{
    const stm=el("span",{class:"note"});
    const sel=el("select",{"aria-label":"Quincaillerie de "+(m.nom||"ce menuisier")},el("option",{value:""},"— aucune —"),...v.quincailleries.map(q=>el("option",{value:q.id},q.nom)));sel.value=m.quincaillerie_id||"";
    sel.onchange=async()=>{stm.textContent="⏳";try{await cloud.adminRattacher(m.id,sel.value||null);m.quincaillerie_id=sel.value||null;m.quincaillerie=(v.quincailleries.find(q=>q.id===sel.value)||{}).nom||null;stm.textContent="✅"}catch(e){stm.textContent=cloud.message(e);sel.value=m.quincaillerie_id||""}};
    const carteB=el("button",{type:"button",class:"btn mini",title:"Nouvelle carte MenuiPro",onclick:()=>refaireCarte(m.id,{nom:m.nom,role:"menuisier",tel:m.telephone})},"🪪");
    const pinB=el("button",{type:"button",class:"btn mini",title:"Nouveau code PIN",onclick:()=>{$("arTel").value=(m.telephone||"").replace(/^221/,"");$("arTel").closest("section").scrollIntoView({behavior:"smooth",block:"center"})}},"🔑");
    const blq=el("button",{type:"button",class:"btn mini",onclick:async()=>{stm.textContent="⏳";try{await cloud.adminBloquer(m.id,!m.bloque);m.bloque=!m.bloque;drawM(search.value.trim().toLowerCase())}catch(e){stm.textContent=e.message}}},m.bloque?"✅ Débloquer":"⛔ Bloquer");
    let armed=false;const del=el("button",{type:"button",class:"btn mini"},"🗑️");
    del.onclick=async()=>{if(!armed){armed=true;del.textContent="🗑️ Supprimer pour de bon ?";return}stm.textContent="⏳";try{await cloud.adminSupprimer(m.id);v.menuisiers=v.menuisiers.filter(x=>x!==m);drawM(search.value.trim().toLowerCase());toast("Compte supprimé")}catch(e){stm.textContent=e.message}};
    return el("tr",{class:m.bloque?"ligne-bloquee":""},el("td",{},el("b",{},m.nom||"—"),m.bloque?el("div",{class:"note",style:"color:var(--warn);font-weight:700"},"⛔ bloqué : ne peut plus se connecter"):null),
      el("td",{class:"n"},m.telephone||"—"),el("td",{},sel),el("td",{class:"n"},String(m.projets)),el("td",{class:"n"},String(m.commandes)),el("td",{class:"n"},dt(m.cree)),el("td",{class:"n"},dt(m.derniere_activite)),
      el("td",{},el("div",{class:"acts-admin"},carteB,pinB,blq,del),stm));
  }));
  search.addEventListener("input",()=>{const f=search.value.trim().toLowerCase();drawQ(f);drawM(f)});
  drawQ("");drawM("");
  const th=(...h)=>el("thead",{},el("tr",{},h.map(x=>el("th",{},x))));
  /* ----- Créer un compte ----- */
  const genPin=()=>String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
  let type="quincaillerie";
  const cTel=el("input",{id:"acTel",type:"tel",inputmode:"tel",placeholder:"77 000 00 00"}),cNom=el("input",{id:"acNom",type:"text",placeholder:"Nom de la personne"});
  const cPin=el("input",{id:"acPin",type:"text",inputmode:"numeric",maxlength:"6",placeholder:"facultatif",style:"letter-spacing:.2em;font-weight:700"});
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
      if(cPin.value.trim()&&!/^\d{6}$/.test(cPin.value.trim()))throw new Error("Le code PIN a 6 chiffres (ou laissez vide : la carte QR suffit).");
      const r=await cloud.adminCreerCompte({type,telephone:cTel.value,pin:cPin.value.trim(),nom:cNom.value,quincaillerie:qNom.value,whatsapp:qWa.value,commune:qCom.value,code:qSel.value});
      cSt.className="status ok";cSt.textContent="✅ Compte créé";
      // La carte QR ouvre le compte : on l'envoie à la personne (le code PIN, s'il y en a un, reste un secours).
      const nomC=cNom.value.trim()||qNom.value.trim();
      const msg=["Bonjour"+(nomC?" "+nomC:"")+", votre compte MenuiPro est prêt.","Pour entrer dans votre compte, ouvrez ce lien sur votre téléphone (c'est votre carte MenuiPro, ne la donnez à personne) :",lienCarte(r.cle),
        r.code?"QR code à montrer à vos menuisiers : dans l'appli, onglet Commandes, « Inviter mes menuisiers ».":"",r.quincaillerie&&type==="menuisier"?"Quincaillerie : "+r.quincaillerie:"",cPin.value.trim()?"Code PIN de secours : "+cPin.value.trim():""].filter(Boolean).join("\n");
      const ta=el("textarea",{class:"copy",readonly:"readonly"});ta.value=msg;
      const wa=el("a",{class:"btn primary",target:"_blank",rel:"noopener",href:"https://wa.me/"+r.telephone+"?text="+encodeURIComponent(msg)},"📲 Envoyer sur WhatsApp");
      const cp=el("button",{type:"button",class:"btn"},"📋 Copier");cp.onclick=()=>copyText(msg,cSt,ta);
      res.replaceChildren(blocCarte({nom:nomC,role:type,cle:r.cle,tel:r.telephone}),el("div",{class:"banner"},"Message à envoyer à la personne :"),ta,el("div",{class:"actions"},wa,cp));
      cTel.value="";cNom.value="";qNom.value="";qWa.value="";qCom.value="";cPin.value="";
    }catch(e){cSt.className="status err";cSt.textContent=e.message}
    finally{creer.disabled=false}
  };
  const creation=el("section",{class:"panel form"},el("h2",{},"➕ Créer un compte"),typeSeg,
    el("div",{class:"grid2"},el("div",{class:"field"},el("label",{for:"acTel"},"📱 Numéro"),cTel),el("div",{class:"field"},el("label",{for:"acNom"},"Nom"),cNom),
      el("div",{class:"field"},el("label",{for:"acPin"},"🔑 Code PIN de secours (facultatif)"),cPin)),
    blocQ,blocM,el("div",{class:"actions"},creer,el("button",{type:"button",class:"btn",onclick:()=>{cPin.value=genPin()}},"🎲 Code PIN de secours")),cSt,res,
    el("p",{class:"note"},"Le compte est utilisable tout de suite avec sa carte QR : envoyez-la à la personne sur WhatsApp, ou faites-la scanner sur place."));
  /* ----- Réinitialiser un code PIN ----- */
  const rTel=el("input",{id:"arTel",type:"tel",inputmode:"tel",placeholder:"77 000 00 00"}),rPin=el("input",{id:"arPin",type:"text",inputmode:"numeric",maxlength:"6",style:"letter-spacing:.2em;font-weight:700"});rPin.value=genPin();
  const rSt=el("p",{class:"status",role:"status"});
  const reset=el("button",{type:"button",class:"btn"},"🔑 Changer le code PIN");
  reset.onclick=async()=>{rSt.className="status";rSt.textContent="⏳";reset.disabled=true;try{await cloud.adminNouveauPin(rTel.value,rPin.value.trim());rSt.className="status ok";rSt.textContent="✅ Nouveau code PIN : "+rPin.value.trim()+" (à transmettre)";rPin.value=genPin()}catch(e){rSt.className="status err";rSt.textContent=e.message}finally{reset.disabled=false}};
  const reinit=el("section",{class:"panel form"},el("h2",{},"🔑 Code PIN oublié"),el("div",{class:"grid2"},el("div",{class:"field"},el("label",{for:"arTel"},"📱 Numéro du compte"),rTel),el("div",{class:"field"},el("label",{for:"arPin"},"Nouveau code PIN"),rPin)),el("div",{class:"actions"},reset),rSt);
  return [
    el("section",{class:"panel"},el("h2",{},"🛡️ Vue d'ensemble"),kpis,el("div",{class:"actions"},el("button",{type:"button",class:"btn",onclick:()=>renderCompte()},"🔄 Actualiser")),search),
    creation,reinit,await sectionVoix(),
    el("section",{class:"panel"},el("h2",{},"🏪 Quincailleries ("+v.quincailleries.length+")"),el("p",{class:"note"},"Réglez la date de fin d'abonnement puis 💾. Après cette date, 7 jours de grâce, puis les commandes sont bloquées. Touchez le statut pour suspendre ou réactiver. Touchez le nombre de menuisiers pour les voir."),
      el("div",{class:"tablewrap"},el("table",{},th("Quincaillerie","Propriétaire","Code","Menuisiers","Commandes","Montant","Abonnement jusqu'au","Note","Statut"),qBody))),
    el("section",{class:"panel"},el("h2",{},"🪚 Menuisiers ("+v.menuisiers.length+")"),
      el("div",{class:"tablewrap"},el("table",{},th("Nom","Téléphone","Quincaillerie","Projets","Commandes","Inscrit le","Dernière activité","Actions"),mBody)))
  ];
}
/* ----- Assistant vocal : note vocale en wolof → meuble rempli ----- */
// « Mon dessin » se fait au doigt, pas à la voix : il reste hors de l'assistant.
const RECETTES_IA=RECIPES.filter(r=>!r.dessin&&!r.importe&&!r.cache),CAT_IA=catalogueIA(RECETTES_IA);
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
function majMicro(){const ok=cloud.actif&&ME&&!estQuinc();$("micBox").hidden=!ok}
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
      let note=new Blob(morceaux,{type:r.mimeType||"audio/webm"});try{note=await versWav(note)}catch(e){/* on envoie le format d'origine */}
      const res=await cloud.assistant(note,CAT_IA,{recette:st.id,nom:R(st.id).nom,...cfg()},duree);
      const a=validerAction(res.action,RECETTES_IA,st.id)||{action:"inconnu",reponse:"pas_compris"};
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
// Démarrage : avec la connexion en ligne, l'appli ne s'ouvre qu'une fois connecté (sinon page de connexion).
// Lien de carte (?carte=…) ouvert avec l'appareil photo du téléphone : connexion directe.
let CARTE_LIEN=null;
try{const u=new URL(location.href);CARTE_LIEN=u.searchParams.get("carte");if(CARTE_LIEN){u.searchParams.delete("carte");history.replaceState(null,"",u.pathname+u.search)}}catch(e){}
if(cloud.actif&&CARTE_LIEN){
  document.body.classList.remove("attente");
  entrerAvecCarte(CARTE_LIEN,null).then(ok=>{if(!ok)ouvrirPorte()});
}else if(cloud.actif){
  cloud.chargerCompte().then(c=>{ME=c;if(c){entrerDansAppli();appliquerCompte();majMicro()}else ouvrirPorte()})
    .catch(async()=>{
      // Pas de réseau : un compte déjà connecté sur ce téléphone garde l'accès (l'appli marche hors ligne).
      let s=null;try{s=await cloud.session()}catch(e){}
      if(s){entrerDansAppli();toast("Hors ligne : l'application marche, la synchronisation reprendra avec le réseau.",true)}else ouvrirPorte(true)});
}else document.body.classList.remove("attente");

/* ----- Application installable (hors-ligne) ----- */
if("serviceWorker" in navigator&&location.protocol==="https:"){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}
