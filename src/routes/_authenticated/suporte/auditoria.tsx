import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Clock, Download, FileSpreadsheet, Layers, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader, StatCardTopo } from "@/components/crm/pagina";
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
import { Fragment } from "react";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { dataParaBR } from "@/lib/formato";
import { exportarCSV, exportarExcel } from "@/lib/exportar";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suporte/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Ações que alteram dado no CRM: quem fez, o quê e quando." },
      { property: "og:title", content: "Auditoria — AD CRM" },
      {
        property: "og:description",
        content: "Ações que alteram dado no CRM: quem fez, o quê e quando.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuporteAuditoria,
});

type Registro = {
  id: string;
  pessoa: string;
  acao: string;
  entidade: string;
  detalhe: string;
  dia: string;
  hora: string;
  quando: string;
};

type ColunaKey = "hora" | "pessoa" | "acao" | "entidade" | "detalhe";

const COLUNAS_TABELA = [
  { chave: "hora", rotulo: "Hora" },
  { chave: "pessoa", rotulo: "Pessoa" },
  { chave: "acao", rotulo: "Ação" },
  { chave: "entidade", rotulo: "Entidade" },
  { chave: "detalhe", rotulo: "Detalhe" },
] as const satisfies readonly { chave: ColunaKey; rotulo: string }[];

type OrdemKey = "dia" | "pessoa" | "acao" | "entidade";

/** Nomes amigáveis para o que a trilha guarda em inglês curto. */
const ENTIDADES: Record<string, string> = {
  cadastro: "Cadastro",
  congregacao: "Congregação",
  ebd_turma: "Turma (EBD)",
  ebd_aula: "Aula (EBD)",
  papo_reto: "Agendamento (Papo reto)",
  papo_reto_horario: "Horário (Papo reto)",
  projeto: "Projeto",
  arquivo: "Arquivo",
  pasta: "Pasta",
  acesso: "Acesso",
  usuario: "Usuário",
};

const CORES_ACAO: Record<string, string> = {
  criou: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  agendou: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  abriu: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  confirmado: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  editou: "bg-jt-panel-2 text-jt-text",
  importou: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  enviou: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  liberou: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  removeu: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  excluiu: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  recusado: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

function alternarNoSet<T>(conjunto: Set<T>, valor: T, marcado: boolean) {
  const proximo = new Set(conjunto);
  if (marcado) proximo.add(valor);
  else proximo.delete(valor);
  return proximo;
}

function SuporteAuditoria() {
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "suporte" }, acesso);

  const [busca, setBusca] = useState("");
  const [filtroEntidade, setFiltroEntidade] = useState<Set<string>>(new Set());
  const [filtroAcao, setFiltroAcao] = useState<Set<string>>(new Set());
  const [colunas, setColunas] = useState<Set<ColunaKey>>(
    () => new Set(COLUNAS_TABELA.map((c) => c.chave)),
  );
  const [agrupado, setAgrupado] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [ordem, setOrdem] = useState<OrdemKey>("dia");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(10);

  const consulta = useQuery({
    queryKey: ["auditoria"],
    enabled: pode,
    queryFn: async (): Promise<Registro[]> => {
      const { data, error } = await supabase
        .from("auditoria")
        .select("id, user_nome, acao, entidade, detalhe, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((a) => {
        const d = new Date(a.created_at);
        return {
          id: a.id,
          pessoa: a.user_nome,
          acao: a.acao,
          entidade: ENTIDADES[a.entidade] ?? a.entidade,
          detalhe: a.detalhe ?? "—",
          dia: a.created_at.slice(0, 10),
          hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          quando: a.created_at,
        };
      });
    },
  });

  const todas = useMemo(() => consulta.data ?? [], [consulta.data]);
  const entidades = useMemo(
    () => [...new Set(todas.map((a) => a.entidade))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [todas],
  );
  const acoes = useMemo(
    () => [...new Set(todas.map((a) => a.acao))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [todas],
  );

  const indicadores = useMemo(() => {
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    const porEntidade = new Map<string, number>();
    for (const a of todas) porEntidade.set(a.entidade, (porEntidade.get(a.entidade) ?? 0) + 1);
    const maior = [...porEntidade.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      total: todas.length,
      ultimas24h: todas.filter((a) => new Date(a.quando).getTime() >= limite).length,
      pessoas: new Set(todas.map((a) => a.pessoa)).size,
      areaTop: maior?.[0] ?? "—",
    };
  }, [todas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = todas.filter((a) => {
      if (filtroEntidade.size > 0 && !filtroEntidade.has(a.entidade)) return false;
      if (filtroAcao.size > 0 && !filtroAcao.has(a.acao)) return false;
      if (!termo) return true;
      return [a.pessoa, a.acao, a.entidade, a.detalhe].some((v) => v.toLowerCase().includes(termo));
    });
    const sinal = direcao === "asc" ? 1 : -1;
    const campo = (a: Registro) =>
      ordem === "dia"
        ? a.quando
        : ordem === "pessoa"
          ? a.pessoa
          : ordem === "acao"
            ? a.acao
            : a.entidade;
    return [...lista].sort((a, b) => campo(a).localeCompare(campo(b), "pt-BR") * sinal);
  }, [todas, busca, filtroEntidade, filtroAcao, ordem, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtradas.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Registro[]>();
    for (const a of daPagina) mapa.set(a.dia, [...(mapa.get(a.dia) ?? []), a]);
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

  const CABECALHO = ["Dia", "Hora", "Pessoa", "Ação", "Entidade", "Detalhe"];
  const linhasExport = () =>
    filtradas.map((a) => [dataParaBR(a.dia), a.hora, a.pessoa, a.acao, a.entidade, a.detalhe]);
  const nomeArquivo = `auditoria-${new Date().toISOString().slice(0, 10)}`;

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Auditoria" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Auditoria" />
        <SemPermissao mensagem="Sua conta não tem permissão para ver o histórico do sistema." />
      </>
    );
  }

  const linha = (a: Registro) => (
    <TableRow key={a.id} className="border-jt-line hover:bg-jt-panel-2">
      <TableCell className="num whitespace-nowrap text-jt-text">{dataParaBR(a.dia)}</TableCell>
      {colunas.has("hora") ? (
        <TableCell className="num whitespace-nowrap text-jt-muted">{a.hora}</TableCell>
      ) : null}
      {colunas.has("pessoa") ? (
        <TableCell className="whitespace-nowrap text-jt-text">{a.pessoa}</TableCell>
      ) : null}
      {colunas.has("acao") ? (
        <TableCell>
          <Badge
            className={cn(
              "border-transparent font-normal capitalize",
              CORES_ACAO[a.acao] ?? "bg-jt-panel-2 text-jt-text",
            )}
          >
            {a.acao}
          </Badge>
        </TableCell>
      ) : null}
      {colunas.has("entidade") ? (
        <TableCell className="whitespace-nowrap text-jt-muted">{a.entidade}</TableCell>
      ) : null}
      {colunas.has("detalhe") ? <TableCell className="text-jt-muted">{a.detalhe}</TableCell> : null}
    </TableRow>
  );

  return (
    <>
      <PageHeader
        titulo="Auditoria"
        descricao="Ações que alteram dado no CRM: quem fez, o quê e quando."
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {filtradas.length} de {todas.length}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardTopo
          icone={Activity}
          rotulo="Ações registradas"
          valor={String(indicadores.total)}
        />
        <StatCardTopo
          icone={Clock}
          rotulo="Nas últimas 24 h"
          valor={String(indicadores.ultimas24h)}
        />
        <StatCardTopo icone={Users} rotulo="Pessoas ativas" valor={String(indicadores.pessoas)} />
        <StatCardTopo icone={Layers} rotulo="Área mais movimentada" valor={indicadores.areaTop} />
      </div>

      <div className="mt-4">
        <TableShell>
          <TableToolbar>
            <TableSearch
              valor={busca}
              onChange={(v) => {
                setBusca(v);
                setPagina(1);
              }}
              placeholder="Buscar por pessoa, ação, detalhe…"
            />

            <TableToolbarActions>
              <FilterMenu contador={filtroEntidade.size + filtroAcao.size}>
                <DropdownMenuLabel>Entidade</DropdownMenuLabel>
                {entidades.map((e) => (
                  <DropdownMenuCheckboxItem
                    key={e}
                    checked={filtroEntidade.has(e)}
                    onCheckedChange={(marcado) => {
                      setPagina(1);
                      setFiltroEntidade((atual) => alternarNoSet(atual, e, marcado === true));
                    }}
                  >
                    {e}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Ação</DropdownMenuLabel>
                {acoes.map((a) => (
                  <DropdownMenuCheckboxItem
                    key={a}
                    checked={filtroAcao.has(a)}
                    onCheckedChange={(marcado) => {
                      setPagina(1);
                      setFiltroAcao((atual) => alternarNoSet(atual, a, marcado === true));
                    }}
                  >
                    {a}
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
                rotulo="Agrupar por dia"
                onToggle={() => setAgrupado((g) => !g)}
              />

              <span className="mx-1 h-6 w-px bg-jt-line" aria-hidden />

              <ToolbarIconButton
                rotulo="Exportar CSV"
                onClick={() => exportarCSV(nomeArquivo, CABECALHO, linhasExport())}
              >
                <Download className="h-4 w-4" aria-hidden />
              </ToolbarIconButton>
              <ToolbarIconButton
                rotulo="Exportar Excel"
                onClick={() => exportarExcel(nomeArquivo, CABECALHO, linhasExport())}
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
              </ToolbarIconButton>
            </TableToolbarActions>
          </TableToolbar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-jt-line hover:bg-transparent">
                  <SortableHead
                    rotulo="Dia"
                    chave="dia"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                  {colunas.has("hora") ? (
                    <TableHead className="text-jt-muted">Hora</TableHead>
                  ) : null}
                  {colunas.has("pessoa") ? (
                    <SortableHead
                      rotulo="Pessoa"
                      chave="pessoa"
                      atual={ordem}
                      direcao={direcao}
                      onOrdenar={ordenar}
                    />
                  ) : null}
                  {colunas.has("acao") ? (
                    <SortableHead
                      rotulo="Ação"
                      chave="acao"
                      atual={ordem}
                      direcao={direcao}
                      onOrdenar={ordenar}
                    />
                  ) : null}
                  {colunas.has("entidade") ? (
                    <SortableHead
                      rotulo="Entidade"
                      chave="entidade"
                      atual={ordem}
                      direcao={direcao}
                      onOrdenar={ordenar}
                    />
                  ) : null}
                  {colunas.has("detalhe") ? (
                    <TableHead className="text-jt-muted">Detalhe</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {consulta.isLoading ? (
                  <EmptyRow colSpan={colSpan}>Carregando…</EmptyRow>
                ) : consulta.isError ? (
                  <EmptyRow colSpan={colSpan}>Não foi possível carregar a auditoria.</EmptyRow>
                ) : daPagina.length === 0 ? (
                  <EmptyRow colSpan={colSpan}>Nenhuma ação registrada ainda.</EmptyRow>
                ) : agrupado ? (
                  grupos.map(([dia, doGrupo], i) => (
                    <Fragment key={dia}>
                      <GroupHeaderRow
                        rotulo={dataParaBR(dia)}
                        contagem={doGrupo.length}
                        indice={i}
                        colSpan={colSpan}
                        recolhido={recolhidos.has(dia)}
                        onToggle={() =>
                          setRecolhidos((atual) => alternarNoSet(atual, dia, !atual.has(dia)))
                        }
                      />
                      {recolhidos.has(dia) ? null : doGrupo.map(linha)}
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
            unidade="registros"
          />
        </TableShell>
      </div>
    </>
  );
}
