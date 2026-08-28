-- Tarefas de projeto: cada projeto nasce com as fases padrão do ministério e
-- cada tarefa tem um responsável, prazo e situação. O cronograma (gantt) lê
-- daqui, agrupando por fase.

create table if not exists public.projeto_tarefas (
  id uuid primary key default gen_random_uuid(),
  numero bigserial,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  fase text not null,
  titulo text not null,
  descricao text,
  -- Mesma escala do quadro: da ideia até a entrega.
  status text not null default 'backlog'
    check (status in ('backlog','a_fazer','em_andamento','concluida','cancelada')),
  prioridade text not null default 'media'
    check (prioridade in ('baixa','media','alta')),
  responsavel_id uuid,
  responsavel_nome text,
  inicio date,
  fim date check (fim is null or inicio is null or fim >= inicio),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projeto_tarefas to authenticated;
grant all on public.projeto_tarefas to service_role;
alter table public.projeto_tarefas enable row level security;

create index if not exists projeto_tarefas_projeto_idx on public.projeto_tarefas (projeto_id);

drop trigger if exists projeto_tarefas_touch on public.projeto_tarefas;
create trigger projeto_tarefas_touch before update on public.projeto_tarefas
  for each row execute function public.touch_updated_at();

-- Quem enxerga projeto enxerga a tarefa; quem gerencia projeto mexe nela.
drop policy if exists "projeto_tarefas_read" on public.projeto_tarefas;
create policy "projeto_tarefas_read" on public.projeto_tarefas
  for select to authenticated using (public.has_module_access(auth.uid(), 'projetos'));
drop policy if exists "projeto_tarefas_insert" on public.projeto_tarefas;
create policy "projeto_tarefas_insert" on public.projeto_tarefas
  for insert to authenticated with check (public.has_module_access(auth.uid(), 'projetos_gerenciar'));
drop policy if exists "projeto_tarefas_update" on public.projeto_tarefas;
create policy "projeto_tarefas_update" on public.projeto_tarefas
  for update to authenticated using (
    -- O responsável toca a própria tarefa mesmo sem ser gestor do módulo.
    public.has_module_access(auth.uid(), 'projetos_gerenciar') or responsavel_id = auth.uid()
  )
  with check (
    public.has_module_access(auth.uid(), 'projetos_gerenciar') or responsavel_id = auth.uid()
  );
drop policy if exists "projeto_tarefas_delete" on public.projeto_tarefas;
create policy "projeto_tarefas_delete" on public.projeto_tarefas
  for delete to authenticated using (public.has_module_access(auth.uid(), 'projetos_gerenciar'));
