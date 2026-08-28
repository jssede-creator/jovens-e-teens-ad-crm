import { supabase } from "@/integrations/supabase/client";

/** Tarefas de projeto: template de fases, rótulos e consultas. */

export type StatusTarefa = "backlog" | "a_fazer" | "em_andamento" | "concluida" | "cancelada";
export type PrioridadeTarefa = "baixa" | "media" | "alta";

export type Tarefa = {
  id: string;
  numero: number;
  projeto_id: string;
  fase: string;
  titulo: string;
  descricao: string | null;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  inicio: string | null;
  fim: string | null;
  ordem: number;
};

export const STATUS_TAREFA: Record<
  StatusTarefa,
  { rotulo: string; classe: string; ponto: string }
> = {
  backlog: { rotulo: "Backlog", classe: "bg-jt-panel-2 text-jt-muted", ponto: "bg-jt-muted" },
  a_fazer: {
    rotulo: "A fazer",
    classe: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    ponto: "bg-blue-500",
  },
  em_andamento: {
    rotulo: "Em andamento",
    classe: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    ponto: "bg-amber-500",
  },
  concluida: {
    rotulo: "Concluída",
    classe: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    ponto: "bg-jt-success",
  },
  cancelada: {
    rotulo: "Cancelada",
    classe: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    ponto: "bg-jt-coral",
  },
};

export const PRIORIDADE_TAREFA: Record<
  PrioridadeTarefa,
  { rotulo: string; classe: string; seta: "cima" | "lado" | "baixo" }
> = {
  alta: { rotulo: "Alta", classe: "text-jt-coral", seta: "cima" },
  media: { rotulo: "Média", classe: "text-jt-muted", seta: "lado" },
  baixa: { rotulo: "Baixa", classe: "text-jt-muted", seta: "baixo" },
};

/**
 * Fases padrão de um projeto do ministério. Todo projeto novo nasce com essa
 * lista; a liderança ajusta prazos e responsáveis depois.
 */
export const FASES_PADRAO: { fase: string; tarefas: string[] }[] = [
  {
    fase: "Planejamento",
    tarefas: [
      "Idealização",
      "Verificar viabilidade",
      "Alinhar com demais departamentos da igreja",
      "Mídia (banner, vídeos etc.)",
    ],
  },
  {
    fase: "Estrutura e organização",
    tarefas: [
      "Levantar valores e orçamentos",
      "Alinhar estrutura (som, espaço etc.)",
      "Criar formulário",
      "Montar equipe de servos",
    ],
  },
  {
    fase: "Fase final",
    tarefas: ["Aprovação", "Go live"],
  },
];

export const FASES = FASES_PADRAO.map((f) => f.fase);

/** Cor da faixa de cada fase no cronograma, na ordem do template. */
export const CORES_FASE = ["bg-violet-400", "bg-amber-400", "bg-emerald-400"];

/** Cria as tarefas do template para um projeto recém-nascido. */
export async function criarTarefasPadrao(projetoId: string) {
  let ordem = 0;
  const linhas = FASES_PADRAO.flatMap((f) =>
    f.tarefas.map((titulo) => ({
      projeto_id: projetoId,
      fase: f.fase,
      titulo,
      ordem: ordem++,
      status: "backlog",
      prioridade: "media",
    })),
  );
  const { error } = await supabase.from("projeto_tarefas").insert(linhas);
  if (error) throw error;
  return linhas.length;
}

export async function carregarTarefas() {
  const { data, error } = await supabase
    .from("projeto_tarefas")
    .select("*")
    .order("ordem")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as Tarefa[];
}

/** Percentual concluído de um conjunto de tarefas, ignorando canceladas. */
export function progresso(tarefas: Tarefa[]): number {
  const validas = tarefas.filter((t) => t.status !== "cancelada");
  if (validas.length === 0) return 0;
  const feitas = validas.filter((t) => t.status === "concluida").length;
  return Math.round((feitas / validas.length) * 100);
}

/** Menor início e maior fim de um conjunto — usado para a barra da fase. */
export function periodo(tarefas: Tarefa[]): { inicio: string; fim: string } | null {
  const inicios = tarefas.map((t) => t.inicio).filter((d): d is string => Boolean(d));
  const fins = tarefas.map((t) => t.fim ?? t.inicio).filter((d): d is string => Boolean(d));
  if (inicios.length === 0 || fins.length === 0) return null;
  return {
    inicio: inicios.sort()[0]!,
    fim: fins.sort()[fins.length - 1]!,
  };
}
