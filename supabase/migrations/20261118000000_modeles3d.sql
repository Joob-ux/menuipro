-- MenuiPro — fichiers 3D importés par les menuisiers (GLB, GLTF, OBJ, STL, FBX).
-- Bucket privé : chacun ne lit et n'écrit que dans son dossier « <id du compte>/… ». 20 Mo maximum par fichier.
insert into storage.buckets (id, name, public, file_size_limit)
values ('modeles3d', 'modeles3d', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy modeles3d_lire on storage.objects for select to authenticated
  using (bucket_id = 'modeles3d' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy modeles3d_ajouter on storage.objects for insert to authenticated
  with check (bucket_id = 'modeles3d' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy modeles3d_modifier on storage.objects for update to authenticated
  using (bucket_id = 'modeles3d' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'modeles3d' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy modeles3d_supprimer on storage.objects for delete to authenticated
  using (bucket_id = 'modeles3d' and (storage.foldername(name))[1] = (select auth.uid())::text);
