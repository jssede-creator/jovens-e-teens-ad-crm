import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Calendário de mês em tela cheia, adaptado do FullScreenCalendar (shadcn):
 * no desktop cada dia mostra os compromissos; no celular, pontinhos coloridos.
 * Controlado: o mês e o dia selecionado vêm de fora, para a página listar os
 * compromissos do dia logo abaixo.
 */

export type CalendarEvent = {
  id: string;
  name: string;
  /** Texto curto do horário, como "19:30". */
  time: string;
  /** Classe de cor do marcador, como "bg-jt-gold". */
  color?: string;
};

export type CalendarDay = {
  day: Date;
  events: CalendarEvent[];
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Quantos compromissos cabem na célula do desktop antes do "+N". */
const POR_CELULA = 2;

export function FullScreenCalendar({
  data,
  month,
  onMonthChange,
  selectedDay,
  onSelectDay,
  actions,
}: {
  data: CalendarDay[];
  /** Qualquer dia do mês exibido. */
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  /** Botões extras no cabeçalho, à direita da navegação. */
  actions?: ReactNode;
}) {
  const today = startOfToday();
  const inicioMes = startOfMonth(month);
  const days = eachDayOfInterval({
    start: startOfWeek(inicioMes),
    end: endOfWeek(endOfMonth(inicioMes)),
  });

  const eventosDo = (day: Date) =>
    data.filter((d) => isSameDay(d.day, day)).flatMap((d) => d.events);

  const irPara = (meses: number) => onMonthChange(add(inicioMes, { months: meses }));
  const irHoje = () => {
    onMonthChange(startOfMonth(today));
    onSelectDay(today);
  };

  const titulo = format(inicioMes, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="overflow-hidden rounded-[20px] border border-jt-line bg-jt-panel">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="hidden w-16 flex-col items-center rounded-xl border border-jt-line bg-jt-panel-2 p-0.5 md:flex">
            <span className="p-1 text-[11px] uppercase tracking-wider text-jt-muted">
              {format(today, "MMM", { locale: ptBR }).replace(".", "")}
            </span>
            <span className="num flex w-full items-center justify-center rounded-lg border border-jt-line bg-jt-panel p-0.5 text-lg font-bold text-jt-text">
              {format(today, "d")}
            </span>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold capitalize text-jt-text">{titulo}</h2>
            <p className="num text-xs text-jt-muted">
              {format(inicioMes, "d MMM yyyy", { locale: ptBR })} –{" "}
              {format(endOfMonth(inicioMes), "d MMM yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex w-full -space-x-px rounded-full md:w-auto">
            <button
              type="button"
              onClick={() => irPara(-1)}
              aria-label="Mês anterior"
              className="grid h-9 w-10 place-items-center rounded-l-full border border-jt-line text-jt-text transition hover:bg-jt-panel-2 focus-visible:z-10"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={irHoje}
              className="h-9 flex-1 border border-jt-line px-4 text-[13px] font-medium text-jt-text transition hover:bg-jt-panel-2 focus-visible:z-10 md:flex-none"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => irPara(1)}
              aria-label="Próximo mês"
              className="grid h-9 w-10 place-items-center rounded-r-full border border-jt-line text-jt-text transition hover:bg-jt-panel-2 focus-visible:z-10"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {actions}
        </div>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 border-y border-jt-line text-center text-[11px] font-medium uppercase tracking-wider text-jt-muted">
        {DIAS_SEMANA.map((d, i) => (
          <div key={d} className={cn("py-2.5", i < 6 && "border-r border-jt-line")}>
            {d}
          </div>
        ))}
      </div>

      {/* Dias */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const eventos = eventosDo(day);
          const selecionado = isSameDay(day, selectedDay);
          const hoje = isToday(day);
          const doMes = isSameMonth(day, inicioMes);
          const ultimaColuna = i % 7 === 6;
          const ultimaLinha = i >= days.length - 7;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-pressed={selecionado}
              aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}, ${eventos.length} compromisso(s)`}
              className={cn(
                "group flex min-h-14 flex-col gap-1 p-1.5 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold lg:min-h-[112px] lg:p-2",
                !ultimaColuna && "border-r border-jt-line",
                !ultimaLinha && "border-b border-jt-line",
                doMes ? "hover:bg-jt-panel-2" : "bg-jt-panel-2/60 hover:bg-jt-panel-2",
                selecionado && "bg-jt-blue/[0.04]",
              )}
            >
              <time
                dateTime={format(day, "yyyy-MM-dd")}
                className={cn(
                  "num ml-auto flex size-6 items-center justify-center rounded-full text-xs lg:ml-0 lg:size-7",
                  selecionado
                    ? "bg-jt-blue font-semibold text-white"
                    : hoje
                      ? "font-semibold text-jt-gold ring-1 ring-jt-gold/40"
                      : doMes
                        ? "text-jt-text"
                        : "text-jt-muted/70",
                )}
              >
                {format(day, "d")}
              </time>

              {eventos.length > 0 ? (
                <>
                  {/* Celular e tablet: só os pontinhos. */}
                  <span className="mt-auto flex flex-wrap gap-1 lg:hidden">
                    {eventos.slice(0, 4).map((e) => (
                      <span
                        key={e.id}
                        className={cn("h-1.5 w-1.5 rounded-full", e.color ?? "bg-jt-muted")}
                      />
                    ))}
                  </span>

                  {/* Desktop: os compromissos, enxutos. */}
                  <span className="hidden w-full min-w-0 flex-col gap-1 lg:flex">
                    {eventos.slice(0, POR_CELULA).map((e) => (
                      <span
                        key={e.id}
                        className="flex w-full min-w-0 items-center gap-1.5 rounded-md bg-jt-panel-2 px-1.5 py-1 text-[11px] leading-tight"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            e.color ?? "bg-jt-muted",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-jt-text">
                          {e.name}
                        </span>
                        <span className="num shrink-0 text-jt-muted">{e.time}</span>
                      </span>
                    ))}
                    {eventos.length > POR_CELULA ? (
                      <span className="px-1.5 text-[11px] text-jt-muted">
                        + {eventos.length - POR_CELULA} mais
                      </span>
                    ) : null}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
