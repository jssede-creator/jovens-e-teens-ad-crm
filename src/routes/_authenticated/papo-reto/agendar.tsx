import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, MapPin, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Field, PillButton, TextInput } from "@/components/cadastro/ui";
import { Bloco, PageHeader, VazioBloco } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { hojeISO } from "@/lib/ebd";
import { dataParaBR, hora, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { carregarPapoReto, horariosLivres, type Horario } from "@/lib/papo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/papo-reto/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar papo reto — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Escolha um horário aberto e mande seu assunto." },
      { property: "og:title", content: "Agendar papo reto — AD CRM" },
      { property: "og:description", content: "Escolha um horário aberto e mande seu assunto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PapoRetoAgendar,
});

function PapoRetoAgendar() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "papo_reto" }, acesso);

  const [horarioId, setHorarioId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [conta, setConta] = useState<{ id: string; nome: string; email: string } | null>(null);

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
    queryKey: ["papo-reto"],
    enabled: pode,
    queryFn: carregarPapoReto,
  });

  /** Janelas livres de hoje em diante, agrupadas por dia. */
  const porDia = useMemo(() => {
    const hoje = hojeISO();
    const livres = horariosLivres(
      consulta.data?.horarios ?? [],
      consulta.data?.agendamentos ?? [],
    ).filter((h) => h.data >= hoje);

    const mapa = new Map<string, Horario[]>();
    for (const h of livres) mapa.set(h.data, [...(mapa.get(h.data) ?? []), h]);
    return [...mapa].sort((a, b) => a[0].localeCompare(b[0]));
  }, [consulta.data]);

  const escolhido = porDia.flatMap(([, hs]) => hs).find((h) => h.id === horarioId);

  const agendar = useMutation({
    mutationFn: async () => {
      if (!escolhido || !conta) throw new Error("horario");
      const { data, error } = await supabase
        .from("papo_reto_agendamentos")
        .insert({
          user_id: conta.id,
          solicitante_nome: conta.nome,
          solicitante_email: conta.email,
          horario_id: escolhido.id,
          data: escolhido.data,
          hora_inicio: escolhido.hora_inicio,
          hora_fim: escolhido.hora_fim,
          ...(escolhido.local ? { local: escolhido.local } : {}),
          assunto: assunto.trim(),
          mensagem: observacao.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria({
        acao: "agendou",
        entidade: "papo_reto",
        entidadeId: data.id,
        detalhe: `${escolhido.data} ${escolhido.hora_inicio}`,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["papo-reto"] });
      await queryClient.invalidateQueries({ queryKey: ["inicio"] });
      navigate({ to: "/papo-reto/meus-agendamentos" });
    },
    onError: (e) =>
      setErro(
        (e as Error).message === "horario" ? "Escolha um horário disponível." : mensagemErro(e),
      ),
  });

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Agendar papo reto" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Agendar papo reto" />
        <SemPermissao mensagem="Sua conta não tem acesso ao papo reto." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Agendar papo reto"
        descricao="Escolha uma das janelas abertas pela liderança e conte o assunto. Cada pedido passa por aprovação."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Bloco titulo="Horários abertos" descricao="Só aparecem datas de hoje em diante">
          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : porDia.length === 0 ? (
            <VazioBloco>Nenhum horário aberto no momento.</VazioBloco>
          ) : (
            <div className="space-y-4">
              {porDia.map(([dia, janelas]) => (
                <div key={dia}>
                  <p className="num mb-2 text-xs font-medium uppercase tracking-wider text-jt-muted">
                    {dataParaBR(dia)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {janelas.map((h) => {
                      const ativo = horarioId === h.id;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setHorarioId(h.id)}
                          aria-pressed={ativo}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-left text-xs transition",
                            ativo
                              ? "border-transparent bg-jt-blue text-white"
                              : "border-jt-line text-jt-text hover:bg-jt-panel-2",
                          )}
                        >
                          <span className="num font-medium">{hora(h.hora_inicio)}</span>
                          {h.local ? (
                            <span className={cn("ml-1.5", ativo ? "opacity-80" : "text-jt-muted")}>
                              · {h.local}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Bloco>

        <Bloco titulo="Seu pedido">
          {escolhido ? (
            <div className="mb-4 rounded-xl border border-jt-line bg-jt-panel-2 p-3">
              <p className="flex items-center gap-2 text-sm text-jt-text">
                <CalendarClock className="h-4 w-4 text-jt-muted" aria-hidden />
                <span className="num">
                  {dataParaBR(escolhido.data)} · {hora(escolhido.hora_inicio)}–
                  {hora(escolhido.hora_fim)}
                </span>
              </p>
              {escolhido.local ? (
                <p className="mt-1 flex items-center gap-2 text-xs text-jt-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {escolhido.local}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mb-4 text-sm text-jt-muted">Escolha um horário ao lado para começar.</p>
          )}

          <div className="space-y-4">
            <Field label="Assunto" obrigatorio>
              <TextInput
                value={assunto}
                onValueChange={(v) => {
                  setAssunto(v);
                  setErro("");
                }}
                placeholder="Ex.: conversa sobre a equipe de louvor"
              />
            </Field>
            <Field label="Observação" dica="Opcional — ajuda a liderança a se preparar.">
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-jt-line bg-jt-panel p-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
              />
            </Field>
            {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
            <PillButton
              className="w-full"
              disabled={!horarioId || !assunto.trim() || agendar.isPending}
              onClick={() => agendar.mutate()}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {agendar.isPending ? "Enviando…" : "Pedir papo reto"}
            </PillButton>
          </div>
        </Bloco>
      </div>
    </>
  );
}
