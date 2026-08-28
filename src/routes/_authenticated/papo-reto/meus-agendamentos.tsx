import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CalendarClock, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Bloco, PageHeader, StatCardTopo } from "@/components/crm/pagina";
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
import { hojeISO } from "@/lib/ebd";
import { dataParaBR, hora } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { carregarPapoReto, rotuloStatus, type Agendamento, type StatusPapo } from "@/lib/papo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/papo-reto/meus-agendamentos")({
  head: () => ({
    meta: [
      { title: "Meus agendamentos — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Suas conversas pedidas, confirmadas e realizadas." },
      { property: "og:title", content: "Meus agendamentos — AD CRM" },
      { property: "og:description", content: "Suas conversas pedidas, confirmadas e realizadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeusAgendamentos,
});

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type OrdemKey = "data" | "hora_inicio" | "local" | "status";

function MeusAgendamentos() {
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "papo_reto" }, acesso);

  const [userId, setUserId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<Set<StatusPapo>>(new Set());
  const [ordem, setOrdem] = useState<OrdemKey>("data");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(10);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const consulta = useQuery({
    queryKey: ["papo-reto"],
    enabled: pode,
    queryFn: carregarPapoReto,
  });

  const meus = useMemo(
    () => (consulta.data?.agendamentos ?? []).filter((a) => a.user_id === userId),
    [consulta.data, userId],
  );

  const indicadores = useMemo(() => {
    const hoje = hojeISO();
    const confirmados = meus.filter((a) => a.status === "confirmado");
    const proximo = [...confirmados]
      .filter((a) => a.data >= hoje)
      .sort((a, b) => a.data.localeCompare(b.data))[0];
    const inicioMes = hoje.slice(0, 7);
    return {
      total: meus.length,
      doMes: meus.filter((a) => a.data.slice(0, 7) === inicioMes).length,
      realizados: confirmados.filter((a) => a.data < hoje).length,
      confirmados: confirmados.length,
      pendentes: meus.filter((a) => a.status === "pendente").length,
      recusados: meus.filter((a) => a.status === "recusado").length,
      proximo,
    };
  }, [meus]);

  /** Seis meses fechados, do mais antigo para o mais novo. */
  const porMes = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        chave,
        rotulo: MESES[d.getMonth()] ?? "",
        total: meus.filter((a) => a.data.slice(0, 7) === chave).length,
      };
    });
  }, [meus]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = meus.filter((a) => {
      if (filtroStatus.size > 0 && !filtroStatus.has(a.status)) return false;
      if (!termo) return true;
      return [a.assunto, a.mensagem ?? "", a.local ?? ""].some((v) =>
        v.toLowerCase().includes(termo),
      );
    });
    const sinal = direcao === "asc" ? 1 : -1;
    const campo = (a: Agendamento) =>
      ordem === "data"
        ? a.data
        : ordem === "hora_inicio"
          ? a.hora_inicio
          : ordem === "local"
            ? (a.local ?? "")
            : a.status;
    return [...lista].sort((a, b) => campo(a).localeCompare(campo(b), "pt-BR") * sinal);
  }, [meus, busca, filtroStatus, ordem, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtrados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);
  const maiorBarra = Math.max(1, ...porMes.map((m) => m.total));

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
        <PageHeader titulo="Meus agendamentos" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Meus agendamentos" />
        <SemPermissao mensagem="Sua conta não tem acesso ao papo reto." />
      </>
    );
  }

  const distribuicao = [
    { rotulo: "Aguardando resposta", total: indicadores.pendentes, cor: "bg-amber-500" },
    { rotulo: "Confirmado", total: indicadores.confirmados, cor: "bg-jt-success" },
    { rotulo: "Recusado", total: indicadores.recusados, cor: "bg-jt-coral" },
  ].filter((d) => d.total > 0);
  const somaDistribuicao = Math.max(
    1,
    distribuicao.reduce((s, d) => s + d.total, 0),
  );

  return (
    <>
      <PageHeader
        titulo="Meus agendamentos"
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {filtrados.length} de {meus.length}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardTopo
          icone={CalendarClock}
          rotulo="Total de agendamentos"
          valor={String(indicadores.total)}
          rodape={`${indicadores.doMes} neste mês`}
        />
        <StatCardTopo
          icone={CheckCircle2}
          rotulo="Realizados"
          valor={String(indicadores.realizados)}
          rodape={`de ${indicadores.confirmados} confirmado(s)`}
        />
        <StatCardTopo
          icone={Clock}
          rotulo="Aguardando resposta"
          valor={String(indicadores.pendentes)}
          rodape={`${indicadores.recusados} recusado(s)`}
        />
        <StatCardTopo
          icone={CalendarCheck}
          rotulo="Próximo agendamento"
          valor={indicadores.proximo ? dataParaBR(indicadores.proximo.data) : "—"}
          rodape={
            indicadores.proximo
              ? `${hora(indicadores.proximo.hora_inicio)}${indicadores.proximo.local ? ` · ${indicadores.proximo.local}` : ""}`
              : "nada marcado"
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Agendamentos por mês" descricao="Últimos 6 meses">
          <div className="flex h-40 items-end gap-3">
            {porMes.map((m) => (
              <div key={m.chave} className="flex h-full flex-1 flex-col justify-end gap-1">
                {m.total > 0 ? (
                  <span className="num text-center text-xs text-jt-muted">{m.total}</span>
                ) : null}
                <div
                  className="w-full rounded-sm bg-jt-blue"
                  style={{ height: `${Math.max((m.total / maiorBarra) * 100, 1)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            {porMes.map((m) => (
              <span key={m.chave} className="flex-1 text-center text-[11px] text-jt-muted">
                {m.rotulo}
              </span>
            ))}
          </div>
        </Bloco>

        <Bloco titulo="Situação" descricao="Distribuição dos seus agendamentos">
          {distribuicao.length === 0 ? (
            <p className="py-10 text-center text-sm text-jt-muted">Nada pedido ainda.</p>
          ) : (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-jt-panel-2">
                {distribuicao.map((d) => (
                  <div
                    key={d.rotulo}
                    className={d.cor}
                    style={{ width: `${(d.total / somaDistribuicao) * 100}%` }}
                    title={`${d.rotulo}: ${d.total}`}
                  />
                ))}
              </div>
              <ul className="mt-4 space-y-2">
                {distribuicao.map((d) => (
                  <li key={d.rotulo} className="flex items-center gap-2 text-sm">
                    <span className={cn("h-2 w-2 rounded-full", d.cor)} />
                    <span className="text-jt-muted">{d.rotulo}</span>
                    <span className="num ml-auto text-jt-text">{d.total}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Bloco>
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
              placeholder="Buscar por assunto, local, observação…"
            />
            <TableToolbarActions>
              <FilterMenu contador={filtroStatus.size} largura="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {(["pendente", "confirmado", "recusado", "concluido"] as const).map((s) => (
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
                    {rotuloStatus(s).rotulo}
                  </DropdownMenuCheckboxItem>
                ))}
              </FilterMenu>
            </TableToolbarActions>
          </TableToolbar>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-jt-line hover:bg-transparent">
                  <SortableHead
                    rotulo="Data"
                    chave="data"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                  <SortableHead
                    rotulo="Horário"
                    chave="hora_inicio"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                  <SortableHead
                    rotulo="Local"
                    chave="local"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                  <TableHead className="text-jt-muted">Assunto</TableHead>
                  <TableHead className="text-jt-muted">Observação</TableHead>
                  <SortableHead
                    rotulo="Status"
                    chave="status"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.isLoading ? (
                  <EmptyRow colSpan={6}>Carregando…</EmptyRow>
                ) : daPagina.length === 0 ? (
                  <EmptyRow colSpan={6}>Você ainda não pediu nenhum papo reto.</EmptyRow>
                ) : (
                  daPagina.map((a) => {
                    const status = rotuloStatus(a.status);
                    return (
                      <TableRow key={a.id} className="border-jt-line hover:bg-jt-panel-2">
                        <TableCell className="num whitespace-nowrap text-jt-text">
                          {dataParaBR(a.data)}
                        </TableCell>
                        <TableCell className="num whitespace-nowrap text-jt-muted">
                          {hora(a.hora_inicio)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-jt-muted">
                          {a.local ?? "—"}
                        </TableCell>
                        <TableCell className="text-jt-text">{a.assunto}</TableCell>
                        <TableCell className="text-jt-muted">{a.mensagem ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className={cn("border-transparent font-normal", status.classe)}>
                            {status.rotulo}
                          </Badge>
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
            unidade="registros"
          />
        </TableShell>
      </div>
    </>
  );
}
