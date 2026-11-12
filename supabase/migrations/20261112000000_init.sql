-- MenuiPro — base de données initiale
-- Comptes (profils), quincailleries et leur catalogue partagé, projets des menuisiers, commandes.
-- Toute la sécurité repose sur les règles RLS : chacun ne voit que ce qui le concerne.

-- ---------- Tables ----------
create table public.quincailleries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nom text not null check (char_length(nom) between 2 and 80),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 20),
  commune text check (commune is null or char_length(commune) <= 60),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  catalogue jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index quincailleries_un_par_proprietaire on public.quincailleries(owner_id);

create table public.profils (
  id uuid primary key references auth.users(id) on delete cascade,
  telephone text unique,
  nom text check (nom is null or char_length(nom) <= 80),
  role text not null default 'menuisier' check (role in ('menuisier', 'quincaillerie')),
  quincaillerie_id uuid references public.quincailleries(id) on delete set null,
  atelier jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index profils_quincaillerie on public.profils(quincaillerie_id);

create table public.projets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom text not null default 'Meuble' check (char_length(nom) <= 120),
  recette text not null,
  config jsonb not null,
  prix integer,
  materiel integer,
  statut text not null default 'devis' check (statut in ('devis', 'commande', 'livre')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projets_owner on public.projets(owner_id, updated_at desc);

create table public.commandes (
  id uuid primary key default gen_random_uuid(),
  menuisier_id uuid not null default auth.uid() references public.profils(id) on delete cascade,
  quincaillerie_id uuid not null references public.quincailleries(id) on delete cascade,
  projet_id uuid references public.projets(id) on delete set null,
  meuble text not null check (char_length(meuble) <= 200),
  lignes jsonb not null,
  total integer,
  statut text not null default 'envoyee' check (statut in ('envoyee', 'vue', 'prete', 'livree', 'annulee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index commandes_quincaillerie on public.commandes(quincaillerie_id, created_at desc);
create index commandes_menuisier on public.commandes(menuisier_id, created_at desc);

-- ---------- Fonctions d'aide (security definer : évitent la récursion des règles) ----------
create or replace function public.ma_quincaillerie() returns uuid
language sql stable security definer set search_path = public as $$
  select quincaillerie_id from public.profils where id = auth.uid()
$$;

create or replace function public.est_proprietaire(q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.quincailleries where id = q and owner_id = auth.uid())
$$;

-- ---------- Triggers ----------
create or replace function public.maj_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_quincailleries_maj before update on public.quincailleries for each row execute function public.maj_updated_at();
create trigger t_projets_maj before update on public.projets for each row execute function public.maj_updated_at();
create trigger t_commandes_maj before update on public.commandes for each row execute function public.maj_updated_at();

-- Profil créé automatiquement à l'inscription (téléphone et nom passés dans les métadonnées)
create or replace function public.nouveau_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, telephone, nom)
  values (new.id, new.raw_user_meta_data ->> 'telephone', new.raw_user_meta_data ->> 'nom');
  return new;
end $$;
create trigger t_nouveau_profil after insert on auth.users for each row execute function public.nouveau_profil();

-- Le rôle et la quincaillerie d'un profil ne changent que par les fonctions prévues
create or replace function public.proteger_profil() returns trigger language plpgsql set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.quincaillerie_id is distinct from old.quincaillerie_id
      or new.telephone is distinct from old.telephone or new.id is distinct from old.id)
     and coalesce(current_setting('menuipro.autorise', true), '') <> 'oui' then
    raise exception 'modification_interdite' using hint = 'Utilisez creer_quincaillerie ou rejoindre_quincaillerie';
  end if;
  return new;
end $$;
create trigger t_proteger_profil before update on public.profils for each row execute function public.proteger_profil();

-- Le propriétaire et le code d'une quincaillerie ne changent pas
create or replace function public.proteger_quincaillerie() returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id or new.code is distinct from old.code or new.id is distinct from old.id then
    raise exception 'modification_interdite';
  end if;
  return new;
end $$;
create trigger t_proteger_quincaillerie before update on public.quincailleries for each row execute function public.proteger_quincaillerie();

-- La quincaillerie ne modifie que le statut d'une commande
create or replace function public.proteger_commande() returns trigger language plpgsql set search_path = public as $$
begin
  if new.lignes is distinct from old.lignes or new.total is distinct from old.total or new.meuble is distinct from old.meuble
     or new.menuisier_id is distinct from old.menuisier_id or new.quincaillerie_id is distinct from old.quincaillerie_id
     or new.projet_id is distinct from old.projet_id or new.created_at is distinct from old.created_at then
    raise exception 'modification_interdite' using hint = 'Seul le statut peut changer';
  end if;
  return new;
end $$;
create trigger t_proteger_commande before update on public.commandes for each row execute function public.proteger_commande();

-- ---------- Fonctions appelées par l'application ----------
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
  update public.profils set role = 'quincaillerie', quincaillerie_id = q.id where id = auth.uid();
  return q;
end $$;

create or replace function public.rejoindre_quincaillerie(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare q public.quincailleries;
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  select * into q from public.quincailleries where code = upper(trim(p_code));
  if not found then raise exception 'code_inconnu'; end if;
  perform set_config('menuipro.autorise', 'oui', true);
  update public.profils set quincaillerie_id = q.id where id = auth.uid() and role = 'menuisier';
  return json_build_object('id', q.id, 'nom', q.nom, 'commune', q.commune, 'whatsapp', q.whatsapp);
end $$;

create or replace function public.quitter_quincaillerie()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non_connecte'; end if;
  perform set_config('menuipro.autorise', 'oui', true);
  update public.profils set quincaillerie_id = null where id = auth.uid() and role = 'menuisier';
end $$;

revoke all on function public.creer_quincaillerie(text, text, text), public.rejoindre_quincaillerie(text),
  public.quitter_quincaillerie(), public.ma_quincaillerie(), public.est_proprietaire(uuid) from public, anon;
grant execute on function public.creer_quincaillerie(text, text, text), public.rejoindre_quincaillerie(text),
  public.quitter_quincaillerie(), public.ma_quincaillerie(), public.est_proprietaire(uuid) to authenticated;

-- ---------- Règles d'accès (RLS) ----------
alter table public.profils enable row level security;
alter table public.quincailleries enable row level security;
alter table public.projets enable row level security;
alter table public.commandes enable row level security;

-- Profils : je vois et modifie le mien ; une quincaillerie voit ses menuisiers (pour les commandes)
create policy profils_lire on public.profils for select to authenticated
  using (id = auth.uid() or (quincaillerie_id is not null and public.est_proprietaire(quincaillerie_id)));
create policy profils_modifier on public.profils for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Quincailleries : visibles par leur propriétaire et leurs menuisiers ; modifiables par le propriétaire
create policy quinc_lire on public.quincailleries for select to authenticated
  using (owner_id = auth.uid() or id = public.ma_quincaillerie());
create policy quinc_modifier on public.quincailleries for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Projets : uniquement les miens
create policy projets_tout on public.projets for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Commandes : le menuisier commande auprès de SA quincaillerie ; la quincaillerie voit et suit les siennes
create policy commandes_creer on public.commandes for insert to authenticated
  with check (menuisier_id = auth.uid() and quincaillerie_id = public.ma_quincaillerie());
create policy commandes_lire on public.commandes for select to authenticated
  using (menuisier_id = auth.uid() or public.est_proprietaire(quincaillerie_id));
create policy commandes_statut on public.commandes for update to authenticated
  using (public.est_proprietaire(quincaillerie_id)) with check (public.est_proprietaire(quincaillerie_id));
