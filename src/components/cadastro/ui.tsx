import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { mascaraCEP, mascaraCPF, mascaraRG, mascaraTelefone } from "@/lib/formato";

/* ------------------------------------------------------------------ */
/* Blocos do formulário guiado                                         */
/* ------------------------------------------------------------------ */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.18em] text-jt-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Panel({
  children,
  className,
  title,
  descricao,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  descricao?: string;
}) {
  return (
    <section
      className={cn("rounded-xl border border-jt-line bg-jt-panel p-5 sm:p-6", className)}
    >
      {title ? (
        <header className="mb-4">
          <h2 className="font-display text-lg text-jt-text">{title}</h2>
          {descricao ? <p className="mt-1 text-sm text-jt-muted">{descricao}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

type PillVariant = "solido" | "outline" | "ghost";

export function PillButton({
  children,
  variante = "solido",
  className,
  type = "button",
  ...props
}: InputHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variante?: PillVariant;
  type?: "button" | "submit" | "reset";
}) {
  const estilos: Record<PillVariant, string> = {
    solido: "bg-jt-blue text-white shadow-pill hover:brightness-110",
    outline: "border border-jt-line bg-jt-panel text-jt-text hover:bg-jt-panel-2",
    ghost: "text-jt-text hover:bg-jt-panel-2",
  };
  return (
    <button
      type={type}
      className={cn(
        "jt-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold focus-visible:ring-offset-2 focus-visible:ring-offset-jt-bg disabled:pointer-events-none disabled:opacity-50",
        estilos[variante],
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  erro,
  dica,
  obrigatorio,
  htmlFor,
  children,
}: {
  label: string;
  erro?: string;
  dica?: string;
  obrigatorio?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-jt-text">
        {label}
        {obrigatorio ? <span className="ml-1 text-jt-coral">*</span> : null}
      </label>
      {children}
      {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
      {!erro && dica ? <p className="text-xs text-jt-muted">{dica}</p> : null}
    </div>
  );
}

const inputBase =
  "h-10 w-full rounded-lg border border-jt-line bg-jt-panel px-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold";

export type Mascara = "cpf" | "rg" | "telefone" | "cep";

const mascaras: Record<Mascara, (v: string) => string> = {
  cpf: mascaraCPF,
  rg: mascaraRG,
  telefone: mascaraTelefone,
  cep: mascaraCEP,
};

export function TextInput({
  mascara,
  onValueChange,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  mascara?: Mascara;
  onValueChange?: (valor: string) => void;
}) {
  return (
    <input
      {...props}
      className={cn(inputBase, className)}
      onChange={(e) => {
        const bruto = e.target.value;
        const valor = mascara ? mascaras[mascara](bruto) : bruto;
        if (mascara) e.target.value = valor;
        onValueChange?.(valor);
        props.onChange?.(e);
      }}
    />
  );
}

/** Data em ISO no valor (aaaa-mm-dd) e exibição dd/mm/aaaa pelo navegador. */
export function DateInput({
  className,
  onValueChange,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { onValueChange?: (valor: string) => void }) {
  return (
    <input
      type="date"
      {...props}
      className={cn(inputBase, className)}
      onChange={(e) => {
        onValueChange?.(e.target.value);
        props.onChange?.(e);
      }}
    />
  );
}

export function SelectInput({
  opcoes,
  placeholder = "Selecione…",
  className,
  onValueChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  opcoes: { valor: string; rotulo: string }[];
  placeholder?: string;
  onValueChange?: (valor: string) => void;
}) {
  return (
    <select
      {...props}
      className={cn(inputBase, className)}
      onChange={(e) => {
        onValueChange?.(e.target.value);
        props.onChange?.(e);
      }}
    >
      <option value="">{placeholder}</option>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}

export function YesNoToggle({
  valor,
  onChange,
  nome,
}: {
  valor: boolean | null;
  onChange: (valor: boolean) => void;
  nome?: string;
}) {
  const botao = (ativo: boolean, rotulo: string, alvo: boolean) => (
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={nome ? `${nome}: ${rotulo}` : rotulo}
      onClick={() => onChange(alvo)}
      className={cn(
        "h-10 flex-1 rounded-full border text-sm font-medium transition",
        ativo
          ? "border-transparent bg-jt-blue text-white shadow-pill"
          : "border-jt-line bg-jt-panel text-jt-muted hover:bg-jt-panel-2",
      )}
    >
      {rotulo}
    </button>
  );
  return (
    <div className="flex max-w-xs gap-2">
      {botao(valor === true, "Sim", true)}
      {botao(valor === false, "Não", false)}
    </div>
  );
}

export function ProgressTrail({
  etapas,
  atual,
}: {
  etapas: string[];
  atual: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {etapas.map((etapa, i) => {
        const concluida = i < atual;
        const ativa = i === atual;
        return (
          <li key={etapa} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs num",
                concluida && "border-transparent bg-jt-success/15 text-jt-success",
                ativa && "border-transparent bg-jt-blue text-white",
                !concluida && !ativa && "border-jt-line text-jt-muted",
              )}
            >
              {concluida ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                ativa ? "font-medium text-jt-text" : "text-jt-muted",
              )}
            >
              {etapa}
            </span>
            {i < etapas.length - 1 ? (
              <span className="hidden h-px w-8 bg-jt-line sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
