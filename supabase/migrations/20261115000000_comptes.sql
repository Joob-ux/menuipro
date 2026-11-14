-- MenuiPro — comptes prêts pour les tests : abonnements, actions de l'administrateur,
-- annulation d'une commande par le menuisier, retrait d'un menuisier par sa quincaillerie.

-- ---------- 1. Abonnement : 7 jours de grâce après la date de fin, puis plus de commandes ----------
create or replace function prive.quinc_active(q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select actif and (abonnement_jusqu is null or abonnement_jusqu + 7 >= current_date)
                   from public.quincailleries where id = q), false)
$$;

-- ---------- 2. Administrateur ----------
-- Vue globale : on ajoute le rattachement (id de la quincaillerie) et le blocage de chaque compte.
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
      where m.role = 'menuisier') y), '[]'::json)
  );
end $$;

-- Rattacher un menuisier à une quincaillerie (ou le détacher avec null).
create or replace function public.admin_rattacher(p_user uuid, p_quinc uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_admin() then raise exception 'reserve_admin'; end if;
  if p_quinc is not null and not exists (select 1 from quincailleries where id = p_quinc) then raise exception 'quincaillerie_inconnue'; end if;
  perform set_config('menuipro.autorise', 'oui', true);
  update profils set quincaillerie_id = p_quinc where id = p_user and role = 'menuisier';
  if not found then raise exception 'compte_inconnu'; end if;
end $$;

-- Modifier le nom, le WhatsApp ou la commune d'une quincaillerie.
create or replace function public.admin_modifier_quincaillerie(p_quinc uuid, p_nom text, p_whatsapp text, p_commune text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not prive.est_admin() then raise exception 'reserve_admin'; end if;
  if coalesce(char_length(trim(p_nom)), 0) < 2 then raise exception 'nom_quincaillerie_manquant'; end if;
  update quincailleries set nom = left(trim(p_nom), 80), whatsapp = nullif(left(trim(p_whatsapp), 20), ''), commune = nullif(left(trim(p_commune), 60), '')
  where id = p_quinc;
  if not found then raise exception 'quincaillerie_inconnue'; end if;
end $$;

revoke all on function public.admin_vue(), public.admin_rattacher(uuid, uuid), public.admin_modifier_quincaillerie(uuid, text, text, text) from public, anon;
grant execute on function public.admin_vue(), public.admin_rattacher(uuid, uuid), public.admin_modifier_quincaillerie(uuid, text, text, text) to authenticated;

-- ---------- 3. Le menuisier annule sa commande (tant qu'elle n'est pas prête) ----------
create or replace function public.annuler_commande(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  update commandes set statut = 'annulee'
  where id = p_id and menuisier_id = auth.uid() and statut in ('envoyee', 'vue', 'confirmee');
  if not found then raise exception 'annulation_impossible'; end if;
end $$;

-- ---------- 4. La quincaillerie retire un menuisier de sa liste ----------
create or replace function public.retirer_menuisier(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  perform set_config('menuipro.autorise', 'oui', true);
  update profils set quincaillerie_id = null
  where id = p_user and role = 'menuisier' and quincaillerie_id is not null and prive.est_proprietaire(quincaillerie_id);
  if not found then raise exception 'modification_interdite'; end if;
end $$;

revoke all on function public.annuler_commande(uuid), public.retirer_menuisier(uuid) from public, anon;
grant execute on function public.annuler_commande(uuid), public.retirer_menuisier(uuid) to authenticated;
