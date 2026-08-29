-- Fotos de perfil: leitura para conta logada, escrita só na própria pasta.
drop policy if exists "avatares_read" on storage.objects;
create policy "avatares_read" on storage.objects
  for select to authenticated using (bucket_id = 'avatares');

drop policy if exists "avatares_insert" on storage.objects;
create policy "avatares_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatares_update" on storage.objects;
create policy "avatares_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatares_delete" on storage.objects;
create policy "avatares_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text
  );