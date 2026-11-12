-- MenuiPro — configuration d'un compte créé par l'administrateur.
-- Appelée uniquement par la fonction serveur « admin-comptes » (clé de service), jamais par l'application.
create or replace function public.svc_configurer_compte(p_user uuid, p_type text, p_quinc_nom text default null,
  p_whatsapp text default null, p_commune text default null, p_code text default null)
returns json language plpgsql security definer set search_path = public as $$
declare q public.quincailleries;
begin
  perform set_config('menuipro.autorise', 'oui', true);
  if p_type = 'quincaillerie' then
    if coalesce(char_length(trim(p_quinc_nom)), 0) < 2 then raise exception 'nom_quincaillerie_manquant'; end if;
    insert into quincailleries (owner_id, nom, whatsapp, commune)
    values (p_user, trim(p_quinc_nom), nullif(trim(p_whatsapp), ''), nullif(trim(p_commune), '')) returning * into q;
    update profils set role = 'quincaillerie', quincaillerie_id = q.id where id = p_user;
    return json_build_object('code', q.code, 'quincaillerie', q.nom);
  elsif p_type = 'menuisier' then
    if nullif(trim(p_code), '') is not null then
      select * into q from quincailleries where code = upper(trim(p_code));
      if not found then raise exception 'code_inconnu'; end if;
      update profils set quincaillerie_id = q.id where id = p_user;
      return json_build_object('quincaillerie', q.nom);
    end if;
    return json_build_object();
  elsif p_type = 'admin' then
    update profils set role = 'admin' where id = p_user;
    return json_build_object();
  end if;
  raise exception 'type_inconnu';
end $$;
revoke all on function public.svc_configurer_compte(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.svc_configurer_compte(uuid, text, text, text, text, text) to service_role;
