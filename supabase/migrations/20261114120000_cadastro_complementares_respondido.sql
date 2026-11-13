-- Registra que a pessoa respondeu à pergunta dos dados complementares.
--
-- Antes, só "compartilhou_dados_complementares = true" contava como cadastro
-- completo; quem respondia "Não, prefiro não compartilhar" ficava para sempre
-- com o cadastro "básico" e o sistema seguia pedindo para completar. A coluna
-- separa "recusou" de "ninguém perguntou ainda" (por exemplo, membro cadastrado
-- pela liderança em Membros › Novo membro).

alter table public.cadastros
  add column if not exists complementares_respondido boolean not null default false;

-- Quem compartilhou os dados, evidentemente, respondeu.
update public.cadastros
set complementares_respondido = true
where compartilhou_dados_complementares = true;
