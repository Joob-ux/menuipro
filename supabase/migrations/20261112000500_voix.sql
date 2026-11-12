-- Guide vocal en wolof : fichiers audio publics (lecture pour tous), dépôt réservé à l'administrateur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voix', 'voix', true, 2097152, array['audio/*'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['audio/*'];

create policy voix_lire on storage.objects for select to anon, authenticated
  using (bucket_id = 'voix');
create policy voix_admin_ajouter on storage.objects for insert to authenticated
  with check (bucket_id = 'voix' and (select prive.est_admin()));
create policy voix_admin_modifier on storage.objects for update to authenticated
  using (bucket_id = 'voix' and (select prive.est_admin()))
  with check (bucket_id = 'voix' and (select prive.est_admin()));
create policy voix_admin_supprimer on storage.objects for delete to authenticated
  using (bucket_id = 'voix' and (select prive.est_admin()));
