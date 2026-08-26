
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.congregacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  status text not null default 'ativa' check (status in ('ativa','inativa')),
  endereco text not null,
  numero text,
  bairro text not null,
  cidade text not null,
  estado char(2) not null,
  cep text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.congregacoes to authenticated;
grant all on public.congregacoes to service_role;
alter table public.congregacoes enable row level security;

create table public.cadastros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nome_completo text not null,
  data_nascimento date not null,
  cpf text not null,
  rg text not null,
  telefone text not null,
  email text not null,
  congregacao_id uuid references public.congregacoes(id),
  endereco text not null,
  numero text,
  complemento text,
  cidade text not null,
  cep text not null,
  compartilhou_dados_complementares boolean not null default false,
  escolaridade text,
  local_estudo text,
  curso text,
  estado_civil text,
  trabalha_atualmente boolean,
  renda_mensal text,
  mora_com_pais boolean,
  renda_familiar text,
  lgpd_aceito boolean not null,
  data_cadastro timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cadastros_cpf_unico unique (cpf),
  constraint cadastros_lgpd_obrigatorio check (lgpd_aceito = true)
);
grant select, insert, update, delete on public.cadastros to authenticated;
grant all on public.cadastros to service_role;
alter table public.cadastros enable row level security;

create table public.composicao_familiar (
  id uuid primary key default gen_random_uuid(),
  cadastro_id uuid not null references public.cadastros(id) on delete cascade,
  nome_completo text not null,
  parentesco text,
  idade integer,
  ocupacao text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.composicao_familiar to authenticated;
grant all on public.composicao_familiar to service_role;
alter table public.composicao_familiar enable row level security;

create table public.module_access (
  user_id uuid not null,
  module_key text not null check (module_key in
    ('congregacoes','congregacoes_gerenciar','ebd','ebd_chamada','ebd_turmas')),
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, module_key)
);
grant select on public.module_access to authenticated;
grant all on public.module_access to service_role;
alter table public.module_access enable row level security;

create table public.ebd_turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  congregacao_id uuid not null references public.congregacoes(id),
  idade_min integer not null,
  idade_max integer not null check (idade_max >= idade_min),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ebd_turmas to authenticated;
grant all on public.ebd_turmas to service_role;
alter table public.ebd_turmas enable row level security;

create table public.ebd_matriculas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.ebd_turmas(id) on delete cascade,
  cadastro_id uuid not null references public.cadastros(id),
  created_at timestamptz not null default now(),
  unique (turma_id, cadastro_id)
);
grant select, insert, update, delete on public.ebd_matriculas to authenticated;
grant all on public.ebd_matriculas to service_role;
alter table public.ebd_matriculas enable row level security;

create table public.ebd_aulas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.ebd_turmas(id) on delete cascade,
  nome text not null,
  data date not null,
  hora_inicio time not null,
  hora_fim time not null check (hora_fim > hora_inicio),
  created_at timestamptz not null default now(),
  constraint ebd_aulas_turma_data_unico unique (turma_id, data)
);
grant select, insert, update, delete on public.ebd_aulas to authenticated;
grant all on public.ebd_aulas to service_role;
alter table public.ebd_aulas enable row level security;

create table public.ebd_frequencia (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.ebd_turmas(id) on delete cascade,
  cadastro_id uuid not null references public.cadastros(id),
  data date not null,
  presente boolean not null,
  created_at timestamptz not null default now(),
  unique (turma_id, cadastro_id, data)
);
grant select, insert, update, delete on public.ebd_frequencia to authenticated;
grant all on public.ebd_frequencia to service_role;
alter table public.ebd_frequencia enable row level security;

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_nome text not null default '—',
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  detalhe text,
  created_at timestamptz not null default now()
);
grant select, insert on public.auditoria to authenticated;
grant all on public.auditoria to service_role;
alter table public.auditoria enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.has_module_access(_user_id uuid, _module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = 'admin'::public.app_role
  ) or exists (
    select 1 from public.module_access
    where user_id = _user_id and module_key = _module
  )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger congregacoes_touch before update on public.congregacoes
  for each row execute function public.touch_updated_at();
create trigger cadastros_touch before update on public.cadastros
  for each row execute function public.touch_updated_at();

-- user_roles
create policy "user_roles_self_read" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "user_roles_admin_read" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- module_access
create policy "module_access_self_read" on public.module_access
  for select to authenticated using (user_id = auth.uid());
create policy "module_access_admin_read" on public.module_access
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- cadastros
create policy "cadastros_self_read" on public.cadastros
  for select to authenticated using (user_id = auth.uid());
create policy "cadastros_admin_read" on public.cadastros
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "cadastros_module_read" on public.cadastros
  for select to authenticated using (public.has_module_access(auth.uid(), 'congregacoes') or public.has_module_access(auth.uid(), 'ebd'));
create policy "cadastros_insert" on public.cadastros
  for insert to authenticated with check (lgpd_aceito = true and (user_id = auth.uid() or public.has_role(auth.uid(), 'admin')));
create policy "cadastros_self_update" on public.cadastros
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and lgpd_aceito = true);
create policy "cadastros_admin_update" on public.cadastros
  for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "cadastros_admin_delete" on public.cadastros
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- composicao_familiar
create policy "composicao_read" on public.composicao_familiar
  for select to authenticated using (
    exists (select 1 from public.cadastros c where c.id = cadastro_id and (c.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  );
create policy "composicao_insert" on public.composicao_familiar
  for insert to authenticated with check (
    exists (select 1 from public.cadastros c where c.id = cadastro_id and (c.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  );
create policy "composicao_update" on public.composicao_familiar
  for update to authenticated using (
    exists (select 1 from public.cadastros c where c.id = cadastro_id and (c.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  );
create policy "composicao_delete" on public.composicao_familiar
  for delete to authenticated using (
    exists (select 1 from public.cadastros c where c.id = cadastro_id and (c.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  );

-- congregacoes
create policy "congregacoes_read" on public.congregacoes
  for select to authenticated using (public.has_module_access(auth.uid(), 'congregacoes'));
create policy "congregacoes_insert" on public.congregacoes
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'congregacoes_gerenciar'));
create policy "congregacoes_update" on public.congregacoes
  for update to authenticated using (public.has_module_access(auth.uid(), 'congregacoes_gerenciar'))
  with check (public.has_module_access(auth.uid(), 'congregacoes_gerenciar'));
create policy "congregacoes_delete" on public.congregacoes
  for delete to authenticated using (public.has_module_access(auth.uid(), 'congregacoes_gerenciar'));

-- ebd_turmas
create policy "ebd_turmas_read" on public.ebd_turmas
  for select to authenticated using (public.has_module_access(auth.uid(), 'ebd'));
create policy "ebd_turmas_insert" on public.ebd_turmas
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'ebd_turmas'));
create policy "ebd_turmas_update" on public.ebd_turmas
  for update to authenticated using (public.has_module_access(auth.uid(), 'ebd_turmas'))
  with check (public.has_module_access(auth.uid(), 'ebd_turmas'));
create policy "ebd_turmas_delete" on public.ebd_turmas
  for delete to authenticated using (public.has_module_access(auth.uid(), 'ebd_turmas'));

-- ebd_matriculas
create policy "ebd_matriculas_read" on public.ebd_matriculas
  for select to authenticated using (public.has_module_access(auth.uid(), 'ebd'));
create policy "ebd_matriculas_insert" on public.ebd_matriculas
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'ebd_chamada'));
create policy "ebd_matriculas_update" on public.ebd_matriculas
  for update to authenticated using (public.has_module_access(auth.uid(), 'ebd_chamada'))
  with check (public.has_module_access(auth.uid(), 'ebd_chamada'));
create policy "ebd_matriculas_delete" on public.ebd_matriculas
  for delete to authenticated using (public.has_module_access(auth.uid(), 'ebd_chamada'));

-- ebd_aulas
create policy "ebd_aulas_read" on public.ebd_aulas
  for select to authenticated using (public.has_module_access(auth.uid(), 'ebd'));
create policy "ebd_aulas_insert" on public.ebd_aulas
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'ebd_chamada'));
create policy "ebd_aulas_update" on public.ebd_aulas
  for update to authenticated using (public.has_module_access(auth.uid(), 'ebd_chamada'))
  with check (public.has_module_access(auth.uid(), 'ebd_chamada'));
create policy "ebd_aulas_delete" on public.ebd_aulas
  for delete to authenticated using (public.has_module_access(auth.uid(), 'ebd_chamada'));

-- ebd_frequencia
create policy "ebd_frequencia_read" on public.ebd_frequencia
  for select to authenticated using (public.has_module_access(auth.uid(), 'ebd'));
create policy "ebd_frequencia_insert" on public.ebd_frequencia
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'ebd_chamada'));
create policy "ebd_frequencia_update" on public.ebd_frequencia
  for update to authenticated using (public.has_module_access(auth.uid(), 'ebd_chamada'))
  with check (public.has_module_access(auth.uid(), 'ebd_chamada'));
create policy "ebd_frequencia_delete" on public.ebd_frequencia
  for delete to authenticated using (public.has_module_access(auth.uid(), 'ebd_chamada'));

-- auditoria
create policy "auditoria_self_read" on public.auditoria
  for select to authenticated using (user_id = auth.uid());
create policy "auditoria_admin_read" on public.auditoria
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "auditoria_insert" on public.auditoria
  for insert to authenticated with check (user_id = auth.uid());
