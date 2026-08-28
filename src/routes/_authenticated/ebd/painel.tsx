import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarPlus, Church, GraduationCap, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { Bloco, PageHeader, StatCardTopo, VazioBloco } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { diasAtras, hojeISO, semanaDe, trimestres } from "@/lib/ebd";
import { dataParaBR, hora } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ebd/painel")({
  head: () => ({
    meta: [
      { title: "Painel da EBD — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Resumo das turmas e da frequência." },
      { property: "og:title", content: "Painel da EBD — AD CRM" },
      { property: "og:description", content: "Resumo das turmas e da frequência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EbdPainel,
});

function saudacao(hora = new Date().getHours()) {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function EbdPainel() {
  const navigate = useNavigate();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "ebd" }, acesso);
  const [aba, setAba] = useState<"hoje" | "proximas">("hoje");
  const [nome, setNome] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setNome((data.session?.user?.user_metadata?.["nome"] as string | undefined) ?? "");
    });
  }, []);

  const consulta = useQuery({
    queryKey: ["ebd-painel"],
    enabled: pode,
    queryFn: async () => {
      const t = trimestres();
      const semana = semanaDe();
      const [turmas, matriculas, aulas, frequencia] = await Promise.all([
        supabase.from("ebd_turmas").select("id, nome, congregacao_id"),
        supabase.from("ebd_matriculas").select("id, turma_id, created_at"),
        supabase.from("ebd_aulas").select("id, turma_id, nome, data, hora_inicio, hora_fim"),
        supabase.from("ebd_frequencia").select("turma_id, data, presente"),
      ]);
      for (const r of [turmas, matriculas, aulas, frequencia]) {
        if (r.error) throw r.error;
      }

      const listaTurmas = turmas.data ?? [];
      const listaAulas = aulas.data ?? [];
      const listaFreq = frequencia.data ?? [];
      const nomeTurma = new Map(listaTurmas.map((t2) => [t2.id, t2.nome]));

      const noPeriodo = (data: string, inicio: string, fim: string) =>
        data >= inicio && data <= fim;
      const percentual = (linhas: typeof listaFreq) => {
        if (linhas.length === 0) return null;
        return Math.round((linhas.filter((l) => l.presente).length / linhas.length) * 100);
      };

      const hoje = hojeISO();

      return {
        matriculados: (matriculas.data ?? []).length,
        matriculadosNovos: (matriculas.data ?? []).filter(
          (m) => m.created_at.slice(0, 10) >= diasAtras(30),
        ).length,
        frequenciaAtual: percentual(
          listaFreq.filter((f) => noPeriodo(f.data, t.atualInicio, t.atualFim)),
        ),
        frequenciaAnterior: percentual(
          listaFreq.filter((f) => noPeriodo(f.data, t.anteriorInicio, t.anteriorFim)),
        ),
        turmas: listaTurmas.length,
        congregacoes: new Set(listaTurmas.map((t2) => t2.congregacao_id)).size,
        aulasSemana: listaAulas.filter((a) => noPeriodo(a.data, semana.inicio, semana.fim)).length,
        aulasHoje: listaAulas
          .filter((a) => a.data === hoje)
          .map((a) => ({ ...a, turma: nomeTurma.get(a.turma_id) ?? "—" })),
        proximas: listaAulas
          .filter((a) => a.data > hoje)
          .sort((a, b) => a.data.localeCompare(b.data))
          .slice(0, 6)
          .map((a) => ({ ...a, turma: nomeTurma.get(a.turma_id) ?? "—" })),
        porTurma: listaTurmas.map((t2) => {
          const linhas = listaFreq.filter((f) => f.turma_id === t2.id);
          return {
            id: t2.id,
            nome: t2.nome,
            presentes: linhas.filter((l) => l.presente).length,
            faltas: linhas.filter((l) => !l.presente).length,
          };
        }),
      };
    },
  });

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Painel — EBD" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Painel — EBD" />
        <SemPermissao mensagem="Sua conta não tem permissão de liderança para ver a EBD." />
      </>
    );
  }

  const d = consulta.data;
  const carregando = consulta.isLoading;
  const aulasDaAba = aba === "hoje" ? (d?.aulasHoje ?? []) : (d?.proximas ?? []);
  const maiorBarra = Math.max(1, ...(d?.porTurma.map((t) => t.presentes + t.faltas) ?? [1]));

  return (
    <>
      <PageHeader
        titulo="Painel — EBD"
        descricao={`${saudacao()}${nome ? `, ${nome}` : ""}. Aqui está um resumo de hoje.`}
        acoes={
          <>
            <PillButton
              variante="outline"
              onClick={() => navigate({ to: "/ebd/turmas" })}
              className="h-9 rounded-full px-4 text-[13px]"
            >
              <GraduationCap className="h-4 w-4" aria-hidden /> Ver turmas
            </PillButton>
            <PillButton
              onClick={() => navigate({ to: "/ebd/cadastrar-aulas" })}
              className="h-9 rounded-full px-4 text-[13px]"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden /> Cadastrar aula
            </PillButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardTopo
          icone={Users}
          rotulo="Alunos matriculados"
          valor={carregando ? "—" : String(d?.matriculados ?? 0)}
          rodape={carregando ? undefined : `${d?.matriculadosNovos ?? 0} nos últimos 30 dias`}
        />
        <StatCardTopo
          icone={TrendingUp}
          rotulo="Frequência do trimestre"
          valor={carregando ? "—" : d?.frequenciaAtual != null ? `${d.frequenciaAtual}%` : "—"}
          rodape={
            carregando
              ? undefined
              : d?.frequenciaAnterior != null
                ? `${d.frequenciaAnterior}% no trimestre anterior`
                : "sem chamada no trimestre anterior"
          }
        />
        <StatCardTopo
          icone={GraduationCap}
          rotulo="Turmas ativas"
          valor={carregando ? "—" : String(d?.turmas ?? 0)}
          rodape={carregando ? undefined : `em ${d?.congregacoes ?? 0} congregação(ões)`}
        />
        <StatCardTopo
          icone={Church}
          rotulo="Aulas esta semana"
          valor={carregando ? "—" : String(d?.aulasSemana ?? 0)}
          rodape={carregando ? undefined : `${d?.aulasHoje.length ?? 0} hoje`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Bloco
          acao={
            <Link to="/calendario" className="text-xs font-medium text-jt-blue hover:underline">
              Ver calendário →
            </Link>
          }
          titulo=""
        >
          <div className="-mt-2 mb-4 inline-flex rounded-full border border-jt-line bg-jt-panel-2 p-1">
            {(
              [
                ["hoje", "Aulas de hoje", d?.aulasHoje.length ?? 0],
                ["proximas", "Próximas aulas", d?.proximas.length ?? 0],
              ] as const
            ).map(([chave, rotulo, contagem]) => (
              <button
                key={chave}
                type="button"
                onClick={() => setAba(chave)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
                  aba === chave ? "bg-jt-blue text-white" : "text-jt-muted hover:text-jt-text",
                )}
              >
                {rotulo}
                <span className="num text-xs opacity-70">{contagem}</span>
              </button>
            ))}
          </div>

          {carregando ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : aulasDaAba.length === 0 ? (
            <VazioBloco>
              {aba === "hoje"
                ? "Nenhuma aula cadastrada para hoje."
                : "Nenhuma aula futura cadastrada."}
            </VazioBloco>
          ) : (
            <ul className="space-y-2">
              {aulasDaAba.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-jt-line px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-jt-text">{a.nome}</p>
                    <p className="truncate text-xs text-jt-muted">{a.turma}</p>
                  </div>
                  <p className="num text-xs text-jt-muted">
                    {dataParaBR(a.data)} · {hora(a.hora_inicio)}–{hora(a.hora_fim)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco
          titulo="Frequência por turma"
          acao={
            <span className="flex items-center gap-3 text-xs text-jt-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-jt-blue" /> Presentes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-jt-coral" /> Faltas
              </span>
            </span>
          }
        >
          {carregando ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : (d?.porTurma.length ?? 0) === 0 ? (
            <VazioBloco>Nenhuma turma cadastrada.</VazioBloco>
          ) : (
            <div className="flex h-56 items-end justify-around gap-6">
              {d?.porTurma.map((t) => (
                <div key={t.id} className="flex h-full flex-col items-center gap-2">
                  <div className="flex h-full items-end gap-1">
                    <div
                      className="w-6 rounded-sm bg-jt-blue"
                      style={{ height: `${Math.max((t.presentes / maiorBarra) * 100, 1)}%` }}
                      title={`${t.presentes} presença(s)`}
                    />
                    <div
                      className="w-6 rounded-sm bg-jt-coral"
                      style={{ height: `${Math.max((t.faltas / maiorBarra) * 100, 1)}%` }}
                      title={`${t.faltas} falta(s)`}
                    />
                  </div>
                  <span className="max-w-24 truncate text-xs text-jt-muted">{t.nome}</span>
                </div>
              ))}
            </div>
          )}
        </Bloco>
      </div>
    </>
  );
}
