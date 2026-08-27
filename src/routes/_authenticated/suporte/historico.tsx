import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/crm/pagina";
import {
  EmptyRow,
  FilterMenu,
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
import { dataHoraBR } from "@/lib/formato";
import { podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/suporte/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Trilha de auditoria do sistema." },
      { property: "og:title", content: "Histórico — AD CRM" },
      { property: "og:description", content: "Trilha de auditoria do sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuporteHistorico,
});

function SuporteHistorico() {
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "suporte" }, acesso);

  const [busca, setBusca] = useState("");
  const [entidades, setEntidades] = useState<Set<string>>(new Set());
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(25);

  const consulta = useQuery({
    queryKey: ["auditoria"],
    enabled: pode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditoria")
        .select("id, user_nome, acao, entidade, detalhe, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const todas = useMemo(() => consulta.data ?? [], [consulta.data]);
  const tiposEntidade = useMemo(
    () => [...new Set(todas.map((a) => a.entidade))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [todas],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todas.filter((a) => {
      if (entidades.size > 0 && !entidades.has(a.entidade)) return false;
      if (!termo) return true;
      return [a.user_nome, a.acao, a.entidade, a.detalhe ?? ""].some((v) =>
        v.toLowerCase().includes(termo),
      );
    });
  }, [todas, busca, entidades]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtradas.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Histórico — Suporte" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Histórico — Suporte" />
        <SemPermissao mensagem="Sua conta não tem permissão para ver o histórico do sistema." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Histórico — Suporte"
        descricao="Cada ação registrada no CRM: quem fez, o quê e quando."
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {filtradas.length} de {todas.length}
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
            placeholder="Buscar por pessoa, ação, registro…"
          />
          <TableToolbarActions>
            <FilterMenu contador={entidades.size} largura="w-56">
              <DropdownMenuLabel>Tipo de registro</DropdownMenuLabel>
              {tiposEntidade.map((e) => (
                <DropdownMenuCheckboxItem
                  key={e}
                  checked={entidades.has(e)}
                  onCheckedChange={(marcado) => {
                    setPagina(1);
                    setEntidades((atual) => {
                      const proximo = new Set(atual);
                      if (marcado) proximo.add(e);
                      else proximo.delete(e);
                      return proximo;
                    });
                  }}
                >
                  {e}
                </DropdownMenuCheckboxItem>
              ))}
            </FilterMenu>
          </TableToolbarActions>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <TableHead className="text-jt-muted">Quando</TableHead>
                <TableHead className="text-jt-muted">Quem</TableHead>
                <TableHead className="text-jt-muted">Ação</TableHead>
                <TableHead className="text-jt-muted">Registro</TableHead>
                <TableHead className="text-jt-muted">Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consulta.isLoading ? (
                <EmptyRow colSpan={5}>Carregando…</EmptyRow>
              ) : consulta.isError ? (
                <EmptyRow colSpan={5}>Não foi possível carregar o histórico.</EmptyRow>
              ) : daPagina.length === 0 ? (
                <EmptyRow colSpan={5}>Nenhuma ação registrada ainda.</EmptyRow>
              ) : (
                daPagina.map((a) => (
                  <TableRow key={a.id} className="border-jt-line hover:bg-jt-panel-2">
                    <TableCell className="num whitespace-nowrap text-jt-muted">
                      {dataHoraBR(a.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-jt-text">{a.user_nome}</TableCell>
                    <TableCell className="text-jt-text">{a.acao}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-jt-line font-normal text-jt-muted">
                        {a.entidade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-jt-muted">{a.detalhe ?? "—"}</TableCell>
                  </TableRow>
                ))
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
    </>
  );
}
