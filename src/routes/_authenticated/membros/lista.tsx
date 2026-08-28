import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Church,
  Download,
  MailPlus,
  Pencil,
  Plus,
  Upload,
  UserPlus,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";

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
  ToolbarIconButton,
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
import type { Database } from "@/integrations/supabase/types";
import { registrarAuditoria } from "@/lib/auditoria";
import { convidarPessoa } from "@/lib/convite.functions";
import { idadeEm, iniciais } from "@/lib/ebd";
import { dataCurta, dataParaBR, dataParaISO, mensagemErro, semMascara } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/membros/lista")({
  head: () => ({
    meta: [
      { title: "Lista de membros — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Todos os membros cadastrados." },
      { property: "og:title", content: "Lista de membros — AD CRM" },
      { property: "og:description", content: "Todos os membros cadastrados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembrosLista,
});

type Membro = {
  id: string;
  userId: string | null;
  nome: string;
  congregacaoId: string;
  congregacao: string;
  completo: boolean;
  nascimento: string;
  cpf: string;
  rg: string;
  telefone: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  pontoReferencia: string;
  cidade: string;
  cep: string;
  cadastro: string;
};

type ColunaKey =
  "congregacao" | "status" | "nascimento" | "cpf" | "telefone" | "email" | "cidade" | "cadastro";

const COLUNAS_TABELA = [
  { chave: "congregacao", rotulo: "Congregação" },
  { chave: "status", rotulo: "Status" },
  { chave: "nascimento", rotulo: "Nascimento" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "cadastro", rotulo: "Cadastro" },
] as const satisfies readonly { chave: ColunaKey; rotulo: string }[];

type OrdemKey = "nome" | "congregacao" | "nascimento" | "cidade" | "cadastro";

const CABECALHO_CSV =
  "nome_completo;data_nascimento;cpf;rg;telefone;email;congregacao;endereco;numero;cidade;cep";

const EXEMPLO_CSV =
  "Maria de Souza;12/03/2005;123.456.789-00;12.345.678-9;(15) 99999-0000;maria@email.com;AD Sede;Rua A;10;Sorocaba;18043-090";

function alternarNoSet<T>(conjunto: Set<T>, valor: T, marcado: boolean) {
  const proximo = new Set(conjunto);
  if (marcado) proximo.add(valor);
  else proximo.delete(valor);
  return proximo;
}

function MembroRow({
  linha,
  colunas,
  podeGerenciar,
  convidando,
  onEditar,
  onConvidar,
}: {
  linha: Membro;
  colunas: Set<ColunaKey>;
  podeGerenciar: boolean;
  convidando: boolean;
  onEditar: (m: Membro) => void;
  onConvidar: (m: Membro) => void;
}) {
  const idade = idadeEm(linha.nascimento);
  return (
    <TableRow className="border-jt-line hover:bg-jt-panel-2">
      <TableCell>
        <div className="flex items-center gap-2.5">
          <AvatarIniciais texto={iniciais(linha.nome)} />
          <span className="font-medium text-jt-text">{linha.nome}</span>
        </div>
      </TableCell>

      {colunas.has("congregacao") ? (
        <TableCell>
          <Badge variant="outline" className="gap-1.5 border-jt-line font-normal text-jt-text">
            <Church className="h-3 w-3 text-jt-muted" aria-hidden />
            {linha.congregacao}
          </Badge>
        </TableCell>
      ) : null}

      {colunas.has("status") ? (
        <TableCell>
          <Badge
            variant="outline"
            className={cn(
              "border-jt-line font-normal",
              linha.completo ? "text-jt-success" : "text-jt-muted",
            )}
          >
            {linha.completo ? "Completo" : "Básico"}
          </Badge>
        </TableCell>
      ) : null}

      {colunas.has("nascimento") ? (
        <TableCell className="num whitespace-nowrap text-jt-text">
          {dataCurta(linha.nascimento)}
          {idade != null ? <span className="text-jt-muted"> · {idade}a</span> : null}
        </TableCell>
      ) : null}

      {colunas.has("cpf") ? (
        <TableCell className="num whitespace-nowrap text-jt-muted">{linha.cpf}</TableCell>
      ) : null}

      {colunas.has("telefone") ? (
        <TableCell className="num whitespace-nowrap text-jt-muted">{linha.telefone}</TableCell>
      ) : null}

      {colunas.has("email") ? (
        <TableCell className="whitespace-nowrap text-jt-muted">{linha.email}</TableCell>
      ) : null}

      {colunas.has("cidade") ? (
        <TableCell className="whitespace-nowrap text-jt-muted">{linha.cidade}</TableCell>
      ) : null}

      {colunas.has("cadastro") ? (
        <TableCell className="num whitespace-nowrap text-jt-muted">
          {dataParaBR(linha.cadastro.slice(0, 10))}
        </TableCell>
      ) : null}

      <TableCell>
        {!podeGerenciar ? (
          <span className="text-jt-muted">—</span>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Editar ${linha.nome}`}
              title="Editar cadastro"
              onClick={() => onEditar(linha)}
              className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
            {linha.userId ? (
              <span
                title="Já tem acesso ao CRM"
                className="grid h-7 w-7 place-items-center rounded-full text-jt-success"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              </span>
            ) : (
              <button
                type="button"
                disabled={convidando}
                aria-label={`Enviar convite para ${linha.nome}`}
                title="Enviar convite de acesso ao CRM"
                onClick={() => onConvidar(linha)}
                className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-blue disabled:opacity-40"
              >
                <MailPlus className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

const FORM_MEMBRO = {
  nome_completo: "",
  data_nascimento: "",
  cpf: "",
  rg: "",
  telefone: "",
  email: "",
  congregacao_id: "",
  endereco: "",
  numero: "",
  complemento: "",
  ponto_referencia: "",
  cidade: "",
  cep: "",
};
type FormMembro = typeof FORM_MEMBRO;

function MembroDialog({
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
  editando: Membro | null;
  congregacoes: { id: string; nome: string }[];
  onSalvar: (form: FormMembro, lgpd: boolean) => void;
  salvando: boolean;
  erro: string;
}) {
  const [form, setForm] = useState<FormMembro>(FORM_MEMBRO);
  const [lgpd, setLgpd] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [chaveAtual, setChaveAtual] = useState<string | null>(null);

  const chave = aberto ? (editando?.id ?? "novo") : null;
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setErros({});
    // Em edição o aceite já foi dado quando o cadastro entrou.
    setLgpd(Boolean(editando));
    setForm(
      editando
        ? {
            nome_completo: editando.nome,
            data_nascimento: editando.nascimento,
            cpf: editando.cpf,
            rg: editando.rg,
            telefone: editando.telefone,
            email: editando.email,
            congregacao_id: editando.congregacaoId,
            endereco: editando.endereco,
            numero: editando.numero,
            complemento: editando.complemento,
            ponto_referencia: editando.pontoReferencia,
            cidade: editando.cidade,
            cep: editando.cep,
          }
        : FORM_MEMBRO,
    );
  }

  const campo = <K extends keyof FormMembro>(nome: K, valor: FormMembro[K]) => {
    setForm((atual) => ({ ...atual, [nome]: valor }));
    setErros((atual) => ({ ...atual, [nome]: "" }));
  };

  function enviar() {
    const novos: Record<string, string> = {};
    const obrigatorios: (keyof FormMembro)[] = [
      "nome_completo",
      "data_nascimento",
      "cpf",
      "rg",
      "telefone",
      "email",
      "endereco",
      "cidade",
      "cep",
    ];
    for (const c of obrigatorios) if (!form[c].trim()) novos[c] = "Campo obrigatório.";
    if (!novos["cep"] && semMascara(form.cep).length < 8) novos["cep"] = "Informe o CEP completo.";
    if (!novos["email"] && !form.email.includes("@")) novos["email"] = "E-mail inválido.";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    onSalvar(form, lgpd);
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-jt-line bg-jt-panel text-jt-text sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <UserPlus className="h-5 w-5 text-jt-gold" aria-hidden />
            {editando ? "Editar membro" : "Novo membro"}
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            {editando
              ? "Os dados socioeconômicos continuam sendo preenchidos pela própria pessoa."
              : "O cadastro entra completo na lista; a pessoa pode complementar depois com os dados socioeconômicos."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1">
          <Field label="Nome completo" obrigatorio erro={erros["nome_completo"] ?? ""}>
            <TextInput
              value={form.nome_completo}
              onValueChange={(v) => campo("nome_completo", v)}
              placeholder="Ex.: Maria de Souza"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nascimento" obrigatorio erro={erros["data_nascimento"] ?? ""}>
              <DataCampo
                valor={form.data_nascimento}
                onValueChange={(v) => campo("data_nascimento", v)}
                placeholder="Escolha a data"
                anoInicial={1920}
                anoFinal={new Date().getFullYear()}
              />
            </Field>
            <Field label="Congregação">
              <SelectCampo
                opcoes={congregacoes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
                valor={form.congregacao_id}
                onValueChange={(v) => campo("congregacao_id", v)}
                placeholder="Selecione"
              />
            </Field>
            <Field label="CPF" obrigatorio erro={erros["cpf"] ?? ""}>
              <TextInput
                mascara="cpf"
                value={form.cpf}
                onValueChange={(v) => campo("cpf", v)}
                inputMode="numeric"
              />
            </Field>
            <Field label="RG" obrigatorio erro={erros["rg"] ?? ""}>
              <TextInput
                mascara="rg"
                value={form.rg}
                onValueChange={(v) => campo("rg", v)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Telefone" obrigatorio erro={erros["telefone"] ?? ""}>
              <TextInput
                mascara="telefone"
                value={form.telefone}
                onValueChange={(v) => campo("telefone", v)}
                inputMode="numeric"
              />
            </Field>
            <Field label="E-mail" obrigatorio erro={erros["email"] ?? ""}>
              <TextInput
                type="email"
                value={form.email}
                onValueChange={(v) => campo("email", v)}
                placeholder="nome@email.com"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Endereço" obrigatorio erro={erros["endereco"] ?? ""}>
              <TextInput value={form.endereco} onValueChange={(v) => campo("endereco", v)} />
            </Field>
            <Field label="Número">
              <TextInput
                value={form.numero}
                onValueChange={(v) => campo("numero", v)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Complemento" dica="Apartamento, bloco, casa dos fundos…">
              <TextInput
                value={form.complemento}
                onValueChange={(v) => campo("complemento", v)}
                placeholder="Ex.: Apto 32, bloco B"
              />
            </Field>
            <Field label="Ponto de referência" dica="Ajuda a achar o endereço em visitas.">
              <TextInput
                value={form.ponto_referencia}
                onValueChange={(v) => campo("ponto_referencia", v)}
                placeholder="Ex.: em frente à praça"
              />
            </Field>
            <Field label="Cidade" obrigatorio erro={erros["cidade"] ?? ""}>
              <TextInput value={form.cidade} onValueChange={(v) => campo("cidade", v)} />
            </Field>
            <Field label="CEP" obrigatorio erro={erros["cep"] ?? ""}>
              <TextInput
                mascara="cep"
                value={form.cep}
                onValueChange={(v) => campo("cep", v)}
                inputMode="numeric"
                placeholder="00000-000"
              />
            </Field>
          </div>

          {editando ? null : (
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition",
                lgpd
                  ? "border-jt-success/50 bg-green-50/50 dark:bg-green-950/20"
                  : "border-jt-line",
              )}
            >
              <input
                type="checkbox"
                checked={lgpd}
                onChange={(e) => setLgpd(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-jt-muted">
                <span className="block font-medium text-jt-text">Aceite da LGPD</span>
                Confirmo que essa pessoa autorizou o uso dos dados pelo ministério.
              </span>
            </label>
          )}

          {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </PillButton>
          <PillButton onClick={enviar} disabled={salvando || !lgpd}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar membro"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarDialog({
  aberto,
  onOpenChange,
  congregacoes,
  onImportar,
  importando,
  resultado,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  congregacoes: { id: string; nome: string }[];
  onImportar: (linhas: string, lgpd: boolean) => void;
  importando: boolean;
  resultado: string;
}) {
  const arquivoCsv = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [lgpd, setLgpd] = useState(false);

  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.toLowerCase().startsWith("nome_completo"));

  const baixarModelo = () => {
    const exemplo = `${CABECALHO_CSV}\n${EXEMPLO_CSV}`;
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${exemplo}`], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-membros.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-jt-line bg-jt-panel text-jt-text sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Upload className="h-5 w-5 text-jt-gold" aria-hidden />
            Incluir membros em lote
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            Uma pessoa por linha, com os campos separados por ponto e vírgula.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1">
          <div className="rounded-xl border border-jt-line bg-jt-panel-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-jt-text">Ordem dos campos</p>
              <button
                type="button"
                onClick={baixarModelo}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-jt-blue hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> Baixar modelo
              </button>
            </div>
            <ol className="mt-2 flex flex-wrap gap-1.5">
              {CABECALHO_CSV.split(";").map((campo, i) => (
                <li
                  key={campo}
                  className="rounded-full border border-jt-line bg-jt-panel px-2 py-0.5 text-[11px] text-jt-muted"
                >
                  <span className="num mr-1 text-jt-text">{i + 1}</span>
                  {campo}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-jt-muted">
              Congregação pelo nome exato: {congregacoes.map((c) => c.nome).join(", ") || "nenhuma"}
              .
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-jt-text">Linhas</span>
              <button
                type="button"
                onClick={() => arquivoCsv.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-jt-blue hover:underline"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden /> Escolher arquivo .csv
              </button>
              <input
                ref={arquivoCsv}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setTexto(await file.text());
                  e.target.value = "";
                }}
              />
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={7}
              spellCheck={false}
              placeholder={EXEMPLO_CSV}
              className="num w-full resize-none whitespace-pre rounded-xl border border-jt-line bg-jt-panel-2 p-3 text-xs leading-relaxed text-jt-text placeholder:text-jt-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
            />
            <p className="mt-1.5 text-xs text-jt-muted">
              {linhas.length === 0
                ? "Nenhuma linha ainda."
                : `${linhas.length} pessoa(s) prontas para importar.`}
            </p>
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition",
              lgpd ? "border-jt-success/50 bg-green-50/50 dark:bg-green-950/20" : "border-jt-line",
            )}
          >
            <input
              type="checkbox"
              checked={lgpd}
              onChange={(e) => setLgpd(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-jt-muted">
              <span className="block font-medium text-jt-text">Aceite da LGPD</span>
              Confirmo que essas pessoas autorizaram o uso dos dados fora do sistema. O cadastro
              fica gravado como aceito.
            </span>
          </label>

          {resultado ? (
            <p className="rounded-xl border border-jt-line bg-jt-panel-2 p-3 text-xs text-jt-text">
              {resultado}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </PillButton>
          <PillButton
            onClick={() => onImportar(texto, lgpd)}
            disabled={importando || linhas.length === 0 || !lgpd}
          >
            {importando
              ? "Importando…"
              : `Importar ${linhas.length > 0 ? `${linhas.length} membro(s)` : ""}`.trim()}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembrosLista() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "membros" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "membros_gerenciar" }, acesso);

  const [busca, setBusca] = useState("");
  const [agrupado, setAgrupado] = useState(true);
  const [filtroCongregacao, setFiltroCongregacao] = useState<Set<string>>(new Set());
  const [filtroStatus, setFiltroStatus] = useState<Set<"completo" | "basico">>(new Set());
  const [colunas, setColunas] = useState<Set<ColunaKey>>(
    () => new Set(COLUNAS_TABELA.map((c) => c.chave)),
  );
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [ordem, setOrdem] = useState<OrdemKey>("nome");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(10);
  const [importar, setImportar] = useState(false);
  const [novoMembro, setNovoMembro] = useState(false);
  const [editando, setEditando] = useState<Membro | null>(null);
  const [erroNovo, setErroNovo] = useState("");
  const [avisoConvite, setAvisoConvite] = useState("");
  const [resultadoImport, setResultadoImport] = useState("");

  const consulta = useQuery({
    queryKey: ["membros-lista"],
    enabled: pode,
    queryFn: async () => {
      const [cadastros, congregacoes] = await Promise.all([
        supabase
          .from("cadastros")
          .select(
            "id, user_id, nome_completo, congregacao_id, compartilhou_dados_complementares, data_nascimento, cpf, rg, telefone, email, endereco, numero, complemento, cidade, cep, data_cadastro",
          )
          .order("nome_completo"),
        supabase.from("congregacoes").select("id, nome").order("nome"),
      ]);
      if (cadastros.error) throw cadastros.error;
      if (congregacoes.error) throw congregacoes.error;

      const nomePorId = new Map((congregacoes.data ?? []).map((c) => [c.id, c.nome]));
      const linhas: Membro[] = (cadastros.data ?? []).map((c) => ({
        id: c.id,
        userId: c.user_id,
        nome: c.nome_completo,
        congregacaoId: c.congregacao_id ?? "",
        congregacao: c.congregacao_id ? (nomePorId.get(c.congregacao_id) ?? "—") : "—",
        completo: c.compartilhou_dados_complementares,
        nascimento: c.data_nascimento,
        cpf: c.cpf,
        rg: c.rg,
        telefone: c.telefone,
        email: c.email,
        endereco: c.endereco,
        numero: c.numero ?? "",
        complemento: c.complemento ?? "",
        pontoReferencia: (c as { ponto_referencia?: string | null }).ponto_referencia ?? "",
        cidade: c.cidade,
        cep: c.cep,
        cadastro: c.data_cadastro,
      }));
      return { linhas, congregacoes: congregacoes.data ?? [] };
    },
  });

  const todos = useMemo(() => consulta.data?.linhas ?? [], [consulta.data]);
  const congregacoes = consulta.data?.congregacoes ?? [];

  const criarMembro = useMutation({
    mutationFn: async ({ form, lgpd }: { form: FormMembro; lgpd: boolean }) => {
      if (!lgpd) throw new Error("lgpd");
      const base = {
        ...(editando ? {} : { user_id: null }),
        nome_completo: form.nome_completo.trim(),
        data_nascimento: form.data_nascimento,
        cpf: form.cpf,
        rg: form.rg,
        telefone: form.telefone,
        email: form.email.trim().toLowerCase(),
        congregacao_id: form.congregacao_id || null,
        endereco: form.endereco.trim(),
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        cidade: form.cidade.trim(),
        cep: form.cep,
        compartilhou_dados_complementares: false,
        lgpd_aceito: true,
      };
      const referencia = form.ponto_referencia.trim();
      const comReferencia = { ...base, ...(referencia ? { ponto_referencia: referencia } : {}) };

      if (editando) {
        let { error } = await supabase
          .from("cadastros")
          .update(comReferencia as never)
          .eq("id", editando.id);
        // A coluna ponto_referencia entra pela migração 20260828230000; enquanto
        // o banco não a tiver, o cadastro segue sem ela em vez de falhar.
        if (error?.code === "PGRST204" && referencia) {
          ({ error } = await supabase.from("cadastros").update(base).eq("id", editando.id));
        }
        if (error) throw error;
        await registrarAuditoria({
          acao: "editou",
          entidade: "cadastro",
          entidadeId: editando.id,
          detalhe: form.nome_completo.trim(),
        });
        return;
      }

      let { data, error } = await supabase
        .from("cadastros")
        .insert(comReferencia as never)
        .select("id")
        .single();
      if (error?.code === "PGRST204" && referencia) {
        ({ data, error } = await supabase.from("cadastros").insert(base).select("id").single());
      }
      if (error) throw error;
      await registrarAuditoria({
        acao: "criou",
        entidade: "cadastro",
        entidadeId: data?.id ?? null,
        detalhe: form.nome_completo.trim(),
      });
    },
    onSuccess: async () => {
      setNovoMembro(false);
      setEditando(null);
      setErroNovo("");
      await queryClient.invalidateQueries({ queryKey: ["membros-lista"] });
      await queryClient.invalidateQueries({ queryKey: ["membros-painel"] });
      await queryClient.invalidateQueries({ queryKey: ["congregacoes-lista"] });
    },
    onError: (e) =>
      setErroNovo((e as Error).message === "lgpd" ? "Confirme o aceite da LGPD." : mensagemErro(e)),
  });

  const convidar = useMutation({
    mutationFn: async (membro: Membro) => {
      const r = await convidarPessoa({ data: { email: membro.email, nome: membro.nome } });
      if (!r.enviado) throw new Error("convite");
      await registrarAuditoria({
        acao: "convidou",
        entidade: "cadastro",
        entidadeId: membro.id,
        detalhe: membro.email,
      });
      return membro;
    },
    onSuccess: (membro) => {
      setErroNovo("");
      setAvisoConvite(`Convite enviado para ${membro.email}. A pessoa define a senha pelo link.`);
    },
    onError: () =>
      setErroNovo(
        "Não foi possível enviar o convite. Confira se o e-mail está certo e se a conta ainda não existe.",
      ),
  });

  const importacao = useMutation({
    mutationFn: async ({ texto, lgpd }: { texto: string; lgpd: boolean }) => {
      if (!lgpd) throw new Error("lgpd");
      const idPorNome = new Map(congregacoes.map((c) => [c.nome.toLowerCase(), c.id]));
      const linhas = texto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.toLowerCase().startsWith("nome_completo"));

      type NovoCadastro = Database["public"]["Tables"]["cadastros"]["Insert"];
      const registros: NovoCadastro[] = [];
      const problemas: string[] = [];

      linhas.forEach((linha, i) => {
        const campos = linha.split(";").map((c) => c.trim());
        const [
          nome,
          nascimento,
          cpf,
          rg,
          telefone,
          email,
          congregacao,
          endereco,
          numero,
          cidade,
          cep,
        ] = campos;
        const iso = dataParaISO(nascimento ?? "");
        if (!nome || !iso || !cpf || !rg || !telefone || !email || !endereco || !cidade || !cep) {
          problemas.push(`linha ${i + 1}: campos obrigatórios faltando`);
          return;
        }
        registros.push({
          user_id: null,
          nome_completo: nome,
          data_nascimento: iso,
          cpf,
          rg,
          telefone,
          email: email.toLowerCase(),
          congregacao_id: congregacao ? (idPorNome.get(congregacao.toLowerCase()) ?? null) : null,
          endereco,
          numero: numero || null,
          cidade,
          cep: semMascara(cep).length === 8 ? cep : cep,
          compartilhou_dados_complementares: false,
          lgpd_aceito: true,
        });
      });

      if (registros.length === 0) {
        return { inseridos: 0, problemas: problemas.length ? problemas : ["nenhuma linha válida"] };
      }

      const { error } = await supabase.from("cadastros").insert(registros);
      if (error) throw error;
      await registrarAuditoria({
        acao: "importou",
        entidade: "cadastro",
        detalhe: `${registros.length} membro(s)`,
      });
      return { inseridos: registros.length, problemas };
    },
    onSuccess: async (r) => {
      setResultadoImport(
        `${r.inseridos} membro(s) importado(s).` +
          (r.problemas.length ? ` Ignorados: ${r.problemas.join("; ")}` : ""),
      );
      await queryClient.invalidateQueries({ queryKey: ["membros-lista"] });
      await queryClient.invalidateQueries({ queryKey: ["membros-painel"] });
      await queryClient.invalidateQueries({ queryKey: ["congregacoes-lista"] });
    },
    onError: (erro) =>
      setResultadoImport(
        (erro as Error).message === "lgpd"
          ? "Confirme o aceite da LGPD antes de importar."
          : mensagemErro(erro),
      ),
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = todos.filter((m) => {
      if (filtroCongregacao.size > 0 && !filtroCongregacao.has(m.congregacao)) return false;
      if (filtroStatus.size > 0 && !filtroStatus.has(m.completo ? "completo" : "basico")) {
        return false;
      }
      if (!termo) return true;
      return [m.nome, m.email, m.telefone, m.cpf, m.cidade, m.congregacao].some((v) =>
        (v ?? "").toLowerCase().includes(termo),
      );
    });

    const sinal = direcao === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      const campo = (m: Membro) =>
        ordem === "nome"
          ? m.nome
          : ordem === "congregacao"
            ? m.congregacao
            : ordem === "cidade"
              ? m.cidade
              : ordem === "nascimento"
                ? m.nascimento
                : m.cadastro;
      return campo(a).localeCompare(campo(b), "pt-BR") * sinal;
    });
  }, [todos, busca, filtroCongregacao, filtroStatus, ordem, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtrados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Membro[]>();
    for (const m of daPagina) {
      mapa.set(m.congregacao, [...(mapa.get(m.congregacao) ?? []), m]);
    }
    return [...mapa];
  }, [daPagina]);

  const colSpan = 2 + colunas.size;

  const ordenar = (chave: OrdemKey) => {
    if (chave === ordem) setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrdem(chave);
      setDirecao("asc");
    }
  };

  const abrirEdicao = (m: Membro) => {
    setEditando(m);
    setErroNovo("");
    setNovoMembro(true);
  };

  const exportar = () => {
    const cabecalho = [
      "Nome",
      "Congregação",
      "Status",
      "Nascimento",
      "CPF",
      "Telefone",
      "E-mail",
      "Cidade",
      "Cadastro",
    ];
    const linhas = filtrados.map((m) =>
      [
        m.nome,
        m.congregacao,
        m.completo ? "Completo" : "Básico",
        dataParaBR(m.nascimento),
        m.cpf,
        m.telefone,
        m.email,
        m.cidade,
        dataParaBR(m.cadastro.slice(0, 10)),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const csv = "﻿" + [cabecalho.join(";"), ...linhas].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `membros-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Membros" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Membros" />
        <SemPermissao mensagem="Sua conta não tem permissão de liderança para ver os membros." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Membros"
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {filtrados.length} de {todos.length}
          </Badge>
        }
      />

      {erroNovo && !novoMembro ? <p className="mb-3 text-xs text-jt-coral">{erroNovo}</p> : null}
      {avisoConvite ? <p className="mb-3 text-xs text-jt-success">{avisoConvite}</p> : null}

      <TableShell>
        <TableToolbar>
          <TableSearch
            valor={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Buscar por nome, e-mail, telefone…"
          />

          <TableToolbarActions>
            <FilterMenu contador={filtroCongregacao.size + filtroStatus.size}>
              <DropdownMenuLabel>Congregação</DropdownMenuLabel>
              {congregacoes.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={filtroCongregacao.has(c.nome)}
                  onCheckedChange={(marcado) => {
                    setPagina(1);
                    setFiltroCongregacao((atual) => alternarNoSet(atual, c.nome, marcado === true));
                  }}
                >
                  {c.nome}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {(["completo", "basico"] as const).map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={filtroStatus.has(s)}
                  onCheckedChange={(marcado) => {
                    setPagina(1);
                    setFiltroStatus((atual) => alternarNoSet(atual, s, marcado === true));
                  }}
                >
                  {s === "completo" ? "Completo" : "Básico"}
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
              rotulo="Agrupar por congregação"
              onToggle={() => setAgrupado((g) => !g)}
            />

            <ToolbarIconButton rotulo="Exportar CSV" onClick={exportar}>
              <Download className="h-4 w-4" aria-hidden />
            </ToolbarIconButton>

            {podeGerenciar ? (
              <>
                <PillButton
                  variante="outline"
                  onClick={() => {
                    setResultadoImport("");
                    setImportar(true);
                  }}
                  className="h-9 rounded-full px-4 text-[13px]"
                >
                  <Upload className="h-4 w-4" aria-hidden /> Incluir membros
                </PillButton>
                <PillButton
                  onClick={() => {
                    setEditando(null);
                    setErroNovo("");
                    setNovoMembro(true);
                  }}
                  className="h-9 rounded-full px-4 text-[13px]"
                >
                  <Plus className="h-4 w-4" aria-hidden /> Novo
                </PillButton>
              </>
            ) : null}
          </TableToolbarActions>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <SortableHead
                  rotulo="Contato"
                  chave="nome"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                {colunas.has("congregacao") ? (
                  <SortableHead
                    rotulo="Congregação"
                    chave="congregacao"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("status") ? (
                  <TableHead className="text-jt-muted">Status</TableHead>
                ) : null}
                {colunas.has("nascimento") ? (
                  <SortableHead
                    rotulo="Nascimento"
                    chave="nascimento"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("cpf") ? <TableHead className="text-jt-muted">CPF</TableHead> : null}
                {colunas.has("telefone") ? (
                  <TableHead className="text-jt-muted">Telefone</TableHead>
                ) : null}
                {colunas.has("email") ? (
                  <TableHead className="text-jt-muted">E-mail</TableHead>
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
                {colunas.has("cadastro") ? (
                  <SortableHead
                    rotulo="Cadastro"
                    chave="cadastro"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                <TableHead className="text-jt-muted">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {consulta.isLoading ? (
                <EmptyRow colSpan={colSpan}>Carregando…</EmptyRow>
              ) : consulta.isError ? (
                <EmptyRow colSpan={colSpan}>
                  Não foi possível carregar os membros. Tente novamente em instantes.
                </EmptyRow>
              ) : filtrados.length === 0 ? (
                <EmptyRow colSpan={colSpan}>Nenhum membro corresponde aos filtros.</EmptyRow>
              ) : agrupado ? (
                grupos.map(([congregacao, doGrupo], i) => (
                  <Fragment key={congregacao}>
                    <GroupHeaderRow
                      rotulo={congregacao}
                      contagem={doGrupo.length}
                      indice={i}
                      colSpan={colSpan}
                      recolhido={recolhidos.has(congregacao)}
                      onToggle={() =>
                        setRecolhidos((atual) =>
                          alternarNoSet(atual, congregacao, !atual.has(congregacao)),
                        )
                      }
                    />
                    {recolhidos.has(congregacao)
                      ? null
                      : doGrupo.map((m) => (
                          <MembroRow
                            key={m.id}
                            linha={m}
                            colunas={colunas}
                            podeGerenciar={podeGerenciar}
                            convidando={convidar.isPending}
                            onEditar={abrirEdicao}
                            onConvidar={(alvo) => convidar.mutate(alvo)}
                          />
                        ))}
                  </Fragment>
                ))
              ) : (
                daPagina.map((m) => (
                  <MembroRow
                    key={m.id}
                    linha={m}
                    colunas={colunas}
                    podeGerenciar={podeGerenciar}
                    convidando={convidar.isPending}
                    onEditar={abrirEdicao}
                    onConvidar={(alvo) => convidar.mutate(alvo)}
                  />
                ))
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
          unidade="registros"
        />
      </TableShell>

      <MembroDialog
        aberto={novoMembro}
        onOpenChange={(v) => {
          setNovoMembro(v);
          if (!v) setEditando(null);
        }}
        editando={editando}
        congregacoes={congregacoes}
        onSalvar={(form, lgpd) => criarMembro.mutate({ form, lgpd })}
        salvando={criarMembro.isPending}
        erro={erroNovo}
      />

      <ImportarDialog
        aberto={importar}
        onOpenChange={setImportar}
        congregacoes={congregacoes}
        onImportar={(texto, lgpd) => importacao.mutate({ texto, lgpd })}
        importando={importacao.isPending}
        resultado={resultadoImport}
      />
    </>
  );
}
