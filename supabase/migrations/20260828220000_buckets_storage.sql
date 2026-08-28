-- Os dois buckets do CRM. As tabelas das migrações anteriores entraram, mas as
-- linhas em storage.buckets não — sem elas, "Enviar arquivo" e "Trocar foto"
-- respondem "Bucket not found". Este arquivo cria só os buckets e é idempotente.

insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do update set public = true;

-- Fotos de perfil: leitura livre, escrita só na própria pasta.
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

-- Anexos do ministério: seguem as chaves de módulo de Arquivos.
drop policy if exists "arquivos_bucket_read" on storage.objects;
create policy "arquivos_bucket_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'arquivos' and public.has_module_access(auth.uid(), 'arquivos')
  );

drop policy if exists "arquivos_bucket_insert" on storage.objects;
create policy "arquivos_bucket_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'arquivos' and public.has_module_access(auth.uid(), 'arquivos_gerenciar')
  );

drop policy if exists "arquivos_bucket_update" on storage.objects;
create policy "arquivos_bucket_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'arquivos' and public.has_module_access(auth.uid(), 'arquivos_gerenciar')
  );

drop policy if exists "arquivos_bucket_delete" on storage.objects;
create policy "arquivos_bucket_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'arquivos' and public.has_module_access(auth.uid(), 'arquivos_gerenciar')
  );
