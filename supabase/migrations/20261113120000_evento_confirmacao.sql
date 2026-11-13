-- Fluxo de confirmação das inscrições em eventos.
--
-- Evento gratuito: a pessoa fica inscrita na hora ("isento").
-- Evento com taxa: a inscrição nasce "pendente" e vira uma solicitação para a
-- liderança aprovar depois do PIX ("confirmado").
--
-- Quem decide o estado do pagamento é o banco, não a tela: o app gravava a
-- inscrição sem informar o pagamento e o padrão da coluna ('pendente') deixava
-- até evento gratuito aguardando aprovação.

-- 1. Regra de valores do pagamento ------------------------------------------
-- Remove qualquer variação anterior da regra antes de recriá-la.
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.evento_inscricoes'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%pagamento%'
  loop
    execute format('alter table public.evento_inscricoes drop constraint %I', r.conname);
  end loop;
end $$;

-- O banco pode estar com a variação 'nao_aplicavel' / 'pago'; traduz para os
-- valores que o app usa sem perder pagamentos já aprovados.
update public.evento_inscricoes set pagamento = 'isento' where pagamento = 'nao_aplicavel';
update public.evento_inscricoes set pagamento = 'confirmado' where pagamento = 'pago';
update public.evento_inscricoes
set pagamento = 'pendente'
where pagamento is null or pagamento not in ('isento', 'pendente', 'confirmado');

alter table public.evento_inscricoes add constraint evento_inscricoes_pagamento_check
  check (pagamento in ('isento', 'pendente', 'confirmado'));

-- 2. Código do comprovante ----------------------------------------------------
-- Recriado aqui porque nem todo banco recebeu a versão anterior desta função.
create or replace function public.evento_codigo_comprovante()
returns text
language sql
volatile
as $$
  select lpad((floor(random() * 10000000000000))::bigint::text, 13, '0')
$$;
grant execute on function public.evento_codigo_comprovante() to authenticated;

alter table public.evento_inscricoes
  alter column codigo set default public.evento_codigo_comprovante();

update public.evento_inscricoes
set codigo = public.evento_codigo_comprovante()
where codigo is null;

-- Evento gratuito? -------------------------------------------------------------
create or replace function public.evento_gratuito(_evento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.taxa is null or e.taxa = 0 from public.eventos e where e.id = _evento_id),
    true
  )
$$;
grant execute on function public.evento_gratuito(uuid) to authenticated;

-- 3. Na inscrição, o banco define o estado do pagamento -------------------------
create or replace function public.evento_inscricao_ao_inserir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.pagamento := case when public.evento_gratuito(new.evento_id) then 'isento' else 'pendente' end;
  new.codigo := public.evento_codigo_comprovante();
  new.confirmado_em := null;
  new.confirmado_por := null;
  new.confirmado_por_nome := null;
  return new;
end
$$;

drop trigger if exists evento_inscricoes_ao_inserir on public.evento_inscricoes;
create trigger evento_inscricoes_ao_inserir
  before insert on public.evento_inscricoes
  for each row execute function public.evento_inscricao_ao_inserir();

-- 4. Só a liderança aprova pagamento ------------------------------------------
-- A política inscricoes_self_update deixa o inscrito editar a própria linha;
-- sem esta trava ele conseguiria se marcar como pago direto pela API.
create or replace function public.evento_inscricao_ao_atualizar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem usuário (migrações, service role) ou liderança: pode tudo.
  if auth.uid() is null or public.has_module_access(auth.uid(), 'eventos_gerenciar') then
    return new;
  end if;

  if new.pagamento is distinct from old.pagamento
    or new.codigo is distinct from old.codigo
    or new.confirmado_em is distinct from old.confirmado_em
    or new.confirmado_por is distinct from old.confirmado_por
    or new.confirmado_por_nome is distinct from old.confirmado_por_nome
    or new.evento_id is distinct from old.evento_id
    or new.user_id is distinct from old.user_id
  then
    raise exception 'Somente a liderança aprova inscrições.' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists evento_inscricoes_ao_atualizar on public.evento_inscricoes;
create trigger evento_inscricoes_ao_atualizar
  before update on public.evento_inscricoes
  for each row execute function public.evento_inscricao_ao_atualizar();

-- 5. Taxa mudou depois de abertas as inscrições -------------------------------
-- Ficou gratuito: quem aguardava aprovação passa a inscrito.
-- Passou a cobrar: quem estava isento passa a aguardar o PIX.
-- Pagamentos já aprovados não mudam.
create or replace function public.evento_taxa_alterada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.taxa is null or new.taxa = 0 then
    update public.evento_inscricoes
    set pagamento = 'isento'
    where evento_id = new.id and pagamento = 'pendente';
  else
    update public.evento_inscricoes
    set pagamento = 'pendente'
    where evento_id = new.id and pagamento = 'isento';
  end if;
  return new;
end
$$;

drop trigger if exists eventos_taxa_alterada on public.eventos;
create trigger eventos_taxa_alterada
  after update of taxa on public.eventos
  for each row
  when (old.taxa is distinct from new.taxa)
  execute function public.evento_taxa_alterada();

-- 6. Corrige as inscrições que ficaram presas em evento gratuito --------------
update public.evento_inscricoes i
set pagamento = 'isento'
where i.pagamento = 'pendente' and public.evento_gratuito(i.evento_id);
