-- MenuiPro — travail fluide entre menuisiers et quincailleries
-- 1. Lien d'invitation : on peut voir le nom de la quincaillerie d'un code avant d'avoir un compte.
-- 2. Réponse aux commandes : la quincaillerie confirme ligne par ligne (dispo, prix réel, remplacement),
--    indique retrait ou livraison et la date ; le menuisier voit la réponse.

-- ---------- 1. Aperçu d'une invitation (sans compte) ----------
-- Renvoie seulement le nom et la commune : rien de privé (ni catalogue, ni WhatsApp, ni membres).
create or replace function public.apercu_invitation(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('nom', q.nom, 'commune', q.commune, 'actif', q.actif)
  from public.quincailleries q
  where q.code = upper(trim(p_code)) and char_length(trim(p_code)) = 6
$$;
revoke all on function public.apercu_invitation(text) from public;
grant execute on function public.apercu_invitation(text) to anon, authenticated;

-- ---------- 2. Réponse de la quincaillerie à une commande ----------
alter table public.commandes add column if not exists reponse jsonb;
alter table public.commandes add column if not exists repondu_le timestamptz;
-- Une réponse est un objet JSON de taille raisonnable.
alter table public.commandes add constraint commandes_reponse_forme
  check (reponse is null or (jsonb_typeof(reponse) = 'object' and pg_column_size(reponse) < 20000));

-- Nouveau statut « confirmee » : la quincaillerie a répondu (dispo, prix, retrait/livraison).
alter table public.commandes drop constraint if exists commandes_statut_check;
alter table public.commandes add constraint commandes_statut_check
  check (statut in ('envoyee', 'vue', 'confirmee', 'prete', 'livree', 'annulee'));

-- La date de réponse est posée par la base, pas par l'application.
create or replace function public.dater_reponse() returns trigger language plpgsql set search_path = public as $$
begin
  if new.reponse is distinct from old.reponse then new.repondu_le = now(); end if;
  return new;
end $$;
drop trigger if exists t_dater_reponse on public.commandes;
create trigger t_dater_reponse before update on public.commandes for each row execute function public.dater_reponse();
