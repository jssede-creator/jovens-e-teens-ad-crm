-- Papéis e permissões.
-- Antes o acesso era só uma lista solta de módulos por pessoa (module_access).
-- Agora existe um nível acima: papéis nomeados, cada um com um conjunto de
-- permissões, atribuídos às contas. As duas formas convivem — module_access
-- continua servindo para exceções pontuais.

-- 1. Papéis ------------------------------------------------------------------

create table if not exists public.papeis (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  -- Papel de sistema não pode ser apagado pela tela.
  sistema boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.papeis to authenticated;
grant all on public.papeis to service_role;
alter table public.papeis enable row level security;

create table if not exists public.papel_permissoes (
  papel_id uuid not null references public.papeis(id) on delete cascade,
  module_key text not null,
  primary key (papel_id, module_key)
);
grant select, insert, update, delete on public.papel_permissoes to authenticated;
grant all on public.papel_permissoes to service_role;
alter table public.papel_permissoes enable row level security;

create table if not exists public.usuario_papeis (
  user_id uuid not null,
  papel_id uuid not null references public.papeis(id) on delete cascade,
  atribuido_por uuid,
  atribuido_em timestamptz not null default now(),
  primary key (user_id, papel_id)
);
grant select, insert, update, delete on public.usuario_papeis to authenticated;
grant all on public.usuario_papeis to service_role;
alter table public.usuario_papeis enable row level security;

drop trigger if exists papeis_touch on public.papeis;
create trigger papeis_touch before update on public.papeis
  for each row execute function public.touch_updated_at();

-- 2. Acesso efetivo ----------------------------------------------------------

-- Passa a somar três fontes: admin, permissão solta e permissão vinda de papel.
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
  ) or exists (
    select 1
    from public.usuario_papeis up
    join public.papel_permissoes pp on pp.papel_id = up.papel_id
    where up.user_id = _user_id and pp.module_key = _module
  )
$$;

-- 3. Políticas ---------------------------------------------------------------

-- Nome e descrição de papel não são sigilosos: qualquer conta lê, só admin muda.
drop policy if exists "papeis_read" on public.papeis;
create policy "papeis_read" on public.papeis for select to authenticated using (true);
drop policy if exists "papeis_admin_write" on public.papeis;
create policy "papeis_admin_write" on public.papeis
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "papeis_admin_update" on public.papeis;
create policy "papeis_admin_update" on public.papeis
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "papeis_admin_delete" on public.papeis;
create policy "papeis_admin_delete" on public.papeis
  for delete to authenticated using (public.has_role(auth.uid(), 'admin') and sistema = false);

drop policy if exists "papel_permissoes_read" on public.papel_permissoes;
create policy "papel_permissoes_read" on public.papel_permissoes
  for select to authenticated using (true);
drop policy if exists "papel_permissoes_admin_write" on public.papel_permissoes;
create policy "papel_permissoes_admin_write" on public.papel_permissoes
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "papel_permissoes_admin_delete" on public.papel_permissoes;
create policy "papel_permissoes_admin_delete" on public.papel_permissoes
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "usuario_papeis_self_read" on public.usuario_papeis;
create policy "usuario_papeis_self_read" on public.usuario_papeis
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "usuario_papeis_admin_read" on public.usuario_papeis;
create policy "usuario_papeis_admin_read" on public.usuario_papeis
  for select to authenticated using (public.has_module_access(auth.uid(), 'configuracoes'));
drop policy if exists "usuario_papeis_admin_write" on public.usuario_papeis;
create policy "usuario_papeis_admin_write" on public.usuario_papeis
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "usuario_papeis_admin_delete" on public.usuario_papeis;
create policy "usuario_papeis_admin_delete" on public.usuario_papeis
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 4. Papéis que já nascem com o sistema --------------------------------------

insert into public.papeis (nome, descricao, sistema) values
  ('Administrador', 'Enxerga e gerencia todo o CRM, incluindo papéis e permissões.', true),
  ('Liderança', 'Acompanha membros, congregações, EBD, eventos e projetos do ministério.', true),
  ('Professor da EBD', 'Cuida das classes: matrícula, aulas e chamada.', true),
  ('Secretaria', 'Mantém o cadastro de membros e congregações em dia.', true),
  ('Membro', 'Vê o calendário, agenda papo reto e reserva vaga nos eventos.', true)
on conflict (nome) do nothing;

-- Permissões de cada papel de sistema.
with alvo as (
  select id, nome from public.papeis where sistema = true
)
insert into public.papel_permissoes (papel_id, module_key)
select a.id, p.module_key
from alvo a
join (values
  ('Liderança','membros'), ('Liderança','membros_gerenciar'),
  ('Liderança','congregacoes'), ('Liderança','congregacoes_gerenciar'),
  ('Liderança','ebd'), ('Liderança','ebd_turmas'), ('Liderança','ebd_chamada'),
  ('Liderança','calendario'),
  ('Liderança','papo_reto'), ('Liderança','papo_reto_gerenciar'),
  ('Liderança','projetos'), ('Liderança','projetos_gerenciar'),
  ('Liderança','eventos'), ('Liderança','eventos_gerenciar'),
  ('Liderança','arquivos'), ('Liderança','arquivos_gerenciar'),
  ('Liderança','suporte'),

  ('Professor da EBD','ebd'), ('Professor da EBD','ebd_chamada'),
  ('Professor da EBD','calendario'), ('Professor da EBD','membros'),

  ('Secretaria','membros'), ('Secretaria','membros_gerenciar'),
  ('Secretaria','congregacoes'), ('Secretaria','congregacoes_gerenciar'),
  ('Secretaria','arquivos'), ('Secretaria','calendario'),

  ('Membro','calendario'), ('Membro','papo_reto'), ('Membro','eventos')
) as p(papel, module_key) on p.papel = a.nome
on conflict do nothing;

-- O papel Administrador recebe tudo o que existe hoje.
insert into public.papel_permissoes (papel_id, module_key)
select p.id, m.module_key
from public.papeis p
cross join (values
  ('membros'), ('membros_gerenciar'),
  ('congregacoes'), ('congregacoes_gerenciar'),
  ('ebd'), ('ebd_chamada'), ('ebd_turmas'),
  ('calendario'),
  ('papo_reto'), ('papo_reto_gerenciar'),
  ('projetos'), ('projetos_gerenciar'),
  ('arquivos'), ('arquivos_gerenciar'),
  ('eventos'), ('eventos_gerenciar'),
  ('suporte'), ('configuracoes')
) as m(module_key)
where p.nome = 'Administrador'
on conflict do nothing;
