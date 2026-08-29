-- Módulo de Eventos: a liderança publica o evento e os membros reservam vaga.
-- Segue o padrão das outras áreas: grants explícitos, RLS ligada e políticas
-- baseadas em has_module_access.

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
    'eventos','eventos_gerenciar',
    'suporte',
    'configuracoes'
  ));

-- 2. Eventos ----------------------------------------------------------------

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  categoria text not null default 'Encontro',
  data date not null,
  hora_inicio time not null,
  hora_fim time not null check (hora_fim > hora_inicio),
  congregacao_id uuid references public.congregacoes(id),
  local text not null,
  -- Nulo significa evento gratuito; a tela mostra "Não é atribuído".
  taxa numeric(10,2) check (taxa is null or taxa >= 0),
  vagas integer check (vagas is null or vagas > 0),
  status text not null default 'aberto'
    check (status in ('aberto','encerrado','cancelado')),
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.eventos to authenticated;
grant all on public.eventos to service_role;
alter table public.eventos enable row level security;

create table if not exists public.evento_inscricoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  user_id uuid not null,
  nome text not null,
  email text not null,
  observacao text,
  status text not null default 'confirmada'
    check (status in ('confirmada','cancelada')),
  created_at timestamptz not null default now(),
  unique (evento_id, user_id)
);
grant select, insert, update, delete on public.evento_inscricoes to authenticated;
grant all on public.evento_inscricoes to service_role;
alter table public.evento_inscricoes enable row level security;

drop trigger if exists eventos_touch on public.eventos;
create trigger eventos_touch before update on public.eventos
  for each row execute function public.touch_updated_at();

-- 3. Políticas --------------------------------------------------------------

drop policy if exists "eventos_read" on public.eventos;
create policy "eventos_read" on public.eventos
  for select to authenticated using (public.has_module_access(auth.uid(), 'eventos'));
drop policy if exists "eventos_insert" on public.eventos;
create policy "eventos_insert" on public.eventos
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'eventos_gerenciar'));
drop policy if exists "eventos_update" on public.eventos;
create policy "eventos_update" on public.eventos
  for update to authenticated using (public.has_module_access(auth.uid(), 'eventos_gerenciar'))
  with check (public.has_module_access(auth.uid(), 'eventos_gerenciar'));
drop policy if exists "eventos_delete" on public.eventos;
create policy "eventos_delete" on public.eventos
  for delete to authenticated using (public.has_module_access(auth.uid(), 'eventos_gerenciar'));

-- Inscrições: cada um enxerga e mexe na sua; a liderança enxerga todas.
drop policy if exists "inscricoes_self_read" on public.evento_inscricoes;
create policy "inscricoes_self_read" on public.evento_inscricoes
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "inscricoes_lideranca_read" on public.evento_inscricoes;
create policy "inscricoes_lideranca_read" on public.evento_inscricoes
  for select to authenticated using (public.has_module_access(auth.uid(), 'eventos_gerenciar'));
drop policy if exists "inscricoes_insert" on public.evento_inscricoes;
create policy "inscricoes_insert" on public.evento_inscricoes
  for insert to authenticated with check (
    user_id = auth.uid() and public.has_module_access(auth.uid(), 'eventos')
  );
drop policy if exists "inscricoes_self_update" on public.evento_inscricoes;
create policy "inscricoes_self_update" on public.evento_inscricoes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "inscricoes_lideranca_update" on public.evento_inscricoes;
create policy "inscricoes_lideranca_update" on public.evento_inscricoes
  for update to authenticated using (public.has_module_access(auth.uid(), 'eventos_gerenciar'))
  with check (public.has_module_access(auth.uid(), 'eventos_gerenciar'));
drop policy if exists "inscricoes_delete" on public.evento_inscricoes;
create policy "inscricoes_delete" on public.evento_inscricoes
  for delete to authenticated using (
    user_id = auth.uid() or public.has_module_access(auth.uid(), 'eventos_gerenciar')
  );

-- 4. Contagem pública de inscritos ------------------------------------------

-- Um membro comum não lê a inscrição dos outros, mas precisa saber quantas
-- vagas sobraram. A função roda com privilégio elevado e devolve só o número.
create or replace function public.eventos_inscritos()
returns table (evento_id uuid, inscritos bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.evento_id, count(*)
  from public.evento_inscricoes i
  where i.status = 'confirmada'
  group by i.evento_id
$$;
grant execute on function public.eventos_inscritos() to authenticated;