import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, ListChecks, Plus, Trash2, UserRound } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";

import { Field, PillButton, TextInput } from "@/components/cadastro/ui";
import { DataCampo, SelectCampo } from "@/components/crm/campos";
import { AvatarIniciais, PageHeader } from "@/components/crm/pagina";
import {
  ColumnsMenu,
  EmptyRow,
  FilterMenu,
  GroupHeaderRow,
  GroupToggleButton,
  SortableHead,
  TablePagination,
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
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { iniciais } from "@/lib/ebd";
import { dataParaBR, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import {
  carregarTarefas,
  FASES,
  PRIORIDADE_TAREFA,
  STATUS_TAREFA,
  type PrioridadeTarefa,
  type StatusTarefa,
  type Tarefa,
} from "@/lib/tarefas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/novosprojetos/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Tarefas dos projetos e seus responsáveis." },
      { property: "og:title", content: "Tarefas — AD CRM" },
      { property: "og:description", content: "Tarefas dos projetos e seus responsáveis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Tarefas,
});

type ColunaKey = "projeto" | "fase" | "responsavel" | "prazo" | "status" | "prioridade";

const COLUNAS_TABELA = [
  { chave: "projeto", rotulo: "Projeto" },
  { chave: "fase", rotulo: "Fase" },
  { chave: "responsavel", rotulo: "Responsável" },
  { chave: "prazo", rotulo: "Prazo" },
  { chave: "status", rotulo: "Situação" },
  { chave: "prioridade", rotulo: "Prioridade" },
] as const satisfies readonly { chave: ColunaKey; rotulo: string }[];

type OrdemKey = "numero" | "titulo" | "prazo" | "status";

const FORM_VAZIO = {
  projeto_id: "",
  fase: FASES[0] ?? "Planejamento",
  titulo: "",
  descricao: "",
  status: "backlog" as StatusTarefa,
  prioridade: "media" as PrioridadeTarefa,
  responsavel_id: "",
  inicio: "",
  fim: "",
};
type Formulario = typeof FORM_VAZIO;

function alternarNoSet<T>(conjunto: Set<T>, valor: T, marcado: boolean) {
  const proximo = new Set(conjunto);
  if (marcado) proximo.add(valor);
  else proximo.delete(valor);
  return proximo;
}

function SetaPrioridade({ prioridade }: { prioridade: PrioridadeTarefa }) {
  const p = PRIORIDADE_TAREFA[prioridade];
  const Icone = p.seta === "cima" ? ArrowUp : p.seta === "baixo" ? ArrowDown : ArrowRight;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", p.classe)}>
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {p.rotulo}
    </span>
  );
}

function TarefaDialog({
  aberto,
  onOpenChange,
  editando,
  projetos,
  pessoas,
  onSalvar,
  salvando,
  erro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: Tarefa | null;
  projetos: { id: string; titulo: string }[];
  pessoas: { id: string; nome: string }[];
  onSalvar: (form: Formulario) => void;
  salvando: boolean;
  erro: string;
}) {
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [chaveAtual, setChaveAtual] = useState<string | null>(null);

  const chave = aberto ? (editando?.id ?? "nova") : null;
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setErros({});
    setForm(
      editando
        ? {
            projeto_id: editando.projeto_id,
            fase: editando.fase,
            titulo: editando.titulo,
            descricao: editando.descricao ?? "",
            status: editando.status,
            prioridade: editando.prioridade,
            responsavel_id: editando.responsavel_id ?? "",
            inicio: editando.inicio ?? "",
            fim: editando.fim ?? "",
          }
        : { ...FORM_VAZIO, projeto_id: projetos[0]?.id ?? "" },
    );
  }

  const campo = <K extends keyof Formulario>(nome: K, valor: Formulario[K]) => {
    setForm((atual) => ({ ...atual, [nome]: valor }));
    setErros((atual) => ({ ...atual, [nome]: "" }));
  };

  function enviar() {
    const novos: Record<string, string> = {};
    if (!form.projeto_id) novos["projeto_id"] = "Escolha o projeto.";
    if (!form.titulo.trim()) novos["titulo"] = "Campo obrigatório.";
    if (form.inicio && form.fim && form.fim < form.inicio) {
      novos["fim"] = "O fim precisa ser depois do início.";
    }
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    onSalvar(form);
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ListChecks className="h-5 w-5 text-jt-gold" aria-hidden />
            {editando ? `Tarefa ${String(editando.numero).padStart(4, "0")}` : "Nova tarefa"}
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            A tarefa pertence a um projeto e tem um responsável, que pode atualizar a situação.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1">
          <Field label="Título" obrigatorio erro={erros["titulo"] ?? ""}>
            <TextInput
              value={form.titulo}
              onValueChange={(v) => campo("titulo", v)}
              placeholder="Ex.: Levantar valores e orçamentos"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Projeto" obrigatorio erro={erros["projeto_id"] ?? ""}>
              <SelectCampo
                opcoes={projetos.map((p) => ({ valor: p.id, rotulo: p.titulo }))}
                valor={form.projeto_id}
                onValueChange={(v) => campo("projeto_id", v)}
                placeholder="Selecione"
              />
            </Field>
            <Field label="Fase">
              <SelectCampo
                opcoes={FASES.map((f) => ({ valor: f, rotulo: f }))}
                valor={form.fase}
                onValueChange={(v) => campo("fase", v)}
              />
            </Field>
            <Field label="Situação">
              <SelectCampo
                opcoes={(
                  ["backlog", "a_fazer", "em_andamento", "concluida", "cancelada"] as const
                ).map((s) => ({ valor: s, rotulo: STATUS_TAREFA[s].rotulo }))}
                valor={form.status}
                onValueChange={(v) => campo("status", v as StatusTarefa)}
              />
            </Field>
            <Field label="Prioridade">
              <SelectCampo
                opcoes={(["alta", "media", "baixa"] as const).map((p) => ({
                  valor: p,
                  rotulo: PRIORIDADE_TAREFA[p].rotulo,
                }))}
                valor={form.prioridade}
                onValueChange={(v) => campo("prioridade", v as PrioridadeTarefa)}
              />
            </Field>
            <Field label="Responsável" dica="Quem toca a tarefa até o fim.">
              <SelectCampo
                opcoes={pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))}
                valor={form.responsavel_id}
                onValueChange={(v) => campo("responsavel_id", v)}
                placeholder="Sem responsável"
              />
            </Field>
            <div />
            <Field label="Início">
              <DataCampo valor={form.inicio} onValueChange={(v) => campo("inicio", v)} />
            </Field>
            <Field label="Fim" erro={erros["fim"] ?? ""}>
              <DataCampo valor={form.fim} onValueChange={(v) => campo("fim", v)} />
            </Field>
          </div>

          <Field label="Descrição">
            <textarea
              value={form.descricao}
              onChange={(e) => campo("descricao", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-jt-line bg-jt-panel p-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
            />
          </Field>

          {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </PillButton>
          <PillButton onClick={enviar} disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar tarefa"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Tarefas() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "projetos" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "projetos_gerenciar" }, acesso);

  const [userId, setUserId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<Set<StatusTarefa>>(new Set());
  const [filtroPrioridade, setFiltroPrioridade] = useState<Set<PrioridadeTarefa>>(new Set());
  const [filtroProjeto, setFiltroProjeto] = useState<Set<string>>(new Set());
  const [soMinhas, setSoMinhas] = useState(false);
  const [colunas, setColunas] = useState<Set<ColunaKey>>(
    () => new Set(COLUNAS_TABELA.map((c) => c.chave)),
  );
  const [agrupado, setAgrupado] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [ordem, setOrdem] = useState<OrdemKey>("numero");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(10);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const consulta = useQuery({
    queryKey: ["projeto-tarefas"],
    enabled: pode,
    queryFn: async () => {
      const [tarefas, projetos, pessoas] = await Promise.all([
        carregarTarefas(),
        supabase.from("projetos").select("id, titulo").order("titulo"),
        supabase
          .from("cadastros")
          .select("user_id, nome_completo")
          .not("user_id", "is", null)
          .order("nome_completo"),
      ]);
      if (projetos.error) throw projetos.error;
      if (pessoas.error) throw pessoas.error;

      const vistos = new Set<string>();
      const lista: { id: string; nome: string }[] = [];
      for (const p of pessoas.data ?? []) {
        const id = p.user_id as string;
        if (vistos.has(id)) continue;
        vistos.add(id);
        lista.push({ id, nome: p.nome_completo });
      }
      return { tarefas, projetos: projetos.data ?? [], pessoas: lista };
    },
  });

  const tarefas = useMemo(() => consulta.data?.tarefas ?? [], [consulta.data]);
  const projetos = useMemo(() => consulta.data?.projetos ?? [], [consulta.data]);
  const pessoas = useMemo(() => consulta.data?.pessoas ?? [], [consulta.data]);
  const tituloProjeto = useMemo(() => new Map(projetos.map((p) => [p.id, p.titulo])), [projetos]);

  const salvar = useMutation({
    mutationFn: async (form: Formulario) => {
      const responsavel = pessoas.find((p) => p.id === form.responsavel_id);
      const registro = {
        projeto_id: form.projeto_id,
        fase: form.fase,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        status: form.status,
        prioridade: form.prioridade,
        responsavel_id: form.responsavel_id || null,
        responsavel_nome: responsavel?.nome ?? null,
        inicio: form.inicio || null,
        fim: form.fim || null,
      };

      if (editando) {
        const { error } = await supabase
          .from("projeto_tarefas")
          .update(registro)
          .eq("id", editando.id);
        if (error) throw error;
        await registrarAuditoria({
          acao: "editou",
          entidade: "tarefa",
          entidadeId: editando.id,
          detalhe: registro.titulo,
        });
        return;
      }

      const { data, error } = await supabase
        .from("projeto_tarefas")
        .insert(registro)
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria({
        acao: "criou",
        entidade: "tarefa",
        entidadeId: data.id,
        detalhe: registro.titulo,
      });
    },
    onSuccess: async () => {
      setAberto(false);
      setEditando(null);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["projeto-tarefas"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ tarefa, status }: { tarefa: Tarefa; status: StatusTarefa }) => {
      const { error } = await supabase
        .from("projeto_tarefas")
        .update({ status })
        .eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["projeto-tarefas"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const excluir = useMutation({
    mutationFn: async (tarefa: Tarefa) => {
      const { error } = await supabase.from("projeto_tarefas").delete().eq("id", tarefa.id);
      if (error) throw error;
      await registrarAuditoria({
        acao: "excluiu",
        entidade: "tarefa",
        entidadeId: tarefa.id,
        detalhe: tarefa.titulo,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projeto-tarefas"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = tarefas.filter((t) => {
      if (filtroStatus.size > 0 && !filtroStatus.has(t.status)) return false;
      if (filtroPrioridade.size > 0 && !filtroPrioridade.has(t.prioridade)) return false;
      if (filtroProjeto.size > 0 && !filtroProjeto.has(t.projeto_id)) return false;
      if (soMinhas && t.responsavel_id !== userId) return false;
      if (!termo) return true;
      return [
        t.titulo,
        t.fase,
        t.responsavel_nome ?? "",
        tituloProjeto.get(t.projeto_id) ?? "",
      ].some((v) => v.toLowerCase().includes(termo));
    });

    const sinal = direcao === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (ordem === "numero") return (a.numero - b.numero) * sinal;
      const campo = (t: Tarefa) =>
        ordem === "titulo" ? t.titulo : ordem === "prazo" ? (t.fim ?? "9999") : t.status;
      return campo(a).localeCompare(campo(b), "pt-BR") * sinal;
    });
  }, [
    tarefas,
    busca,
    filtroStatus,
    filtroPrioridade,
    filtroProjeto,
    soMinhas,
    userId,
    ordem,
    direcao,
    tituloProjeto,
  ]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtradas.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>();
    for (const t of daPagina) {
      const chave = tituloProjeto.get(t.projeto_id) ?? "Sem projeto";
      mapa.set(chave, [...(mapa.get(chave) ?? []), t]);
    }
    return [...mapa];
  }, [daPagina, tituloProjeto]);

  const colSpan = 2 + colunas.size;

  const ordenar = (chave: OrdemKey) => {
    if (chave === ordem) setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrdem(chave);
      setDirecao("asc");
    }
  };

  const abrirEdicao = (t: Tarefa) => {
    setEditando(t);
    setErro("");
    setAberto(true);
  };

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Tarefas" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Tarefas" />
        <SemPermissao mensagem="Sua conta não tem acesso aos projetos do ministério." />
      </>
    );
  }

  const linha = (t: Tarefa) => {
    const status = STATUS_TAREFA[t.status];
    const meu = t.responsavel_id === userId;
    return (
      <TableRow key={t.id} className="border-jt-line hover:bg-jt-panel-2">
        <TableCell className="num whitespace-nowrap text-jt-muted">
          TAR-{String(t.numero).padStart(4, "0")}
        </TableCell>

        <TableCell>
          <button
            type="button"
            onClick={() => (podeGerenciar || meu ? abrirEdicao(t) : undefined)}
            className={cn(
              "text-left text-sm font-medium text-jt-text",
              (podeGerenciar || meu) && "hover:underline",
            )}
          >
            {t.titulo}
          </button>
        </TableCell>

        {colunas.has("projeto") ? (
          <TableCell className="whitespace-nowrap text-jt-muted">
            {tituloProjeto.get(t.projeto_id) ?? "—"}
          </TableCell>
        ) : null}

        {colunas.has("fase") ? (
          <TableCell>
            <Badge variant="outline" className="border-jt-line font-normal text-jt-muted">
              {t.fase}
            </Badge>
          </TableCell>
        ) : null}

        {colunas.has("responsavel") ? (
          <TableCell>
            {t.responsavel_nome ? (
              <div className="flex items-center gap-2">
                <AvatarIniciais texto={iniciais(t.responsavel_nome)} tamanho="sm" />
                <span className="truncate text-sm text-jt-text">{t.responsavel_nome}</span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm text-jt-muted">
                <UserRound className="h-3.5 w-3.5" aria-hidden /> sem responsável
              </span>
            )}
          </TableCell>
        ) : null}

        {colunas.has("prazo") ? (
          <TableCell className="num whitespace-nowrap text-jt-muted">
            {t.fim ? dataParaBR(t.fim) : "—"}
          </TableCell>
        ) : null}

        {colunas.has("status") ? (
          <TableCell>
            <Badge className={cn("gap-1.5 border-transparent font-normal", status.classe)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", status.ponto)} />
              {status.rotulo}
            </Badge>
          </TableCell>
        ) : null}

        {colunas.has("prioridade") ? (
          <TableCell>
            <SetaPrioridade prioridade={t.prioridade} />
          </TableCell>
        ) : null}

        <TableCell>
          {podeGerenciar || meu ? (
            <div className="flex items-center gap-1">
              <div className="w-36">
                <SelectCampo
                  className="h-8 text-xs"
                  opcoes={(
                    ["backlog", "a_fazer", "em_andamento", "concluida", "cancelada"] as const
                  ).map((s) => ({ valor: s, rotulo: STATUS_TAREFA[s].rotulo }))}
                  valor={t.status}
                  onValueChange={(v) =>
                    mudarStatus.mutate({ tarefa: t, status: v as StatusTarefa })
                  }
                />
              </div>
              {podeGerenciar ? (
                <button
                  type="button"
                  aria-label={`Excluir ${t.titulo}`}
                  onClick={() => excluir.mutate(t)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : (
            <span className="text-jt-muted">—</span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <>
      <PageHeader
        titulo="Tarefas"
        descricao="O que cada projeto precisa para sair do papel, por fase e responsável."
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {filtradas.length} de {tarefas.length}
          </Badge>
        }
      />

      {erro ? <p className="mb-3 text-xs text-jt-coral">{erro}</p> : null}

      <TableShell>
        <TableToolbar>
          <TableSearch
            valor={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Filtrar tarefas…"
          />

          <TableToolbarActions>
            <button
              type="button"
              onClick={() => {
                setSoMinhas((s) => !s);
                setPagina(1);
              }}
              aria-pressed={soMinhas}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium transition",
                soMinhas
                  ? "border-jt-gold/50 text-jt-gold"
                  : "border-jt-line text-jt-muted hover:text-jt-text",
              )}
            >
              Minhas tarefas
            </button>

            <FilterMenu contador={filtroStatus.size + filtroPrioridade.size + filtroProjeto.size}>
              <DropdownMenuLabel>Situação</DropdownMenuLabel>
              {(["backlog", "a_fazer", "em_andamento", "concluida", "cancelada"] as const).map(
                (s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={filtroStatus.has(s)}
                    onCheckedChange={(marcado) => {
                      setPagina(1);
                      setFiltroStatus((atual) => alternarNoSet(atual, s, marcado === true));
                    }}
                  >
                    {STATUS_TAREFA[s].rotulo}
                  </DropdownMenuCheckboxItem>
                ),
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Prioridade</DropdownMenuLabel>
              {(["alta", "media", "baixa"] as const).map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={filtroPrioridade.has(p)}
                  onCheckedChange={(marcado) => {
                    setPagina(1);
                    setFiltroPrioridade((atual) => alternarNoSet(atual, p, marcado === true));
                  }}
                >
                  {PRIORIDADE_TAREFA[p].rotulo}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Projeto</DropdownMenuLabel>
              {projetos.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={filtroProjeto.has(p.id)}
                  onCheckedChange={(marcado) => {
                    setPagina(1);
                    setFiltroProjeto((atual) => alternarNoSet(atual, p.id, marcado === true));
                  }}
                >
                  {p.titulo}
                </DropdownMenuCheckboxItem>
              ))}
            </FilterMenu>

            <ColumnsMenu
              colunas={COLUNAS_TABELA}
              visiveis={colunas}
              onToggle={(chave, marcada) =>
                setColunas((atual) => alternarNoSet(atual, chave, marcada))
              }
            />

            <GroupToggleButton
              agrupado={agrupado}
              rotulo="Agrupar por projeto"
              onToggle={() => setAgrupado((g) => !g)}
            />

            {podeGerenciar ? (
              <PillButton
                className="h-9 rounded-full px-4 text-[13px]"
                disabled={projetos.length === 0}
                onClick={() => {
                  setEditando(null);
                  setErro("");
                  setAberto(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden /> Nova tarefa
              </PillButton>
            ) : null}
          </TableToolbarActions>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <SortableHead
                  rotulo="Tarefa"
                  chave="numero"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                <SortableHead
                  rotulo="Título"
                  chave="titulo"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                {colunas.has("projeto") ? (
                  <TableHead className="text-jt-muted">Projeto</TableHead>
                ) : null}
                {colunas.has("fase") ? <TableHead className="text-jt-muted">Fase</TableHead> : null}
                {colunas.has("responsavel") ? (
                  <TableHead className="text-jt-muted">Responsável</TableHead>
                ) : null}
                {colunas.has("prazo") ? (
                  <SortableHead
                    rotulo="Prazo"
                    chave="prazo"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("status") ? (
                  <SortableHead
                    rotulo="Situação"
                    chave="status"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("prioridade") ? (
                  <TableHead className="text-jt-muted">Prioridade</TableHead>
                ) : null}
                <TableHead className="text-jt-muted">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {consulta.isLoading ? (
                <EmptyRow colSpan={colSpan}>Carregando…</EmptyRow>
              ) : consulta.isError ? (
                <EmptyRow colSpan={colSpan}>
                  Não foi possível carregar as tarefas. Se a área é nova, pode faltar aplicar a
                  migração no banco.
                </EmptyRow>
              ) : filtradas.length === 0 ? (
                <EmptyRow colSpan={colSpan}>
                  {tarefas.length === 0
                    ? "Nenhuma tarefa ainda. Ao criar um projeto, as fases padrão entram aqui."
                    : "Nenhuma tarefa corresponde aos filtros."}
                </EmptyRow>
              ) : agrupado ? (
                grupos.map(([projeto, doGrupo], i) => (
                  <Fragment key={projeto}>
                    <GroupHeaderRow
                      rotulo={projeto}
                      contagem={doGrupo.length}
                      indice={i}
                      colSpan={colSpan}
                      recolhido={recolhidos.has(projeto)}
                      onToggle={() =>
                        setRecolhidos((atual) => alternarNoSet(atual, projeto, !atual.has(projeto)))
                      }
                    />
                    {recolhidos.has(projeto) ? null : doGrupo.map(linha)}
                  </Fragment>
                ))
              ) : (
                daPagina.map(linha)
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          total={filtradas.length}
          tamanhoPagina={tamanhoPagina}
          onPagina={(atualizar) => setPagina((p) => atualizar(Math.min(p, totalPaginas)))}
          onTamanhoPagina={(n) => {
            setTamanhoPagina(n);
            setPagina(1);
          }}
          unidade="tarefas"
        />
      </TableShell>

      <TarefaDialog
        aberto={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          if (!v) setEditando(null);
        }}
        editando={editando}
        projetos={projetos}
        pessoas={pessoas}
        onSalvar={(form) => salvar.mutate(form)}
        salvando={salvar.isPending}
        erro={erro}
      />
    </>
  );
}
