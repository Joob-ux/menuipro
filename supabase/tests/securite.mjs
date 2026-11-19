// Test des règles de sécurité MenuiPro sur un vrai PostgreSQL (PGlite), avec un faux schéma « auth » Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const migration = ["20261112000000_init.sql", "20261112000100_durcissement.sql", "20261112000200_performance.sql", "20261112000300_administration.sql", "20261112000400_comptes_par_admin.sql", "20261114000000_quincaillerie_fluide.sql", "20261115000000_comptes.sql", "20261115000100_roles.sql", "20261120000000_cartes.sql"].map(f => readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8")).join("\n");
let ok = 0, ko = 0;
const check = (cond, label) => { if (cond) { ok++; console.log("  ✅ " + label); } else { ko++; console.log("  ❌ " + label); } };
const expectError = async (fn, label, msg) => { try { await fn(); check(false, label + " (aurait dû être refusé)"); } catch (e) { check(!msg || String(e.message).includes(msg), label + " → refusé : " + e.message.split("\n")[0]); } };

// --- Simulation de Supabase : schéma auth, rôles anon/authenticated, auth.uid()
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb, banned_until timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(migration);
console.log("Migration appliquée.");

const U = { quinc: "11111111-1111-1111-1111-111111111111", ali: "22222222-2222-2222-2222-222222222222", bob: "33333333-3333-3333-3333-333333333333", autreQ: "44444444-4444-4444-4444-444444444444" };
for (const [nom, id] of Object.entries(U)) await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [id, { telephone: "77" + id.slice(0, 7), nom }]);
check((await db.query(`select count(*)::int n from public.profils`)).rows[0].n === 4, "un profil est créé automatiquement pour chaque inscription");

// Exécuter une requête « en tant que » quelqu'un
const as = async (uid, sql, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false);`);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try { return await db.query(sql, params); } finally { await db.exec("reset role"); }
};

console.log("\nQuincaillerie");
const creerQ = async (uid, nom, wa, commune) => { await db.query(`select public.svc_configurer_compte($1, 'quincaillerie', $2, $3, $4)`, [uid, nom, wa, commune]); return (await db.query(`select * from public.quincailleries where owner_id = $1`, [uid])).rows[0]; };
const q = await creerQ(U.quinc, 'Quincaillerie Test', '771234567', 'Pikine');
check(q && q.code && q.code.length === 6, "la quincaillerie est créée avec un code d'invitation à 6 caractères (" + q.code + ")");
check((await as(U.quinc, `select role from public.profils where id = auth.uid()`)).rows[0].role === "quincaillerie", "son profil passe en rôle quincaillerie");
const q2 = await creerQ(U.autreQ, 'Autre Quincaillerie', null, null);
check((await as(U.quinc, `update public.quincailleries set catalogue = '{"prix":{"charn":750}}' where id = $1 returning id`, [q.id])).rows.length === 1, "le propriétaire modifie son catalogue");
await expectError(() => as(U.quinc, `update public.quincailleries set owner_id = $1 where id = $2`, [U.ali, q.id]), "le propriétaire ne peut pas céder sa quincaillerie", "modification_interdite");

console.log("\nMenuisier Ali");
check((await as(U.ali, `select id, nom from public.quincailleries`)).rows.length === 0, "avant d'avoir rejoint, il ne voit aucune quincaillerie");
await expectError(() => as(U.ali, `select public.rejoindre_quincaillerie('ZZZZZZ')`), "un mauvais code", "code_inconnu");
const j = (await as(U.ali, `select public.rejoindre_quincaillerie($1) as r`, [q.code.toLowerCase()])).rows[0].r;
check(j.nom === "Quincaillerie Test", "il rejoint la quincaillerie avec le code (en minuscules aussi)");
const vu = (await as(U.ali, `select nom, catalogue from public.quincailleries`)).rows;
check(vu.length === 1 && vu[0].catalogue.prix.charn === 750, "il voit le catalogue et les prix de SA quincaillerie seulement");
check((await as(U.ali, `update public.quincailleries set catalogue = '{}' where id = $1 returning id`, [q.id])).rows.length === 0, "il ne peut pas modifier le catalogue");
await expectError(() => as(U.ali, `update public.profils set role = 'quincaillerie' where id = auth.uid()`), "il ne peut pas se donner le rôle quincaillerie", "modification_interdite");
await expectError(() => as(U.ali, `update public.profils set quincaillerie_id = $1 where id = auth.uid()`, [q2.id]), "il ne peut pas changer de quincaillerie sans code", "modification_interdite");
check((await as(U.ali, `update public.profils set nom = 'Ali Menuiserie', atelier = '{"jour":15000}' where id = auth.uid() returning id`)).rows.length === 1, "il modifie son nom et les réglages de son atelier");

console.log("\nProjets");
const p = (await as(U.ali, `insert into public.projets (nom, recette, config, prix) values ('Mme Ndiaye', 'armoire-2', '{"L":100}', 158000) returning id`)).rows[0];
check(!!p.id, "Ali enregistre un projet");
check((await as(U.bob, `select * from public.projets`)).rows.length === 0, "Bob ne voit pas les projets d'Ali");
check((await as(U.quinc, `select * from public.projets`)).rows.length === 0, "la quincaillerie ne voit pas non plus les projets d'Ali");
await expectError(() => as(U.bob, `insert into public.projets (owner_id, recette, config) values ($1, 'x', '{}')`, [U.ali]), "Bob ne peut pas créer un projet au nom d'Ali");

console.log("\nCommandes");
const c = (await as(U.ali, `insert into public.commandes (quincaillerie_id, projet_id, meuble, lignes, total) values ($1, $2, 'Armoire 2 portes', '[{"l":"Mélaminé 18","q":4}]', 116400) returning id`, [q.id, p.id])).rows[0];
check(!!c.id, "Ali commande auprès de sa quincaillerie");
await expectError(() => as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'x', '[]')`, [q2.id]), "Ali ne peut pas envoyer une commande à une autre quincaillerie");
await expectError(() => as(U.bob, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'x', '[]')`, [q.id]), "Bob (pas membre) ne peut pas commander chez elle");
const vues = (await as(U.quinc, `select public.commandes_recues() as r`)).rows[0].r;
check(vues.length === 1 && vues[0].profils.nom === "Ali Menuiserie", "la quincaillerie voit la commande et le nom du menuisier");
check((await as(U.autreQ, `select * from public.commandes`)).rows.length === 0, "l'autre quincaillerie ne voit pas cette commande");
check((await as(U.quinc, `update public.commandes set statut = 'prete' where id = $1 returning statut`, [c.id])).rows[0].statut === "prete", "la quincaillerie change le statut (prête)");
await expectError(() => as(U.quinc, `update public.commandes set total = 1 where id = $1`, [c.id]), "la quincaillerie ne peut pas modifier le montant", "modification_interdite");
check((await as(U.ali, `update public.commandes set statut = 'livree' where id = $1 returning id`, [c.id])).rows.length === 0, "Ali ne peut pas changer le statut lui-même");
check((await as(U.ali, `select statut from public.commandes`)).rows[0].statut === "prete", "Ali voit l'avancement de sa commande");

console.log("\nVisiteur non connecté");
for (const t of ["profils", "quincailleries", "projets", "commandes"]) { let n = 0; try { n = (await as(null, `select id from public.${t}`)).rows.length; } catch (e) { n = 0; } check(n === 0, "il ne voit rien dans " + t); }
await expectError(() => as(null, `select public.rejoindre_quincaillerie($1)`, [q.code]), "il ne peut pas utiliser un code d'invitation");

console.log("\nProfils");
check((await as(U.quinc, `select nom from public.profils order by nom`)).rows.length === 1, "la quincaillerie ne lit que son propre profil");
check((await as(U.quinc, `select * from public.mes_menuisiers()`)).rows.map(r => r.nom).join() === "Ali Menuiserie", "elle voit le nom de ses menuisiers (Ali, pas Bob) par mes_menuisiers");
check((await as(U.bob, `select * from public.profils`)).rows.length === 1, "Bob ne voit que son propre profil");

console.log("\nFonctions internes");
await expectError(() => as(U.ali, `select public.ma_quincaillerie()`), "ma_quincaillerie n'est plus exposée dans l'API");
await expectError(() => as(U.ali, `select public.nouveau_profil()`), "nouveau_profil ne peut pas être appelée");
console.log("\nAdministration");
await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, ["55555555-5555-5555-5555-555555555555", { telephone: "221770000000", nom: "Admin" }]);
const ADMIN = "55555555-5555-5555-5555-555555555555";
await expectError(() => as(ADMIN, `update public.profils set role = 'admin' where id = auth.uid()`), "personne ne peut se nommer admin depuis l'application", "modification_interdite");
await expectError(() => as(U.ali, `select public.admin_vue()`), "un menuisier n'a pas accès à la vue admin", "reserve_admin");
await expectError(() => as(U.quinc, `select public.admin_vue()`), "une quincaillerie non plus", "reserve_admin");
await expectError(() => as(null, `select public.admin_vue()`), "un visiteur non plus");
await db.exec(`select set_config('menuipro.autorise','oui',false); update public.profils set role='admin' where id='${ADMIN}'; select set_config('menuipro.autorise','',false);`);
const v = (await as(ADMIN, `select public.admin_vue() as v`)).rows[0].v;
check(v.totaux.quincailleries === 2 && v.totaux.menuisiers === 2 && v.totaux.commandes === 1, "l'admin voit les totaux (2 quincailleries, 2 menuisiers, 1 commande)");
const qa = v.quincailleries.find(x => x.nom === "Quincaillerie Test");
check(qa && qa.menuisiers === 1 && qa.commandes === 1 && qa.montant === 116400, "l'admin voit par quincaillerie : menuisiers, commandes, montant");
check(v.menuisiers.find(m => m.nom === "Ali Menuiserie")?.quincaillerie === "Quincaillerie Test", "l'admin voit chaque menuisier et sa quincaillerie");
await expectError(() => as(U.quinc, `update public.quincailleries set actif = true, abonnement_jusqu = '2030-01-01' where id = $1`, [q.id]), "une quincaillerie ne peut pas prolonger son abonnement elle-même", "modification_interdite");
await as(ADMIN, `select public.admin_abonnement($1, false, '2099-12-31', 'impayé')`, [q.id]);
check((await as(U.quinc, `select actif from public.quincailleries`)).rows[0].actif === false, "l'admin suspend une quincaillerie");
await expectError(() => as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'x', '[]')`, [q.id]), "une quincaillerie suspendue ne reçoit plus de commandes");
await as(ADMIN, `select public.admin_abonnement($1, true, '2099-12-31', null)`, [q.id]);
check(!!(await as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'x', '[]') returning id`, [q.id])).rows[0], "après réactivation, les commandes reprennent");
await expectError(() => as(U.ali, `select public.admin_abonnement($1, true)`, [q.id]), "un menuisier ne peut pas toucher aux abonnements", "reserve_admin");

console.log("\nComptes créés par l'administrateur");
await expectError(() => as(ADMIN, `select public.svc_configurer_compte($1, 'admin')`, [U.bob]), "même l'admin ne peut pas appeler directement la fonction serveur");
await expectError(() => as(U.ali, `select public.svc_configurer_compte($1, 'admin')`, [U.ali]), "un menuisier ne peut pas se nommer admin par cette fonction");
const asService = async (sql, params = []) => { await db.exec("set role service_role"); try { return await db.query(sql, params); } finally { await db.exec("reset role"); } };
await db.exec("grant all on all tables in schema public to service_role");
await db.query(`insert into auth.users (id, raw_user_meta_data) values ('66666666-6666-6666-6666-666666666666', '{"telephone":"221771230000","nom":"Nouvelle Quinc"}')`);
const r1 = (await asService(`select public.svc_configurer_compte('66666666-6666-6666-6666-666666666666', 'quincaillerie', 'Quinc Rufisque', '771230000', 'Rufisque') as r`)).rows[0].r;
check(r1.code && r1.code.length === 6, "le serveur crée une quincaillerie avec son code (" + r1.code + ")");
await db.query(`insert into auth.users (id, raw_user_meta_data) values ('77777777-7777-7777-7777-777777777777', '{"telephone":"221771230001","nom":"Nouveau Menuisier"}')`);
const r2 = (await asService(`select public.svc_configurer_compte('77777777-7777-7777-7777-777777777777', 'menuisier', null, null, null, $1) as r`, [r1.code])).rows[0].r;
check(r2.quincaillerie === "Quinc Rufisque", "le serveur crée un menuisier déjà rattaché à sa quincaillerie");
check((await as("77777777-7777-7777-7777-777777777777", `select nom from public.quincailleries`)).rows[0]?.nom === "Quinc Rufisque", "ce menuisier voit tout de suite les prix de sa quincaillerie");

console.log("\nLien d'invitation");
const ap = (await as(null, `select public.apercu_invitation($1) as a`, [q.code.toLowerCase()])).rows[0].a;
check(ap && ap.nom === "Quincaillerie Test" && ap.commune === "Pikine", "sans compte, le lien montre le nom et la commune de la quincaillerie");
check(ap && ap.whatsapp === undefined && ap.catalogue === undefined && ap.id === undefined, "l'aperçu ne révèle ni WhatsApp, ni catalogue, ni identifiant");
check((await as(null, `select public.apercu_invitation('ZZZZZZ') as a`)).rows[0].a === null, "un code inconnu ne montre rien");
check((await as(null, `select public.apercu_invitation('') as a`)).rows[0].a === null, "un code vide ne montre rien");

console.log("\nRéponse aux commandes");
const c2 = (await as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes, total) values ($1, 'Commode', '[{"article":"Mélaminé 18 mm blanc","detail":"2 feuilles","total":44000}]', 44000) returning id`, [q.id])).rows[0];
const rep = { lignes: [{ i: 0, dispo: "remplace", prix: 46000, remplacement: "Mélaminé 18 mm chêne" }], total: 46000, mode: "retrait", date: "2026-11-15", message: "Le blanc est fini, j'ai le chêne." };
const rq = (await as(U.quinc, `update public.commandes set reponse = $1, statut = 'confirmee' where id = $2 returning statut, repondu_le`, [rep, c2.id])).rows[0];
check(rq && rq.statut === "confirmee" && rq.repondu_le, "la quincaillerie répond (dispo, prix réel, retrait, date) et la base date la réponse");
const lu = (await as(U.ali, `select reponse, statut from public.commandes where id = $1`, [c2.id])).rows[0];
check(lu && lu.statut === "confirmee" && lu.reponse.total === 46000 && lu.reponse.lignes[0].remplacement === "Mélaminé 18 mm chêne", "Ali voit la réponse et le prix confirmé");
check((await as(U.ali, `update public.commandes set reponse = '{"total":1}' where id = $1 returning id`, [c2.id])).rows.length === 0, "Ali ne peut pas écrire la réponse à la place de la quincaillerie");
check((await as(U.autreQ, `update public.commandes set reponse = '{"total":1}' where id = $1 returning id`, [c2.id])).rows.length === 0, "une autre quincaillerie ne peut pas répondre");
check((await as(U.bob, `select * from public.commandes where id = $1`, [c2.id])).rows.length === 0, "Bob ne voit pas cette commande ni sa réponse");
await expectError(() => as(U.quinc, `update public.commandes set total = 1 where id = $1`, [c2.id]), "en répondant, la quincaillerie ne peut pas changer le montant de la commande", "modification_interdite");
await expectError(() => as(U.quinc, `update public.commandes set reponse = '"texte"' where id = $1`, [c2.id]), "une réponse qui n'est pas un objet est refusée", "commandes_reponse_forme");
await expectError(() => as(U.quinc, `update public.commandes set reponse = $1 where id = $2`, [{ message: "x".repeat(30000) }, c2.id]), "une réponse trop grosse est refusée", "commandes_reponse_forme");
await expectError(() => as(U.quinc, `update public.commandes set statut = 'perdue' where id = $1`, [c2.id]), "un statut inconnu est refusé", "commandes_statut_check");

console.log("\nAbonnement : 7 jours de grâce");
const finIl = j => (j >= 0 ? `current_date - ${j}` : `current_date + ${-j}`);
await db.exec(`select set_config('menuipro.admin','oui',false); update public.quincailleries set abonnement_jusqu = ${finIl(3)} where id = '${q.id}'; select set_config('menuipro.admin','',false);`);
check(!!(await as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'grâce', '[]') returning id`, [q.id])).rows[0], "abonnement fini depuis 3 jours : les commandes passent encore (grâce)");
await db.exec(`select set_config('menuipro.admin','oui',false); update public.quincailleries set abonnement_jusqu = ${finIl(8)} where id = '${q.id}'; select set_config('menuipro.admin','',false);`);
await expectError(() => as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'x', '[]')`, [q.id]), "abonnement fini depuis 8 jours : plus de commandes");
const vg = (await as(ADMIN, `select public.admin_vue() as v`)).rows[0].v;
check(vg.quincailleries.find(x => x.id === q.id)?.recoit_commandes === false, "l'admin voit que cette quincaillerie ne reçoit plus de commandes");
await as(ADMIN, `select public.admin_abonnement($1, true, '2099-12-31', null)`, [q.id]);
check(!!(await as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'renouvelé', '[]') returning id`, [q.id])).rows[0], "après renouvellement, les commandes reprennent");

console.log("\nActions de l'administrateur");
await as(ADMIN, `select public.admin_rattacher($1, $2)`, [U.bob, q2.id]);
check((await as(U.bob, `select quincaillerie_id from public.profils where id = auth.uid()`)).rows[0].quincaillerie_id === q2.id, "l'admin rattache Bob à une quincaillerie");
await as(ADMIN, `select public.admin_rattacher($1, null)`, [U.bob]);
check((await as(U.bob, `select quincaillerie_id from public.profils where id = auth.uid()`)).rows[0].quincaillerie_id === null, "l'admin détache Bob");
await expectError(() => as(U.ali, `select public.admin_rattacher($1, $2)`, [U.bob, q.id]), "un menuisier ne peut pas rattacher quelqu'un", "reserve_admin");
await expectError(() => as(ADMIN, `select public.admin_rattacher($1, $2)`, [U.quinc, q2.id]), "on ne rattache pas une quincaillerie comme un menuisier", "compte_inconnu");
await as(ADMIN, `select public.admin_modifier_quincaillerie($1, 'Quincaillerie Test', '770000000', 'Guédiawaye')`, [q.id]);
check((await as(U.quinc, `select commune from public.quincailleries where id = $1`, [q.id])).rows[0].commune === "Guédiawaye", "l'admin corrige la commune d'une quincaillerie");
await expectError(() => as(U.quinc, `select public.admin_modifier_quincaillerie($1, 'X', null, null)`, [q2.id]), "une quincaillerie ne peut pas modifier une autre par cette fonction", "reserve_admin");
await expectError(() => as(ADMIN, `select public.admin_modifier_quincaillerie($1, ' ', null, null)`, [q.id]), "un nom vide est refusé", "nom_quincaillerie_manquant");
check(vg.menuisiers.every(m => "bloque" in m && "quincaillerie_id" in m), "la vue admin indique le blocage et le rattachement de chaque menuisier");

console.log("\nAnnuler une commande");
const ca = (await as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'à annuler', '[]') returning id`, [q.id])).rows[0];
await expectError(() => as(U.bob, `select public.annuler_commande($1)`, [ca.id]), "Bob ne peut pas annuler la commande d'Ali", "annulation_impossible");
await as(U.ali, `select public.annuler_commande($1)`, [ca.id]);
check((await as(U.ali, `select statut from public.commandes where id = $1`, [ca.id])).rows[0].statut === "annulee", "Ali annule sa commande");
await as(U.quinc, `update public.commandes set statut = 'prete' where id = $1`, [c2.id]);
await expectError(() => as(U.ali, `select public.annuler_commande($1)`, [c2.id]), "une commande déjà prête ne s'annule plus", "annulation_impossible");

console.log("\nLa quincaillerie et ses menuisiers");
check((await as(U.quinc, `select * from public.mes_menuisiers()`)).rows.some(r => r.id === U.ali), "la quincaillerie voit la liste de ses menuisiers");
await expectError(() => as(U.autreQ, `select public.retirer_menuisier($1)`, [U.ali]), "une autre quincaillerie ne peut pas retirer Ali", "modification_interdite");
await as(U.quinc, `select public.retirer_menuisier($1)`, [U.ali]);
check((await as(U.ali, `select quincaillerie_id from public.profils where id = auth.uid()`)).rows[0].quincaillerie_id === null, "la quincaillerie retire Ali de sa liste");
await expectError(() => as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'x', '[]')`, [q.id]), "Ali retiré ne peut plus lui commander");

console.log("\nAudit des rôles");
await db.exec(`select set_config('menuipro.admin','oui',false); update public.quincailleries set note_admin = 'mauvais payeur' where id = '${q.id}'; select set_config('menuipro.admin','',false);`);
await as(U.quinc, `select public.retirer_menuisier($1)`, [U.ali]).catch(() => {});
await as(U.ali, `select public.rejoindre_quincaillerie($1)`, [q.code]);
await as(U.ali, `update public.profils set atelier = '{"jour":15000,"marge":35}' where id = auth.uid()`);
check((await as(U.ali, `update public.quincailleries set catalogue = '{"prix":{"charn":1}}' where id = $1 returning id`, [q.id])).rows.length === 0, "un menuisier ne peut pas modifier les prix de sa quincaillerie");
await expectError(() => as(U.ali, `select note_admin from public.quincailleries`), "un menuisier ne lit pas la note privée de l'admin", "permission denied");
await expectError(() => as(U.quinc, `select note_admin from public.quincailleries`), "la quincaillerie ne lit pas la note privée de l'admin sur elle", "permission denied");
check((await as(ADMIN, `select public.admin_vue() as v`)).rows[0].v.quincailleries.find(x => x.id === q.id)?.note_admin === "mauvais payeur", "l'admin lit toujours sa note");
await expectError(() => as(U.ali, `select (public.creer_quincaillerie('Fausse quinc')).nom`), "un menuisier ne peut pas se transformer en quincaillerie", "reserve_admin");
check((await as(U.ali, `select role from public.profils where id = auth.uid()`)).rows[0].role === "menuisier", "Ali reste menuisier");
check((await as(U.quinc, `select atelier from public.profils where id = $1`, [U.ali])).rows.length === 0, "la quincaillerie ne lit pas les réglages privés de ses menuisiers (prix de journée, marge)");
check(!JSON.stringify((await as(U.quinc, `select public.commandes_recues() as r`)).rows[0].r).includes("marge"), "les commandes reçues ne contiennent pas les réglages du menuisier");
const fausse = (await as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes, statut, reponse, repondu_le) values ($1, 'x', '[]', 'livree', '{"total":1}', now()) returning statut, reponse, repondu_le`, [q.id])).rows[0];
check(fausse.statut === "envoyee" && fausse.reponse === null && fausse.repondu_le === null, "une commande neuve est toujours « envoyée », sans réponse (pas de fausse livraison)");
await expectError(() => as(U.ali, `update public.profils set atelier = $1 where id = auth.uid()`, [{ x: "y".repeat(30000) }]), "réglages trop gros refusés", "profils_atelier_taille");
check((await as(U.bob, `select * from public.mes_menuisiers()`)).rows.length === 0 && (await as(U.bob, `select public.commandes_recues() as r`)).rows[0].r.length === 0, "un menuisier n'obtient rien des fonctions de la quincaillerie");
await expectError(() => as(null, `select public.commandes_recues()`), "un visiteur ne peut pas lire les commandes reçues", "permission denied");

console.log("\nCartes QR et choix de la quincaillerie");
await expectError(() => as(U.ali, `select * from prive.cartes`), "un compte ne lit pas les cartes", "permission denied");
await expectError(() => as(U.ali, `select public.svc_poser_carte(auth.uid(), repeat('a', 64))`), "un compte ne pose pas sa propre carte", "permission denied");
await expectError(() => as(null, `select public.svc_lire_carte(repeat('a', 64))`), "un visiteur ne lit pas une carte", "permission denied");
await db.exec("set role service_role");
await db.query(`select public.svc_poser_carte($1, $2)`, [U.ali, "b".repeat(64)]);
const lue = (await db.query(`select public.svc_lire_carte($1) as u`, ["b".repeat(64)])).rows[0].u;
await db.query(`select public.svc_poser_carte($1, $2)`, [U.ali, "c".repeat(64)]);
const ancienne = (await db.query(`select public.svc_lire_carte($1) as u`, ["b".repeat(64)])).rows[0].u;
await db.exec("reset role");
check(lue === U.ali, "la fonction serveur retrouve le compte d'une carte");
check(ancienne === null, "une nouvelle carte rend l'ancienne inutilisable");
await expectError(() => as(null, `select public.quincailleries_ouvertes()`), "un visiteur ne voit pas les quincailleries", "permission denied");
const ouvertes = (await as(U.bob, `select public.quincailleries_ouvertes() as r`)).rows[0].r;
check(ouvertes.some(x => x.id === q.id && x.catalogue) && !JSON.stringify(ouvertes).includes(q.code) && !JSON.stringify(ouvertes).includes("owner") && !JSON.stringify(ouvertes).includes("note_admin"), "un menuisier voit les quincailleries ouvertes et leurs prix, sans code, propriétaire ni note");
await as(ADMIN, `select public.admin_abonnement($1, false, '2099-12-31', null)`, [q2.id]);
check(!(await as(U.bob, `select public.quincailleries_ouvertes() as r`)).rows[0].r.some(x => x.id === q2.id), "une quincaillerie suspendue n'apparaît pas");
await expectError(() => as(U.bob, `select public.choisir_quincaillerie($1)`, [q2.id]), "on ne choisit pas une quincaillerie suspendue", "quincaillerie_fermee");
check((await as(U.bob, `select public.choisir_quincaillerie($1) as r`, [q.id])).rows[0].r.nom === q.nom, "un menuisier choisit une quincaillerie ouverte, sans code");
check((await as(U.bob, `select quincaillerie_id from public.profils where id = auth.uid()`)).rows[0].quincaillerie_id === q.id, "il y est bien rattaché");
await expectError(() => as(U.quinc, `select public.choisir_quincaillerie($1)`, [q.id]), "une quincaillerie ne change pas de quincaillerie ainsi", "reserve_menuisier");
await as(ADMIN, `select public.admin_abonnement($1, true, '2099-12-31', null)`, [q2.id]);

console.log(`\nRésultat : ${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
