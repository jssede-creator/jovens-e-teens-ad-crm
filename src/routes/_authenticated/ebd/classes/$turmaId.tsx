import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarPlus,
  Check,
  ClipboardCheck,
  History,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { SelectCampo } from "@/components/crm/campos";
import { AvatarIniciais, PageHeader } from "@/components/crm/pagina";
import {
  EmptyRow,
  TableSearch,
  TableShell,
  TableToolbar,
  TableToolbarActions,
} from "@/components/crm/tabela";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { hojeISO, idadeEm, iniciais, nivelFrequencia } from "@/lib/ebd";
import { dataParaBR, hora, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ebd/classes/$turmaId")({
  head: () => ({
    meta: [
      { title: "Classe da EBD — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Matriculados, chamada e frequência da classe." },
      { property: "og:title", content: "Classe da EBD — AD CRM" },
      { property: "og:description", content: "Matriculados, chamada e frequência da classe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClasseDetalhe,
});

type Aluno = {
  matriculaId: string;
  cadastroId: string;
  nome: string;
  nascimento: string;
  presencas: number;
  faltas: number;
};

type Aula = { id: string; nome: string; data: string; hora_inicio: string; hora_fim: string };

const NIVEL = {
  alto: {
    rotulo: "Alto",
    classe: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  },
  medio: {
    rotulo: "Médio",
    classe: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  baixo: { rotulo: "Baixo", classe: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};

/* ------------------------------------------------------------------ */
/* Modal — frequência de um aluno                                      */
/* ------------------------------------------------------------------ */

function FrequenciaDialog({
  aluno,
  chamadas,
  onFechar,
}: {
  aluno: Aluno | null;
  chamadas: { data: string; presente: boolean; cadastro_id: string }[];
  onFechar: () => void;
}) {
  const [aba, setAba] = useState<"resumo" | "historico">("resumo");

  const doAluno = chamadas
    .filter((c) => c.cadastro_id === aluno?.cadastroId)
    .sort((a, b) => b.data.localeCompare(a.data));
  const presencas = doAluno.filter((c) => c.presente).length;
  const total = doAluno.length;
  const percentual = total === 0 ? 0 : Math.round((presencas / total) * 100);

  return (
    <Dialog open={aluno !== null} onOpenChange={(v) => (!v ? onFechar() : undefined)}>
      <DialogContent className="border-jt-line bg-jt-panel text-jt-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <History className="h-5 w-5 text-jt-blue" aria-hidden />
            Frequência de aulas
          </DialogTitle>
          <DialogDescription className="text-jt-muted">{aluno?.nome ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="inline-flex w-full rounded-xl border border-jt-line bg-jt-panel-2 p-1">
          {(
            [
              ["resumo", "Resumo"],
              ["historico", "Histórico"],
            ] as const
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={cn(
                "min-h-9 flex-1 rounded-lg text-sm font-medium transition",
                aba === chave ? "bg-jt-panel text-jt-text shadow-sm" : "text-jt-muted",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {aba === "resumo" ? (
          <div className="rounded-xl border border-jt-line bg-jt-panel-2 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-jt-muted">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    total === 0
                      ? "bg-jt-muted"
                      : NIVEL[nivelFrequencia(percentual)].classe.includes("green")
                        ? "bg-jt-success"
                        : "bg-amber-500",
                  )}
                />
                Frequência
              </p>
              <p className="num text-xs text-jt-muted">
                {presencas} de {total} · {percentual}%
              </p>
            </div>

            {total === 0 ? (
              <p className="py-6 text-center text-sm text-jt-muted">
                Ainda não houve chamada com este aluno.
              </p>
            ) : (
              <>
                <div className="mt-3 flex h-20 items-end gap-3">
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-md bg-jt-blue"
                      style={{ height: `${Math.max((presencas / total) * 100, 4)}%` }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-md bg-jt-line"
                      style={{ height: `${Math.max(((total - presencas) / total) * 100, 4)}%` }}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-jt-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-jt-blue" /> Presente ({presencas})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-jt-line" /> Falta ({total - presencas})
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {doAluno.length === 0 ? (
              <p className="py-6 text-center text-sm text-jt-muted">Nenhuma chamada registrada.</p>
            ) : (
              doAluno.map((c) => (
                <div
                  key={c.data}
                  className="flex items-center justify-between rounded-xl border border-jt-line bg-jt-panel-2 px-3 py-2.5"
                >
                  <span className="num text-sm text-jt-text">{dataParaBR(c.data)}</span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      c.presente ? "text-jt-success" : "text-jt-coral",
                    )}
                  >
                    {c.presente ? "Presente" : "Falta"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          <PillButton variante="ghost" onClick={onFechar}>
            Fechar
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Modal — chamada do dia                                              */
/* ------------------------------------------------------------------ */

function ChamadaDialog({
  aberto,
  onOpenChange,
  aulas,
  alunos,
  chamadas,
  onSalvar,
  salvando,
  erro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  aulas: Aula[];
  alunos: Aluno[];
  chamadas: { data: string; presente: boolean; cadastro_id: string }[];
  onSalvar: (data: string, presencas: Record<string, boolean>) => void;
  salvando: boolean;
  erro: string;
}) {
  const hoje = hojeISO();
  const aulaDeHoje = aulas.find((a) => a.data === hoje);
  const [aulaId, setAulaId] = useState("");
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [chaveAtual, setChaveAtual] = useState(false);

  const aulaEscolhida = aulas.find((a) => a.id === aulaId) ?? aulaDeHoje ?? aulas[0];

  // Ao abrir, começa na aula de hoje e traz a chamada já registrada.
  if (aberto !== chaveAtual) {
    setChaveAtual(aberto);
    if (aberto) {
      const inicial = aulaDeHoje ?? aulas[0];
      setAulaId(inicial?.id ?? "");
      const jaRegistrada = chamadas.filter((c) => c.data === inicial?.data);
      setPresencas(
        Object.fromEntries(
          alunos.map((a) => [
            a.cadastroId,
            jaRegistrada.find((c) => c.cadastro_id === a.cadastroId)?.presente ?? true,
          ]),
        ),
      );
    }
  }

  const trocarAula = (id: string) => {
    setAulaId(id);
    const aula = aulas.find((a) => a.id === id);
    const jaRegistrada = chamadas.filter((c) => c.data === aula?.data);
    setPresencas(
      Object.fromEntries(
        alunos.map((a) => [
          a.cadastroId,
          jaRegistrada.find((c) => c.cadastro_id === a.cadastroId)?.presente ?? true,
        ]),
      ),
    );
  };

  const presentes = Object.values(presencas).filter(Boolean).length;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ClipboardCheck className="h-5 w-5 text-jt-gold" aria-hidden />
            Chamada
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            {aulaEscolhida
              ? `${aulaEscolhida.nome} · ${dataParaBR(aulaEscolhida.data)} · ${hora(aulaEscolhida.hora_inicio)}`
              : "Nenhuma aula cadastrada nesta classe."}
          </DialogDescription>
        </DialogHeader>

        {aulas.length === 0 ? (
          <p className="py-8 text-center text-sm text-jt-muted">
            Cadastre uma aula para esta classe antes de fazer a chamada.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              <SelectCampo
                opcoes={aulas.map((a) => ({
                  valor: a.id,
                  rotulo: `${dataParaBR(a.data)} · ${a.nome}`,
                }))}
                valor={aulaEscolhida?.id ?? ""}
                onValueChange={trocarAula}
                placeholder="Escolha a aula"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-jt-muted">
                <span className="num">
                  {presentes} de {alunos.length} presentes
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPresencas(Object.fromEntries(alunos.map((a) => [a.cadastroId, true])))
                    }
                    className="rounded-full border border-jt-line px-2.5 py-1 transition hover:bg-jt-panel-2 hover:text-jt-text"
                  >
                    Todos presentes
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPresencas(Object.fromEntries(alunos.map((a) => [a.cadastroId, false])))
                    }
                    className="rounded-full border border-jt-line px-2.5 py-1 transition hover:bg-jt-panel-2 hover:text-jt-text"
                  >
                    Todos ausentes
                  </button>
                </div>
              </div>
            </div>

            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-1">
              {alunos.map((a) => {
                const presente = presencas[a.cadastroId] ?? true;
                return (
                  <li
                    key={a.cadastroId}
                    className="flex items-center gap-3 rounded-xl border border-jt-line px-3 py-2"
                  >
                    <AvatarIniciais texto={iniciais(a.nome)} tamanho="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-jt-text">{a.nome}</span>
                    <div className="inline-flex rounded-full border border-jt-line bg-jt-panel-2 p-0.5">
                      <button
                        type="button"
                        aria-pressed={presente}
                        onClick={() =>
                          setPresencas((atual) => ({ ...atual, [a.cadastroId]: true }))
                        }
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium transition",
                          presente ? "bg-jt-success text-white" : "text-jt-muted",
                        )}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden /> Presente
                      </button>
                      <button
                        type="button"
                        aria-pressed={!presente}
                        onClick={() =>
                          setPresencas((atual) => ({ ...atual, [a.cadastroId]: false }))
                        }
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium transition",
                          !presente ? "bg-jt-coral text-white" : "text-jt-muted",
                        )}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden /> Falta
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </PillButton>
          <PillButton
            disabled={salvando || !aulaEscolhida || alunos.length === 0}
            onClick={() => aulaEscolhida && onSalvar(aulaEscolhida.data, presencas)}
          >
            {salvando ? "Salvando…" : "Salvar chamada"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Modal — incluir alunos                                              */
/* ------------------------------------------------------------------ */

function IncluirAlunoDialog({
  aberto,
  onOpenChange,
  candidatos,
  faixa,
  onMatricular,
  salvando,
  erro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  candidatos: { id: string; nome: string; nascimento: string; congregacao: string }[];
  faixa: string;
  onMatricular: (ids: string[]) => void;
  salvando: boolean;
  erro: string;
}) {
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [foraDaFaixa, setForaDaFaixa] = useState(false);
  const [chaveAtual, setChaveAtual] = useState(false);

  if (aberto !== chaveAtual) {
    setChaveAtual(aberto);
    if (aberto) {
      setEscolhidos(new Set());
      setBusca("");
      setForaDaFaixa(false);
    }
  }

  const termo = busca.trim().toLowerCase();
  const visiveis = candidatos.filter((c) => {
    if (!termo) return true;
    return [c.nome, c.congregacao].some((v) => v.toLowerCase().includes(termo));
  });

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <UserPlus className="h-5 w-5 text-jt-gold" aria-hidden />
            Incluir aluno
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            Membros cadastrados que ainda não estão nesta classe. Faixa da classe: {faixa}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-jt-muted"
              aria-hidden
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome…"
              aria-label="Buscar candidato"
              className="h-9 w-full rounded-full border border-jt-line bg-jt-panel-2 pl-8 pr-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-jt-muted">
            <input
              type="checkbox"
              checked={foraDaFaixa}
              onChange={(e) => setForaDaFaixa(e.target.checked)}
            />
            Mostrar também quem está fora da faixa etária
          </label>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-1">
          {visiveis.length === 0 ? (
            <p className="py-8 text-center text-sm text-jt-muted">
              Ninguém disponível para matricular.
            </p>
          ) : (
            visiveis.map((c) => {
              const idade = idadeEm(c.nascimento);
              const marcado = escolhidos.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setEscolhidos((atual) => {
                        const proximo = new Set(atual);
                        if (proximo.has(c.id)) proximo.delete(c.id);
                        else proximo.add(c.id);
                        return proximo;
                      })
                    }
                    aria-pressed={marcado}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                      marcado
                        ? "border-jt-gold/60 bg-jt-panel-2"
                        : "border-jt-line hover:bg-jt-panel-2",
                    )}
                  >
                    <AvatarIniciais texto={iniciais(c.nome)} tamanho="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-jt-text">
                        {c.nome}
                      </span>
                      <span className="num block truncate text-xs text-jt-muted">
                        {idade != null ? `${idade} anos` : "—"} · {c.congregacao}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                        marcado ? "border-transparent bg-jt-blue text-white" : "border-jt-line",
                      )}
                    >
                      {marcado ? <Check className="h-3 w-3" aria-hidden /> : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </PillButton>
          <PillButton
            disabled={salvando || escolhidos.size === 0}
            onClick={() => onMatricular([...escolhidos])}
          >
            {salvando ? "Matriculando…" : `Matricular ${escolhidos.size || ""}`.trim()}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

function ClasseDetalhe() {
  const { turmaId } = useParams({ from: "/_authenticated/ebd/classes/$turmaId" });
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "ebd" }, acesso);
  const podeChamada = podeVer({ tipo: "modulo", modulo: "ebd_chamada" }, acesso);

  const [busca, setBusca] = useState("");
  const [incluir, setIncluir] = useState(false);
  const [chamada, setChamada] = useState(false);
  const [frequenciaDe, setFrequenciaDe] = useState<Aluno | null>(null);
  const [mostrarForaFaixa] = useState(false);
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["ebd-classe", turmaId],
    enabled: pode,
    queryFn: async () => {
      const [turma, matriculas, aulas, frequencia, cadastros, congregacoes] = await Promise.all([
        supabase
          .from("ebd_turmas")
          .select("id, nome, congregacao_id, idade_min, idade_max")
          .eq("id", turmaId)
          .maybeSingle(),
        supabase
          .from("ebd_matriculas")
          .select("id, cadastro_id, cadastros(nome_completo, data_nascimento)")
          .eq("turma_id", turmaId),
        supabase
          .from("ebd_aulas")
          .select("id, nome, data, hora_inicio, hora_fim")
          .eq("turma_id", turmaId)
          .order("data", { ascending: false }),
        supabase
          .from("ebd_frequencia")
          .select("cadastro_id, data, presente")
          .eq("turma_id", turmaId),
        supabase
          .from("cadastros")
          .select("id, nome_completo, data_nascimento, congregacao_id")
          .order("nome_completo"),
        supabase.from("congregacoes").select("id, nome"),
      ]);
      for (const r of [turma, matriculas, aulas, frequencia, cadastros, congregacoes]) {
        if (r.error) throw r.error;
      }

      const chamadas = frequencia.data ?? [];
      const alunos: Aluno[] = (matriculas.data ?? []).map((m) => {
        const pessoa = m.cadastros as unknown as {
          nome_completo: string;
          data_nascimento: string;
        } | null;
        const minhas = chamadas.filter((c) => c.cadastro_id === m.cadastro_id);
        return {
          matriculaId: m.id,
          cadastroId: m.cadastro_id,
          nome: pessoa?.nome_completo ?? "—",
          nascimento: pessoa?.data_nascimento ?? "",
          presencas: minhas.filter((c) => c.presente).length,
          faltas: minhas.filter((c) => !c.presente).length,
        };
      });

      const nomeCongregacao = new Map((congregacoes.data ?? []).map((c) => [c.id, c.nome]));
      const matriculados = new Set(alunos.map((a) => a.cadastroId));
      const candidatos = (cadastros.data ?? [])
        .filter((c) => !matriculados.has(c.id))
        .map((c) => ({
          id: c.id,
          nome: c.nome_completo,
          nascimento: c.data_nascimento,
          congregacao: c.congregacao_id ? (nomeCongregacao.get(c.congregacao_id) ?? "—") : "—",
        }));

      return {
        turma: turma.data,
        congregacao: turma.data?.congregacao_id
          ? (nomeCongregacao.get(turma.data.congregacao_id) ?? "—")
          : "—",
        alunos: alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        aulas: (aulas.data ?? []) as Aula[],
        chamadas,
        candidatos,
      };
    },
  });

  const turma = consulta.data?.turma;
  const alunos = useMemo(() => consulta.data?.alunos ?? [], [consulta.data]);
  const aulas = consulta.data?.aulas ?? [];
  const chamadas = consulta.data?.chamadas ?? [];
  const aulaDeHoje = aulas.find((a) => a.data === hojeISO());

  const candidatos = useMemo(() => {
    const lista = consulta.data?.candidatos ?? [];
    if (mostrarForaFaixa || !turma) return lista;
    return lista.filter((c) => {
      const idade = idadeEm(c.nascimento);
      return idade == null || (idade >= turma.idade_min && idade <= turma.idade_max);
    });
  }, [consulta.data, turma, mostrarForaFaixa]);

  const matricular = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("ebd_matriculas")
        .insert(ids.map((cadastro_id) => ({ turma_id: turmaId, cadastro_id })));
      if (error) throw error;
      await registrarAuditoria({
        acao: "matriculou",
        entidade: "ebd_turma",
        entidadeId: turmaId,
        detalhe: `${ids.length} aluno(s)`,
      });
    },
    onSuccess: async () => {
      setIncluir(false);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["ebd-classe", turmaId] });
      await queryClient.invalidateQueries({ queryKey: ["ebd-turmas"] });
      await queryClient.invalidateQueries({ queryKey: ["ebd-painel"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const desmatricular = useMutation({
    mutationFn: async (aluno: Aluno) => {
      const { error } = await supabase.from("ebd_matriculas").delete().eq("id", aluno.matriculaId);
      if (error) throw error;
      await registrarAuditoria({
        acao: "removeu",
        entidade: "ebd_turma",
        entidadeId: turmaId,
        detalhe: `matrícula de ${aluno.nome}`,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ebd-classe", turmaId] });
      await queryClient.invalidateQueries({ queryKey: ["ebd-turmas"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const salvarChamada = useMutation({
    mutationFn: async ({
      data,
      presencas,
    }: {
      data: string;
      presencas: Record<string, boolean>;
    }) => {
      const linhas = alunos.map((a) => ({
        turma_id: turmaId,
        cadastro_id: a.cadastroId,
        data,
        presente: presencas[a.cadastroId] ?? true,
      }));
      const { error } = await supabase
        .from("ebd_frequencia")
        .upsert(linhas, { onConflict: "turma_id,cadastro_id,data" });
      if (error) throw error;
      await registrarAuditoria({
        acao: "fez chamada",
        entidade: "ebd_turma",
        entidadeId: turmaId,
        detalhe: `${dataParaBR(data)} · ${linhas.filter((l) => l.presente).length} presente(s)`,
      });
    },
    onSuccess: async () => {
      setChamada(false);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["ebd-classe", turmaId] });
      await queryClient.invalidateQueries({ queryKey: ["ebd-painel"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const visiveis = alunos.filter((a) =>
    busca.trim() ? a.nome.toLowerCase().includes(busca.trim().toLowerCase()) : true,
  );

  if (carregandoAcesso || consulta.isLoading) {
    return (
      <>
        <PageHeader titulo="Classe" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Classe" />
        <SemPermissao mensagem="Sua conta não tem permissão de liderança para ver a EBD." />
      </>
    );
  }

  if (!turma) {
    return (
      <>
        <PageHeader titulo="Classe" />
        <div className="rounded-[20px] border border-jt-line bg-jt-panel px-6 py-14 text-center">
          <p className="text-sm text-jt-muted">Esta classe não existe mais.</p>
          <Link to="/ebd/classes" className="mt-4 inline-block">
            <PillButton variante="outline">Voltar para as classes</PillButton>
          </Link>
        </div>
      </>
    );
  }

  const faixa = `${turma.idade_min} a ${turma.idade_max} anos`;

  return (
    <>
      <Link
        to="/ebd/classes"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-jt-muted transition hover:text-jt-text"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Classes
      </Link>

      <PageHeader
        titulo={turma.nome}
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {visiveis.length} de {alunos.length}
          </Badge>
        }
        acoes={
          <span className="text-sm text-jt-muted">
            {consulta.data?.congregacao} · {faixa}
          </span>
        }
      />

      <p className="-mt-2 mb-4 text-sm text-jt-muted">
        {aulaDeHoje ? (
          <>
            Aula de hoje: <span className="text-jt-text">{aulaDeHoje.nome}</span> ·{" "}
            {hora(aulaDeHoje.hora_inicio)}–{hora(aulaDeHoje.hora_fim)}
          </>
        ) : (
          <>
            Sem aula cadastrada para hoje nesta classe —{" "}
            <Link to="/ebd/cadastrar-aulas" className="text-jt-blue hover:underline">
              cadastre a aula de hoje
            </Link>{" "}
            pra liberar a chamada do dia.
          </>
        )}
      </p>

      {erro ? <p className="mb-3 text-xs text-jt-coral">{erro}</p> : null}

      <TableShell>
        <TableToolbar>
          <TableSearch valor={busca} onChange={setBusca} placeholder="Buscar aluno por nome…" />
          <TableToolbarActions>
            {podeChamada ? (
              <>
                <PillButton
                  variante="outline"
                  className="h-9 rounded-full px-4 text-[13px]"
                  disabled={aulas.length === 0}
                  onClick={() => {
                    setErro("");
                    setChamada(true);
                  }}
                >
                  {aulaDeHoje ? (
                    <CalendarCheck className="h-4 w-4" aria-hidden />
                  ) : (
                    <CalendarPlus className="h-4 w-4" aria-hidden />
                  )}
                  {aulas.length === 0 ? "Sem aula cadastrada" : "Fazer chamada"}
                </PillButton>
                <PillButton
                  className="h-9 rounded-full px-4 text-[13px]"
                  onClick={() => {
                    setErro("");
                    setIncluir(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" aria-hidden /> Incluir aluno
                </PillButton>
              </>
            ) : null}
          </TableToolbarActions>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <TableHead className="text-jt-muted">Aluno</TableHead>
                <TableHead className="text-jt-muted">Data de nascimento</TableHead>
                <TableHead className="text-jt-muted">Idade</TableHead>
                <TableHead className="text-jt-muted">Frequência</TableHead>
                <TableHead className="text-jt-muted">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.length === 0 ? (
                <EmptyRow colSpan={5}>
                  {alunos.length === 0
                    ? "Nenhum aluno matriculado nesta classe ainda."
                    : "Nenhum aluno corresponde à busca."}
                </EmptyRow>
              ) : (
                visiveis.map((a) => {
                  const total = a.presencas + a.faltas;
                  const percentual = total === 0 ? null : Math.round((a.presencas / total) * 100);
                  const nivel = percentual == null ? null : NIVEL[nivelFrequencia(percentual)];
                  const idade = idadeEm(a.nascimento);
                  return (
                    <TableRow key={a.matriculaId} className="border-jt-line hover:bg-jt-panel-2">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <AvatarIniciais texto={iniciais(a.nome)} />
                          <span className="font-medium text-jt-text">{a.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="num whitespace-nowrap text-jt-muted">
                        {dataParaBR(a.nascimento)}
                      </TableCell>
                      <TableCell className="num whitespace-nowrap text-jt-muted">
                        {idade != null ? `${idade} anos` : "—"}
                      </TableCell>
                      <TableCell>
                        {nivel ? (
                          <Badge className={cn("border-transparent font-normal", nivel.classe)}>
                            {nivel.rotulo} · {percentual}%
                          </Badge>
                        ) : (
                          <span className="text-jt-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PillButton
                            variante="outline"
                            className="h-8 rounded-full px-3 text-xs"
                            onClick={() => setFrequenciaDe(a)}
                          >
                            <History className="h-3.5 w-3.5" aria-hidden /> Frequência de aulas
                          </PillButton>
                          {podeChamada ? (
                            <button
                              type="button"
                              aria-label={`Remover ${a.nome} da classe`}
                              onClick={() => desmatricular.mutate(a)}
                              className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </TableShell>

      <IncluirAlunoDialog
        aberto={incluir}
        onOpenChange={setIncluir}
        candidatos={candidatos}
        faixa={faixa}
        onMatricular={(ids) => matricular.mutate(ids)}
        salvando={matricular.isPending}
        erro={erro}
      />

      <ChamadaDialog
        aberto={chamada}
        onOpenChange={setChamada}
        aulas={aulas}
        alunos={alunos}
        chamadas={chamadas}
        onSalvar={(data, presencas) => salvarChamada.mutate({ data, presencas })}
        salvando={salvarChamada.isPending}
        erro={erro}
      />

      <FrequenciaDialog
        aluno={frequenciaDe}
        chamadas={chamadas}
        onFechar={() => setFrequenciaDe(null)}
      />
    </>
  );
}
