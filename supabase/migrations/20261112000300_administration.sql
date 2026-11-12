-- MenuiPro — compte administrateur et abonnements des quincailleries
-- Le rôle « admin » ne s'attribue que directement en base (jamais depuis l'application).

alter table public.profils drop constraint profils_role_check;
alter table public.profils add constraint profils_role_check check (role in ('menuisier', 'quincaillerie', 'admin'));

alter table public.quincailleries
  add column actif boolean not null default true,
  add column abonnement_jusqu date,
  add column note_admin text check (note_admin is null or char_length(note_admin) <= 300);

-- Le propriétaire ne peut pas modifier son statut ni son abonnement : seul l'administrateur le peut (par fonction)
create or replace function public.proteger_quincaillerie() returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id or new.code is distinct from old.code or new.id is distinct from old.id then
    raise exception 'modification_interdite';
  end if;
  if (new.actif is distinct from old.actif or new.abonnement_jusqu is distinct from old.abonnement_jusqu or new.note_admin is distinct from old.note_admin)
     and coalesce(current_setting('menuipro.admin', true), '') <> 'oui' then
    raise exception 'modification_interdite' using hint = 'Réservé à l''administrateur';
  end if;
  return new;
end $$;

create or replace function prive.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profils where id = auth.uid() and role = 'admin')
$$;
create or replace function prive.quinc_active(q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select actif from public.quincailleries where id = q), false)
$$;
revoke all on function prive.est_admin(), prive.quinc_active(uuid) from public, anon;
grant execute on function prive.est_admin(), prive.quinc_active(uuid) to authenticated;

-- Une quincaillerie suspendue ne reçoit plus de commandes
drop policy commandes_creer on public.commandes;
create policy commandes_creer on public.commandes for insert to authenticated
  with check (menuisier_id = (select auth.uid()) and quincaillerie_id = (select prive.ma_quincaillerie()) and prive.quinc_active(quincaillerie_id));

-- Vue globale de l'administrateur (chiffres et listes, sans le contenu des projets des menuisiers)
create or replace function public.admin_vue() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not prive.est_admin() then raise exception 'reserve_admin'; end if;
  return json_build_object(
    'totaux', json_build_object(
      'quincailleries', (select count(*) from quincailleries),
      'quincailleries_actives', (select count(*) from quincailleries where actif),
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
             p.nom as proprietaire, p.telephone as tel_proprietaire,
             (select count(*) from profils m where m.quincaillerie_id = q.id and m.role = 'menuisier') as menuisiers,
             (select count(*) from commandes c where c.quincaillerie_id = q.id) as commandes,
             (select coalesce(sum(total), 0) from commandes c where c.quincaillerie_id = q.id and c.statut <> 'annulee') as montant,
             (select max(created_at) from commandes c where c.quincaillerie_id = q.id) as derniere_commande
      from quincailleries q left join profils p on p.id = q.owner_id) x), '[]'::json),
    'menuisiers', coalesce((select json_agg(y order by y.cree desc) from (
      select m.id, m.nom, m.telephone, m.created_at as cree, q.nom as quincaillerie,
             (select count(*) from projets pr where pr.owner_id = m.id) as projets,
             (select count(*) from commandes c where c.menuisier_id = m.id) as commandes,
             (select max(updated_at) from projets pr where pr.owner_id = m.id) as derniere_activite
      from profils m left join quincailleries q on q.id = m.quincaillerie_id where m.role = 'menuisier') y), '[]'::json)
  );
end $$;

create or replace function public.admin_abonnement(p_quinc uuid, p_actif boolean, p_jusqu date default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_admin() then raise exception 'reserve_admin'; end if;
  perform set_config('menuipro.admin', 'oui', true);
  update quincailleries set actif = p_actif, abonnement_jusqu = p_jusqu, note_admin = nullif(trim(p_note), '') where id = p_quinc;
  if not found then raise exception 'quincaillerie_inconnue'; end if;
end $$;

revoke all on function public.admin_vue(), public.admin_abonnement(uuid, boolean, date, text) from public, anon;
grant execute on function public.admin_vue(), public.admin_abonnement(uuid, boolean, date, text) to authenticated;

-- Un administrateur qui crée une quincaillerie de test garde son rôle d'administrateur
create or replace function public.creer_quincaillerie(p_nom text, p_whatsapp text default null, p_commune text default null)
returns public.quincailleries language plpgsql security definer set search_path = public as $$
declare q public.quincailleries;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  select * into q from public.quincailleries where owner_id = auth.uid();
  if not found then
    insert into public.quincailleries (owner_id, nom, whatsapp, commune)
    values (auth.uid(), trim(p_nom), nullif(trim(p_whatsapp), ''), nullif(trim(p_commune), ''))
    returning * into q;
  end if;
  perform set_config('menuipro.autorise', 'oui', true);
  update public.profils set role = case when role = 'admin' then 'admin' else 'quincaillerie' end, quincaillerie_id = q.id where id = auth.uid();
  return q;
end $$;
