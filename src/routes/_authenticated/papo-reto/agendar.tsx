import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Field, PillButton, TextInput } from "@/components/cadastro/ui";
import { Bloco, PageHeader, VazioBloco } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { hojeISO } from "@/lib/ebd";
import { dataParaBR, hora, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { STATUS_PAPO } from "@/lib/papo";
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
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "papo_reto" }, acesso);

  const [horarioId, setHorarioId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [conta, setConta] = useState<{ id: string; nome: string; email: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setConta({
        id: user.id,
        nome: (user.user_metadata?.["nome"] as string | undefined) ?? user.email ?? "—",
        email: user.email ?? "",
      });
    });
  }, []);

  const consulta = useQuery({
    queryKey: ["papo-reto-agendar"],
    enabled: pode,
    queryFn: async () => {
      const hoje = hojeISO();
      const [horarios, agendamentos] = await Promise.all([
        supabase
          .from("papo_reto_horarios")
          .select("id, data, hora_inicio, hora_fim")
          .gte("data", hoje)
          .order("data")
          .order("hora_inicio"),
        supabase
          .from("papo_reto_agendamentos")
          .select("id, horario_id, data, hora_inicio, hora_fim, assunto, status, resposta")
          .order("data", { ascending: false }),
      ]);
      if (horarios.error) throw horarios.error;
      if (agendamentos.error) throw agendamentos.error;
      return { horarios: horarios.data ?? [], agendamentos: agendamentos.data ?? [] };
    },
  });

  const ocupados = useMemo(
    () =>
      new Set(
        (consulta.data?.agendamentos ?? [])
          .filter((a) => a.status !== "recusado" && a.horario_id)
          .map((a) => a.horario_id as string),
      ),
    [consulta.data],
  );

  const livres = (consulta.data?.horarios ?? []).filter((h) => !ocupados.has(h.id));
  const meus = consulta.data?.agendamentos ?? [];

  const agendar = useMutation({
    mutationFn: async () => {
      const escolhido = livres.find((h) => h.id === horarioId);
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
          assunto: assunto.trim(),
          mensagem: mensagem.trim() || null,
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
      setHorarioId("");
      setAssunto("");
      setMensagem("");
      setErro("");
      setOk("Pedido enviado. A liderança responde por aqui.");
      await queryClient.invalidateQueries({ queryKey: ["papo-reto-agendar"] });
      await queryClient.invalidateQueries({ queryKey: ["papo-reto-agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["inicio"] });
    },
    onError: (e) =>
      setErro(
        (e as Error).message === "horario" ? "Escolha um horário disponível." : mensagemErro(e),
      ),
  });

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Papo reto" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Papo reto" />
        <SemPermissao mensagem="Sua conta não tem acesso ao papo reto." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Agendar papo reto"
        descricao="Escolha um dos horários abertos pela liderança e conte o assunto."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Horários abertos" descricao="Só aparecem datas de hoje em diante">
          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : livres.length === 0 ? (
            <VazioBloco>Nenhum horário aberto no momento.</VazioBloco>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {livres.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => setHorarioId(h.id)}
                    aria-pressed={horarioId === h.id}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition",
                      horarioId === h.id
                        ? "border-jt-gold/60 bg-jt-panel-2"
                        : "border-jt-line hover:bg-jt-panel-2",
                    )}
                  >
                    <p className="num text-sm font-medium text-jt-text">{dataParaBR(h.data)}</p>
                    <p className="num text-xs text-jt-muted">
                      {hora(h.hora_inicio)}–{hora(h.hora_fim)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-4 border-t border-jt-line pt-4">
            <Field label="Assunto" obrigatorio>
              <TextInput
                value={assunto}
                onValueChange={setAssunto}
                placeholder="Ex.: conversa sobre a liderança de louvor"
              />
            </Field>
            <Field label="Mensagem" dica="Opcional — ajuda a liderança a se preparar.">
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={3}
                className="w-full rounded-[12px] border border-jt-line bg-jt-panel-2 p-3 text-sm text-jt-text placeholder:text-jt-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
              />
            </Field>
            {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
            {ok ? <p className="text-xs text-jt-success">{ok}</p> : null}
            <div className="flex justify-end">
              <PillButton
                disabled={!horarioId || !assunto.trim() || agendar.isPending}
                onClick={() => agendar.mutate()}
              >
                <MessageCircle className="h-4 w-4" aria-hidden /> Pedir papo reto
              </PillButton>
            </div>
          </div>
        </Bloco>

        <Bloco titulo="Meus pedidos" descricao="Histórico das suas conversas">
          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : meus.length === 0 ? (
            <VazioBloco>Você ainda não pediu nenhum papo reto.</VazioBloco>
          ) : (
            <ul className="space-y-2">
              {meus.map((a) => {
                const status = STATUS_PAPO[a.status] ?? STATUS_PAPO["pendente"]!;
                return (
                  <li key={a.id} className="rounded-xl border border-jt-line px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-jt-text">{a.assunto}</p>
                      <Badge
                        variant="outline"
                        className={cn("border-jt-line font-normal", status.classe)}
                      >
                        {status.rotulo}
                      </Badge>
                    </div>
                    <p className="num mt-1 text-xs text-jt-muted">
                      {dataParaBR(a.data)} · {hora(a.hora_inicio)}–{hora(a.hora_fim)}
                    </p>
                    {a.resposta ? (
                      <p className="mt-1 text-xs text-jt-text">Resposta: {a.resposta}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>
      </div>
    </>
  );
}
