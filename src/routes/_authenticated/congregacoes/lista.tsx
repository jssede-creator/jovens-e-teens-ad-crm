import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Church, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { Field, PillButton, SelectInput, TextInput } from "@/components/cadastro/ui";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { iniciais, UFS } from "@/lib/ebd";
import { mascaraCEP, mensagemErro, semMascara } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/congregacoes/lista")({
  head: () => ({
    meta: [
      { title: "Lista de congregações — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Todas as congregações cadastradas." },
      { property: "og:title", content: "Lista de congregações — AD CRM" },
      { property: "og:description", content: "Todas as congregações cadastradas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CongregacoesLista,
});

type Status = "ativa" | "inativa";

type Membro = { id: string; nome_completo: string; telefone: string; email: string };

type Congregacao = {
  id: string;
  nome: string;
  status: Status;
  endereco: string;
  numero: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  membros: Membro[];
};

type ColunaKey = "membros" | "status" | "endereco" | "bairro" | "cidade" | "estado" | "cep";

const COLUNAS_TABELA = [
  { chave: "membros", rotulo: "Membros" },
  { chave: "status", rotulo: "Status" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "bairro", rotulo: "Bairro" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "estado", rotulo: "Estado" },
  { chave: "cep", rotulo: "CEP" },
] as const satisfies readonly { chave: ColunaKey; rotulo: string }[];

type OrdemKey = "nome" | "membros" | "cidade" | "estado";

const FORM_VAZIO = {
  nome: "",
  status: "ativa" as Status,
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
};

type Formulario = typeof FORM_VAZIO;

function alternarNoSet<T>(conjunto: Set<T>, valor: T, marcado: boolean) {
  const proximo = new Set(conjunto);
  if (marcado) proximo.add(valor);
  else proximo.delete(valor);
  return proximo;
}

/** Pastilha com pontinho de 6px. Verde para ativa, vermelho para inativa. */
function StatusBadge({ status }: { status: Status }) {
  const ativa = status === "ativa";
  return (
    <Badge
      className={cn(
        "gap-1.5 border-transparent font-normal",
        ativa
          ? "bg-green-50 text-green-700 hover:bg-green-50 dark:bg-green-950/50 dark:text-green-300 dark:hover:bg-green-950/50"
          : "bg-red-50 text-red-700 hover:bg-red-50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/50",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ativa ? "bg-green-600" : "bg-red-600")} />
      {ativa ? "Ativa" : "Inativa"}
    </Badge>
  );
}

/** Pílula com a contagem que abre o popover dos vinculados. Zero vira travessão. */
function MembrosCell({ nome, membros }: { nome: string; membros: Membro[] }) {
  if (membros.length === 0) return <span className="text-jt-muted">—</span>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="num inline-flex items-center gap-1.5 rounded-full border border-jt-line px-2.5 py-1 text-xs font-medium text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          {membros.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 border-jt-line bg-jt-panel p-0">
        <div className="border-b border-jt-line px-4 py-3">
          <p className="text-xs text-jt-muted">Membros</p>
          <p className="font-display text-sm font-semibold text-jt-text">{nome}</p>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {membros.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-jt-blue text-[10px] font-semibold text-white">
                {iniciais(m.nome_completo)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-jt-text">{m.nome_completo}</p>
                <p className="truncate text-xs text-jt-muted">{m.telefone || m.email || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CongregacaoRow({
  linha,
  colunas,
  podeGerenciar,
  onEditar,
  onExcluir,
}: {
  linha: Congregacao;
  colunas: Set<ColunaKey>;
  podeGerenciar: boolean;
  onEditar: (linha: Congregacao) => void;
  onExcluir: (linha: Congregacao) => void;
}) {
  return (
    <TableRow className="border-jt-line hover:bg-jt-panel-2">
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-jt-blue text-[11px] font-semibold text-white">
            {iniciais(linha.nome)}
          </div>
          <span className="font-medium text-jt-text">{linha.nome}</span>
        </div>
      </TableCell>

      {colunas.has("membros") ? (
        <TableCell>
          <MembrosCell nome={linha.nome} membros={linha.membros} />
        </TableCell>
      ) : null}

      {colunas.has("status") ? (
        <TableCell>
          <StatusBadge status={linha.status} />
        </TableCell>
      ) : null}

      {colunas.has("endereco") ? (
        <TableCell className="whitespace-nowrap text-jt-muted">
          {linha.endereco}
          {linha.numero ? `, ${linha.numero}` : ""}
        </TableCell>
      ) : null}

      {colunas.has("bairro") ? (
        <TableCell className="whitespace-nowrap text-jt-muted">{linha.bairro}</TableCell>
      ) : null}

      {colunas.has("cidade") ? (
        <TableCell className="whitespace-nowrap text-jt-muted">{linha.cidade}</TableCell>
      ) : null}

      {colunas.has("estado") ? (
        <TableCell>
          <Badge variant="outline" className="border-jt-line font-normal text-jt-text">
            {linha.estado}
          </Badge>
        </TableCell>
      ) : null}

      {colunas.has("cep") ? (
        <TableCell className="num whitespace-nowrap text-jt-muted">{linha.cep}</TableCell>
      ) : null}

      <TableCell>
        {!podeGerenciar ? (
          <span className="text-jt-muted">—</span>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Editar ${linha.nome}`}
              onClick={() => onEditar(linha)}
              className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Excluir ${linha.nome}`}
              onClick={() => onExcluir(linha)}
              className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function CongregacaoDialog({
  aberto,
  onOpenChange,
  editando,
  onSalvar,
  salvando,
  erro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: Congregacao | null;
  onSalvar: (form: Formulario) => void;
  salvando: boolean;
  erro: string;
}) {
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});

  // Recarrega o formulário sempre que o diálogo abre (novo ou edição).
  const [chaveAtual, setChaveAtual] = useState<string | null>(null);
  const chave = aberto ? (editando?.id ?? "novo") : null;
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setErrosCampo({});
    setForm(
      editando
        ? {
            nome: editando.nome,
            status: editando.status,
            endereco: editando.endereco,
            numero: editando.numero ?? "",
            bairro: editando.bairro,
            cidade: editando.cidade,
            estado: editando.estado,
            cep: editando.cep,
          }
        : FORM_VAZIO,
    );
  }

  const campo = <K extends keyof Formulario>(nome: K, valor: Formulario[K]) => {
    setForm((atual) => ({ ...atual, [nome]: valor }));
    setErrosCampo((atual) => ({ ...atual, [nome]: "" }));
  };

  function enviar() {
    const novos: Record<string, string> = {};
    for (const obrigatorio of ["nome", "endereco", "bairro", "cidade", "estado", "cep"] as const) {
      if (!form[obrigatorio].trim()) novos[obrigatorio] = "Campo obrigatório.";
    }
    if (!novos["cep"] && semMascara(form.cep).length < 8) {
      novos["cep"] = "Informe o CEP completo.";
    }
    setErrosCampo(novos);
    if (Object.keys(novos).length > 0) return;
    onSalvar(form);
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Church className="h-5 w-5 text-jt-gold" aria-hidden />
            {editando ? "Editar congregação" : "Nova congregação"}
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            Esses dados ficam visíveis só para administradores; o combobox do cadastro mostra apenas
            o nome.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Nome da congregação" obrigatorio erro={errosCampo["nome"] ?? ""}>
            <TextInput
              placeholder="Ex.: AD Sede"
              value={form.nome}
              onValueChange={(v) => campo("nome", v)}
            />
          </Field>

          <div className="flex items-center justify-between gap-3 border-t border-jt-line pt-4">
            <span className="text-sm text-jt-muted">Status</span>
            <div className="inline-flex rounded-full border border-jt-line bg-jt-panel-2 p-1">
              {(["ativa", "inativa"] as const).map((valor) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={form.status === valor}
                  onClick={() => campo("status", valor)}
                  className={cn(
                    "min-h-9 rounded-full px-5 text-sm font-medium transition",
                    form.status === valor
                      ? "bg-jt-blue text-white"
                      : "text-jt-muted hover:text-jt-text",
                  )}
                >
                  {valor === "ativa" ? "Ativa" : "Inativa"}
                </button>
              ))}
            </div>
          </div>

          <Field label="Endereço" obrigatorio erro={errosCampo["endereco"] ?? ""}>
            <TextInput
              placeholder="Rua"
              value={form.endereco}
              onValueChange={(v) => campo("endereco", v)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Número">
              <TextInput
                inputMode="numeric"
                value={form.numero}
                onValueChange={(v) => campo("numero", v)}
              />
            </Field>
            <Field label="Bairro" obrigatorio erro={errosCampo["bairro"] ?? ""}>
              <TextInput value={form.bairro} onValueChange={(v) => campo("bairro", v)} />
            </Field>
            <Field label="Cidade" obrigatorio erro={errosCampo["cidade"] ?? ""}>
              <TextInput value={form.cidade} onValueChange={(v) => campo("cidade", v)} />
            </Field>
            <Field label="Estado" obrigatorio erro={errosCampo["estado"] ?? ""}>
              <SelectInput
                opcoes={UFS.map((uf) => ({ valor: uf, rotulo: uf }))}
                placeholder="UF"
                value={form.estado}
                onValueChange={(v) => campo("estado", v)}
              />
            </Field>
            <Field label="CEP" obrigatorio erro={errosCampo["cep"] ?? ""}>
              <TextInput
                inputMode="numeric"
                placeholder="00000-000"
                value={form.cep}
                onValueChange={(v) => campo("cep", mascaraCEP(v))}
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
            {editando ? "Salvar alterações" : "Cadastrar congregação"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirDialog({
  alvo,
  onFechar,
  onConfirmar,
  excluindo,
}: {
  alvo: Congregacao | null;
  onFechar: () => void;
  onConfirmar: () => void;
  excluindo: boolean;
}) {
  return (
    <AlertDialog
      open={alvo !== null}
      onOpenChange={(v) => {
        if (!v) onFechar();
      }}
    >
      <AlertDialogContent className="border-jt-line bg-jt-panel text-jt-text">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Excluir esta congregação?</AlertDialogTitle>
          <AlertDialogDescription className="text-jt-muted">
            {alvo ? `"${alvo.nome}" será removida permanentemente.` : ""} Essa ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-jt-line bg-transparent text-jt-text hover:bg-jt-panel-2">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={excluindo}
            onClick={(e) => {
              e.preventDefault();
              onConfirmar();
            }}
            className="bg-jt-coral text-white hover:brightness-110"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CongregacoesLista() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "congregacoes" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "congregacoes_gerenciar" }, acesso);

  const [busca, setBusca] = useState("");
  const [agrupado, setAgrupado] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<Set<Status>>(new Set());
  const [colunas, setColunas] = useState<Set<ColunaKey>>(
    () => new Set(COLUNAS_TABELA.map((c) => c.chave)),
  );
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [ordem, setOrdem] = useState<OrdemKey>("nome");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(10);

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Congregacao | null>(null);
  const [aExcluir, setAExcluir] = useState<Congregacao | null>(null);
  const [erroFormulario, setErroFormulario] = useState("");
  const [erroTabela, setErroTabela] = useState("");

  const consulta = useQuery({
    queryKey: ["congregacoes-lista"],
    enabled: pode,
    queryFn: async (): Promise<Congregacao[]> => {
      const [congregacoes, cadastros] = await Promise.all([
        supabase
          .from("congregacoes")
          .select("id, nome, status, endereco, numero, bairro, cidade, estado, cep")
          .order("nome"),
        supabase
          .from("cadastros")
          .select("id, nome_completo, telefone, email, congregacao_id")
          .order("nome_completo"),
      ]);
      if (congregacoes.error) throw congregacoes.error;
      if (cadastros.error) throw cadastros.error;

      const porCongregacao = new Map<string, Membro[]>();
      for (const c of cadastros.data ?? []) {
        if (!c.congregacao_id) continue;
        const lista = porCongregacao.get(c.congregacao_id) ?? [];
        lista.push({
          id: c.id,
          nome_completo: c.nome_completo,
          telefone: c.telefone,
          email: c.email,
        });
        porCongregacao.set(c.congregacao_id, lista);
      }

      return (congregacoes.data ?? []).map((c) => ({
        ...c,
        status: c.status === "inativa" ? "inativa" : "ativa",
        membros: porCongregacao.get(c.id) ?? [],
      }));
    },
  });

  const todas = useMemo(() => consulta.data ?? [], [consulta.data]);

  const salvar = useMutation({
    mutationFn: async (form: Formulario) => {
      const registro = {
        nome: form.nome.trim(),
        status: form.status,
        endereco: form.endereco.trim(),
        numero: form.numero.trim() || null,
        bairro: form.bairro.trim(),
        cidade: form.cidade.trim(),
        estado: form.estado,
        cep: form.cep,
      };
      if (editando) {
        const { error } = await supabase
          .from("congregacoes")
          .update(registro)
          .eq("id", editando.id);
        if (error) throw error;
        await registrarAuditoria({
          acao: "editou",
          entidade: "congregacao",
          entidadeId: editando.id,
          detalhe: registro.nome,
        });
        return;
      }
      const { data, error } = await supabase
        .from("congregacoes")
        .insert(registro)
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria({
        acao: "criou",
        entidade: "congregacao",
        entidadeId: data.id,
        detalhe: registro.nome,
      });
    },
    onSuccess: async () => {
      setAberto(false);
      setEditando(null);
      setErroFormulario("");
      await queryClient.invalidateQueries({ queryKey: ["congregacoes-lista"] });
      await queryClient.invalidateQueries({ queryKey: ["congregacoes-indicadores"] });
      await queryClient.invalidateQueries({ queryKey: ["congregacoes-ativas"] });
    },
    onError: (erro) => setErroFormulario(mensagemErro(erro)),
  });

  const excluir = useMutation({
    mutationFn: async (linha: Congregacao) => {
      const { error } = await supabase.from("congregacoes").delete().eq("id", linha.id);
      if (error) throw error;
      await registrarAuditoria({
        acao: "excluiu",
        entidade: "congregacao",
        entidadeId: linha.id,
        detalhe: linha.nome,
      });
    },
    onSuccess: async () => {
      setAExcluir(null);
      setErroTabela("");
      await queryClient.invalidateQueries({ queryKey: ["congregacoes-lista"] });
      await queryClient.invalidateQueries({ queryKey: ["congregacoes-indicadores"] });
      await queryClient.invalidateQueries({ queryKey: ["congregacoes-ativas"] });
    },
    onError: (erro) => {
      setAExcluir(null);
      setErroTabela(mensagemErro(erro));
    },
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = todas.filter((c) => {
      if (filtroStatus.size > 0 && !filtroStatus.has(c.status)) return false;
      if (!termo) return true;
      return [c.nome, c.cidade, c.bairro, c.endereco, c.estado, c.cep].some((v) =>
        (v ?? "").toLowerCase().includes(termo),
      );
    });

    const sinal = direcao === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (ordem === "membros") return (a.membros.length - b.membros.length) * sinal;
      const va = ordem === "nome" ? a.nome : ordem === "cidade" ? a.cidade : a.estado;
      const vb = ordem === "nome" ? b.nome : ordem === "cidade" ? b.cidade : b.estado;
      return va.localeCompare(vb, "pt-BR") * sinal;
    });
  }, [todas, busca, filtroStatus, ordem, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const linhas = agrupado
    ? filtradas
    : filtradas.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Congregacao[]>();
    for (const linha of filtradas) {
      const chave = linha.estado || "Sem estado";
      mapa.set(chave, [...(mapa.get(chave) ?? []), linha]);
    }
    return [...mapa].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [filtradas]);

  const colSpan = 2 + colunas.size;

  const ordenar = (chave: OrdemKey) => {
    if (chave === ordem) setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrdem(chave);
      setDirecao("asc");
    }
  };

  if (carregandoAcesso) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-jt-text sm:text-[28px]">
          Congregações
        </h1>
        <Carregando />
      </div>
    );
  }

  if (!pode) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-jt-text sm:text-[28px]">
          Congregações
        </h1>
        <SemPermissao mensagem="Sua conta não tem permissão de liderança para ver as congregações." />
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-2xl font-bold text-jt-text sm:text-[28px]">
          Congregações
        </h1>
        <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
          {filtradas.length} de {todas.length}
        </Badge>
      </div>

      <TableShell>
        <TableToolbar>
          <TableSearch
            valor={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Buscar por nome, cidade, bairro…"
          />

          <TableToolbarActions>
            <FilterMenu contador={filtroStatus.size} largura="w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {(["ativa", "inativa"] as const).map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={filtroStatus.has(status)}
                  onCheckedChange={(marcado) => {
                    setPagina(1);
                    setFiltroStatus((atual) => alternarNoSet(atual, status, marcado === true));
                  }}
                >
                  {status === "ativa" ? "Ativa" : "Inativa"}
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
              rotulo="Agrupar por estado"
              onToggle={() => {
                setAgrupado((g) => !g);
                setPagina(1);
              }}
            />

            {podeGerenciar ? (
              <PillButton
                onClick={() => {
                  setEditando(null);
                  setErroFormulario("");
                  setAberto(true);
                }}
                className="h-9 rounded-full px-4 text-[13px]"
              >
                <Plus className="h-4 w-4" aria-hidden /> Nova congregação
              </PillButton>
            ) : null}
          </TableToolbarActions>
        </TableToolbar>

        {erroTabela ? (
          <p className="border-b border-jt-line px-3 py-2 text-xs text-jt-coral">{erroTabela}</p>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <SortableHead
                  rotulo="Congregação"
                  chave="nome"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                {colunas.has("membros") ? (
                  <SortableHead
                    rotulo="Membros"
                    chave="membros"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("status") ? (
                  <TableHead className="text-jt-muted">Status</TableHead>
                ) : null}
                {colunas.has("endereco") ? (
                  <TableHead className="text-jt-muted">Endereço</TableHead>
                ) : null}
                {colunas.has("bairro") ? (
                  <TableHead className="text-jt-muted">Bairro</TableHead>
                ) : null}
                {colunas.has("cidade") ? (
                  <SortableHead
                    rotulo="Cidade"
                    chave="cidade"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("estado") ? (
                  <SortableHead
                    rotulo="Estado"
                    chave="estado"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("cep") ? <TableHead className="text-jt-muted">CEP</TableHead> : null}
                <TableHead className="text-jt-muted">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {consulta.isLoading ? (
                <EmptyRow colSpan={colSpan}>Carregando…</EmptyRow>
              ) : consulta.isError ? (
                <EmptyRow colSpan={colSpan}>
                  Não foi possível carregar as congregações. Tente novamente em instantes.
                </EmptyRow>
              ) : filtradas.length === 0 ? (
                <EmptyRow colSpan={colSpan}>Nenhuma congregação corresponde aos filtros.</EmptyRow>
              ) : agrupado ? (
                grupos.map(([estado, doGrupo], i) => (
                  <Fragment key={estado}>
                    <GroupHeaderRow
                      rotulo={estado}
                      contagem={doGrupo.length}
                      indice={i}
                      colSpan={colSpan}
                      recolhido={recolhidos.has(estado)}
                      onToggle={() =>
                        setRecolhidos((atual) => alternarNoSet(atual, estado, !atual.has(estado)))
                      }
                    />
                    {recolhidos.has(estado)
                      ? null
                      : doGrupo.map((linha) => (
                          <CongregacaoRow
                            key={linha.id}
                            linha={linha}
                            colunas={colunas}
                            podeGerenciar={podeGerenciar}
                            onEditar={(l) => {
                              setEditando(l);
                              setErroFormulario("");
                              setAberto(true);
                            }}
                            onExcluir={setAExcluir}
                          />
                        ))}
                  </Fragment>
                ))
              ) : (
                linhas.map((linha) => (
                  <CongregacaoRow
                    key={linha.id}
                    linha={linha}
                    colunas={colunas}
                    podeGerenciar={podeGerenciar}
                    onEditar={(l) => {
                      setEditando(l);
                      setErroFormulario("");
                      setAberto(true);
                    }}
                    onExcluir={setAExcluir}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {agrupado ? null : (
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
            unidade="registros"
          />
        )}
      </TableShell>

      <CongregacaoDialog
        aberto={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          if (!v) setErroFormulario("");
        }}
        editando={editando}
        onSalvar={(form) => salvar.mutate(form)}
        salvando={salvar.isPending}
        erro={erroFormulario}
      />

      <ExcluirDialog
        alvo={aExcluir}
        onFechar={() => setAExcluir(null)}
        onConfirmar={() => {
          if (aExcluir) excluir.mutate(aExcluir);
        }}
        excluindo={excluir.isPending}
      />
    </>
  );
}
