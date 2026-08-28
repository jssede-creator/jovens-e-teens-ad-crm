import { supabase } from "@/integrations/supabase/client";

/** Tipos, rótulos e consultas compartilhadas pelas telas do papo reto. */

export type StatusPapo = "pendente" | "confirmado" | "recusado" | "concluido";

export const STATUS_PAPO: Record<string, { rotulo: string; classe: string; ponto: string }> = {
  pendente: {
    rotulo: "Aguardando resposta",
    classe: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    ponto: "bg-amber-500",
  },
  confirmado: {
    rotulo: "Confirmado",
    classe: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    ponto: "bg-jt-success",
  },
  recusado: {
    rotulo: "Recusado",
    classe: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    ponto: "bg-jt-coral",
  },
  concluido: {
    rotulo: "Concluído",
    classe: "bg-jt-panel-2 text-jt-muted",
    ponto: "bg-jt-muted",
  },
};

export function rotuloStatus(status: string) {
  return STATUS_PAPO[status] ?? STATUS_PAPO["pendente"]!;
}

/** Salas onde a liderança costuma receber. */
export { LOCAIS as LOCAIS_PAPO } from "@/lib/locais";

export type Horario = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  local: string | null;
};

export type Agendamento = {
  id: string;
  user_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  horario_id: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  local: string | null;
  assunto: string;
  mensagem: string | null;
  status: StatusPapo;
  resposta: string | null;
  created_at: string;
};

/**
 * Lê as duas tabelas com `select("*")` de propósito: enquanto a coluna `local`
 * não existir no banco, o campo volta indefinido em vez de derrubar a consulta.
 */
export async function carregarPapoReto() {
  // A coluna `local` só existe depois da migração 20260828160000. Enquanto o
  // banco não a tiver, as telas escondem o campo em vez de quebrar no insert.
  const sonda = await supabase.from("papo_reto_horarios").select("local").limit(1);
  const temLocal = !sonda.error;

  const [horarios, agendamentos] = await Promise.all([
    supabase.from("papo_reto_horarios").select("*").order("data").order("hora_inicio"),
    supabase.from("papo_reto_agendamentos").select("*").order("data", { ascending: false }),
  ]);
  if (horarios.error) throw horarios.error;
  if (agendamentos.error) throw agendamentos.error;

  return {
    temLocal,
    horarios: (horarios.data ?? []).map((h) => ({
      ...h,
      local: (h as { local?: string | null }).local ?? null,
    })) as Horario[],
    agendamentos: (agendamentos.data ?? []).map((a) => ({
      ...a,
      local: (a as { local?: string | null }).local ?? null,
    })) as Agendamento[],
  };
}

/** Horários que ninguém reservou (pedido recusado devolve a janela). */
export function horariosLivres(horarios: Horario[], agendamentos: Agendamento[]) {
  const ocupados = new Set(
    agendamentos
      .filter((a) => a.status !== "recusado" && a.horario_id)
      .map((a) => a.horario_id as string),
  );
  return horarios.filter((h) => !ocupados.has(h.id));
}

/** Descrição curta de uma janela: "29/08/2026 · 17:00 · Sala VIP". */
export function resumoHorario(h: { data: string; hora_inicio: string; local: string | null }) {
  const [ano, mes, dia] = h.data.split("-");
  return `${dia}/${mes}/${ano} · ${h.hora_inicio.slice(0, 5)}${h.local ? ` · ${h.local}` : ""}`;
}
