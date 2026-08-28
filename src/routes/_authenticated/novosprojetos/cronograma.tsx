import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { SelectCampo } from "@/components/crm/campos";
import { AvatarIniciais, PageHeader } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO, iniciais, iso } from "@/lib/ebd";
import { dataParaBR } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import {
  CORES_FASE,
  FASES,
  STATUS_TAREFA,
  carregarTarefas,
  periodo,
  progresso,
  type Tarefa,
} from "@/lib/tarefas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/novosprojetos/cronograma")({
  head: () => ({
    meta: [
      { title: "Cronograma — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Acompanhamento das fases do projeto em linha do tempo." },
      { property: "og:title", content: "Cronograma — AD CRM" },
      {
        property: "og:description",
        content: "Acompanhamento das fases do projeto em linha do tempo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Cronograma,
});

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const LARGURA_DIA = 44;

function paraData(dataISO: string) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return new Date(ano ?? 2026, (mes ?? 1) - 1, dia ?? 1);
}

function diasEntre(de: string, ate: string) {
  const um = 24 * 60 * 60 * 1000;
  return Math.round((paraData(ate).getTime() - paraData(de).getTime()) / um);
}

function Cronograma() {
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "projetos" }, acesso);

  const [projetoId, setProjetoId] = useState("");
  const [mes, setMes] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());

  const consulta = useQuery({
    queryKey: ["projeto-tarefas"],
    enabled: pode,
    queryFn: async () => {
      const [tarefas, projetos] = await Promise.all([
        carregarTarefas(),
        supabase.from("projetos").select("id, titulo").order("titulo"),
      ]);
      if (projetos.error) throw projetos.error;
      return { tarefas, projetos: projetos.data ?? [] };
    },
  });

  const projetos = consulta.data?.projetos ?? [];
  const projetoAtual = projetoId || projetos[0]?.id || "";
  const tarefas = useMemo(
    () => (consulta.data?.tarefas ?? []).filter((t) => t.projeto_id === projetoAtual),
    [consulta.data, projetoAtual],
  );

  /** Colunas: o mês exibido, dia a dia. */
  const colunas = useMemo(() => {
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    return Array.from({ length: ultimo }, (_, i) => {
      const d = new Date(mes.getFullYear(), mes.getMonth(), i + 1);
      return { data: iso(d), dia: i + 1, semana: d.getDay() };
    });
  }, [mes]);

  const primeiroDia = colunas[0]?.data ?? hojeISO();
  const ultimoDia = colunas[colunas.length - 1]?.data ?? hojeISO();
  const hoje = hojeISO();

  /** Posição e largura de uma barra dentro do mês exibido. */
  const barra = (inicio: string, fim: string) => {
    if (fim < primeiroDia || inicio > ultimoDia) return null;
    const de = inicio < primeiroDia ? primeiroDia : inicio;
    const ate = fim > ultimoDia ? ultimoDia : fim;
    return {
      esquerda: diasEntre(primeiroDia, de) * LARGURA_DIA,
      largura: Math.max((diasEntre(de, ate) + 1) * LARGURA_DIA - 4, 12),
      cortadaInicio: inicio < primeiroDia,
      cortadaFim: fim > ultimoDia,
    };
  };

  const porFase = useMemo(() => {
    const nomes = [...new Set([...FASES, ...tarefas.map((t) => t.fase)])];
    return nomes
      .map((fase) => ({ fase, tarefas: tarefas.filter((t) => t.fase === fase) }))
      .filter((f) => f.tarefas.length > 0);
  }, [tarefas]);

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Cronograma" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Cronograma" />
        <SemPermissao mensagem="Sua conta não tem acesso aos projetos do ministério." />
      </>
    );
  }

  const larguraTotal = colunas.length * LARGURA_DIA;

  return (
    <>
      <PageHeader
        titulo="Cronograma"
        descricao="Cada fase do projeto na linha do tempo, com responsável e andamento."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <SelectCampo
                className="h-9"
                opcoes={projetos.map((p) => ({ valor: p.id, rotulo: p.titulo }))}
                valor={projetoAtual}
                onValueChange={setProjetoId}
                placeholder="Escolha o projeto"
              />
            </div>
            <PillButton
              variante="outline"
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={() => {
                const h = new Date();
                setMes(new Date(h.getFullYear(), h.getMonth(), 1));
              }}
            >
              Hoje
            </PillButton>
          </div>
        }
      />

      <div className="overflow-hidden rounded-[20px] border border-jt-line bg-jt-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-jt-line px-3 py-2.5">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
            className="grid h-8 w-8 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-sm font-medium text-jt-text">
            {MESES[mes.getMonth()]} {mes.getFullYear()}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
            className="grid h-8 w-8 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-jt-muted">
            {porFase.map((f, i) => (
              <span key={f.fase} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", CORES_FASE[i % CORES_FASE.length])} />
                {f.fase}
              </span>
            ))}
          </div>
        </div>

        {consulta.isLoading ? (
          <p className="py-12 text-center text-sm text-jt-muted">Carregando…</p>
        ) : projetos.length === 0 ? (
          <p className="py-12 text-center text-sm text-jt-muted">
            Crie um projeto para acompanhar o cronograma.
          </p>
        ) : tarefas.length === 0 ? (
          <p className="py-12 text-center text-sm text-jt-muted">
            Este projeto ainda não tem tarefas.
          </p>
        ) : (
          <div className="flex">
            {/* Coluna fixa: fase, responsável e situação. */}
            <div className="w-[320px] shrink-0 border-r border-jt-line">
              <div className="flex h-[52px] items-end border-b border-jt-line px-3 pb-2">
                <span className="text-xs text-jt-muted">Fase e responsável</span>
              </div>
              {porFase.map((f, i) => {
                const recolhida = recolhidas.has(f.fase);
                return (
                  <Fragment key={f.fase}>
                    <div className="flex h-11 items-center gap-2 border-b border-jt-line px-3">
                      <button
                        type="button"
                        onClick={() =>
                          setRecolhidas((atual) => {
                            const proximo = new Set(atual);
                            if (proximo.has(f.fase)) proximo.delete(f.fase);
                            else proximo.add(f.fase);
                            return proximo;
                          })
                        }
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-jt-muted transition-transform",
                            recolhida && "-rotate-90",
                          )}
                          aria-hidden
                        />
                        <span className="truncate text-sm font-semibold text-jt-text">
                          {f.fase}
                        </span>
                      </button>
                      <span className="num shrink-0 text-xs text-jt-muted">
                        {progresso(f.tarefas)}%
                      </span>
                    </div>

                    {recolhida
                      ? null
                      : f.tarefas.map((t) => (
                          <div
                            key={t.id}
                            className="flex h-11 items-center gap-2 border-b border-jt-line pl-8 pr-3"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm text-jt-text">
                              {t.titulo}
                            </span>
                            {t.responsavel_nome ? (
                              <span
                                title={t.responsavel_nome}
                                className="flex shrink-0 items-center gap-1.5"
                              >
                                <AvatarIniciais texto={iniciais(t.responsavel_nome)} tamanho="sm" />
                              </span>
                            ) : null}
                            <Badge
                              className={cn(
                                "shrink-0 border-transparent text-[10px] font-normal",
                                STATUS_TAREFA[t.status].classe,
                              )}
                            >
                              {STATUS_TAREFA[t.status].rotulo}
                            </Badge>
                          </div>
                        ))}
                  </Fragment>
                );
              })}
            </div>

            {/* Linha do tempo. */}
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div style={{ width: larguraTotal }}>
                <div className="flex h-[52px] border-b border-jt-line">
                  {colunas.map((c) => {
                    const fimDeSemana = c.semana === 0 || c.semana === 6;
                    return (
                      <div
                        key={c.data}
                        style={{ width: LARGURA_DIA }}
                        className={cn(
                          "flex shrink-0 flex-col items-center justify-end border-r border-jt-line pb-1.5",
                          fimDeSemana && "bg-jt-panel-2",
                          c.data === hoje && "bg-jt-blue/5",
                        )}
                      >
                        <span className="text-[10px] uppercase text-jt-muted">
                          {DIAS_CURTOS[c.semana]}
                        </span>
                        <span
                          className={cn(
                            "num text-xs",
                            c.data === hoje ? "font-semibold text-jt-blue" : "text-jt-text",
                          )}
                        >
                          {c.dia}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {porFase.map((f, i) => {
                  const recolhida = recolhidas.has(f.fase);
                  const intervalo = periodo(f.tarefas);
                  const posicaoFase = intervalo ? barra(intervalo.inicio, intervalo.fim) : null;
                  const cor = CORES_FASE[i % CORES_FASE.length];

                  return (
                    <Fragment key={f.fase}>
                      <div className="relative h-11 border-b border-jt-line">
                        <Grade colunas={colunas} hoje={hoje} />
                        {posicaoFase ? (
                          <div
                            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-jt-line"
                            style={{ left: posicaoFase.esquerda, width: posicaoFase.largura }}
                          >
                            <div
                              className="h-full rounded-full bg-jt-muted"
                              style={{ width: `${progresso(f.tarefas)}%` }}
                            />
                          </div>
                        ) : null}
                      </div>

                      {recolhida
                        ? null
                        : f.tarefas.map((t) => {
                            const posicao =
                              t.inicio || t.fim
                                ? barra(t.inicio ?? t.fim!, t.fim ?? t.inicio!)
                                : null;
                            return (
                              <div key={t.id} className="relative h-11 border-b border-jt-line">
                                <Grade colunas={colunas} hoje={hoje} />
                                {posicao ? (
                                  <div
                                    title={`${t.titulo} · ${dataParaBR(t.inicio ?? t.fim!)}${
                                      t.fim && t.fim !== t.inicio ? ` – ${dataParaBR(t.fim)}` : ""
                                    }`}
                                    className={cn(
                                      "absolute top-1/2 flex h-7 -translate-y-1/2 items-center rounded-md px-2",
                                      cor,
                                      t.status === "concluida" && "opacity-60",
                                      t.status === "cancelada" && "opacity-30 line-through",
                                      posicao.cortadaInicio && "rounded-l-none",
                                      posicao.cortadaFim && "rounded-r-none",
                                    )}
                                    style={{ left: posicao.esquerda, width: posicao.largura }}
                                  >
                                    <span className="truncate text-[11px] font-medium text-jt-blue">
                                      {t.titulo}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-jt-muted">
                                    sem data definida
                                  </span>
                                )}
                              </div>
                            );
                          })}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-jt-muted">
        <CalendarRange className="h-4 w-4" aria-hidden />
        As datas saem de cada tarefa em Novos projetos › Tarefas. A barra cinza de cada fase mostra
        o andamento pelas tarefas concluídas.
      </p>
    </>
  );
}

/** Colunas de fundo, com fim de semana sombreado e a marca de hoje. */
function Grade({ colunas, hoje }: { colunas: { data: string; semana: number }[]; hoje: string }) {
  return (
    <div className="absolute inset-0 flex" aria-hidden>
      {colunas.map((c) => {
        const fimDeSemana = c.semana === 0 || c.semana === 6;
        return (
          <div
            key={c.data}
            style={{ width: LARGURA_DIA }}
            className={cn(
              "shrink-0 border-r border-jt-line/60",
              fimDeSemana && "bg-jt-panel-2/60",
              c.data === hoje && "bg-jt-blue/5",
            )}
          />
        );
      })}
    </div>
  );
}
