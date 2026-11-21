-- MenuiPro — console de l'administrateur : modèles retirés de l'appli, quincaillerie par défaut, commandes récentes.

-- ---------- 1. Réglages de l'appli (une seule ligne) ----------
-- modeles_retires : identifiants des meubles que l'administrateur a retirés du catalogue (pour tout le monde).
create table if not exists public.reglages (
  id int primary key default 1 check (id = 1),
  modeles_retires text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.reglages (id) values (1) on conflict do nothing;
alter table public.reglages enable row level security;
revoke all on public.reglages from anon, authenticated; -- lecture et écriture par les fonctions ci-dessous seulement

-- Lu par tout le monde au démarrage (même sans compte) : la liste n'a rien de secret.
create or replace function public.reglages_publics() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('modeles_retires', coalesce((select modeles_retires from reglages where id = 1), '{}'))
$$;
revoke all on function public.reglages_publics() from public;
grant execute on function public.reglages_publics() to anon, authenticated;

-- L'administrateur retire ou remet des modèles (liste complète des retirés).
create or replace function public.admin_modeles_retires(p_ids text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_admin() then raise exception 'reserve_admin'; end if;
  if coalesce(array_length(p_ids, 1), 0) > 500 then raise exception 'trop_de_modeles'; end if;
  if exists (select 1 from unnest(coalesce(p_ids, '{}')) i where i !~ '^[a-z0-9-]{1,60}$') then raise exception 'modele_inconnu'; end if;
  update reglages set modeles_retires = (select coalesce(array_agg(distinct i), '{}') from unnest(coalesce(p_ids, '{}')) i), updated_at = now() where id = 1;
end $$;

-- ---------- 2. Quincaillerie par défaut, choisie depuis la console ----------
create or replace function public.admin_par_defaut(p_quinc uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_admin() then raise exception 'reserve_admin'; end if;
  if p_quinc is not null and not exists (select 1 from quincailleries where id = p_quinc) then raise exception 'quincaillerie_inconnue'; end if;
  perform set_config('menuipro.admin', 'oui', true);
  update quincailleries set par_defaut = false where par_defaut and id is distinct from p_quinc;
  if p_quinc is not null then update quincailleries set par_defaut = true where id = p_quinc; end if;
end $$;

-- ---------- 3. Vue d'ensemble : + propriétaire (pour supprimer), par défaut, commandes récentes, modèles retirés ----------
create or replace function public.admin_vue() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not prive.est_admin() then raise exception 'reserve_admin'; end if;
  return json_build_object(
    'totaux', json_build_object(
      'quincailleries', (select count(*) from quincailleries),
      'quincailleries_actives', (select count(*) from quincailleries q where prive.quinc_active(q.id)),
      'menuisiers', (select count(*) from profils where role = 'menuisier'),
      'menuisiers_rattaches', (select count(*) from profils where role = 'menuisier' and quincaillerie_id is not null),
      'projets', (select count(*) from projets),
      'commandes', (select count(*) from commandes),
      'commandes_30j', (select count(*) from commandes where created_at > now() - interval '30 days'),
      'montant_commandes', (select coalesce(sum(total), 0) from commandes where statut <> 'annulee'),
      'montant_30j', (select coalesce(sum(total), 0) from commandes where statut <> 'annulee' and created_at > now() - interval '30 days')
    ),
    'quincailleries', coalesce((select json_agg(x order by x.cree desc) from (
      select q.id, q.nom, q.commune, q.whatsapp, q.code, q.actif, q.abonnement_jusqu, q.note_admin, q.created_at as cree,
             q.owner_id, q.par_defaut,
             prive.quinc_active(q.id) as recoit_commandes,
             p.nom as proprietaire, p.telephone as tel_proprietaire,
             (u.banned_until is not null and u.banned_until > now()) as bloque,
             (select count(*) from profils m where m.quincaillerie_id = q.id and m.role = 'menuisier') as menuisiers,
             (select count(*) from commandes c where c.quincaillerie_id = q.id) as commandes,
             (select coalesce(sum(total), 0) from commandes c where c.quincaillerie_id = q.id and c.statut <> 'annulee') as montant,
             (select max(created_at) from commandes c where c.quincaillerie_id = q.id) as derniere_commande
      from quincailleries q left join profils p on p.id = q.owner_id left join auth.users u on u.id = q.owner_id) x), '[]'::json),
    'menuisiers', coalesce((select json_agg(y order by y.cree desc) from (
      select m.id, m.nom, m.telephone, m.created_at as cree, m.quincaillerie_id, q.nom as quincaillerie,
             (u.banned_until is not null and u.banned_until > now()) as bloque,
             (select count(*) from projets pr where pr.owner_id = m.id) as projets,
             (select count(*) from commandes c where c.menuisier_id = m.id) as commandes,
             greatest((select max(updated_at) from projets pr where pr.owner_id = m.id), (select max(created_at) from commandes c where c.menuisier_id = m.id)) as derniere_activite
      from profils m left join quincailleries q on q.id = m.quincaillerie_id left join auth.users u on u.id = m.id
      where m.role = 'menuisier') y), '[]'::json),
    'commandes_recentes', coalesce((select json_agg(z order by z.created_at desc) from (
      select c.id, c.created_at, c.meuble, c.statut, coalesce((c.reponse ->> 'total')::numeric, c.total) as total,
             m.nom as menuisier, m.telephone as tel_menuisier, q.nom as quincaillerie
      from commandes c join profils m on m.id = c.menuisier_id join quincailleries q on q.id = c.quincaillerie_id
      order by c.created_at desc limit 100) z), '[]'::json),
    'modeles_retires', coalesce((select modeles_retires from reglages where id = 1), '{}')
  );
end $$;

revoke all on function public.admin_vue(), public.admin_modeles_retires(text[]), public.admin_par_defaut(uuid) from public, anon;
grant execute on function public.admin_vue(), public.admin_modeles_retires(text[]), public.admin_par_defaut(uuid) to authenticated;
