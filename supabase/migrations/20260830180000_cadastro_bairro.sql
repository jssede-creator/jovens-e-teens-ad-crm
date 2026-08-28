-- Bairro no cadastro da pessoa. Antes ele vinha grudado no campo de endereço
-- ("Rua e bairro"), o que atrapalhava busca e conferência. Fica opcional para
-- não invalidar os cadastros que já existem.

alter table public.cadastros add column if not exists bairro text;
