-- MenuiPro — comptes par QR code
-- 1. Carte MenuiPro : chaque compte a un QR code personnel qui le connecte sur n'importe quel téléphone.
--    La base ne garde que l'empreinte SHA-256 de la clé : une fuite de la base ne donne accès à aucun compte.
--    Seule la fonction serveur « compte-qr » (clé de service) lit et écrit les cartes.
-- 2. Un menuisier sans quincaillerie voit les quincailleries ouvertes et leurs prix, et choisit la sienne.

create schema if not exists prive;

-- ---------- 1. Cartes ----------
create table if not exists prive.cartes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  empreinte text not null unique check (empreinte ~ '^[0-9a-f]{64}$'),
  cree_le timestamptz not null default now(),
  cree_par uuid,
  utilisee_le timestamptz
);
revoke all on prive.cartes from public, anon, authenticated;

-- Pose (ou remplace) la carte d'un compte : l'ancienne carte ne marche plus.
create or replace function public.svc_poser_carte(p_user uuid, p_empreinte text, p_par uuid default null)
returns void language sql security definer set search_path = prive, public as $$
  insert into prive.cartes (user_id, empreinte, cree_par) values (p_user, p_empreinte, p_par)
  on conflict (user_id) do update set empreinte = excluded.empreinte, cree_le = now(), cree_par = excluded.cree_par, utilisee_le = null
$$;
-- Retrouve le compte d'une carte (et note son utilisation).
create or replace function public.svc_lire_carte(p_empreinte text)
returns uuid language sql security definer set search_path = prive, public as $$
  update prive.cartes set utilisee_le = now() where empreinte = p_empreinte returning user_id
$$;
revoke all on function public.svc_poser_carte(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.svc_lire_carte(text) from public, anon, authenticated;
grant execute on function public.svc_poser_carte(uuid, text, uuid) to service_role;
grant execute on function public.svc_lire_carte(text) to service_role;
grant usage on schema prive to service_role;

-- ---------- 2. Quincailleries ouvertes et leurs prix ----------
-- Pour tout compte connecté : nom, commune, WhatsApp et catalogue des quincailleries actives (abonnement valable).
-- Jamais : propriétaire, code d'invitation, note de l'administrateur, liste des menuisiers.
create or replace function public.quincailleries_ouvertes()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', q.id, 'nom', q.nom, 'commune', q.commune, 'whatsapp', q.whatsapp, 'catalogue', q.catalogue) order by q.nom), '[]'::json)
  from public.quincailleries q
  where auth.uid() is not null and prive.quinc_active(q.id)
$$;
revoke all on function public.quincailleries_ouvertes() from public, anon;
grant execute on function public.quincailleries_ouvertes() to authenticated;

-- Un menuisier choisit une quincaillerie ouverte (sans code). Une quincaillerie ou un admin ne change pas ainsi.
create or replace function public.choisir_quincaillerie(p_quinc uuid)
returns json language plpgsql security definer set search_path = public as $$
declare q public.quincailleries; r text;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  select role into r from public.profils where id = auth.uid();
  if r is distinct from 'menuisier' then raise exception 'reserve_menuisier'; end if;
  select * into q from public.quincailleries where id = p_quinc;
  if not found or not prive.quinc_active(q.id) then raise exception 'quincaillerie_fermee'; end if;
  perform set_config('menuipro.autorise', 'oui', true);
  update public.profils set quincaillerie_id = q.id where id = auth.uid();
  return json_build_object('id', q.id, 'nom', q.nom, 'commune', q.commune, 'whatsapp', q.whatsapp);
end $$;
revoke all on function public.choisir_quincaillerie(uuid) from public, anon;
grant execute on function public.choisir_quincaillerie(uuid) to authenticated;
