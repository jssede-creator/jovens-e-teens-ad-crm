import { ChevronLeft, ChevronRight } from "lucide-react";

import { iso } from "@/lib/ebd";
import { cn } from "@/lib/utils";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
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

export type MarcaDia = { data: string; cor?: string };

/** Grade de um mês (domingo a sábado) com pontinhos de marcação por dia. */
export function CalendarioMes({
  mes,
  onMes,
  selecionado,
  onSelecionar,
  marcas = [],
  legenda,
}: {
  /** Primeiro dia do mês exibido. */
  mes: Date;
  onMes: (novo: Date) => void;
  selecionado: string;
  onSelecionar: (dataISO: string) => void;
  marcas?: MarcaDia[];
  legenda?: string;
}) {
  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const inicioGrade = new Date(primeiro.getFullYear(), primeiro.getMonth(), 1 - primeiro.getDay());
  const hoje = iso(new Date());

  const celulas = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(
      inicioGrade.getFullYear(),
      inicioGrade.getMonth(),
      inicioGrade.getDate() + i,
    );
    return { data: iso(d), dia: d.getDate(), doMes: d.getMonth() === mes.getMonth() };
  });
  // Seis linhas só quando o mês realmente precisa da última.
  const visiveis = celulas.slice(0, celulas.slice(35).some((c) => c.doMes) ? 42 : 35);

  const corDe = (data: string) => marcas.find((m) => m.data === data)?.cor;

  return (
    <div className="rounded-[20px] border border-jt-line bg-jt-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => onMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
          className="grid h-8 w-8 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-sm font-medium text-jt-text">
          {MESES[mes.getMonth()]} {mes.getFullYear()}
        </p>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => onMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
          className="grid h-8 w-8 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS.map((d) => (
          <span key={d} className="py-1 text-xs text-jt-muted">
            {d}
          </span>
        ))}
        {visiveis.map((c) => {
          const ativo = c.data === selecionado;
          const cor = corDe(c.data);
          return (
            <button
              key={c.data}
              type="button"
              onClick={() => onSelecionar(c.data)}
              aria-current={ativo ? "date" : undefined}
              className={cn(
                "num relative grid h-11 place-items-center rounded-lg text-sm transition",
                ativo
                  ? "bg-jt-blue font-semibold text-white"
                  : c.doMes
                    ? "text-jt-text hover:bg-jt-panel-2"
                    : "text-jt-muted/50 hover:bg-jt-panel-2",
                !ativo && c.data === hoje && "font-semibold text-jt-gold",
              )}
            >
              {c.dia}
              {cor ? (
                <span
                  className={cn(
                    "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                    ativo ? "bg-white" : cor,
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {legenda ? (
        <p className="mt-3 flex items-center gap-1.5 border-t border-jt-line pt-3 text-xs text-jt-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-jt-blue" />
          {legenda}
        </p>
      ) : null}
    </div>
  );
}
