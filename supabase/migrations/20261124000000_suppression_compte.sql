-- Suppression de compte par le menuisier lui-même (exigée par le Play Store).
-- Efface le compte (auth.users) : par cascade, son profil, ses projets, ses commandes et sa carte QR.
-- Une quincaillerie ou l'administrateur ne peut pas se supprimer seul (ses menuisiers en dépendent) :
-- il passe par MenuiPro (console administrateur).
create or replace function public.supprimer_mon_compte()
returns void language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  select role into r from public.profils where id = auth.uid();
  if r is distinct from 'menuisier' then raise exception 'suppression_par_admin'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
