insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = 'jovensteens.sede@gmail.com'
on conflict (user_id, role) do nothing;