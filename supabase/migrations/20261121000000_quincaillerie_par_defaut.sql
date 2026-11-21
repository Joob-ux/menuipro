-- MenuiPro — quincaillerie par défaut (aujourd'hui : Sodimac).
-- Un menuisier qui s'inscrit sans scanner le QR d'une quincaillerie est rattaché à la quincaillerie par défaut :
-- ses prix sont ceux de cette boutique et ses commandes y arrivent (appli + WhatsApp de la boutique).
-- Une seule quincaillerie par défaut ; seul l'administrateur (ou le serveur) peut la changer.

alter table public.quincailleries add column if not exists par_defaut boolean not null default false;
create unique index if not exists quincailleries_une_par_defaut on public.quincailleries (par_defaut) where par_defaut;

create or replace function public.proteger_quincaillerie() returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id or new.code is distinct from old.code or new.id is distinct from old.id then
    raise exception 'modification_interdite';
  end if;
  if (new.actif is distinct from old.actif or new.abonnement_jusqu is distinct from old.abonnement_jusqu or new.note_admin is distinct from old.note_admin
      or new.par_defaut is distinct from old.par_defaut)
     and coalesce(current_setting('menuipro.admin', true), '') <> 'oui' then
    raise exception 'modification_interdite' using hint = 'Réservé à l''administrateur';
  end if;
  return new;
end $$;

-- Quincaillerie par défaut, si elle reçoit des commandes (abonnement, pas suspendue).
create or replace function prive.quinc_par_defaut() returns uuid language sql stable security definer set search_path = public as $$
  select q.id from public.quincailleries q where q.par_defaut and prive.quinc_active(q.id) limit 1
$$;
revoke all on function prive.quinc_par_defaut() from public, anon, authenticated;

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
    else
      select * into q from quincailleries where id = prive.quinc_par_defaut(); -- sans QR : la quincaillerie par défaut
      if not found then return json_build_object(); end if;
    end if;
    update profils set quincaillerie_id = q.id where id = p_user;
    return json_build_object('quincaillerie', q.nom);
  elsif p_type = 'admin' then
    update profils set role = 'admin' where id = p_user;
    return json_build_object();
  end if;
  raise exception 'type_inconnu';
end $$;
revoke all on function public.svc_configurer_compte(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.svc_configurer_compte(uuid, text, text, text, text, text) to service_role;
