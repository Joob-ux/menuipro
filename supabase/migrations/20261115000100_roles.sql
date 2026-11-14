-- MenuiPro — audit des rôles : chacun ne voit et ne fait que ce qui le concerne.
-- Trous fermés :
--  1. un menuisier pouvait se transformer en quincaillerie (creer_quincaillerie) → réservé à l'administrateur ;
--  2. la note privée de l'administrateur (note_admin) était lisible par la quincaillerie et ses menuisiers ;
--  3. une quincaillerie lisait les réglages privés de ses menuisiers (prix de journée, marge) ;
--  4. un menuisier pouvait créer une commande déjà « livrée », avec une fausse réponse de la quincaillerie ;
--  5. tailles non limitées pour les données libres (réglages, catalogue, projets).

-- ---------- 1. Créer une quincaillerie : administrateur seulement ----------
create or replace function public.creer_quincaillerie(p_nom text, p_whatsapp text default null, p_commune text default null)
returns public.quincailleries language plpgsql security definer set search_path = public as $$
begin
  raise exception 'reserve_admin' using hint = 'Les quincailleries sont créées depuis la console administrateur';
end $$;

-- ---------- 2. Note de l'administrateur : invisible pour les autres ----------
-- Lecture colonne par colonne : tout sauf note_admin (l'administrateur la lit par admin_vue).
revoke select on public.quincailleries from anon, authenticated;
grant select (id, owner_id, nom, whatsapp, commune, code, catalogue, created_at, updated_at, actif, abonnement_jusqu)
  on public.quincailleries to authenticated;

-- ---------- 3. Profils : chacun ne lit que le sien ----------
-- La quincaillerie obtient le nom et le téléphone de ses menuisiers par deux fonctions, sans leurs réglages.
drop policy if exists profils_lire on public.profils;
create policy profils_lire on public.profils for select to authenticated
  using (id = (select auth.uid()));

create or replace function public.mes_menuisiers()
returns table (id uuid, nom text, telephone text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.nom, m.telephone, m.created_at
  from profils m join quincailleries q on q.id = m.quincaillerie_id
  where q.owner_id = auth.uid() and m.role = 'menuisier'
  order by m.created_at desc
$$;

create or replace function public.commandes_recues()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select c.id, c.meuble, c.lignes, c.total, c.statut, c.reponse, c.repondu_le, c.created_at,
           json_build_object('nom', p.nom, 'telephone', p.telephone) as profils
    from commandes c join quincailleries q on q.id = c.quincaillerie_id left join profils p on p.id = c.menuisier_id
    where q.owner_id = auth.uid()
    order by c.created_at desc limit 100) x
$$;
revoke all on function public.mes_menuisiers(), public.commandes_recues() from public, anon;
grant execute on function public.mes_menuisiers(), public.commandes_recues() to authenticated;

-- ---------- 4. Une commande neuve est toujours « envoyée », sans réponse ----------
create or replace function public.commande_neuve() returns trigger language plpgsql set search_path = public as $$
begin
  new.statut = 'envoyee'; new.reponse = null; new.repondu_le = null;
  new.created_at = now(); new.updated_at = now();
  return new;
end $$;
drop trigger if exists t_commande_neuve on public.commandes;
create trigger t_commande_neuve before insert on public.commandes for each row execute function public.commande_neuve();

-- ---------- 5. Tailles raisonnables ----------
alter table public.profils add constraint profils_atelier_taille check (pg_column_size(atelier) < 20000);
alter table public.quincailleries add constraint quincailleries_catalogue_taille check (pg_column_size(catalogue) < 200000);
alter table public.projets add constraint projets_config_taille check (pg_column_size(config) < 100000);
alter table public.commandes add constraint commandes_lignes_taille check (pg_column_size(lignes) < 50000);
