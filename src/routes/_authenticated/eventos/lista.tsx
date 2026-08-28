import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, CalendarPlus, Pencil, Receipt, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Field, PillButton, TextInput } from "@/components/cadastro/ui";
import { DataCampo, HORARIOS_DIA, SelectCampo } from "@/components/crm/campos";
import { Comprovante, type DadosComprovante } from "@/components/crm/comprovante";
import { AvatarIniciais, PageHeader } from "@/components/crm/pagina";
import {
  EmptyRow,
  FilterMenu,
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
import { DropdownMenuCheckboxItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
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
import { hojeISO, iniciais } from "@/lib/ebd";
import {
  CATEGORIAS_EVENTO,
  carregarEventos,
  LOCAIS_EVENTO,
  PAGAMENTO,
  STATUS_EVENTO,
  taxaFormatada,
  vagasRestantes,
  type Evento,
  type Inscricao,
  type StatusEvento,
} from "@/lib/eventos";
import { dataParaBR, hora, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/eventos/lista")({
  head: () => ({
    meta: [
      { title: "Eventos — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Todos os eventos do ministério e seus inscritos." },
      { property: "og:title", content: "Eventos — AD CRM" },
      { property: "og:description", content: "Todos os eventos do ministério e seus inscritos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EventosLista,
});

const FORM_VAZIO = {
  titulo: "",
  descricao: "",
  categoria: "Encontro",
  data: "",
  hora_inicio: "",
  hora_fim: "",
  congregacao_id: "",
  local: "",
  temTaxa: false,
  taxa: "",
  vagas: "",
  status: "aberto" as StatusEvento,
};
type Formulario = typeof FORM_VAZIO;

type OrdemKey = "data" | "titulo" | "local" | "inscritos";

function EventoDialog({
  aberto,
  onOpenChange,
  editando,
  congregacoes,
  onSalvar,
  salvando,
  erro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: Evento | null;
  congregacoes: { id: string; nome: string }[];
  onSalvar: (form: Formulario) => void;
  salvando: boolean;
  erro: string;
}) {
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [chaveAtual, setChaveAtual] = useState<string | null>(null);

  const chave = aberto ? (editando?.id ?? "novo") : null;
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setErros({});
    setForm(
      editando
        ? {
            titulo: editando.titulo,
            descricao: editando.descricao ?? "",
            categoria: editando.categoria,
            data: editando.data,
            hora_inicio: editando.hora_inicio.slice(0, 5),
            hora_fim: editando.hora_fim.slice(0, 5),
            congregacao_id: editando.congregacao_id ?? "",
            local: editando.local,
            temTaxa: editando.taxa != null,
            taxa: editando.taxa != null ? String(editando.taxa).replace(".", ",") : "",
            vagas: editando.vagas != null ? String(editando.vagas) : "",
            status: editando.status,
          }
        : FORM_VAZIO,
    );
  }

  const campo = <K extends keyof Formulario>(nome: K, valor: Formulario[K]) => {
    setForm((atual) => ({ ...atual, [nome]: valor }));
    setErros((atual) => ({ ...atual, [nome]: "" }));
  };

  function enviar() {
    const novos: Record<string, string> = {};
    if (!form.titulo.trim()) novos["titulo"] = "Campo obrigatório.";
    if (!form.data) novos["data"] = "Escolha a data.";
    if (!form.hora_inicio) novos["hora_inicio"] = "Escolha o início.";
    if (!form.hora_fim) novos["hora_fim"] = "Escolha o término.";
    if (form.hora_inicio && form.hora_fim && form.hora_fim <= form.hora_inicio) {
      novos["hora_fim"] = "O término precisa ser depois do início.";
    }
    if (!form.local) novos["local"] = "Escolha o local.";
    if (form.temTaxa && !form.taxa.trim()) novos["taxa"] = "Informe o valor ou marque como grátis.";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    onSalvar(form);
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-jt-line bg-jt-panel text-jt-text sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <CalendarPlus className="h-5 w-5 text-jt-gold" aria-hidden />
            {editando ? "Editar evento" : "Novo evento"}
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            O evento aparece no painel de todo mundo que tem acesso e recebe reservas até acabarem
            as vagas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1">
          <Field label="Nome do evento" obrigatorio erro={erros["titulo"] ?? ""}>
            <TextInput
              value={form.titulo}
              onValueChange={(v) => campo("titulo", v)}
              placeholder="Ex.: Encontro de jovens"
            />
          </Field>

          <Field label="Descrição" dica="Opcional — aparece no cartão do evento.">
            <textarea
              value={form.descricao}
              onChange={(e) => campo("descricao", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-jt-line bg-jt-panel p-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
              placeholder="O que vai acontecer?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" obrigatorio erro={erros["data"] ?? ""}>
              <DataCampo
                valor={form.data}
                onValueChange={(v) => campo("data", v)}
                placeholder="Escolha a data"
              />
            </Field>
            <Field label="Categoria">
              <SelectCampo
                opcoes={CATEGORIAS_EVENTO.map((c) => ({ valor: c, rotulo: c }))}
                valor={form.categoria}
                onValueChange={(v) => campo("categoria", v)}
              />
            </Field>
            <Field label="Horário de início" obrigatorio erro={erros["hora_inicio"] ?? ""}>
              <SelectCampo
                opcoes={HORARIOS_DIA.map((h) => ({ valor: h, rotulo: h }))}
                valor={form.hora_inicio}
                onValueChange={(v) => campo("hora_inicio", v)}
                placeholder="Selecione"
              />
            </Field>
            <Field label="Horário de término" obrigatorio erro={erros["hora_fim"] ?? ""}>
              <SelectCampo
                opcoes={HORARIOS_DIA.map((h) => ({ valor: h, rotulo: h }))}
                valor={form.hora_fim}
                onValueChange={(v) => campo("hora_fim", v)}
                placeholder="Selecione"
              />
            </Field>
            <Field label="Congregação" dica="Deixe vazio para abrir a todas.">
              <SelectCampo
                opcoes={congregacoes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
                valor={form.congregacao_id}
                onValueChange={(v) => campo("congregacao_id", v)}
                placeholder="Todas as congregações"
              />
            </Field>
            <Field label="Local do evento" obrigatorio erro={erros["local"] ?? ""}>
              <SelectCampo
                opcoes={LOCAIS_EVENTO.map((l) => ({ valor: l, rotulo: l }))}
                valor={form.local}
                onValueChange={(v) => campo("local", v)}
                placeholder="Selecione"
              />
            </Field>
          </div>

          <div className="rounded-xl border border-jt-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-jt-text">Taxa de inscrição</span>
              <div className="inline-flex rounded-full border border-jt-line bg-jt-panel-2 p-1">
                {[
                  { valor: false, rotulo: "Não é atribuído" },
                  { valor: true, rotulo: "Tem taxa" },
                ].map((opcao) => (
                  <button
                    key={String(opcao.valor)}
                    type="button"
                    onClick={() => campo("temTaxa", opcao.valor)}
                    aria-pressed={form.temTaxa === opcao.valor}
                    className={cn(
                      "min-h-8 rounded-full px-4 text-xs font-medium transition",
                      form.temTaxa === opcao.valor
                        ? "bg-jt-blue text-white"
                        : "text-jt-muted hover:text-jt-text",
                    )}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>
            </div>

            {form.temTaxa ? (
              <div className="mt-3">
                <Field label="Valor por pessoa" erro={erros["taxa"] ?? ""}>
                  <TextInput
                    inputMode="decimal"
                    value={form.taxa}
                    onValueChange={(v) => campo("taxa", v.replace(/[^\d,.]/g, ""))}
                    placeholder="Ex.: 25,00"
                  />
                </Field>
              </div>
            ) : (
              <p className="mt-2 text-xs text-jt-muted">
                O cartão mostra “Sem taxa de inscrição” e ninguém precisa pagar para reservar.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vagas" dica="Deixe vazio para não limitar.">
              <TextInput
                inputMode="numeric"
                value={form.vagas}
                onValueChange={(v) => campo("vagas", v.replace(/\D/g, ""))}
                placeholder="Ex.: 80"
              />
            </Field>
            <Field label="Situação">
              <SelectCampo
                opcoes={(["aberto", "encerrado", "cancelado"] as const).map((s) => ({
                  valor: s,
                  rotulo: STATUS_EVENTO[s].rotulo,
                }))}
                valor={form.status}
                onValueChange={(v) => campo("status", v as StatusEvento)}
              />
            </Field>
          </div>

          {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </PillButton>
          <PillButton onClick={enviar} disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar evento"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InscritosDialog({
  evento,
  podeGerenciar,
  onFechar,
}: {
  evento: Evento | null;
  podeGerenciar: boolean;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [comprovante, setComprovante] = useState<DadosComprovante | null>(null);
  const [recemConfirmado, setRecemConfirmado] = useState(false);
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["evento-inscritos", evento?.id],
    enabled: evento !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evento_inscricoes")
        .select("*")
        .eq("evento_id", evento!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Inscricao[];
    },
  });

  const confirmar = useMutation({
    mutationFn: async ({
      inscricao,
      confirmando,
    }: {
      inscricao: Inscricao;
      confirmando: boolean;
    }) => {
      const { data: sessao } = await supabase.auth.getSession();
      const user = sessao.session?.user;
      const registro = confirmando
        ? {
            pagamento: "confirmado",
            confirmado_em: new Date().toISOString(),
            confirmado_por: user?.id ?? null,
            confirmado_por_nome:
              (user?.user_metadata?.["nome"] as string | undefined) ?? user?.email ?? null,
          }
        : {
            pagamento: evento?.taxa ? "pendente" : "isento",
            confirmado_em: null,
            confirmado_por: null,
            confirmado_por_nome: null,
          };

      const { error } = await supabase
        .from("evento_inscricoes")
        .update(registro as never)
        .eq("id", inscricao.id);
      if (error) throw error;

      await registrarAuditoria({
        acao: confirmando ? "confirmou presença" : "reabriu inscrição",
        entidade: "evento",
        entidadeId: evento?.id ?? null,
        detalhe: inscricao.nome + (evento ? " · " + evento.titulo : ""),
      });
      return { inscricao, confirmando };
    },
    onSuccess: async ({ inscricao, confirmando }) => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["evento-inscritos", evento?.id] });
      await queryClient.invalidateQueries({ queryKey: ["eventos"] });
      if (confirmando && evento) {
        setRecemConfirmado(true);
        setComprovante({
          codigo: inscricao.codigo ?? "—",
          participante: inscricao.nome,
          email: inscricao.email,
          evento: evento.titulo,
          data: evento.data,
          horaInicio: evento.hora_inicio,
          local: evento.local,
          taxa: evento.taxa,
          confirmadoEm: new Date().toISOString(),
          confirmadoPor: null,
        });
      }
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const lista = (consulta.data ?? []).filter((i) => i.status === "confirmada");
  const confirmados = lista.filter((i) => i.pagamento === "confirmado").length;
  const pendentes = lista.filter((i) => i.pagamento === "pendente").length;

  return (
    <>
      <Dialog open={evento !== null} onOpenChange={(v) => (!v ? onFechar() : undefined)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Users className="h-5 w-5 text-jt-gold" aria-hidden />
              Inscritos
            </DialogTitle>
            <DialogDescription className="text-jt-muted">
              {evento ? evento.titulo + " · " + dataParaBR(evento.data) : ""}
              {evento?.taxa
                ? " · taxa de " + taxaFormatada(evento.taxa) + " paga por PIX"
                : " · evento sem taxa"}
            </DialogDescription>
          </DialogHeader>

          {lista.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="border-transparent bg-green-50 font-normal text-green-700 dark:bg-green-950/50 dark:text-green-300">
                {confirmados} com presença confirmada
              </Badge>
              {pendentes > 0 ? (
                <Badge className="border-transparent bg-amber-50 font-normal text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  {pendentes} aguardando confirmação
                </Badge>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-1">
            {consulta.isLoading ? (
              <p className="py-8 text-center text-sm text-jt-muted">Carregando…</p>
            ) : lista.length === 0 ? (
              <p className="py-8 text-center text-sm text-jt-muted">
                Ninguém reservou vaga ainda neste evento.
              </p>
            ) : (
              lista.map((i) => {
                const estado = PAGAMENTO[i.pagamento] ?? PAGAMENTO.pendente;
                const confirmado = i.pagamento === "confirmado";
                return (
                  <div key={i.id} className="rounded-xl border border-jt-line px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <AvatarIniciais texto={iniciais(i.nome)} tamanho="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-jt-text">{i.nome}</p>
                        <p className="truncate text-xs text-jt-muted">{i.email}</p>
                      </div>
                      <Badge
                        className={cn("shrink-0 border-transparent font-normal", estado.classe)}
                      >
                        {i.pagamento === "isento" && !confirmado ? "Inscrito" : estado.rotulo}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="num text-[11px] text-jt-muted">
                        reservou em {dataParaBR(i.created_at.slice(0, 10))}
                      </span>
                      {podeGerenciar ? (
                        confirmado ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setComprovante({
                                  codigo: i.codigo ?? "—",
                                  participante: i.nome,
                                  email: i.email,
                                  evento: evento?.titulo ?? "",
                                  data: evento?.data ?? "",
                                  horaInicio: evento?.hora_inicio ?? "",
                                  local: evento?.local ?? "",
                                  taxa: evento?.taxa ?? null,
                                  confirmadoEm: i.confirmado_em,
                                  confirmadoPor: i.confirmado_por_nome,
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-jt-blue underline-offset-2 hover:underline"
                            >
                              <Receipt className="h-3.5 w-3.5" aria-hidden /> comprovante
                            </button>
                            <button
                              type="button"
                              disabled={confirmar.isPending}
                              onClick={() => confirmar.mutate({ inscricao: i, confirmando: false })}
                              className="text-xs text-jt-muted underline-offset-2 transition hover:text-jt-coral hover:underline disabled:opacity-40"
                            >
                              desfazer
                            </button>
                          </>
                        ) : (
                          <PillButton
                            className="ml-auto h-8 rounded-full px-3 text-xs"
                            disabled={confirmar.isPending}
                            onClick={() => confirmar.mutate({ inscricao: i, confirmando: true })}
                          >
                            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                            {evento?.taxa ? "Confirmar pagamento" : "Confirmar presença"}
                          </PillButton>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}

          <DialogFooter>
            <PillButton variante="ghost" onClick={onFechar}>
              Fechar
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={comprovante !== null}
        onOpenChange={(v) => {
          if (!v) {
            setComprovante(null);
            setRecemConfirmado(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-none bg-transparent p-0 shadow-none sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Comprovante de inscrição</DialogTitle>
            <DialogDescription>Extrato da presença confirmada.</DialogDescription>
          </DialogHeader>
          {comprovante ? <Comprovante dados={comprovante} comemorar={recemConfirmado} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EventosLista() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "eventos" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "eventos_gerenciar" }, acesso);

  const [userId, setUserId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<Set<StatusEvento>>(new Set());
  const [ordem, setOrdem] = useState<OrdemKey>("data");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(10);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [inscritosDe, setInscritosDe] = useState<Evento | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const consulta = useQuery({
    queryKey: ["eventos", userId],
    enabled: pode,
    queryFn: () => carregarEventos(userId),
  });

  const congregacoesConsulta = useQuery({
    queryKey: ["congregacoes-ativas"],
    enabled: pode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("congregacoes")
        .select("id, nome")
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const eventos = useMemo(() => consulta.data ?? [], [consulta.data]);

  const salvar = useMutation({
    mutationFn: async (form: Formulario) => {
      const registro = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria,
        data: form.data,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
        congregacao_id: form.congregacao_id || null,
        local: form.local,
        taxa: form.temTaxa ? Number(form.taxa.replace(/\./g, "").replace(",", ".")) : null,
        vagas: form.vagas ? Number(form.vagas) : null,
        status: form.status,
      };

      if (editando) {
        const { error } = await supabase.from("eventos").update(registro).eq("id", editando.id);
        if (error) throw error;
        await registrarAuditoria({
          acao: "editou",
          entidade: "evento",
          entidadeId: editando.id,
          detalhe: registro.titulo,
        });
        return;
      }

      const { data, error } = await supabase.from("eventos").insert(registro).select("id").single();
      if (error) throw error;
      await registrarAuditoria({
        acao: "criou",
        entidade: "evento",
        entidadeId: data.id,
        detalhe: registro.titulo,
      });
    },
    onSuccess: async () => {
      setAberto(false);
      setEditando(null);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const excluir = useMutation({
    mutationFn: async (evento: Evento) => {
      const { error } = await supabase.from("eventos").delete().eq("id", evento.id);
      if (error) throw error;
      await registrarAuditoria({
        acao: "excluiu",
        entidade: "evento",
        entidadeId: evento.id,
        detalhe: evento.titulo,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = eventos.filter((e) => {
      if (filtroStatus.size > 0 && !filtroStatus.has(e.status)) return false;
      if (!termo) return true;
      return [e.titulo, e.local, e.categoria, e.congregacao].some((v) =>
        v.toLowerCase().includes(termo),
      );
    });
    const sinal = direcao === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (ordem === "inscritos") return (a.inscritos - b.inscritos) * sinal;
      const campo = (e: Evento) =>
        ordem === "data" ? e.data : ordem === "titulo" ? e.titulo : e.local;
      return campo(a).localeCompare(campo(b), "pt-BR") * sinal;
    });
  }, [eventos, busca, filtroStatus, ordem, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtrados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);
  const hoje = hojeISO();

  const ordenar = (chave: OrdemKey) => {
    if (chave === ordem) setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrdem(chave);
      setDirecao("asc");
    }
  };

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Eventos" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Eventos" />
        <SemPermissao mensagem="Sua conta não tem acesso aos eventos do ministério." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Eventos"
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {filtrados.length} de {eventos.length}
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
            placeholder="Buscar por nome, local, categoria…"
          />
          <TableToolbarActions>
            <FilterMenu contador={filtroStatus.size} largura="w-56">
              <DropdownMenuLabel>Situação</DropdownMenuLabel>
              {(["aberto", "encerrado", "cancelado"] as const).map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={filtroStatus.has(s)}
                  onCheckedChange={(marcado) => {
                    setPagina(1);
                    setFiltroStatus((atual) => {
                      const proximo = new Set(atual);
                      if (marcado) proximo.add(s);
                      else proximo.delete(s);
                      return proximo;
                    });
                  }}
                >
                  {STATUS_EVENTO[s].rotulo}
                </DropdownMenuCheckboxItem>
              ))}
            </FilterMenu>

            {podeGerenciar ? (
              <PillButton
                className="h-9 rounded-full px-4 text-[13px]"
                onClick={() => {
                  setEditando(null);
                  setErro("");
                  setAberto(true);
                }}
              >
                <CalendarPlus className="h-4 w-4" aria-hidden /> Novo evento
              </PillButton>
            ) : null}
          </TableToolbarActions>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <SortableHead
                  rotulo="Evento"
                  chave="titulo"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                <SortableHead
                  rotulo="Data"
                  chave="data"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                <TableHead className="text-jt-muted">Horário</TableHead>
                <SortableHead
                  rotulo="Local"
                  chave="local"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                <TableHead className="text-jt-muted">Taxa</TableHead>
                <SortableHead
                  rotulo="Inscritos"
                  chave="inscritos"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                <TableHead className="text-jt-muted">Situação</TableHead>
                <TableHead className="text-jt-muted">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consulta.isLoading ? (
                <EmptyRow colSpan={8}>Carregando…</EmptyRow>
              ) : consulta.isError ? (
                <EmptyRow colSpan={8}>
                  Não foi possível carregar os eventos. Se a área é nova, pode faltar aplicar a
                  migração no banco.
                </EmptyRow>
              ) : daPagina.length === 0 ? (
                <EmptyRow colSpan={8}>Nenhum evento corresponde aos filtros.</EmptyRow>
              ) : (
                daPagina.map((e) => {
                  const restantes = vagasRestantes(e);
                  const status = STATUS_EVENTO[e.status];
                  return (
                    <TableRow key={e.id} className="border-jt-line hover:bg-jt-panel-2">
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-jt-text">{e.titulo}</p>
                          <p className="truncate text-xs text-jt-muted">
                            {e.categoria} · {e.congregacao}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "num whitespace-nowrap",
                          e.data < hoje ? "text-jt-muted" : "text-jt-text",
                        )}
                      >
                        {dataParaBR(e.data)}
                      </TableCell>
                      <TableCell className="num whitespace-nowrap text-jt-muted">
                        {hora(e.hora_inicio)}–{hora(e.hora_fim)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-jt-muted">{e.local}</TableCell>
                      <TableCell className="num whitespace-nowrap text-jt-muted">
                        {taxaFormatada(e.taxa)}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setInscritosDe(e)}
                          className="num inline-flex items-center gap-1.5 rounded-full border border-jt-line px-2.5 py-1 text-xs font-medium text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
                        >
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          {e.inscritos}
                          {restantes != null ? (
                            <span className="text-jt-muted">/ {e.vagas}</span>
                          ) : null}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border-transparent font-normal", status.classe)}>
                          {status.rotulo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!podeGerenciar ? (
                          <span className="text-jt-muted">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Editar ${e.titulo}`}
                              onClick={() => {
                                setEditando(e);
                                setErro("");
                                setAberto(true);
                              }}
                              className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              aria-label={`Excluir ${e.titulo}`}
                              onClick={() => excluir.mutate(e)}
                              className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          total={filtrados.length}
          tamanhoPagina={tamanhoPagina}
          onPagina={(atualizar) => setPagina((p) => atualizar(Math.min(p, totalPaginas)))}
          onTamanhoPagina={(n) => {
            setTamanhoPagina(n);
            setPagina(1);
          }}
          unidade="eventos"
        />
      </TableShell>

      <EventoDialog
        aberto={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          if (!v) setEditando(null);
        }}
        editando={editando}
        congregacoes={congregacoesConsulta.data ?? []}
        onSalvar={(form) => salvar.mutate(form)}
        salvando={salvar.isPending}
        erro={erro}
      />

      <InscritosDialog
        evento={inscritosDe}
        podeGerenciar={podeGerenciar}
        onFechar={() => setInscritosDe(null)}
      />
    </>
  );
}
