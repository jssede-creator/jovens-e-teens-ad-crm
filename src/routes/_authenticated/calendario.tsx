import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, GraduationCap, MessageCircle } from "lucide-react";
import { useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { CalendarioMes } from "@/components/crm/calendario-mes";
import { Bloco, PageHeader, VazioBloco } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO } from "@/lib/ebd";
import { dataParaBR, hora } from "@/lib/formato";
import { podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Aulas, papos retos e horários abertos em um mês só." },
      { property: "og:title", content: "Calendário — AD CRM" },
      {
        property: "og:description",
        content: "Aulas, papos retos e horários abertos em um mês só.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Calendario,
});

type Evento = {
  id: string;
  tipo: "aula" | "papo" | "horario";
  titulo: string;
  detalhe: string;
  data: string;
  inicio: string;
  fim: string;
};

function Calendario() {
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "calendario" }, acesso);
  const veEbd = podeVer({ tipo: "modulo", modulo: "ebd" }, acesso);
  const vePapo = podeVer({ tipo: "modulo", modulo: "papo_reto" }, acesso);

  const [mes, setMes] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const [selecionado, setSelecionado] = useState(hojeISO());

  const consulta = useQuery({
    queryKey: ["calendario", veEbd, vePapo],
    enabled: pode,
    queryFn: async (): Promise<Evento[]> => {
      const eventos: Evento[] = [];

      if (veEbd) {
        const [aulas, turmas] = await Promise.all([
          supabase.from("ebd_aulas").select("id, turma_id, nome, data, hora_inicio, hora_fim"),
          supabase.from("ebd_turmas").select("id, nome"),
        ]);
        if (aulas.error) throw aulas.error;
        if (turmas.error) throw turmas.error;
        const nomeTurma = new Map((turmas.data ?? []).map((t) => [t.id, t.nome]));
        for (const a of aulas.data ?? []) {
          eventos.push({
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
          eventos.push({
            id: `papo-${p.id}`,
            tipo: "papo",
            titulo: p.assunto,
            detalhe: `Papo reto · ${p.solicitante_nome}`,
            data: p.data,
            inicio: p.hora_inicio,
            fim: p.hora_fim,
          });
        }
        const ocupados = new Set((agendamentos.data ?? []).map((p) => `${p.data}${p.hora_inicio}`));
        for (const h of horarios.data ?? []) {
          if (ocupados.has(`${h.data}${h.hora_inicio}`)) continue;
          eventos.push({
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

      return eventos;
    },
  });

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

  const eventos = consulta.data ?? [];
  const doDia = eventos
    .filter((e) => e.data === selecionado)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const marcas = eventos.map((e) => ({
    data: e.data,
    cor: e.tipo === "aula" ? "bg-jt-blue" : e.tipo === "papo" ? "bg-jt-gold" : "bg-jt-success",
  }));

  const icone = (tipo: Evento["tipo"]) =>
    tipo === "aula" ? (
      <GraduationCap className="h-4 w-4 text-jt-blue" aria-hidden />
    ) : (
      <MessageCircle className="h-4 w-4 text-jt-gold" aria-hidden />
    );

  return (
    <>
      <PageHeader
        titulo="Calendário"
        descricao="Aulas da EBD, papos retos marcados e horários ainda abertos."
        acoes={
          <PillButton
            variante="outline"
            className="h-9 rounded-full px-4 text-[13px]"
            onClick={() => {
              const h = new Date();
              setMes(new Date(h.getFullYear(), h.getMonth(), 1));
              setSelecionado(hojeISO());
            }}
          >
            <CalendarDays className="h-4 w-4" aria-hidden /> Hoje
          </PillButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CalendarioMes
          mes={mes}
          onMes={setMes}
          selecionado={selecionado}
          onSelecionar={setSelecionado}
          marcas={marcas}
          legenda="Tem compromisso marcado"
        />

        <Bloco titulo={dataParaBR(selecionado)} descricao={`${doDia.length} compromisso(s)`}>
          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : doDia.length === 0 ? (
            <VazioBloco>Nada marcado nesse dia.</VazioBloco>
          ) : (
            <ul className="space-y-2">
              {doDia.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-jt-line px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {icone(e.tipo)}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-jt-text">{e.titulo}</p>
                      <p className="truncate text-xs text-jt-muted">{e.detalhe}</p>
                    </div>
                  </div>
                  <p className="num text-xs text-jt-muted">
                    {hora(e.inicio)}–{hora(e.fim)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </>
  );
}
