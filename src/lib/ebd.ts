/** Cálculos compartilhados da EBD e utilidades de data. */

export function idadeEm(dataNascimento: string | null | undefined, hoje = new Date()): number | null {
  if (!dataNascimento) return null;
  const [ano, mes, dia] = dataNascimento.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  let idade = hoje.getFullYear() - ano;
  const aindaNaoFez =
    hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia);
  if (aindaNaoFez) idade -= 1;
  return idade;
}

export function iso(data: Date): string {
  const m = `${data.getMonth() + 1}`.padStart(2, "0");
  const d = `${data.getDate()}`.padStart(2, "0");
  return `${data.getFullYear()}-${m}-${d}`;
}

export const hojeISO = () => iso(new Date());

/** Trimestre civil corrente e anterior, em datas ISO. */
export function trimestres(hoje = new Date()) {
  const t = Math.floor(hoje.getMonth() / 3);
  const inicioAtual = new Date(hoje.getFullYear(), t * 3, 1);
  const inicioAnterior = new Date(hoje.getFullYear(), t * 3 - 3, 1);
  return {
    atualInicio: iso(inicioAtual),
    atualFim: iso(new Date(hoje.getFullYear(), t * 3 + 3, 0)),
    anteriorInicio: iso(inicioAnterior),
    anteriorFim: iso(new Date(inicioAtual.getFullYear(), inicioAtual.getMonth(), 0)),
  };
}

/** Semana de segunda a domingo que contém a data informada. */
export function semanaDe(hoje = new Date()) {
  const dia = hoje.getDay();
  const offset = dia === 0 ? -6 : 1 - dia;
  const segunda = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + offset);
  const domingo = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6);
  return { inicio: iso(segunda), fim: iso(domingo) };
}

export function diasAtras(dias: number, hoje = new Date()): string {
  return iso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias));
}

export type NivelFrequencia = "baixo" | "medio" | "alto";

export function nivelFrequencia(percentual: number): NivelFrequencia {
  if (percentual <= 40) return "baixo";
  if (percentual < 75) return "medio";
  return "alto";
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]![0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]![0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];
