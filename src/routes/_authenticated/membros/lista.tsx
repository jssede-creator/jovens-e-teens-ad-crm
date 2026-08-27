import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Church, Download, Plus, Upload } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
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
  nome: string;
  congregacao: string;
  completo: boolean;
  nascimento: string;
  cpf: string;
  telefone: string;
  email: string;
  cidade: string;
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

function alternarNoSet<T>(conjunto: Set<T>, valor: T, marcado: boolean) {
  const proximo = new Set(conjunto);
  if (marcado) proximo.add(valor);
  else proximo.delete(valor);
  return proximo;
}

function MembroRow({ linha, colunas }: { linha: Membro; colunas: Set<ColunaKey> }) {
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
    </TableRow>
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
  const [texto, setTexto] = useState("");
  const [lgpd, setLgpd] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-jt-line bg-jt-panel text-jt-text sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Upload className="h-5 w-5 text-jt-gold" aria-hidden />
            Incluir membros em lote
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            Cole as linhas separadas por ponto e vírgula, uma pessoa por linha, na ordem do
            cabeçalho abaixo. A congregação é pelo nome exato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="num overflow-x-auto rounded-lg border border-jt-line bg-jt-panel-2 p-3 text-xs text-jt-muted">
            {CABECALHO_CSV}
          </p>
          <p className="text-xs text-jt-muted">
            Congregações disponíveis: {congregacoes.map((c) => c.nome).join(", ") || "nenhuma"}
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={8}
            placeholder="Maria de Souza;12/03/2005;123.456.789-00;12.345.678-9;(15) 99999-0000;maria@email.com;AD Sede;Rua A;10;Sorocaba;18043-090"
            className="w-full rounded-[12px] border border-jt-line bg-jt-panel-2 p-3 text-sm text-jt-text placeholder:text-jt-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
          />
          <label className="flex items-start gap-2 text-xs text-jt-muted">
            <input
              type="checkbox"
              checked={lgpd}
              onChange={(e) => setLgpd(e.target.checked)}
              className="mt-0.5"
            />
            Confirmo que o aceite da LGPD foi coletado dessas pessoas fora do sistema. O cadastro
            fica gravado como aceito.
          </label>
          {resultado ? <p className="text-xs text-jt-text">{resultado}</p> : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </PillButton>
          <PillButton
            onClick={() => onImportar(texto, lgpd)}
            disabled={importando || !texto.trim() || !lgpd}
          >
            Importar
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembrosLista() {
  const navigate = useNavigate();
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
  const [resultadoImport, setResultadoImport] = useState("");

  const consulta = useQuery({
    queryKey: ["membros-lista"],
    enabled: pode,
    queryFn: async () => {
      const [cadastros, congregacoes] = await Promise.all([
        supabase
          .from("cadastros")
          .select(
            "id, nome_completo, congregacao_id, compartilhou_dados_complementares, data_nascimento, cpf, telefone, email, cidade, data_cadastro",
          )
          .order("nome_completo"),
        supabase.from("congregacoes").select("id, nome").order("nome"),
      ]);
      if (cadastros.error) throw cadastros.error;
      if (congregacoes.error) throw congregacoes.error;

      const nomePorId = new Map((congregacoes.data ?? []).map((c) => [c.id, c.nome]));
      const linhas: Membro[] = (cadastros.data ?? []).map((c) => ({
        id: c.id,
        nome: c.nome_completo,
        congregacao: c.congregacao_id ? (nomePorId.get(c.congregacao_id) ?? "—") : "—",
        completo: c.compartilhou_dados_complementares,
        nascimento: c.data_nascimento,
        cpf: c.cpf,
        telefone: c.telefone,
        email: c.email,
        cidade: c.cidade,
        cadastro: c.data_cadastro,
      }));
      return { linhas, congregacoes: congregacoes.data ?? [] };
    },
  });

  const todos = useMemo(() => consulta.data?.linhas ?? [], [consulta.data]);
  const congregacoes = consulta.data?.congregacoes ?? [];

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

  const colSpan = 1 + colunas.size;

  const ordenar = (chave: OrdemKey) => {
    if (chave === ordem) setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrdem(chave);
      setDirecao("asc");
    }
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
                  onClick={() => navigate({ to: "/" })}
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
                      : doGrupo.map((m) => <MembroRow key={m.id} linha={m} colunas={colunas} />)}
                  </Fragment>
                ))
              ) : (
                daPagina.map((m) => <MembroRow key={m.id} linha={m} colunas={colunas} />)
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
