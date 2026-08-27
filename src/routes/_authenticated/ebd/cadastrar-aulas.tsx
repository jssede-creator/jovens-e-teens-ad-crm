import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, PillButton, SelectInput, TextInput } from "@/components/cadastro/ui";
import { CalendarioMes } from "@/components/crm/calendario-mes";
import { PageHeader } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { hojeISO } from "@/lib/ebd";
import { hora, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/ebd/cadastrar-aulas")({
  head: () => ({
    meta: [
      { title: "Cadastrar aulas — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Agende as aulas de cada turma." },
      { property: "og:title", content: "Cadastrar aulas — AD CRM" },
      { property: "og:description", content: "Agende as aulas de cada turma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CadastrarAulas,
});

/** Horários de 30 em 30 minutos, das 06h às 22h. */
const HORARIOS = Array.from({ length: 33 }, (_, i) => {
  const minutos = 6 * 60 + i * 30;
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
});

const DIA_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function porExtenso(dataISO: string) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(ano!, (mes ?? 1) - 1, dia ?? 1);
  return `${DIA_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function CadastrarAulas() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "ebd" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "ebd_turmas" }, acesso);

  const [mes, setMes] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const [selecionado, setSelecionado] = useState(hojeISO());
  const [congregacaoId, setCongregacaoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [nomeAula, setNomeAula] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["ebd-aulas-cadastro"],
    enabled: pode,
    queryFn: async () => {
      const [congregacoes, turmas, aulas] = await Promise.all([
        supabase.from("congregacoes").select("id, nome").eq("status", "ativa").order("nome"),
        supabase.from("ebd_turmas").select("id, nome, congregacao_id").order("nome"),
        supabase
          .from("ebd_aulas")
          .select("id, turma_id, nome, data, hora_inicio, hora_fim")
          .order("data"),
      ]);
      if (congregacoes.error) throw congregacoes.error;
      if (turmas.error) throw turmas.error;
      if (aulas.error) throw aulas.error;
      return {
        congregacoes: congregacoes.data ?? [],
        turmas: turmas.data ?? [],
        aulas: aulas.data ?? [],
      };
    },
  });

  const turmasDaCongregacao = useMemo(
    () => (consulta.data?.turmas ?? []).filter((t) => t.congregacao_id === congregacaoId),
    [consulta.data, congregacaoId],
  );

  const nomeTurma = useMemo(
    () => new Map((consulta.data?.turmas ?? []).map((t) => [t.id, t.nome])),
    [consulta.data],
  );

  const aulasDoDia = (consulta.data?.aulas ?? []).filter((a) => a.data === selecionado);
  const marcas = (consulta.data?.aulas ?? []).map((a) => ({ data: a.data, cor: "bg-jt-blue" }));

  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("ebd_aulas")
        .insert({
          turma_id: turmaId,
          nome: nomeAula.trim(),
          data: selecionado,
          hora_inicio: inicio,
          hora_fim: fim,
        })
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria({
        acao: "criou",
        entidade: "ebd_aula",
        entidadeId: data.id,
        detalhe: `${nomeAula.trim()} · ${selecionado}`,
      });
    },
    onSuccess: async () => {
      setNomeAula("");
      setInicio("");
      setFim("");
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["ebd-aulas-cadastro"] });
      await queryClient.invalidateQueries({ queryKey: ["ebd-painel"] });
      await queryClient.invalidateQueries({ queryKey: ["calendario"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ebd_aulas").delete().eq("id", id);
      if (error) throw error;
      await registrarAuditoria({ acao: "excluiu", entidade: "ebd_aula", entidadeId: id });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ebd-aulas-cadastro"] });
      await queryClient.invalidateQueries({ queryKey: ["ebd-painel"] });
      await queryClient.invalidateQueries({ queryKey: ["calendario"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function enviar() {
    if (!turmaId || !nomeAula.trim() || !inicio || !fim) {
      setErro("Preencha congregação, turma, nome e os dois horários.");
      return;
    }
    if (fim <= inicio) {
      setErro("O horário final precisa ser depois do inicial.");
      return;
    }
    criar.mutate();
  }

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Cadastrar aulas" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Cadastrar aulas" />
        <SemPermissao mensagem="Sua conta não tem permissão de liderança para ver a EBD." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Cadastrar aulas"
        descricao="Os dias marcados já têm aula cadastrada em alguma turma. Escolha um dia pra ver ou adicionar aulas."
        acoes={
          <PillButton
            variante="outline"
            className="h-9 rounded-full px-4 text-[13px]"
            onClick={() => {
              const h = new Date();
              setMes(new Date(h.getFullYear(), h.getMonth(), 1));
              setSelecionado(hojeISO());
            }}
          >
            Hoje
          </PillButton>
        }
      />

      <div className="rounded-[20px] border border-jt-line bg-jt-panel p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <CalendarioMes
            mes={mes}
            onMes={setMes}
            selecionado={selecionado}
            onSelecionar={setSelecionado}
            marcas={marcas}
            legenda="Tem aula cadastrada"
          />

          <div className="rounded-[20px] border border-jt-line bg-jt-panel p-5">
            <h2 className="font-display text-lg font-semibold text-jt-text">
              {porExtenso(selecionado)}
            </h2>

            {aulasDoDia.length === 0 ? (
              <p className="mt-3 text-sm text-jt-muted">Nenhuma aula cadastrada nesse dia ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {aulasDoDia.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-jt-line px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-jt-text">{a.nome}</p>
                      <p className="truncate text-xs text-jt-muted">
                        {nomeTurma.get(a.turma_id) ?? "—"} · {hora(a.hora_inicio)}–
                        {hora(a.hora_fim)}
                      </p>
                    </div>
                    {podeGerenciar ? (
                      <button
                        type="button"
                        aria-label={`Excluir aula ${a.nome}`}
                        onClick={() => excluir.mutate(a.id)}
                        className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {podeGerenciar ? (
              <div className="mt-5 space-y-4 border-t border-jt-line pt-4">
                <h3 className="text-sm font-semibold text-jt-text">Nova aula</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Congregação">
                    <SelectInput
                      opcoes={(consulta.data?.congregacoes ?? []).map((c) => ({
                        valor: c.id,
                        rotulo: c.nome,
                      }))}
                      placeholder="Selecione"
                      value={congregacaoId}
                      onValueChange={(v) => {
                        setCongregacaoId(v);
                        setTurmaId("");
                      }}
                    />
                  </Field>
                  <Field label="Turma">
                    <SelectInput
                      opcoes={turmasDaCongregacao.map((t) => ({ valor: t.id, rotulo: t.nome }))}
                      placeholder={congregacaoId ? "Selecione" : "Escolha a congregação primeiro"}
                      disabled={!congregacaoId}
                      value={turmaId}
                      onValueChange={setTurmaId}
                    />
                  </Field>
                </div>

                <Field label="Nome da aula">
                  <TextInput
                    placeholder="Ex.: A parábola do semeador"
                    value={nomeAula}
                    onValueChange={setNomeAula}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Horário início">
                    <SelectInput
                      opcoes={HORARIOS.map((h) => ({ valor: h, rotulo: h }))}
                      placeholder="Selecione"
                      value={inicio}
                      onValueChange={setInicio}
                    />
                  </Field>
                  <Field label="Horário fim">
                    <SelectInput
                      opcoes={HORARIOS.map((h) => ({ valor: h, rotulo: h }))}
                      placeholder="Selecione"
                      value={fim}
                      onValueChange={setFim}
                    />
                  </Field>
                </div>

                {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}

                <div className="flex justify-end">
                  <PillButton onClick={enviar} disabled={criar.isPending}>
                    Cadastrar aula <CalendarPlus className="h-4 w-4" aria-hidden />
                  </PillButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
