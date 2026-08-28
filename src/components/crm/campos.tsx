import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { iso } from "@/lib/ebd";
import { cn } from "@/lib/utils";

/**
 * Campos de formulário do CRM. O <select> nativo herdava a lista do sistema
 * operacional (fundo azul, fonte fora do tema); aqui a lista é desenhada pelo
 * Radix e segue os tokens jt-*.
 */

const alturaControle =
  "h-10 w-full rounded-lg border border-jt-line bg-jt-panel px-3 text-sm text-jt-text";

export type Opcao = { valor: string; rotulo: string };

/**
 * O Radix trata string vazia como "sem valor" e não aceita item com value "".
 * Este sentinela mantém o campo controlado desde o primeiro render — sem ele o
 * select nasce não-controlado e a escolha podia não chegar ao formulário.
 */
const SEM_VALOR = "__sem_valor__";

export function SelectCampo({
  opcoes,
  valor,
  onValueChange,
  placeholder = "Selecione",
  disabled,
  className,
}: {
  opcoes: Opcao[];
  valor: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={valor || SEM_VALOR}
      onValueChange={(v) => onValueChange(v === SEM_VALOR ? "" : v)}
      {...(disabled ? { disabled: true } : {})}
    >
      <SelectTrigger
        className={cn(
          alturaControle,
          "justify-between data-[placeholder]:text-jt-muted focus:ring-2 focus:ring-jt-gold",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 border-jt-line bg-jt-panel">
        {opcoes.map((o) => (
          <SelectItem
            key={o.valor}
            value={o.valor}
            className="text-sm text-jt-text focus:bg-jt-panel-2 focus:text-jt-text"
          >
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Data em ISO (aaaa-mm-dd) com calendário em popover e rótulo em pt-BR. */
export function DataCampo({
  valor,
  onValueChange,
  placeholder = "Escolha uma data",
  minimo,
  anoInicial,
  anoFinal,
  className,
}: {
  valor: string;
  onValueChange: (isoData: string) => void;
  placeholder?: string;
  /** Data ISO mínima selecionável. */
  minimo?: string;
  /** Primeiro ano da lista. Padrão: 100 anos atrás — serve para nascimento. */
  anoInicial?: number;
  /** Último ano da lista. Padrão: daqui a 5 anos. */
  anoFinal?: number;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const selecionada = valor ? parseISO(valor) : undefined;
  const limite = minimo ? parseISO(minimo) : undefined;
  const agora = new Date();
  const inicio = new Date(anoInicial ?? agora.getFullYear() - 100, 0, 1);
  const fim = new Date(anoFinal ?? agora.getFullYear() + 5, 11, 31);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            alturaControle,
            "flex items-center justify-between gap-2 text-left transition hover:bg-jt-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold",
            !selecionada && "text-jt-muted",
            className,
          )}
        >
          {selecionada
            ? format(selecionada, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
            : placeholder}
          <CalendarIcon className="h-4 w-4 shrink-0 text-jt-muted" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-jt-line bg-jt-panel p-2">
        <Calendar
          mode="single"
          locale={ptBR}
          captionLayout="dropdown"
          formatters={{
            formatMonthDropdown: (d) => d.toLocaleString("pt-BR", { month: "long" }),
          }}
          startMonth={limite && limite > inicio ? limite : inicio}
          endMonth={fim}
          {...(selecionada ? { selected: selecionada, defaultMonth: selecionada } : {})}
          {...(limite ? { disabled: { before: limite } } : {})}
          onSelect={(d) => {
            if (!d) return;
            onValueChange(iso(d));
            setAberto(false);
          }}
        />
        {valor ? (
          <button
            type="button"
            onClick={() => {
              onValueChange("");
              setAberto(false);
            }}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
          >
            Limpar data
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** ISO (aaaa-mm-dd) → Date local, sem o deslocamento de fuso do construtor padrão. */
function parseISO(dataISO: string): Date | undefined {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return undefined;
  return new Date(ano, mes - 1, dia);
}

/** Grade de horários em pastilhas, como no cadastro de janelas do papo reto. */
export function HorariosGrade({
  horarios,
  selecionado,
  onSelecionar,
  desabilitados = [],
  disabled,
}: {
  horarios: string[];
  selecionado: string;
  onSelecionar: (h: string) => void;
  desabilitados?: string[];
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {horarios.map((h) => {
        const bloqueado = disabled || desabilitados.includes(h);
        const ativo = selecionado === h;
        return (
          <button
            key={h}
            type="button"
            disabled={bloqueado}
            onClick={() => onSelecionar(h)}
            aria-pressed={ativo}
            className={cn(
              "num h-9 rounded-full border text-xs transition",
              ativo
                ? "border-transparent bg-jt-blue font-semibold text-white"
                : "border-jt-line text-jt-text hover:bg-jt-panel-2",
              bloqueado && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            {h}
          </button>
        );
      })}
    </div>
  );
}

/** Horários de 30 em 30 minutos, das 06h às 20h30. */
export const HORARIOS_DIA = Array.from({ length: 30 }, (_, i) => {
  const minutos = 6 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});
