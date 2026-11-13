import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { FullScreenCalendar, type CalendarDay } from "@/components/ui/fullscreen-calendar";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO } from "@/lib/ebd";
import { hora } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — AD CRM | Jovens e Teens AD" },
      {
        name: "description",
        content: "Aulas, papos retos, eventos e horários abertos em um mês só.",
      },
      { property: "og:title", content: "Calendário — AD CRM" },
      {
        property: "og:description",
        content: "Aulas, papos retos, eventos e horários abertos em um mês só.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Calendario,
});

type Tipo = "aula" | "papo" | "horario" | "evento";

type Compromisso = {
  id: string;
  tipo: Tipo;
  titulo: string;
  detalhe: string;
  data: string;
  inicio: string;
  fim: string;
};

const TIPOS: Record<Tipo, { rotulo: string; cor: string }> = {
  evento: { rotulo: "Evento", cor: "bg-amber-500" },
  aula: { rotulo: "Aula da EBD", cor: "bg-jt-blue" },
  papo: { rotulo: "Papo reto", cor: "bg-jt-gold" },
  horario: { rotulo: "Horário aberto", cor: "bg-jt-success" },
};

function Calendario() {
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "calendario" }, acesso);
  const veEbd = podeVer({ tipo: "modulo", modulo: "ebd" }, acesso);
  const vePapo = podeVer({ tipo: "modulo", modulo: "papo_reto" }, acesso);
  const veEventos = podeVer({ tipo: "modulo", modulo: "eventos" }, acesso);

  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [selecionado, setSelecionado] = useState(hojeISO());

  const consulta = useQuery({
    queryKey: ["calendario", veEbd, vePapo, veEventos],
    enabled: pode,
    queryFn: async (): Promise<Compromisso[]> => {
      const lista: Compromisso[] = [];

      if (veEventos) {
        const { data, error } = await supabase
          .from("eventos")
          .select("id, titulo, categoria, local, data, hora_inicio, hora_fim, status")
          .neq("status", "cancelado");
        if (error) throw error;
        for (const e of data ?? []) {
          lista.push({
            id: `evento-${e.id}`,
            tipo: "evento",
            titulo: e.titulo,
            detalhe: `${e.categoria} · ${e.local}`,
            data: e.data,
            inicio: e.hora_inicio,
            fim: e.hora_fim,
          });
        }
      }

      if (veEbd) {
        const [aulas, turmas] = await Promise.all([
          supabase.from("ebd_aulas").select("id, turma_id, nome, data, hora_inicio, hora_fim"),
          supabase.from("ebd_turmas").select("id, nome"),
        ]);
        if (aulas.error) throw aulas.error;
        if (turmas.error) throw turmas.error;
        const nomeTurma = new Map((turmas.data ?? []).map((t) => [t.id, t.nome]));
        for (const a of aulas.data ?? []) {
          lista.push({
            id: `aula-${a.id}`,
            tipo: "aula",
            titulo: a.nome,
            detalhe: nomeTurma.get(a.turma_id) ?? "EBD",
            data: a.data,
            inicio: a.hora_inicio,
            fim: a.hora_fim,
          });
        }
      }

      if (vePapo) {
        const [agendamentos, horarios] = await Promise.all([
          supabase
            .from("papo_reto_agendamentos")
            .select("id, assunto, solicitante_nome, data, hora_inicio, hora_fim, status")
            .neq("status", "recusado"),
          supabase.from("papo_reto_horarios").select("id, data, hora_inicio, hora_fim"),
        ]);
        if (agendamentos.error) throw agendamentos.error;
        if (horarios.error) throw horarios.error;

        for (const p of agendamentos.data ?? []) {
          lista.push({
            id: `papo-${p.id}`,
            tipo: "papo",
            titulo: p.assunto,
            detalhe: p.solicitante_nome,
            data: p.data,
            inicio: p.hora_inicio,
            fim: p.hora_fim,
          });
        }
        const ocupados = new Set((agendamentos.data ?? []).map((p) => `${p.data}${p.hora_inicio}`));
        for (const h of horarios.data ?? []) {
          if (ocupados.has(`${h.data}${h.hora_inicio}`)) continue;
          lista.push({
            id: `horario-${h.id}`,
            tipo: "horario",
            titulo: "Horário aberto",
            detalhe: "Papo reto disponível",
            data: h.data,
            inicio: h.hora_inicio,
            fim: h.hora_fim,
          });
        }
      }

      return lista.sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
    },
  });

  const compromissos = useMemo(() => consulta.data ?? [], [consulta.data]);

  // Agrupa por dia no formato do calendário. parseISO lê "2026-11-13" no fuso
  // local; new Date("2026-11-13") cairia no dia anterior no Brasil.
  const dias = useMemo<CalendarDay[]>(() => {
    const porDia = new Map<string, Compromisso[]>();
    for (const c of compromissos) porDia.set(c.data, [...(porDia.get(c.data) ?? []), c]);
    return [...porDia.entries()].map(([data, lista]) => ({
      day: parseISO(data),
      events: lista.map((c) => ({
        id: c.id,
        name: c.titulo,
        time: hora(c.inicio),
        color: TIPOS[c.tipo].cor,
      })),
    }));
  }, [compromissos]);

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Calendário" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Calendário" />
        <SemPermissao mensagem="Sua conta não tem acesso ao calendário do ministério." />
      </>
    );
  }

  const doDia = compromissos.filter((c) => c.data === selecionado);
  const tiposVisiveis = (Object.keys(TIPOS) as Tipo[]).filter((t) =>
    t === "evento" ? veEventos : t === "aula" ? veEbd : vePapo,
  );
  const diaSelecionado = parseISO(selecionado);

  return (
    <>
      <PageHeader
        titulo="Calendário"
        descricao="Eventos, aulas da EBD, papos retos marcados e horários ainda abertos."
      />

      <FullScreenCalendar
        data={dias}
        month={mes}
        onMonthChange={setMes}
        selectedDay={diaSelecionado}
        onSelectDay={(d) => {
          setSelecionado(format(d, "yyyy-MM-dd"));
          setMes(startOfMonth(d));
        }}
      />

      {tiposVisiveis.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-jt-muted">
          {tiposVisiveis.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", TIPOS[t].cor)} aria-hidden />
              {TIPOS[t].rotulo}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-6">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="font-display text-base font-semibold first-letter:uppercase text-jt-text">
            {format(diaSelecionado, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h2>
          <span className="text-xs text-jt-muted">
            {consulta.isLoading
              ? "Carregando…"
              : doDia.length === 0
                ? "Nada marcado"
                : `${doDia.length} compromisso(s)`}
          </span>
        </div>

        {doDia.length > 0 ? (
          <ul className="mt-2 divide-y divide-jt-line border-y border-jt-line">
            {doDia.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-1 py-2.5">
                <span className="num w-[92px] shrink-0 text-xs text-jt-muted">
                  {hora(c.inicio)}–{hora(c.fim)}
                </span>
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", TIPOS[c.tipo].cor)}
                  aria-hidden
                />
                <p className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium text-jt-text">{c.titulo}</span>
                  <span className="text-jt-muted"> · {c.detalhe}</span>
                </p>
                <span className="hidden shrink-0 text-xs text-jt-muted sm:inline">
                  {TIPOS[c.tipo].rotulo}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
