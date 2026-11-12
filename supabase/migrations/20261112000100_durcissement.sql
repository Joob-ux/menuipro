-- MenuiPro — durcissement après l'audit de sécurité Supabase
-- 1. La fonction qui crée les profils n'est utilisée que par le trigger : personne ne doit l'appeler.
revoke all on function public.nouveau_profil() from public, anon, authenticated;

-- 2. Les fonctions internes des règles RLS sortent du schéma exposé par l'API.
create schema if not exists prive;
revoke all on schema prive from public, anon;
grant usage on schema prive to authenticated;
alter function public.ma_quincaillerie() set schema prive;
alter function public.est_proprietaire(uuid) set schema prive;
revoke all on function prive.ma_quincaillerie(), prive.est_proprietaire(uuid) from public, anon;
grant execute on function prive.ma_quincaillerie(), prive.est_proprietaire(uuid) to authenticated;
