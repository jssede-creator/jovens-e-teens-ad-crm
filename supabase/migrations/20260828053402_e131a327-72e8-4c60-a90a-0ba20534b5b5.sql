-- Módulos novos do AD CRM: membros, calendário, papo reto, projetos, arquivos,
-- suporte e configurações. Segue o mesmo padrão das tabelas existentes:
-- grants explícitos, RLS ligada e políticas baseadas em has_module_access/has_role.

-- 1. Chaves de módulo -------------------------------------------------------

alter table public.module_access drop constraint if exists module_access_module_key_check;
alter table public.module_access add constraint module_access_module_key_check
  check (module_key in (
    'membros','membros_gerenciar',
    'congregacoes','congregacoes_gerenciar',
    'ebd','ebd_chamada','ebd_turmas',
    'calendario',
    'papo_reto','papo_reto_gerenciar',
    'projetos','projetos_gerenciar',
    'arquivos','arquivos_gerenciar',
    'suporte',
    'configuracoes'
  ));

-- 2. Papo reto --------------------------------------------------------------

-- Janelas de atendimento abertas pela liderança.
create table if not exists public.papo_reto_horarios (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  hora_inicio time not null,
  hora_fim time not null check (hora_fim > hora_inicio),
  criado_por uuid,
  created_at timestamptz not null default now(),
  unique (data, hora_inicio, hora_fim)
);
grant select, insert, update, delete on public.papo_reto_horarios to authenticated;
grant all on public.papo_reto_horarios to service_role;
alter table public.papo_reto_horarios enable row level security;

-- Pedidos de conversa feitos pelos membros.
create table if not exists public.papo_reto_agendamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  solicitante_nome text not null,
  solicitante_email text not null,
  horario_id uuid references public.papo_reto_horarios(id) on delete set null,
  data date not null,
  hora_inicio time not null,
  hora_fim time not null check (hora_fim > hora_inicio),
  assunto text not null,
  mensagem text,
  status text not null default 'pendente'
    check (status in ('pendente','confirmado','recusado','concluido')),
  resposta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.papo_reto_agendamentos to authenticated;
grant all on public.papo_reto_agendamentos to service_role;
alter table public.papo_reto_agendamentos enable row level security;

-- 3. Novos projetos ---------------------------------------------------------

create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  status text not null default 'ideias'
    check (status in ('ideias','planejado','em_andamento','revisao','concluido')),
  ordem integer not null default 0,
  responsavel text,
  prazo date,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projetos to authenticated;
grant all on public.projetos to service_role;
alter table public.projetos enable row level security;

-- 4. Arquivos ---------------------------------------------------------------

create table if not exists public.arquivos_pastas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_por uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.arquivos_pastas to authenticated;
grant all on public.arquivos_pastas to service_role;
alter table public.arquivos_pastas enable row level security;

create table if not exists public.arquivos (
  id uuid primary key default gen_random_uuid(),
  pasta_id uuid references public.arquivos_pastas(id) on delete set null,
  nome text not null,
  caminho text not null unique,
  tamanho bigint not null default 0,
  tipo text,
  enviado_por uuid,
  enviado_por_nome text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.arquivos to authenticated;
grant all on public.arquivos to service_role;
alter table public.arquivos enable row level security;

insert into public.arquivos_pastas (nome)
values ('Documentos'), ('Financeiro'), ('Geral'), ('Mídia'), ('Modelos')
on conflict (nome) do nothing;

-- 5. Gatilhos de updated_at -------------------------------------------------

drop trigger if exists papo_reto_agendamentos_touch on public.papo_reto_agendamentos;
create trigger papo_reto_agendamentos_touch before update on public.papo_reto_agendamentos
  for each row execute function public.touch_updated_at();

drop trigger if exists projetos_touch on public.projetos;
create trigger projetos_touch before update on public.projetos
  for each row execute function public.touch_updated_at();

-- 6. Políticas --------------------------------------------------------------

-- papo_reto_horarios: quem tem o módulo enxerga; só a liderança abre horário.
drop policy if exists "papo_horarios_read" on public.papo_reto_horarios;
create policy "papo_horarios_read" on public.papo_reto_horarios
  for select to authenticated using (public.has_module_access(auth.uid(), 'papo_reto'));
drop policy if exists "papo_horarios_insert" on public.papo_reto_horarios;
create policy "papo_horarios_insert" on public.papo_reto_horarios
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'papo_reto_gerenciar'));
drop policy if exists "papo_horarios_update" on public.papo_reto_horarios;
create policy "papo_horarios_update" on public.papo_reto_horarios
  for update to authenticated using (public.has_module_access(auth.uid(), 'papo_reto_gerenciar'))
  with check (public.has_module_access(auth.uid(), 'papo_reto_gerenciar'));
drop policy if exists "papo_horarios_delete" on public.papo_reto_horarios;
create policy "papo_horarios_delete" on public.papo_reto_horarios
  for delete to authenticated using (public.has_module_access(auth.uid(), 'papo_reto_gerenciar'));

-- papo_reto_agendamentos: cada um vê o seu; a liderança vê todos.
drop policy if exists "papo_agend_self_read" on public.papo_reto_agendamentos;
create policy "papo_agend_self_read" on public.papo_reto_agendamentos
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "papo_agend_lideranca_read" on public.papo_reto_agendamentos;
create policy "papo_agend_lideranca_read" on public.papo_reto_agendamentos
  for select to authenticated using (public.has_module_access(auth.uid(), 'papo_reto_gerenciar'));
drop policy if exists "papo_agend_insert" on public.papo_reto_agendamentos;
create policy "papo_agend_insert" on public.papo_reto_agendamentos
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "papo_agend_self_update" on public.papo_reto_agendamentos;
create policy "papo_agend_self_update" on public.papo_reto_agendamentos
  for update to authenticated using (user_id = auth.uid() and status = 'pendente')
  with check (user_id = auth.uid());
drop policy if exists "papo_agend_lideranca_update" on public.papo_reto_agendamentos;
create policy "papo_agend_lideranca_update" on public.papo_reto_agendamentos
  for update to authenticated using (public.has_module_access(auth.uid(), 'papo_reto_gerenciar'))
  with check (public.has_module_access(auth.uid(), 'papo_reto_gerenciar'));
drop policy if exists "papo_agend_delete" on public.papo_reto_agendamentos;
create policy "papo_agend_delete" on public.papo_reto_agendamentos
  for delete to authenticated using (
    user_id = auth.uid() or public.has_module_access(auth.uid(), 'papo_reto_gerenciar')
  );

-- projetos
drop policy if exists "projetos_read" on public.projetos;
create policy "projetos_read" on public.projetos
  for select to authenticated using (public.has_module_access(auth.uid(), 'projetos'));
drop policy if exists "projetos_insert" on public.projetos;
create policy "projetos_insert" on public.projetos
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'projetos_gerenciar'));
drop policy if exists "projetos_update" on public.projetos;
create policy "projetos_update" on public.projetos
  for update to authenticated using (public.has_module_access(auth.uid(), 'projetos_gerenciar'))
  with check (public.has_module_access(auth.uid(), 'projetos_gerenciar'));
drop policy if exists "projetos_delete" on public.projetos;
create policy "projetos_delete" on public.projetos
  for delete to authenticated using (public.has_module_access(auth.uid(), 'projetos_gerenciar'));

-- arquivos_pastas
drop policy if exists "pastas_read" on public.arquivos_pastas;
create policy "pastas_read" on public.arquivos_pastas
  for select to authenticated using (public.has_module_access(auth.uid(), 'arquivos'));
drop policy if exists "pastas_insert" on public.arquivos_pastas;
create policy "pastas_insert" on public.arquivos_pastas
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'arquivos_gerenciar'));
drop policy if exists "pastas_update" on public.arquivos_pastas;
create policy "pastas_update" on public.arquivos_pastas
  for update to authenticated using (public.has_module_access(auth.uid(), 'arquivos_gerenciar'))
  with check (public.has_module_access(auth.uid(), 'arquivos_gerenciar'));
drop policy if exists "pastas_delete" on public.arquivos_pastas;
create policy "pastas_delete" on public.arquivos_pastas
  for delete to authenticated using (public.has_module_access(auth.uid(), 'arquivos_gerenciar'));

-- arquivos
drop policy if exists "arquivos_read" on public.arquivos;
create policy "arquivos_read" on public.arquivos
  for select to authenticated using (public.has_module_access(auth.uid(), 'arquivos'));
drop policy if exists "arquivos_insert" on public.arquivos;
create policy "arquivos_insert" on public.arquivos
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'arquivos_gerenciar'));
drop policy if exists "arquivos_update" on public.arquivos;
create policy "arquivos_update" on public.arquivos
  for update to authenticated using (public.has_module_access(auth.uid(), 'arquivos_gerenciar'))
  with check (public.has_module_access(auth.uid(), 'arquivos_gerenciar'));
drop policy if exists "arquivos_delete" on public.arquivos;
create policy "arquivos_delete" on public.arquivos
  for delete to authenticated using (public.has_module_access(auth.uid(), 'arquivos_gerenciar'));

-- storage: o bucket segue as mesmas chaves de módulo.
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

-- 7. Auditoria e acessos ----------------------------------------------------

-- A tela de Suporte lista a trilha de auditoria; só quem tem o módulo enxerga.
drop policy if exists "auditoria_read" on public.auditoria;
create policy "auditoria_read" on public.auditoria
  for select to authenticated using (public.has_module_access(auth.uid(), 'suporte'));
drop policy if exists "auditoria_insert" on public.auditoria;
create policy "auditoria_insert" on public.auditoria
  for insert to authenticated with check (user_id = auth.uid());

-- Configurações precisa escrever em module_access e user_roles (só admin).
grant insert, update, delete on public.module_access to authenticated;
grant insert, update, delete on public.user_roles to authenticated;

drop policy if exists "module_access_admin_write" on public.module_access;
create policy "module_access_admin_write" on public.module_access
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "module_access_admin_delete" on public.module_access;
create policy "module_access_admin_delete" on public.module_access
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "user_roles_admin_write" on public.user_roles;
create policy "user_roles_admin_write" on public.user_roles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "user_roles_admin_delete" on public.user_roles;
create policy "user_roles_admin_delete" on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));