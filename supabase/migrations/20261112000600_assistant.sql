-- Assistant vocal : journal des demandes (quota par jour, suivi des coûts, amélioration des réponses).
-- Écrit uniquement par la fonction serveur (clé de service) ; chacun relit les siennes, l'admin voit tout.
create table public.assistant_journal (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  duree_s integer,
  texte text,
  action jsonb,
  ms integer
);
create index assistant_journal_user_jour on public.assistant_journal(user_id, created_at desc);
alter table public.assistant_journal enable row level security;
create policy assistant_lire on public.assistant_journal for select to authenticated
  using (user_id = (select auth.uid()) or (select prive.est_admin()));
revoke insert, update, delete on public.assistant_journal from anon, authenticated;
