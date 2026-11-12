-- MenuiPro — règles RLS optimisées (auth.uid() évalué une seule fois par requête) et index manquant
create index if not exists commandes_projet on public.commandes(projet_id);

drop policy profils_lire on public.profils;
drop policy profils_modifier on public.profils;
drop policy quinc_lire on public.quincailleries;
drop policy quinc_modifier on public.quincailleries;
drop policy projets_tout on public.projets;
drop policy commandes_creer on public.commandes;
drop policy commandes_lire on public.commandes;
drop policy commandes_statut on public.commandes;

create policy profils_lire on public.profils for select to authenticated
  using (id = (select auth.uid()) or (quincaillerie_id is not null and prive.est_proprietaire(quincaillerie_id)));
create policy profils_modifier on public.profils for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy quinc_lire on public.quincailleries for select to authenticated
  using (owner_id = (select auth.uid()) or id = (select prive.ma_quincaillerie()));
create policy quinc_modifier on public.quincailleries for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy projets_tout on public.projets for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy commandes_creer on public.commandes for insert to authenticated
  with check (menuisier_id = (select auth.uid()) and quincaillerie_id = (select prive.ma_quincaillerie()));
create policy commandes_lire on public.commandes for select to authenticated
  using (menuisier_id = (select auth.uid()) or prive.est_proprietaire(quincaillerie_id));
create policy commandes_statut on public.commandes for update to authenticated
  using (prive.est_proprietaire(quincaillerie_id)) with check (prive.est_proprietaire(quincaillerie_id));
