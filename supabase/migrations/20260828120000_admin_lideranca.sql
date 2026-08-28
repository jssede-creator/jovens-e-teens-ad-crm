-- Garante o papel de administrador para a conta da liderança do ministério.
-- Sem essa linha em user_roles, has_module_access devolve falso e a barra lateral
-- fica só com os itens abertos a todos (Menu inicial, Complementar cadastro, Meu usuário).
-- Idempotente: pode rodar quantas vezes precisar.

insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = 'jovensteens.sede@gmail.com'
on conflict (user_id, role) do nothing;
