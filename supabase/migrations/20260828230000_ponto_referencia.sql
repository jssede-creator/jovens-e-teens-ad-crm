-- Ponto de referência do endereço. Ajuda a liderança a encontrar a casa em
-- visitas e entregas; complemento já existia, este campo fica ao lado dele.

alter table public.cadastros add column if not exists ponto_referencia text;
