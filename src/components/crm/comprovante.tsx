import { CalendarDays, CheckCircle2, MapPin, QrCode } from "lucide-react";
import { useEffect, useState } from "react";

import { taxaFormatada } from "@/lib/eventos";
import { dataHoraBR, dataParaBR, hora } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Comprovante de inscrição confirmada. O desenho é o de um tíquete: recortes
 * nas laterais, linhas pontilhadas e código de barras no rodapé.
 */

export type DadosComprovante = {
  codigo: string;
  participante: string;
  email: string;
  evento: string;
  data: string;
  horaInicio: string;
  local: string;
  taxa: number | null;
  confirmadoEm: string | null;
  confirmadoPor: string | null;
};

/** Barras determinísticas a partir do código — o mesmo código desenha o mesmo padrão. */
function CodigoBarras({ valor }: { valor: string }) {
  const semente = valor.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const aleatorio = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  const barras = Array.from({ length: 52 }, (_, i) => (aleatorio(semente + i) > 0.7 ? 2.5 : 1.5));
  const espaco = 1.5;
  const largura = 236;
  const total = barras.reduce((soma, b) => soma + b + espaco, 0) - espaco;
  let x = (largura - total) / 2;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={largura}
        height={56}
        viewBox={`0 0 ${largura} 56`}
        role="img"
        aria-label={`Código do comprovante ${valor}`}
        className="fill-current text-jt-text"
      >
        {barras.map((b, i) => {
          const atual = x;
          x += b + espaco;
          return <rect key={i} x={atual} y={6} width={b} height={40} />;
        })}
      </svg>
      <p className="num mt-1 text-xs tracking-[0.3em] text-jt-muted">{valor}</p>
    </div>
  );
}

function Pontilhado() {
  return <div className="w-full border-t-2 border-dashed border-jt-line" aria-hidden />;
}

/** Confete discreto, só no momento em que a liderança confirma. */
function Confete() {
  const cores = ["#1d4ed8", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6"];
  return (
    <>
      <style>{`
        @keyframes jt-confete {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jt-confete span { animation: none !important; opacity: 0; }
        }
      `}</style>
      <div className="jt-confete pointer-events-none fixed inset-0 z-50" aria-hidden>
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className="absolute block h-3.5 w-1.5 rounded-sm"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${-15 + Math.random() * 10}%`,
              backgroundColor: cores[i % cores.length],
              animation: `jt-confete ${2.5 + Math.random() * 2}s ${Math.random() * 1.5}s linear forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
}

export function Comprovante({
  dados,
  comemorar = false,
  className,
}: {
  dados: DadosComprovante;
  /** Solta o confete uma vez — usado logo depois da confirmação. */
  comemorar?: boolean;
  className?: string;
}) {
  const [confete, setConfete] = useState(false);

  useEffect(() => {
    if (!comemorar) return;
    const entra = setTimeout(() => setConfete(true), 80);
    const sai = setTimeout(() => setConfete(false), 5000);
    return () => {
      clearTimeout(entra);
      clearTimeout(sai);
    };
  }, [comemorar]);

  const pago = dados.taxa != null && dados.taxa > 0;

  return (
    <>
      {confete ? <Confete /> : null}
      <div
        className={cn(
          "relative w-full rounded-[20px] border border-jt-line bg-jt-panel",
          "duration-500 animate-in fade-in-0 zoom-in-95",
          className,
        )}
      >
        {/* Recortes laterais do tíquete. */}
        <div
          className="absolute -left-3 top-[46%] h-6 w-6 rounded-full bg-jt-panel-2"
          aria-hidden
        />
        <div
          className="absolute -right-3 top-[46%] h-6 w-6 rounded-full bg-jt-panel-2"
          aria-hidden
        />

        <div className="flex flex-col items-center px-6 pb-5 pt-6 text-center">
          <div className="rounded-full bg-jt-success/10 p-3">
            <CheckCircle2 className="h-8 w-8 text-jt-success" aria-hidden />
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-jt-text">
            Presença confirmada
          </h3>
          <p className="mt-1 text-sm text-jt-muted">
            {pago ? "Pagamento conferido pela liderança." : "Inscrição validada pela liderança."}
          </p>
        </div>

        <div className="space-y-5 px-6 pb-6">
          <Pontilhado />

          <div className="grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-jt-muted">Comprovante</p>
              <p className="num font-medium text-jt-text">{dados.codigo}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-jt-muted">Valor</p>
              <p className="num text-lg font-semibold text-jt-text">{taxaFormatada(dados.taxa)}</p>
            </div>
          </div>

          <div className="text-left">
            <p className="text-[11px] uppercase tracking-wider text-jt-muted">Evento</p>
            <p className="font-medium text-jt-text">{dados.evento}</p>
            <p className="num mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-jt-muted">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {dataParaBR(dados.data)} · {hora(dados.horaInicio)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {dados.local}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-jt-panel-2 p-3 text-left">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-jt-panel text-jt-blue">
              <QrCode className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-jt-text">{dados.participante}</p>
              <p className="truncate text-xs text-jt-muted">
                {pago ? "Pago via PIX" : "Sem taxa de inscrição"} · {dados.email}
              </p>
            </div>
          </div>

          {dados.confirmadoEm ? (
            <p className="text-left text-[11px] text-jt-muted">
              Confirmado em {dataHoraBR(dados.confirmadoEm)}
              {dados.confirmadoPor ? ` por ${dados.confirmadoPor}` : ""}.
            </p>
          ) : null}

          <Pontilhado />

          <CodigoBarras valor={dados.codigo} />
        </div>
      </div>
    </>
  );
}
