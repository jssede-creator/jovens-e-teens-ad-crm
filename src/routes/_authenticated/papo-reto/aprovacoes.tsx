import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Check, ClipboardList, Clock, MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import {
  AvatarIniciais,
  Bloco,
  PageHeader,
  StatCardTopo,
  VazioBloco,
} from "@/components/crm/pagina";
import { FilterMenu, TablePagination, TableSearch } from "@/components/crm/tabela";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuCheckboxItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { iniciais } from "@/lib/ebd";
import { dataParaBR, hora, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { carregarPapoReto, rotuloStatus, type StatusPapo } from "@/lib/papo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/papo-reto/aprovacoes")({
  head: () => ({
    meta: [
      { title: "Aprovações — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Solicitações de conversa aguardando resposta." },
      { property: "og:title", content: "Aprovações — AD CRM" },
      { property: "og:description", content: "Solicitações de conversa aguardando resposta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PapoRetoAprovacoes,
});

type Aba = "pendentes" | "respondidas" | "todas";

function PapoRetoAprovacoes() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "papo_reto_gerenciar" }, acesso);

  const [aba, setAba] = useState<Aba>("pendentes");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<Set<StatusPapo>>(new Set());
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(10);
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["papo-reto"],
    enabled: pode,
    queryFn: carregarPapoReto,
  });

  const pedidos = useMemo(() => consulta.data?.agendamentos ?? [], [consulta.data]);

  const responder = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "confirmado" | "recusado" }) => {
      const { error } = await supabase
        .from("papo_reto_agendamentos")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      await registrarAuditoria({ acao: status, entidade: "papo_reto", entidadeId: id });
    },
    onSuccess: async () => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["papo-reto"] });
      await queryClient.invalidateQueries({ queryKey: ["inicio"] });
      await queryClient.invalidateQueries({ queryKey: ["calendario"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const indicadores = {
    pendentes: pedidos.filter((p) => p.status === "pendente").length,
    aceitas: pedidos.filter((p) => p.status === "confirmado").length,
    recusadas: pedidos.filter((p) => p.status === "recusado").length,
    total: pedidos.length,
  };

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos
      .filter((p) =>
        aba === "pendentes"
          ? p.status === "pendente"
          : aba === "respondidas"
            ? p.status !== "pendente"
            : true,
      )
      .filter((p) => (filtroStatus.size > 0 ? filtroStatus.has(p.status) : true))
      .filter((p) => {
        if (!termo) return true;
        return [
          p.solicitante_nome,
          p.solicitante_email,
          p.assunto,
          p.mensagem ?? "",
          p.local ?? "",
        ].some((v) => v.toLowerCase().includes(termo));
      })
      .sort((a, b) => (b.data + b.hora_inicio).localeCompare(a.data + a.hora_inicio));
  }, [pedidos, aba, filtroStatus, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtrados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Aprovações" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Aprovações" />
        <SemPermissao mensagem="Só quem responde o papo reto vê as solicitações." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Aprovações"
        descricao='Solicitações de "Papo reto com liderança".'
        contagem={
          <Badge variant="outline" className="border-jt-line font-medium text-jt-blue">
            Vendo todo o ministério
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardTopo
          icone={ClipboardList}
          rotulo="Aguardando você"
          valor={String(indicadores.pendentes)}
        />
        <StatCardTopo icone={Check} rotulo="Aceitas" valor={String(indicadores.aceitas)} />
        <StatCardTopo icone={X} rotulo="Recusadas" valor={String(indicadores.recusadas)} />
        <StatCardTopo
          icone={CalendarDays}
          rotulo="Total recebido"
          valor={String(indicadores.total)}
        />
      </div>

      {erro ? <p className="mt-3 text-xs text-jt-coral">{erro}</p> : null}

      <div className="mt-4">
        <Bloco>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-jt-line bg-jt-panel-2 p-1">
              {(
                [
                  ["pendentes", "Pendentes", indicadores.pendentes],
                  ["respondidas", "Respondidas", indicadores.aceitas + indicadores.recusadas],
                  ["todas", "Todas", indicadores.total],
                ] as const
              ).map(([chave, rotulo, contagem]) => (
                <button
                  key={chave}
                  type="button"
                  onClick={() => {
                    setAba(chave);
                    setPagina(1);
                  }}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
                    aba === chave ? "bg-jt-blue text-white" : "text-jt-muted hover:text-jt-text",
                  )}
                >
                  {rotulo}
                  <span className="num text-xs opacity-70">{contagem}</span>
                </button>
              ))}
            </div>

            <div className="min-w-[220px] flex-1">
              <TableSearch
                valor={busca}
                onChange={(v) => {
                  setBusca(v);
                  setPagina(1);
                }}
                placeholder="Buscar por pessoa, sala, observação…"
              />
            </div>

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
          </div>

          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : daPagina.length === 0 ? (
            <VazioBloco>
              {aba === "pendentes"
                ? "Nenhuma solicitação aguardando resposta."
                : "Nenhuma solicitação corresponde aos filtros."}
            </VazioBloco>
          ) : (
            <ul className="grid gap-3 xl:grid-cols-2">
              {daPagina.map((p) => {
                const status = rotuloStatus(p.status);
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "rounded-xl border border-jt-line border-l-4 p-3.5",
                      p.status === "pendente"
                        ? "border-l-amber-500"
                        : p.status === "confirmado"
                          ? "border-l-jt-success"
                          : "border-l-jt-coral",
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <AvatarIniciais texto={iniciais(p.solicitante_nome)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-jt-text">
                          {p.solicitante_nome}
                        </p>
                        <p className="num mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jt-muted">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                            {dataParaBR(p.data)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {hora(p.hora_inicio)}
                          </span>
                          {p.local ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" aria-hidden />
                              {p.local}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <Badge className={cn("border-transparent font-normal", status.classe)}>
                        {status.rotulo}
                      </Badge>
                    </div>

                    <p className="mt-2.5 text-sm text-jt-text">{p.assunto}</p>
                    {p.mensagem ? (
                      <p className="mt-1.5 rounded-lg bg-jt-panel-2 px-3 py-2 text-xs text-jt-muted">
                        {p.mensagem}
                      </p>
                    ) : null}

                    {p.status === "pendente" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <PillButton
                          className="h-9 rounded-full px-4 text-[13px]"
                          disabled={responder.isPending}
                          onClick={() => responder.mutate({ id: p.id, status: "confirmado" })}
                        >
                          <Check className="h-4 w-4" aria-hidden /> Aceitar
                        </PillButton>
                        <PillButton
                          variante="outline"
                          className="h-9 rounded-full px-4 text-[13px]"
                          disabled={responder.isPending}
                          onClick={() => responder.mutate({ id: p.id, status: "recusado" })}
                        >
                          <X className="h-4 w-4" aria-hidden /> Recusar
                        </PillButton>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="-mx-5 -mb-5 mt-4">
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
              unidade="solicitações"
            />
          </div>
        </Bloco>
      </div>
    </>
  );
}
