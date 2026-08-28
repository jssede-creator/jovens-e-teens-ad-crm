-- Local (sala) das janelas de papo reto e do agendamento que as ocupa.
-- A tela de cadastro de horário abre dia + sala; a aprovação e "Meus agendamentos"
-- mostram a sala junto de data e hora.

alter table public.papo_reto_horarios add column if not exists local text;
alter table public.papo_reto_agendamentos add column if not exists local text;
