-- Confirmação de pagamento e presença nas inscrições.
-- Evento com taxa nasce "pendente" (a pessoa paga por PIX fora do sistema) e a
-- liderança confirma aqui, emitindo um comprovante. Evento gratuito nasce
-- "isento" e continua contando presença.

alter table public.evento_inscricoes
  add column if not exists pagamento text not null default 'pendente',
  add column if not exists codigo text,
  add column if not exists confirmado_em timestamptz,
  add column if not exists confirmado_por uuid,
  add column if not exists confirmado_por_nome text;

alter table public.evento_inscricoes drop constraint if exists evento_inscricoes_pagamento_check;
alter table public.evento_inscricoes add constraint evento_inscricoes_pagamento_check
  check (pagamento in ('isento', 'pendente', 'confirmado'));

-- Inscrição em evento sem taxa não fica devendo nada.
update public.evento_inscricoes i
set pagamento = 'isento'
where i.pagamento = 'pendente'
  and exists (
    select 1 from public.eventos e
    where e.id = i.evento_id and (e.taxa is null or e.taxa = 0)
  );

-- Código curto do comprovante, no formato que a tela mostra.
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
