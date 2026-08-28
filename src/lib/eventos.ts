import { supabase } from "@/integrations/supabase/client";

/** Tipos, listas e consultas compartilhadas pelo módulo de Eventos. */

export type StatusEvento = "aberto" | "encerrado" | "cancelado";

export type Evento = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  congregacao_id: string | null;
  congregacao: string;
  local: string;
  /** Nulo é evento gratuito. */
  taxa: number | null;
  vagas: number | null;
  status: StatusEvento;
  inscritos: number;
  /** Inscrição confirmada da própria conta, quando existe. */
  minhaInscricao: string | null;
};

export type Inscricao = {
  id: string;
  evento_id: string;
  user_id: string;
  nome: string;
  email: string;
  observacao: string | null;
  status: "confirmada" | "cancelada";
  created_at: string;
};

export const LOCAIS_EVENTO = ["Templo", "Sala VIP", "Refeitório", "Piso Zero"] as const;

export const CATEGORIAS_EVENTO = [
  "Culto",
  "Encontro",
  "Workshop",
  "Retiro",
  "Ensaio",
  "Ação social",
  "Confraternização",
] as const;

export const STATUS_EVENTO: Record<StatusEvento, { rotulo: string; classe: string }> = {
  aberto: {
    rotulo: "Inscrições abertas",
    classe: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  },
  encerrado: { rotulo: "Encerrado", classe: "bg-jt-panel-2 text-jt-muted" },
  cancelado: {
    rotulo: "Cancelado",
    classe: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
};

/** Vagas restantes; nulo quando o evento não tem limite. */
export function vagasRestantes(e: Evento): number | null {
  if (e.vagas == null) return null;
  return Math.max(e.vagas - e.inscritos, 0);
}

/** Aceita novas inscrições? */
export function aceitaInscricao(e: Evento, hoje: string): boolean {
  if (e.status !== "aberto") return false;
  if (e.data < hoje) return false;
  const restantes = vagasRestantes(e);
  return restantes == null || restantes > 0;
}

export function taxaFormatada(taxa: number | null): string {
  if (taxa == null || taxa === 0) return "Gratuito";
  return taxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Eventos com congregação, contagem de inscritos e a inscrição da conta. */
export async function carregarEventos(userId: string | null) {
  const [eventos, congregacoes, contagem, minhas] = await Promise.all([
    supabase.from("eventos").select("*").order("data"),
    supabase.from("congregacoes").select("id, nome"),
    supabase.rpc("eventos_inscritos"),
    userId
      ? supabase.from("evento_inscricoes").select("id, evento_id, status").eq("user_id", userId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (eventos.error) throw eventos.error;
  if (congregacoes.error) throw congregacoes.error;

  const nomeCongregacao = new Map((congregacoes.data ?? []).map((c) => [c.id, c.nome]));
  const inscritosPorEvento = new Map(
    ((contagem.data ?? []) as { evento_id: string; inscritos: number }[]).map((c) => [
      c.evento_id,
      Number(c.inscritos),
    ]),
  );
  const minhasPorEvento = new Map(
    ((minhas.data ?? []) as { id: string; evento_id: string; status: string }[])
      .filter((i) => i.status === "confirmada")
      .map((i) => [i.evento_id, i.id]),
  );

  return ((eventos.data ?? []) as Record<string, unknown>[]).map((e) => ({
    ...(e as unknown as Omit<Evento, "congregacao" | "inscritos" | "minhaInscricao">),
    taxa: e["taxa"] == null ? null : Number(e["taxa"]),
    congregacao: e["congregacao_id"]
      ? (nomeCongregacao.get(e["congregacao_id"] as string) ?? "—")
      : "Todas as congregações",
    inscritos: inscritosPorEvento.get(e["id"] as string) ?? 0,
    minhaInscricao: minhasPorEvento.get(e["id"] as string) ?? null,
  })) as Evento[];
}
