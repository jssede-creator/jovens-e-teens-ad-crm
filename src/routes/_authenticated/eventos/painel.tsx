import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, CalendarPlus, Ticket, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { Comprovante, type DadosComprovante } from "@/components/crm/comprovante";
import { EventoCard } from "@/components/crm/evento-card";
import { Bloco, PageHeader, StatCardTopo, VazioBloco } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { hojeISO } from "@/lib/ebd";
import { carregarEventos, taxaFormatada, type Evento } from "@/lib/eventos";
import { dataParaBR, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/eventos/painel")({
  head: () => ({
    meta: [
      { title: "Painel de eventos — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Próximos eventos do ministério e suas reservas." },
      { property: "og:title", content: "Painel de eventos — AD CRM" },
      { property: "og:description", content: "Próximos eventos do ministério e suas reservas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EventosPainel,
});

function EventosPainel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "eventos" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "eventos_gerenciar" }, acesso);

  const [conta, setConta] = useState<{ id: string; nome: string; email: string } | null>(null);
  const [erro, setErro] = useState("");
  const [comprovante, setComprovante] = useState<DadosComprovante | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      setConta({
        id: user.id,
        nome: (user.user_metadata?.["nome"] as string | undefined) ?? user.email ?? "—",
        email: user.email ?? "",
      });
    });
  }, []);

  const consulta = useQuery({
    queryKey: ["eventos", conta?.id ?? null],
    enabled: pode && conta !== null,
    queryFn: () => carregarEventos(conta?.id ?? null),
  });

  const eventos = useMemo(() => consulta.data ?? [], [consulta.data]);
  const hoje = hojeISO();
  const proximos = eventos.filter((e) => e.data >= hoje && e.status !== "cancelado");
  const meus = eventos.filter((e) => e.minhaInscricao !== null && e.data >= hoje);

  const aguardando = meus.filter((e) => e.meuPagamento === "pendente").length;
  const indicadores = {
    proximos: proximos.length,
    inscritos: proximos.reduce((soma, e) => soma + e.inscritos, 0),
    minhas: meus.length,
    aguardando,
  };

  const reservar = useMutation({
    mutationFn: async (evento: Evento) => {
      if (!conta) throw new Error("sessao");
      const { error } = await supabase.from("evento_inscricoes").insert({
        evento_id: evento.id,
        user_id: conta.id,
        nome: conta.nome,
        email: conta.email,
      });
      if (error) throw error;
      await registrarAuditoria({
        acao: "reservou",
        entidade: "evento",
        entidadeId: evento.id,
        detalhe: evento.titulo,
      });
    },
    onSuccess: async () => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const abrirComprovante = (e: Evento) => {
    if (!conta) return;
    setComprovante({
      codigo: e.meuCodigo ?? "—",
      participante: conta.nome,
      email: conta.email,
      evento: e.titulo,
      data: e.data,
      horaInicio: e.hora_inicio,
      local: e.local,
      taxa: e.taxa,
      confirmadoEm: e.minhaConfirmacao,
      confirmadoPor: null,
    });
  };

  const cancelar = useMutation({
    mutationFn: async (evento: Evento) => {
      if (!evento.minhaInscricao) return;
      const { error } = await supabase
        .from("evento_inscricoes")
        .delete()
        .eq("id", evento.minhaInscricao);
      if (error) throw error;
      await registrarAuditoria({
        acao: "cancelou reserva",
        entidade: "evento",
        entidadeId: evento.id,
        detalhe: evento.titulo,
      });
    },
    onSuccess: async () => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Painel — Eventos" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Painel — Eventos" />
        <SemPermissao mensagem="Sua conta não tem acesso aos eventos do ministério." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Painel — Eventos"
        descricao="O que vem por aí no ministério e onde você já garantiu vaga."
        acoes={
          podeGerenciar ? (
            <PillButton
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={() => navigate({ to: "/eventos/lista" })}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden /> Novo evento
            </PillButton>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardTopo
          icone={CalendarDays}
          rotulo="Próximos eventos"
          valor={String(indicadores.proximos)}
          rodape="de hoje em diante"
        />
        <StatCardTopo
          icone={Users}
          rotulo="Inscrições confirmadas"
          valor={String(indicadores.inscritos)}
          rodape="nos próximos eventos"
        />
        <StatCardTopo
          icone={Ticket}
          rotulo="Minhas reservas"
          valor={String(indicadores.minhas)}
          rodape="vagas garantidas"
        />
        <StatCardTopo
          icone={Ticket}
          rotulo="Aguardando confirmação"
          valor={String(indicadores.aguardando)}
          rodape="reservas suas com PIX pendente"
        />
      </div>

      {erro ? <p className="mt-3 text-xs text-jt-coral">{erro}</p> : null}

      <div className="mt-4 space-y-4">
        <Bloco
          titulo="Próximos eventos"
          descricao={
            consulta.isLoading ? "Carregando…" : `${proximos.length} evento(s) com data marcada`
          }
        >
          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : proximos.length === 0 ? (
            <VazioBloco>
              Nenhum evento marcado.
              {podeGerenciar ? " Crie o primeiro em Eventos › Lista." : ""}
            </VazioBloco>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {proximos.map((e) => (
                <EventoCard
                  key={e.id}
                  evento={e}
                  ocupado={reservar.isPending || cancelar.isPending}
                  onReservar={(alvo) => reservar.mutate(alvo)}
                  onCancelar={(alvo) => cancelar.mutate(alvo)}
                  onComprovante={abrirComprovante}
                />
              ))}
            </div>
          )}
        </Bloco>

        <Bloco titulo="Minhas reservas" descricao="Eventos em que você garantiu vaga">
          {meus.length === 0 ? (
            <VazioBloco>Você ainda não reservou vaga em nenhum evento.</VazioBloco>
          ) : (
            <ul className="space-y-2">
              {meus.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-jt-line px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-jt-text">{e.titulo}</p>
                    <p className="num truncate text-xs text-jt-muted">
                      {dataParaBR(e.data)} · {e.local} · {taxaFormatada(e.taxa)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {e.meuPagamento === "pendente" ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        aguardando confirmação
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => abrirComprovante(e)}
                        className="text-xs font-medium text-jt-blue underline-offset-2 hover:underline"
                      >
                        ver comprovante
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => cancelar.mutate(e)}
                      disabled={cancelar.isPending}
                      className="text-xs text-jt-muted underline-offset-2 transition hover:text-jt-coral hover:underline disabled:opacity-40"
                    >
                      cancelar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>

      <Dialog
        open={comprovante !== null}
        onOpenChange={(v) => (!v ? setComprovante(null) : undefined)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-none bg-transparent p-0 shadow-none sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Comprovante de inscrição</DialogTitle>
            <DialogDescription>Extrato da sua presença confirmada.</DialogDescription>
          </DialogHeader>
          {comprovante ? <Comprovante dados={comprovante} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
