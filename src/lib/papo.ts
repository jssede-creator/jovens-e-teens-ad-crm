/** Rótulos e cores dos status do papo reto. */
export const STATUS_PAPO: Record<string, { rotulo: string; classe: string }> = {
  pendente: { rotulo: "Aguardando resposta", classe: "text-jt-muted" },
  confirmado: { rotulo: "Confirmado", classe: "text-jt-success" },
  recusado: { rotulo: "Recusado", classe: "text-jt-coral" },
  concluido: { rotulo: "Concluído", classe: "text-jt-muted" },
};
