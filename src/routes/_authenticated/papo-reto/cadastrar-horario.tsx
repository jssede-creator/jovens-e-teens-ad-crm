import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, CalendarRange, CheckCircle2, Lock, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, PillButton } from "@/components/cadastro/ui";
import { DataCampo, HORARIOS_DIA, HorariosGrade, SelectCampo } from "@/components/crm/campos";
import { Bloco, PageHeader, StatCardTopo, VazioBloco } from "@/components/crm/pagina";
import { TableSearch } from "@/components/crm/tabela";
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
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { registrarAuditoria } from "@/lib/auditoria";
import { hojeISO } from "@/lib/ebd";
import { dataParaBR, hora, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { carregarPapoReto, horariosLivres, LOCAIS_PAPO, type Horario } from "@/lib/papo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/papo-reto/cadastrar-horario")({
  head: () => ({
    meta: [
      { title: "Cadastrar horário — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Abra dia, sala e horários para os membros." },
      { property: "og:title", content: "Cadastrar horário — AD CRM" },
      { property: "og:description", content: "Abra dia, sala e horários para os membros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CadastrarHorario,
});

type Aba = "proximos" | "passados" | "todos";

type NovoHorario = Database["public"]["Tables"]["papo_reto_horarios"]["Insert"];

/** Fim de uma janela de 30 minutos. */
function meiaHoraDepois(inicio: string) {
  const [h, m] = inicio.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + 30;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function CadastrarHorario() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "papo_reto_gerenciar" }, acesso);

  const [dia, setDia] = useState("");
  const [local, setLocal] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [aba, setAba] = useState<Aba>("proximos");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<Horario | null>(null);

  const consulta = useQuery({
    queryKey: ["papo-reto"],
    enabled: pode,
    queryFn: carregarPapoReto,
  });

  const temLocal = consulta.data?.temLocal ?? false;
  const horarios = useMemo(() => consulta.data?.horarios ?? [], [consulta.data]);
  const agendamentos = useMemo(() => consulta.data?.agendamentos ?? [], [consulta.data]);
  const livres = horariosLivres(horarios, agendamentos);
  const idsLivres = new Set(livres.map((h) => h.id));
  const hoje = hojeISO();

  /** Horários já abertos naquele dia não podem ser abertos de novo. */
  const ocupadosNoDia = useMemo(
    () => horarios.filter((h) => h.data === dia).map((h) => h.hora_inicio.slice(0, 5)),
    [horarios, dia],
  );

  const abrir = useMutation({
    mutationFn: async () => {
      if (!dia || escolhidos.length === 0) throw new Error("campos");
      const registros = escolhidos.map((inicio) => ({
        data: dia,
        hora_inicio: inicio,
        hora_fim: meiaHoraDepois(inicio),
        ...(temLocal && local ? { local } : {}),
      }));
      // O cast cobre a coluna `local`, que os tipos gerados só conhecem depois
      // que a migração roda e o Lovable regenera o types.ts.
      let { error } = await supabase
        .from("papo_reto_horarios")
        .insert(registros as unknown as NovoHorario[]);

      // Sem a coluna local no banco, abre o horário sem sala e avisa.
      if (error?.code === "PGRST204" && local) {
        const semLocal = registros.map(({ local: _l, ...resto }) => resto);
        ({ error } = await supabase
          .from("papo_reto_horarios")
          .insert(semLocal as unknown as NovoHorario[]));
        if (!error) setAviso("Horário aberto sem a sala: o banco ainda não tem esse campo.");
      }
      if (error) throw error;
      await registrarAuditoria({
        acao: "abriu",
        entidade: "papo_reto_horario",
        detalhe: `${dia} · ${escolhidos.join(", ")}${local ? ` · ${local}` : ""}`,
      });
    },
    onSuccess: async () => {
      setEscolhidos([]);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["papo-reto"] });
      await queryClient.invalidateQueries({ queryKey: ["calendario"] });
    },
    onError: (e) =>
      setErro(
        (e as Error).message === "campos"
          ? "Escolha o dia e ao menos um horário."
          : mensagemErro(e),
      ),
  });

  const salvarEdicao = useMutation({
    mutationFn: async ({
      horario,
      dados,
    }: {
      horario: Horario;
      dados: { data: string; hora_inicio: string; hora_fim: string; local: string };
    }) => {
      const registro = {
        data: dados.data,
        hora_inicio: dados.hora_inicio,
        hora_fim: dados.hora_fim,
        ...(temLocal ? { local: dados.local || null } : {}),
      };
      let { error } = await supabase
        .from("papo_reto_horarios")
        .update(registro as never)
        .eq("id", horario.id);
      if (error?.code === "PGRST204") {
        const { local: _l, ...semLocal } = registro as Record<string, unknown>;
        ({ error } = await supabase
          .from("papo_reto_horarios")
          .update(semLocal as never)
          .eq("id", horario.id));
      }
      if (error) throw error;
      await registrarAuditoria({
        acao: "editou",
        entidade: "papo_reto_horario",
        entidadeId: horario.id,
        detalhe: dados.data + " " + dados.hora_inicio + (dados.local ? " · " + dados.local : ""),
      });
    },
    onSuccess: async () => {
      setEditando(null);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["papo-reto"] });
      await queryClient.invalidateQueries({ queryKey: ["calendario"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("papo_reto_horarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["papo-reto"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const listados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return horarios
      .filter((h) =>
        aba === "proximos" ? h.data >= hoje : aba === "passados" ? h.data < hoje : true,
      )
      .filter((h) => {
        if (!termo) return true;
        const pedido = agendamentos.find((a) => a.horario_id === h.id);
        return [h.local ?? "", dataParaBR(h.data), pedido?.solicitante_nome ?? ""].some((v) =>
          v.toLowerCase().includes(termo),
        );
      })
      .sort((a, b) => (a.data + a.hora_inicio).localeCompare(b.data + b.hora_inicio));
  }, [horarios, agendamentos, aba, busca, hoje]);

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Cadastrar horário" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Cadastrar horário" />
        <SemPermissao mensagem="Só quem responde o papo reto pode abrir horários." />
      </>
    );
  }

  const abertosFuturos = horarios.filter((h) => h.data >= hoje);
  const proximoLivre = livres
    .filter((h) => h.data >= hoje)
    .sort((a, b) => (a.data + a.hora_inicio).localeCompare(b.data + b.hora_inicio))[0];

  return (
    <>
      <PageHeader
        titulo="Cadastrar horário"
        descricao='Abra dia, horário e sala para o "Papo reto com liderança" — cada solicitação passa pela sua aprovação.'
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardTopo
          icone={CalendarRange}
          rotulo="Horários abertos"
          valor={String(abertosFuturos.length)}
          rodape="de hoje em diante"
        />
        <StatCardTopo
          icone={CheckCircle2}
          rotulo="Livres"
          valor={String(abertosFuturos.filter((h) => idsLivres.has(h.id)).length)}
          rodape="sem solicitação"
        />
        <StatCardTopo
          icone={Lock}
          rotulo="Reservados"
          valor={String(abertosFuturos.filter((h) => !idsLivres.has(h.id)).length)}
          rodape="com agendamento"
        />
        <StatCardTopo
          icone={CalendarPlus}
          rotulo="Próximo"
          valor={proximoLivre ? dataParaBR(proximoLivre.data) : "—"}
          rodape={
            proximoLivre
              ? `${hora(proximoLivre.hora_inicio)}${proximoLivre.local ? ` · ${proximoLivre.local}` : ""}`
              : "nada agendado"
          }
        />
      </div>

      {aviso ? <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{aviso}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        <Bloco titulo="Novo horário">
          <div className="space-y-4">
            <Field label="Dia">
              <DataCampo
                valor={dia}
                onValueChange={(v) => {
                  setDia(v);
                  setEscolhidos([]);
                  setErro("");
                }}
                placeholder="Selecione o dia"
                minimo={hoje}
              />
            </Field>

            <Field
              label="Local"
              dica={
                temLocal
                  ? ""
                  : "A sala só é gravada depois da migração do papo reto rodar no banco."
              }
            >
              <SelectCampo
                opcoes={LOCAIS_PAPO.map((l) => ({ valor: l, rotulo: l }))}
                valor={local}
                onValueChange={setLocal}
                placeholder="Selecione"
              />
            </Field>

            <div>
              <p className="mb-1.5 block text-sm font-medium text-jt-text">Horários</p>
              <HorariosGrade
                horarios={HORARIOS_DIA}
                selecionado=""
                desabilitados={ocupadosNoDia}
                disabled={!dia}
                onSelecionar={(h) =>
                  setEscolhidos((atual) =>
                    atual.includes(h) ? atual.filter((x) => x !== h) : [...atual, h],
                  )
                }
              />
              {escolhidos.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {escolhidos.sort().map((h) => (
                    <Badge
                      key={h}
                      className="num border-transparent bg-jt-blue font-normal text-white"
                    >
                      {h}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-jt-muted">
                  {dia
                    ? "Toque nos horários que quer abrir — dá para escolher vários."
                    : "Escolha um dia para liberar os horários."}
                </p>
              )}
            </div>

            {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}

            <PillButton
              className="w-full"
              disabled={!dia || escolhidos.length === 0 || abrir.isPending}
              onClick={() => abrir.mutate()}
            >
              Cadastrar horário <CalendarPlus className="h-4 w-4" aria-hidden />
            </PillButton>
          </div>
        </Bloco>

        <Bloco>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-jt-line bg-jt-panel-2 p-1">
              {(
                [
                  ["proximos", "Próximos"],
                  ["passados", "Passados"],
                  ["todos", "Todos"],
                ] as const
              ).map(([chave, rotulo]) => (
                <button
                  key={chave}
                  type="button"
                  onClick={() => setAba(chave)}
                  className={cn(
                    "min-h-8 rounded-full px-4 text-sm font-medium transition",
                    aba === chave ? "bg-jt-blue text-white" : "text-jt-muted hover:text-jt-text",
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <div className="min-w-[220px] flex-1">
              <TableSearch
                valor={busca}
                onChange={setBusca}
                placeholder="Buscar por sala, dia, pessoa…"
              />
            </div>
            <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
              {listados.length} horários
            </Badge>
          </div>

          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : listados.length === 0 ? (
            <VazioBloco>Nenhum horário corresponde aos filtros.</VazioBloco>
          ) : (
            <ul className="space-y-2">
              {listados.map((h) => {
                const pedido = agendamentos.find(
                  (a) => a.horario_id === h.id && a.status !== "recusado",
                );
                return (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-jt-line px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="num text-sm font-medium text-jt-text">
                        {dataParaBR(h.data)} · {hora(h.hora_inicio)}–{hora(h.hora_fim)}
                      </p>
                      <p className="truncate text-xs text-jt-muted">
                        {h.local ?? "Sem sala definida"}
                        {pedido ? ` · ${pedido.solicitante_nome}` : ""}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "border-transparent font-normal",
                        pedido
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                          : "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
                      )}
                    >
                      {pedido ? "Reservado" : "Livre"}
                    </Badge>
                    <button
                      type="button"
                      aria-label={`Editar horário de ${dataParaBR(h.data)} às ${hora(h.hora_inicio)}`}
                      title="Editar dia, horário e sala"
                      onClick={() => setEditando(h)}
                      className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    {!pedido ? (
                      <button
                        type="button"
                        aria-label={`Remover horário de ${dataParaBR(h.data)} às ${hora(h.hora_inicio)}`}
                        onClick={() => remover.mutate(h.id)}
                        className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>
      </div>
      <EditarHorarioDialog
        horario={editando}
        reservado={
          editando
            ? agendamentos.some((a) => a.horario_id === editando.id && a.status !== "recusado")
            : false
        }
        temLocal={temLocal}
        salvando={salvarEdicao.isPending}
        onFechar={() => setEditando(null)}
        onSalvar={(dados) =>
          editando ? salvarEdicao.mutate({ horario: editando, dados }) : undefined
        }
      />
    </>
  );
}

/** Ajusta dia, horário e sala de uma janela já aberta. */
function EditarHorarioDialog({
  horario,
  reservado,
  temLocal,
  salvando,
  onFechar,
  onSalvar,
}: {
  horario: Horario | null;
  reservado: boolean;
  temLocal: boolean;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (dados: { data: string; hora_inicio: string; hora_fim: string; local: string }) => void;
}) {
  const [dados, setDados] = useState({ data: "", hora_inicio: "", hora_fim: "", local: "" });
  const [chaveAtual, setChaveAtual] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const chave = horario?.id ?? null;
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setErro("");
    setDados({
      data: horario?.data ?? "",
      hora_inicio: horario?.hora_inicio.slice(0, 5) ?? "",
      hora_fim: horario?.hora_fim.slice(0, 5) ?? "",
      local: horario?.local ?? "",
    });
  }

  return (
    <Dialog open={horario !== null} onOpenChange={(v) => (!v ? onFechar() : undefined)}>
      <DialogContent className="border-jt-line bg-jt-panel text-jt-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Pencil className="h-5 w-5 text-jt-gold" aria-hidden />
            Editar horário
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            {reservado
              ? "Este horário já tem pedido. Só a sala pode mudar, para não bagunçar a agenda de quem reservou."
              : "Ajuste dia, horário e sala desta janela."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Dia">
            <DataCampo
              valor={dados.data}
              onValueChange={(v) => setDados((a) => ({ ...a, data: v }))}
              placeholder="Escolha o dia"
              {...(reservado ? {} : {})}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início">
              <SelectCampo
                opcoes={HORARIOS_DIA.map((h) => ({ valor: h, rotulo: h }))}
                valor={dados.hora_inicio}
                onValueChange={(v) => setDados((a) => ({ ...a, hora_inicio: v }))}
                disabled={reservado}
                placeholder="Selecione"
              />
            </Field>
            <Field label="Fim">
              <SelectCampo
                opcoes={HORARIOS_DIA.map((h) => ({ valor: h, rotulo: h }))}
                valor={dados.hora_fim}
                onValueChange={(v) => setDados((a) => ({ ...a, hora_fim: v }))}
                disabled={reservado}
                placeholder="Selecione"
              />
            </Field>
          </div>

          <Field
            label="Local"
            dica={temLocal ? "" : "A sala só é gravada depois da migração do papo reto rodar."}
          >
            <SelectCampo
              opcoes={LOCAIS_PAPO.map((l) => ({ valor: l, rotulo: l }))}
              valor={dados.local}
              onValueChange={(v) => setDados((a) => ({ ...a, local: v }))}
              placeholder="Sem sala definida"
            />
          </Field>

          {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={onFechar}>
            Cancelar
          </PillButton>
          <PillButton
            disabled={salvando}
            onClick={() => {
              if (!dados.data || !dados.hora_inicio || !dados.hora_fim) {
                setErro("Preencha dia e os dois horários.");
                return;
              }
              if (dados.hora_fim <= dados.hora_inicio) {
                setErro("O horário final precisa ser depois do inicial.");
                return;
              }
              onSalvar(dados);
            }}
          >
            {salvando ? "Salvando…" : "Salvar horário"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
