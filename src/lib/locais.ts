/**
 * Espaços da igreja usados nos módulos que marcam encontro: papo reto e eventos.
 * Lista única para os dois não divergirem quando aparecer uma sala nova.
 */
export const LOCAIS = [
  "Templo",
  "Sala VIP",
  "Sala 17",
  "Cantina",
  "Refeitório",
  "Piso Zero",
  "Secretaria",
  "Sala de reuniões",
  "Online",
] as const;

export type Local = (typeof LOCAIS)[number];
