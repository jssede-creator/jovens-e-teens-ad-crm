import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Check, Trash2, X } from "lucide-react";
import { useState } from "react";

import { DateInput, Field, PillButton, SelectInput } from "@/components/cadastro/ui";
import { AvatarIniciais, Bloco, PageHeader, VazioBloco } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { hojeISO, iniciais } from "@/lib/ebd";
import { dataParaBR, hora, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { STATUS_PAPO } from "@/lib/papo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/papo-reto/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda do papo reto — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Pedidos de conversa e horários abertos." },
      { property: "og:title", content: "Agenda do papo reto — AD CRM" },
      { property: "og:description", content: "Pedidos de conversa e horários abertos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PapoRetoAgenda,
});

const HORARIOS = Array.from({ length: 33 }, (_, i) => {
  const minutos = 6 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});

function PapoRetoAgenda() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "papo_reto" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "papo_reto_gerenciar" }, acesso);

  const [data, setData] = useState(hojeISO());
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["papo-reto-agenda"],
    enabled: pode,
    queryFn: async () => {
      const [horarios, agendamentos] = await Promise.all([
        supabase
          .from("papo_reto_horarios")
          .select("id, data, hora_inicio, hora_fim")
          .order("data")
          .order("hora_inicio"),
        supabase
          .from("papo_reto_agendamentos")
          .select(
            "id, solicitante_nome, solicitante_email, data, hora_inicio, hora_fim, assunto, mensagem, status, horario_id",
          )
          .order("data", { ascending: false }),
      ]);
      if (horarios.error) throw horarios.error;
      if (agendamentos.error) throw agendamentos.error;
      return { horarios: horarios.data ?? [], agendamentos: agendamentos.data ?? [] };
    },
  });

  const abrirHorario = useMutation({
    mutationFn: async () => {
      if (!data || !inicio || !fim) throw new Error("campos");
      if (fim <= inicio) throw new Error("ordem");
      const { error } = await supabase
        .from("papo_reto_horarios")
        .insert({ data, hora_inicio: inicio, hora_fim: fim });
      if (error) throw error;
      await registrarAuditoria({
        acao: "abriu",
        entidade: "papo_reto_horario",
        detalhe: `${data} ${inicio}–${fim}`,
      });
    },
    onSuccess: async () => {
      setInicio("");
      setFim("");
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["papo-reto-agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["papo-reto-agendar"] });
      await queryClient.invalidateQueries({ queryKey: ["calendario"] });
    },
    onError: (e) => {
      const msg = (e as Error).message;
      setErro(
        msg === "campos"
          ? "Preencha data e os dois horários."
          : msg === "ordem"
            ? "O horário final precisa ser depois do inicial."
            : mensagemErro(e),
      );
    },
  });

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
      await queryClient.invalidateQueries({ queryKey: ["papo-reto-agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["papo-reto-agendar"] });
      await queryClient.invalidateQueries({ queryKey: ["inicio"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const removerHorario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("papo_reto_horarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["papo-reto-agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["papo-reto-agendar"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Agenda — Papo reto" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Agenda — Papo reto" />
        <SemPermissao mensagem="Sua conta não tem acesso ao papo reto." />
      </>
    );
  }

  const pedidos = consulta.data?.agendamentos ?? [];
  const horarios = consulta.data?.horarios ?? [];
  const ocupados = new Set(
    pedidos.filter((p) => p.status !== "recusado" && p.horario_id).map((p) => p.horario_id),
  );

  return (
    <>
      <PageHeader
        titulo="Agenda — Papo reto"
        descricao="Pedidos de conversa e horários que a liderança deixou abertos."
      />

      {erro ? <p className="mb-3 text-xs text-jt-coral">{erro}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Bloco titulo="Pedidos" descricao="Do mais recente para o mais antigo">
          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : pedidos.length === 0 ? (
            <VazioBloco>Nenhum pedido de conversa até agora.</VazioBloco>
          ) : (
            <ul className="space-y-2">
              {pedidos.map((p) => {
                const status = STATUS_PAPO[p.status] ?? STATUS_PAPO["pendente"]!;
                return (
                  <li key={p.id} className="rounded-xl border border-jt-line p-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <AvatarIniciais texto={iniciais(p.solicitante_nome)} tamanho="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-jt-text">
                          {p.solicitante_nome}
                        </p>
                        <p className="truncate text-xs text-jt-muted">{p.solicitante_email}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("border-jt-line font-normal", status.classe)}
                      >
                        {status.rotulo}
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm text-jt-text">{p.assunto}</p>
                    {p.mensagem ? <p className="mt-1 text-xs text-jt-muted">{p.mensagem}</p> : null}
                    <p className="num mt-1 text-xs text-jt-muted">
                      {dataParaBR(p.data)} · {hora(p.hora_inicio)}–{hora(p.hora_fim)}
                    </p>

                    {podeGerenciar && p.status === "pendente" ? (
                      <div className="mt-3 flex gap-2">
                        <PillButton
                          className="h-8 rounded-full px-3 text-xs"
                          onClick={() => responder.mutate({ id: p.id, status: "confirmado" })}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden /> Confirmar
                        </PillButton>
                        <PillButton
                          variante="outline"
                          className="h-8 rounded-full px-3 text-xs"
                          onClick={() => responder.mutate({ id: p.id, status: "recusado" })}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden /> Recusar
                        </PillButton>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>

        <div className="space-y-4">
          {podeGerenciar ? (
            <Bloco titulo="Abrir horário" descricao="A janela fica visível para os membros">
              <div className="space-y-3">
                <Field label="Data">
                  <DateInput value={data} onValueChange={setData} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Início">
                    <SelectInput
                      opcoes={HORARIOS.map((h) => ({ valor: h, rotulo: h }))}
                      placeholder="Selecione"
                      value={inicio}
                      onValueChange={setInicio}
                    />
                  </Field>
                  <Field label="Fim">
                    <SelectInput
                      opcoes={HORARIOS.map((h) => ({ valor: h, rotulo: h }))}
                      placeholder="Selecione"
                      value={fim}
                      onValueChange={setFim}
                    />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <PillButton
                    disabled={abrirHorario.isPending}
                    onClick={() => abrirHorario.mutate()}
                    className="h-9 rounded-full px-4 text-[13px]"
                  >
                    <CalendarPlus className="h-4 w-4" aria-hidden /> Abrir horário
                  </PillButton>
                </div>
              </div>
            </Bloco>
          ) : null}

          <Bloco titulo="Horários cadastrados">
            {horarios.length === 0 ? (
              <VazioBloco>Nenhum horário aberto.</VazioBloco>
            ) : (
              <ul className="space-y-2">
                {horarios.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-jt-line px-3 py-2"
                  >
                    <div>
                      <p className="num text-sm text-jt-text">{dataParaBR(h.data)}</p>
                      <p className="num text-xs text-jt-muted">
                        {hora(h.hora_inicio)}–{hora(h.hora_fim)}
                        {ocupados.has(h.id) ? " · ocupado" : " · livre"}
                      </p>
                    </div>
                    {podeGerenciar && !ocupados.has(h.id) ? (
                      <button
                        type="button"
                        aria-label="Remover horário"
                        onClick={() => removerHorario.mutate(h.id)}
                        className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      </div>
    </>
  );
}
