-- Pagamento dos eventos pagos: código único por inscrição (entregue ao membro
-- depois da confirmação) e registro de quem confirmou o recebimento.

alter table public.evento_inscricoes
  add column if not exists pagamento text not null default 'pendente',
  add column if not exists codigo text,
  add column if not exists confirmado_em timestamptz,
  add column if not exists confirmado_por uuid,
  add column if not exists confirmado_por_nome text;

create unique index if not exists evento_inscricoes_codigo_key
  on public.evento_inscricoes (codigo) where codigo is not null;

alter table public.evento_inscricoes drop constraint if exists evento_inscricoes_pagamento_check;
alter table public.evento_inscricoes add constraint evento_inscricoes_pagamento_check
  check (pagamento in ('nao_aplicavel','pendente','pago'));

-- Inscrições de eventos gratuitos já nascem com o pagamento "não aplicável".
update public.evento_inscricoes i
set pagamento = 'nao_aplicavel'
from public.eventos e
where i.evento_id = e.id and e.taxa is null and i.pagamento = 'pendente';

-- Contagem de vagas: só quem está logado consulta; anônimo não executa.
revoke execute on function public.eventos_inscritos() from anon, public;