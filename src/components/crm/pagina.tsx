import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Peças de página compartilhadas pelos módulos do CRM. */

export function PageHeader({
  titulo,
  descricao,
  contagem,
  acoes,
}: {
  titulo: string;
  descricao?: string | undefined;
  contagem?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-2xl font-bold text-jt-text sm:text-[28px]">{titulo}</h1>
        {contagem}
        {descricao ? <p className="w-full text-sm text-jt-muted">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>
  );
}

/** Cartão de indicador com ícone redondo à esquerda (padrão dos painéis). */
export function StatCard({
  icone: Icone,
  rotulo,
  valor,
  className,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-[20px] border border-jt-line bg-jt-panel p-5",
        className,
      )}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-jt-blue/10 text-jt-blue">
        <Icone className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="num truncate text-2xl font-bold leading-none text-jt-text">{valor}</p>
        <p className="mt-1.5 text-xs text-jt-muted">{rotulo}</p>
      </div>
    </div>
  );
}

/** Cartão de indicador com o rótulo em cima e comparação embaixo (padrão da EBD). */
export function StatCardTopo({
  icone: Icone,
  rotulo,
  valor,
  rodape,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  rodape?: string | undefined;
}) {
  return (
    <div className="rounded-[20px] border border-jt-line bg-jt-panel p-5">
      <div className="flex items-center gap-2 text-sm text-jt-muted">
        <Icone className="h-4 w-4" aria-hidden />
        {rotulo}
      </div>
      <p className="num mt-2 text-3xl font-bold leading-none text-jt-text">{valor}</p>
      {rodape ? <p className="mt-2 text-xs text-jt-muted">{rodape}</p> : null}
    </div>
  );
}

/** Painel branco com título opcional, usado nos blocos dos painéis. */
export function Bloco({
  titulo,
  descricao,
  acao,
  className,
  children,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-[20px] border border-jt-line bg-jt-panel p-5", className)}>
      {titulo || acao ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {titulo ? (
              <h2 className="font-display text-base font-semibold text-jt-text">{titulo}</h2>
            ) : null}
            {descricao ? <p className="text-xs text-jt-muted">{descricao}</p> : null}
          </div>
          {acao}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Avatar redondo de iniciais, do mesmo azul das listas. */
export function AvatarIniciais({
  texto,
  tamanho = "md",
}: {
  texto: string;
  tamanho?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-jt-blue font-semibold text-white",
        tamanho === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]",
      )}
    >
      {texto}
    </div>
  );
}

export function VazioBloco({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-jt-muted">{children}</p>;
}
