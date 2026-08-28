import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Filter, Group, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type Coluna<T> = {
  chave: string;
  titulo: string;
  /** Valor bruto usado em ordenação, busca, filtros e agrupamento. */
  valor: (linha: T) => string | number | null | undefined;
  /** Conteúdo exibido na célula. Padrão: o próprio valor. */
  render?: (linha: T) => ReactNode;
  /** Habilita filtro por opções nesta coluna. */
  filtravel?: boolean;
  /** Permite agrupar por esta coluna. */
  agrupavel?: boolean;
  alinhamento?: "esquerda" | "direita";
  className?: string;
};

const TAMANHOS = [10, 25, 50, 100];

const textoDe = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function DataTable<T>({
  dados,
  colunas,
  chaveLinha,
  vazio = "Nenhum item corresponde aos filtros.",
  acoes,
  carregando,
}: {
  dados: T[];
  colunas: Coluna<T>[];
  chaveLinha: (linha: T) => string;
  vazio?: string;
  acoes?: ReactNode;
  carregando?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<{ chave: string; dir: "asc" | "desc" } | null>(null);
  const [filtros, setFiltros] = useState<Record<string, string[]>>({});
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [agruparPor, setAgruparPor] = useState<string>("");
  const [tamanho, setTamanho] = useState(10);
  const [pagina, setPagina] = useState(1);

  const visiveis = colunas.filter((c) => !ocultas.includes(c.chave));
  const filtraveis = colunas.filter((c) => c.filtravel);
  const agrupaveis = colunas.filter((c) => c.agrupavel ?? c.filtravel);
  const filtrosAtivos = Object.values(filtros).filter((v) => v.length > 0).length;

  const opcoesPorColuna = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const coluna of filtraveis) {
      const set = new Set<string>();
      for (const linha of dados) {
        const v = textoDe(coluna.valor(linha));
        if (v) set.add(v);
      }
      mapa[coluna.chave] = [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    return mapa;
  }, [dados, filtraveis]);

  const processados = useMemo(() => {
    let saida = [...dados];

    const termo = busca.trim().toLowerCase();
    if (termo) {
      saida = saida.filter((linha) =>
        colunas.some((c) => textoDe(c.valor(linha)).toLowerCase().includes(termo)),
      );
    }

    for (const [chave, selecionados] of Object.entries(filtros)) {
      if (!selecionados.length) continue;
      const coluna = colunas.find((c) => c.chave === chave);
      if (!coluna) continue;
      saida = saida.filter((linha) => selecionados.includes(textoDe(coluna.valor(linha))));
    }

    if (ordem) {
      const coluna = colunas.find((c) => c.chave === ordem.chave);
      if (coluna) {
        saida.sort((a, b) => {
          const va = coluna.valor(a);
          const vb = coluna.valor(b);
          let r: number;
          if (typeof va === "number" && typeof vb === "number") r = va - vb;
          else r = textoDe(va).localeCompare(textoDe(vb), "pt-BR");
          return ordem.dir === "asc" ? r : -r;
        });
      }
    }

    if (agruparPor) {
      const coluna = colunas.find((c) => c.chave === agruparPor);
      if (coluna) {
        saida.sort((a, b) =>
          textoDe(coluna.valor(a)).localeCompare(textoDe(coluna.valor(b)), "pt-BR"),
        );
      }
    }

    return saida;
  }, [dados, colunas, busca, filtros, ordem, agruparPor]);

  const totalPaginas = Math.max(1, Math.ceil(processados.length / tamanho));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const fatia = processados.slice((paginaAtual - 1) * tamanho, paginaAtual * tamanho);

  const colunaGrupo = colunas.find((c) => c.chave === agruparPor);
  const contagemGrupo = useMemo(() => {
    if (!colunaGrupo) return {};
    const mapa: Record<string, number> = {};
    for (const linha of processados) {
      const chave = textoDe(colunaGrupo.valor(linha)) || "—";
      mapa[chave] = (mapa[chave] ?? 0) + 1;
    }
    return mapa;
  }, [processados, colunaGrupo]);

  const alternarOrdem = (chave: string) => {
    setOrdem((atual) => {
      if (!atual || atual.chave !== chave) return { chave, dir: "asc" };
      if (atual.dir === "asc") return { chave, dir: "desc" };
      return null;
    });
  };

  const alternarFiltro = (chave: string, valor: string) => {
    setPagina(1);
    setFiltros((atual) => {
      const lista = atual[chave] ?? [];
      const nova = lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
      return { ...atual, [chave]: nova };
    });
  };

  let grupoAnterior: string | null = null;

  return (
    <div className="rounded-xl border border-jt-line bg-jt-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-jt-line p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-jt-muted"
            aria-hidden
          />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar…"
            aria-label="Buscar na tabela"
            className="h-9 w-full rounded-full border border-jt-line bg-jt-panel-2 pl-9 pr-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
          />
        </div>

        {filtraveis.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="jt-pill h-9 border border-jt-line bg-jt-panel text-sm text-jt-text hover:bg-jt-panel-2">
                <Filter className="h-4 w-4" aria-hidden />
                Filtros
                {filtrosAtivos > 0 ? (
                  <span className="num rounded-full bg-jt-blue/10 px-2 text-xs text-jt-blue">
                    {filtrosAtivos}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-60 overflow-auto">
              {filtraveis.map((coluna) => (
                <div key={coluna.chave}>
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-jt-muted">
                    {coluna.titulo}
                  </DropdownMenuLabel>
                  {(opcoesPorColuna[coluna.chave] ?? []).map((opcao) => (
                    <DropdownMenuCheckboxItem
                      key={opcao}
                      checked={(filtros[coluna.chave] ?? []).includes(opcao)}
                      onCheckedChange={() => alternarFiltro(coluna.chave, opcao)}
                    >
                      {opcao}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="jt-pill h-9 border border-jt-line bg-jt-panel text-sm text-jt-text hover:bg-jt-panel-2">
              <Columns3 className="h-4 w-4" aria-hidden />
              Colunas
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-jt-muted">
              Colunas visíveis
            </DropdownMenuLabel>
            {colunas.map((coluna) => (
              <DropdownMenuCheckboxItem
                key={coluna.chave}
                checked={!ocultas.includes(coluna.chave)}
                onCheckedChange={() =>
                  setOcultas((atual) =>
                    atual.includes(coluna.chave)
                      ? atual.filter((c) => c !== coluna.chave)
                      : [...atual, coluna.chave],
                  )
                }
              >
                {coluna.titulo}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {agrupaveis.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="jt-pill h-9 border border-jt-line bg-jt-panel text-sm text-jt-text hover:bg-jt-panel-2">
                <Group className="h-4 w-4" aria-hidden />
                Agrupar por
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuRadioGroup value={agruparPor} onValueChange={setAgruparPor}>
                <DropdownMenuRadioItem value="">Sem agrupamento</DropdownMenuRadioItem>
                {agrupaveis.map((coluna) => (
                  <DropdownMenuRadioItem key={coluna.chave} value={coluna.chave}>
                    {coluna.titulo}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {acoes}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-jt-line">
              {visiveis.map((coluna) => {
                const ativa = ordem?.chave === coluna.chave;
                return (
                  <th
                    key={coluna.chave}
                    className={cn(
                      "px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-jt-muted",
                      coluna.alinhamento === "direita" && "text-right",
                    )}
                  >
                    <button
                      onClick={() => alternarOrdem(coluna.chave)}
                      className="inline-flex items-center gap-1 hover:text-jt-text"
                      aria-label={`Ordenar por ${coluna.titulo}`}
                    >
                      {coluna.titulo}
                      {ativa ? (
                        ordem?.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td
                  colSpan={visiveis.length}
                  className="px-4 py-12 text-center text-sm text-jt-muted"
                >
                  Carregando…
                </td>
              </tr>
            ) : fatia.length === 0 ? (
              <tr>
                <td
                  colSpan={visiveis.length}
                  className="px-4 py-12 text-center text-sm text-jt-muted"
                >
                  {vazio}
                </td>
              </tr>
            ) : (
              fatia.map((linha) => {
                const nós: ReactNode[] = [];
                if (colunaGrupo) {
                  const grupo = textoDe(colunaGrupo.valor(linha)) || "—";
                  if (grupo !== grupoAnterior) {
                    grupoAnterior = grupo;
                    nós.push(
                      <tr key={`grupo-${grupo}`} className="bg-jt-panel-2">
                        <td
                          colSpan={visiveis.length}
                          className="px-4 py-2 text-xs font-medium text-jt-text"
                        >
                          {grupo}
                          <span className="num ml-2 text-jt-muted">
                            {contagemGrupo[grupo] ?? 0}
                          </span>
                        </td>
                      </tr>,
                    );
                  }
                }
                nós.push(
                  <tr
                    key={chaveLinha(linha)}
                    className="border-b border-jt-line last:border-0 hover:bg-jt-panel-2"
                  >
                    {visiveis.map((coluna) => (
                      <td
                        key={coluna.chave}
                        className={cn(
                          "px-4 py-3 text-jt-text",
                          coluna.alinhamento === "direita" && "text-right",
                          coluna.className,
                        )}
                      >
                        {coluna.render ? coluna.render(linha) : textoDe(coluna.valor(linha))}
                      </td>
                    ))}
                  </tr>,
                );
                return nós;
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-jt-line p-3 text-sm text-jt-muted">
        <div className="flex items-center gap-2">
          <span>Itens por página</span>
          <select
            aria-label="Itens por página"
            value={tamanho}
            onChange={(e) => {
              setTamanho(Number(e.target.value));
              setPagina(1);
            }}
            className="num h-8 rounded-lg border border-jt-line bg-jt-panel px-2 text-jt-text"
          >
            {TAMANHOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="num">
            {processados.length === 0 ? 0 : (paginaAtual - 1) * tamanho + 1}–
            {Math.min(paginaAtual * tamanho, processados.length)} de {processados.length}
          </span>
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={paginaAtual <= 1}
            className="jt-pill h-8 border border-jt-line px-3 text-jt-text disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={paginaAtual >= totalPaginas}
            className="jt-pill h-8 border border-jt-line px-3 text-jt-text disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
