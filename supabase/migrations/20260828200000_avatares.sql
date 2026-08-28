-- Bucket das fotos de perfil. A imagem fica pública para leitura (a URL é
-- opaca, com o id da conta no caminho) e cada pessoa só escreve na própria pasta.

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

drop policy if exists "avatares_read" on storage.objects;
create policy "avatares_read" on storage.objects
  for select to public using (bucket_id = 'avatares');

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
