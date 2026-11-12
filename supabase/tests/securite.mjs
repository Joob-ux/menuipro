// Test des règles de sécurité MenuiPro sur un vrai PostgreSQL (PGlite), avec un faux schéma « auth » Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
const migration = ["20261112000000_init.sql", "20261112000100_durcissement.sql", "20261112000200_performance.sql", "20261112000300_administration.sql", "20261112000400_comptes_par_admin.sql"].map(f => readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8")).join("\n");
let ok = 0, ko = 0;
const check = (cond, label) => { if (cond) { ok++; console.log("  ✅ " + label); } else { ko++; console.log("  ❌ " + label); } };
const expectError = async (fn, label, msg) => { try { await fn(); check(false, label + " (aurait dû être refusé)"); } catch (e) { check(!msg || String(e.message).includes(msg), label + " → refusé : " + e.message.split("\n")[0]); } };

// --- Simulation de Supabase : schéma auth, rôles anon/authenticated, auth.uid()
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(migration);
await db.exec(`grant all on all tables in schema public to anon, authenticated;`);
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
const q = (await as(U.quinc, `select * from public.creer_quincaillerie('Quincaillerie Test', '771234567', 'Pikine')`)).rows[0];
check(q && q.code && q.code.length === 6, "la quincaillerie est créée avec un code d'invitation à 6 caractères (" + q.code + ")");
check((await as(U.quinc, `select role from public.profils where id = auth.uid()`)).rows[0].role === "quincaillerie", "son profil passe en rôle quincaillerie");
const q2 = (await as(U.autreQ, `select * from public.creer_quincaillerie('Autre Quincaillerie')`)).rows[0];
check((await as(U.quinc, `update public.quincailleries set catalogue = '{"prix":{"charn":750}}' where id = $1 returning id`, [q.id])).rows.length === 1, "le propriétaire modifie son catalogue");
await expectError(() => as(U.quinc, `update public.quincailleries set owner_id = $1 where id = $2`, [U.ali, q.id]), "le propriétaire ne peut pas céder sa quincaillerie", "modification_interdite");

console.log("\nMenuisier Ali");
check((await as(U.ali, `select * from public.quincailleries`)).rows.length === 0, "avant d'avoir rejoint, il ne voit aucune quincaillerie");
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
const vues = (await as(U.quinc, `select c.meuble, c.total, pr.nom from public.commandes c join public.profils pr on pr.id = c.menuisier_id`)).rows;
check(vues.length === 1 && vues[0].nom === "Ali Menuiserie", "la quincaillerie voit la commande et le nom du menuisier");
check((await as(U.autreQ, `select * from public.commandes`)).rows.length === 0, "l'autre quincaillerie ne voit pas cette commande");
check((await as(U.quinc, `update public.commandes set statut = 'prete' where id = $1 returning statut`, [c.id])).rows[0].statut === "prete", "la quincaillerie change le statut (prête)");
await expectError(() => as(U.quinc, `update public.commandes set total = 1 where id = $1`, [c.id]), "la quincaillerie ne peut pas modifier le montant", "modification_interdite");
check((await as(U.ali, `update public.commandes set statut = 'livree' where id = $1 returning id`, [c.id])).rows.length === 0, "Ali ne peut pas changer le statut lui-même");
check((await as(U.ali, `select statut from public.commandes`)).rows[0].statut === "prete", "Ali voit l'avancement de sa commande");

console.log("\nVisiteur non connecté");
for (const t of ["profils", "quincailleries", "projets", "commandes"]) check((await as(null, `select * from public.${t}`)).rows.length === 0, "il ne voit rien dans " + t);
await expectError(() => as(null, `select public.rejoindre_quincaillerie($1)`, [q.code]), "il ne peut pas utiliser un code d'invitation");

console.log("\nProfils");
check((await as(U.quinc, `select nom from public.profils order by nom`)).rows.length === 2, "la quincaillerie voit son profil et celui de ses menuisiers (pas Bob)");
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
await as(ADMIN, `select public.admin_abonnement($1, false, '2026-12-31', 'impayé')`, [q.id]);
check((await as(U.quinc, `select actif from public.quincailleries`)).rows[0].actif === false, "l'admin suspend une quincaillerie");
await expectError(() => as(U.ali, `insert into public.commandes (quincaillerie_id, meuble, lignes) values ($1, 'x', '[]')`, [q.id]), "une quincaillerie suspendue ne reçoit plus de commandes");
await as(ADMIN, `select public.admin_abonnement($1, true, '2026-12-31', null)`, [q.id]);
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

console.log(`\nRésultat : ${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
