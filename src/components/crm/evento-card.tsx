import { CalendarDays, Check, Clock, MapPin, Ticket, Users } from "lucide-react";

import { PillButton } from "@/components/cadastro/ui";
import { Badge } from "@/components/ui/badge";
import { hojeISO } from "@/lib/ebd";
import {
  aceitaInscricao,
  STATUS_EVENTO,
  taxaFormatada,
  vagasRestantes,
  type Evento,
} from "@/lib/eventos";
import { dataCurta, hora } from "@/lib/formato";
import { cn } from "@/lib/utils";

/** Cartão de evento com data, horário, local, vagas e o botão de reserva. */
export function EventoCard({
  evento,
  ocupado,
  onReservar,
  onCancelar,
  className,
}: {
  evento: Evento;
  ocupado?: boolean;
  onReservar?: (e: Evento) => void;
  onCancelar?: (e: Evento) => void;
  className?: string;
}) {
  const restantes = vagasRestantes(evento);
  const podeReservar = aceitaInscricao(evento, hojeISO());
  const inscrito = evento.minhaInscricao !== null;
  const status = STATUS_EVENTO[evento.status];

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[20px] border border-jt-line bg-jt-panel p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-jt-text">{evento.titulo}</h3>
        <Badge className="shrink-0 border-transparent bg-jt-panel-2 font-normal text-jt-muted">
          {evento.categoria}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 text-xs text-jt-muted">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <span className="num">{dataCurta(evento.data)}</span>
        </span>
        <span className="flex items-center gap-2">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span className="num">
            {hora(evento.hora_inicio)} – {hora(evento.hora_fim)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {evento.local} · {evento.congregacao}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Users className="size-3.5 shrink-0" aria-hidden />
          <span className="num">{evento.inscritos} inscrito(s)</span>
          {restantes != null ? (
            <>
              ·{" "}
              <span
                className={cn(
                  "num",
                  restantes === 0 ? "text-jt-coral" : "text-amber-600 dark:text-amber-400",
                )}
              >
                {restantes === 0 ? "sem vagas" : `${restantes} vaga(s)`}
              </span>
            </>
          ) : null}
        </span>
        <span className="flex items-center gap-2">
          <Ticket className="size-3.5 shrink-0" aria-hidden />
          {evento.taxa == null ? (
            "Sem taxa de inscrição"
          ) : (
            <span className="num text-jt-text">{taxaFormatada(evento.taxa)}</span>
          )}
        </span>
      </div>

      {evento.descricao ? (
        <p className="line-clamp-2 text-xs text-jt-muted">{evento.descricao}</p>
      ) : null}

      {inscrito ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gap-1.5 border-transparent bg-green-50 font-normal text-green-700 dark:bg-green-950/50 dark:text-green-300">
            <Check className="h-3 w-3" aria-hidden /> Sua vaga está reservada
          </Badge>
          {onCancelar ? (
            <button
              type="button"
              onClick={() => onCancelar(evento)}
              disabled={ocupado}
              className="text-xs text-jt-muted underline-offset-2 transition hover:text-jt-coral hover:underline disabled:opacity-40"
            >
              cancelar
            </button>
          ) : null}
        </div>
      ) : podeReservar && onReservar ? (
        <PillButton
          className="h-9 w-full text-[13px]"
          disabled={ocupado}
          onClick={() => onReservar(evento)}
        >
          {ocupado ? "Reservando…" : "Reservar vaga"}
        </PillButton>
      ) : (
        <Badge className={cn("justify-center border-transparent font-normal", status.classe)}>
          {evento.status === "aberto" && restantes === 0 ? "Sem vagas" : status.rotulo}
        </Badge>
      )}
    </article>
  );
}
