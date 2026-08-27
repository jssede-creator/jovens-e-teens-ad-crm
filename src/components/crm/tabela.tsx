import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  LayoutList,
  ListTree,
  Search,
  X,
} from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Peças visuais das tabelas do CRM: casca, toolbar redonda, cabeçalho ordenável,
 * faixa de grupo e paginação. Nenhuma delas conhece dados — só apresentação.
 */

const TAMANHOS_PAGINA = [10, 25, 50, 100] as const;

/** Cores cíclicas das faixas de grupo. */
const CORES_GRUPO = [
  "border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/30",
  "border-l-violet-500 bg-violet-50/60 dark:bg-violet-950/30",
  "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/30",
  "border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30",
  "border-l-rose-500 bg-rose-50/60 dark:bg-rose-950/30",
  "border-l-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30",
];

/** Dá a borda arredondada em volta de toolbar + tabela + paginação. */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-jt-line bg-jt-panel">{children}</div>
  );
}

export function TableToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-jt-line px-3 py-2.5">
      {children}
    </div>
  );
}

export function TableToolbarActions({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex flex-wrap items-center gap-1.5">{children}</div>;
}

/** Botão redondo de 36px da toolbar. `ativo` pinta de dourado; `contador` põe o selo. */
export const ToolbarIconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    rotulo: string;
    ativo?: boolean;
    contador?: number;
  }
>(({ rotulo, ativo, contador, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={rotulo}
    title={rotulo}
    className={cn(
      "relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-jt-line text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold",
      ativo && "border-jt-gold/50 text-jt-gold",
      className,
    )}
    {...props}
  >
    {children}
    {contador ? (
      <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full border-transparent bg-jt-gold px-1 text-[10px] text-white">
        {contador}
      </Badge>
    ) : null}
  </button>
));
ToolbarIconButton.displayName = "ToolbarIconButton";

export function TableSearch({
  valor,
  onChange,
  placeholder,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-jt-muted"
        aria-hidden
      />
      <Input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 rounded-full border-jt-line bg-jt-panel-2 pl-8 text-sm"
      />
      {valor ? (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-jt-muted hover:text-jt-text"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function FilterMenu({
  contador,
  largura = "w-64",
  children,
}: {
  contador: number;
  largura?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarIconButton rotulo="Filtrar" ativo={contador > 0} contador={contador}>
          <Filter className="h-4 w-4" aria-hidden />
        </ToolbarIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("max-h-80 overflow-y-auto border-jt-line bg-jt-panel", largura)}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ColumnsMenu<K extends string>({
  colunas,
  visiveis,
  onToggle,
}: {
  colunas: readonly { chave: K; rotulo: string }[];
  visiveis: Set<K>;
  onToggle: (chave: K, marcada: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarIconButton rotulo="Colunas">
          <Columns3 className="h-4 w-4" aria-hidden />
        </ToolbarIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-56 overflow-y-auto border-jt-line bg-jt-panel"
      >
        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
        {colunas.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.chave}
            checked={visiveis.has(c.chave)}
            onCheckedChange={(marcada) => onToggle(c.chave, marcada === true)}
          >
            {c.rotulo}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GroupToggleButton({
  agrupado,
  rotulo,
  onToggle,
}: {
  agrupado: boolean;
  rotulo: string;
  onToggle: () => void;
}) {
  return (
    <ToolbarIconButton
      rotulo={agrupado ? "Desagrupar" : rotulo}
      ativo={agrupado}
      onClick={onToggle}
    >
      {agrupado ? (
        <ListTree className="h-4 w-4" aria-hidden />
      ) : (
        <LayoutList className="h-4 w-4" aria-hidden />
      )}
    </ToolbarIconButton>
  );
}

/** Cabeçalho clicável: seta na coluna ativa, ícone apagado nas demais. */
export function SortableHead<K extends string>({
  rotulo,
  chave,
  atual,
  direcao,
  onOrdenar,
  className,
}: {
  rotulo: string;
  chave: K;
  atual: K;
  direcao: "asc" | "desc";
  onOrdenar: (chave: K) => void;
  className?: string;
}) {
  const ativo = atual === chave;
  return (
    <TableHead className={cn("text-jt-muted", className)}>
      <button
        type="button"
        onClick={() => onOrdenar(chave)}
        className={cn(
          "inline-flex items-center gap-1 transition hover:text-jt-text",
          ativo && "text-jt-text",
        )}
      >
        {rotulo}
        {ativo ? (
          direcao === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

/** Faixa de grupo dentro do corpo da tabela, com borda esquerda colorida. */
export function GroupHeaderRow({
  rotulo,
  contagem,
  indice,
  colSpan,
  recolhido,
  onToggle,
}: {
  rotulo: string;
  contagem: number;
  indice: number;
  colSpan: number;
  recolhido: boolean;
  onToggle: () => void;
}) {
  return (
    <TableRow className="border-jt-line hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left text-sm font-semibold",
            CORES_GRUPO[indice % CORES_GRUPO.length],
          )}
        >
          {recolhido ? (
            <ChevronRight className="h-4 w-4 text-jt-muted" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-jt-muted" aria-hidden />
          )}
          {rotulo}
          <span className="font-normal text-jt-muted">({contagem})</span>
        </button>
      </TableCell>
    </TableRow>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="border-jt-line hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-jt-muted">
        {children}
      </TableCell>
    </TableRow>
  );
}

export function TablePagination({
  pagina,
  totalPaginas,
  total,
  tamanhoPagina,
  onPagina,
  onTamanhoPagina,
  unidade = "registros",
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  tamanhoPagina: number;
  onPagina: (atualizar: (p: number) => number) => void;
  onTamanhoPagina: (n: number) => void;
  unidade?: string;
}) {
  if (total === 0) return null;
  const rotuloTamanho = `${unidade.charAt(0).toUpperCase()}${unidade.slice(1)} por página`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-jt-line px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-jt-muted">
          Mostrando {(pagina - 1) * tamanhoPagina + 1}–{Math.min(pagina * tamanhoPagina, total)} de{" "}
          {total}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-jt-muted">
          <span className="hidden sm:inline">{rotuloTamanho}</span>
          <select
            aria-label={rotuloTamanho}
            value={tamanhoPagina}
            onChange={(e) => onTamanhoPagina(Number(e.target.value))}
            className="h-8 rounded-md border border-jt-line bg-jt-panel-2 px-2 text-xs text-jt-text outline-none transition hover:bg-jt-panel focus:ring-2 focus:ring-jt-blue/30"
          >
            {TAMANHOS_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={pagina === 1}
          onClick={() => onPagina((p) => Math.max(1, p - 1))}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-jt-line px-2.5 text-xs font-medium text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
        </button>
        <span className="px-2 text-xs text-jt-muted">
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          disabled={pagina === totalPaginas}
          onClick={() => onPagina((p) => Math.min(totalPaginas, p + 1))}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-jt-line px-2.5 text-xs font-medium text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
