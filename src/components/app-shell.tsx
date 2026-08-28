import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import logoCrm from "@/assets/crm-jt.png";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { HOME_ROTA, itensVisiveis, migalhas, navegacao, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const CHAVE_RECOLHIDO = "jt-sidebar-recolhido";

type Largura = "compacto" | "trilho" | "amplo";

function useLargura(): Largura {
  const [largura, setLargura] = useState<Largura>("amplo");
  useEffect(() => {
    const calcular = () => {
      const w = window.innerWidth;
      setLargura(w < 768 ? "compacto" : w < 1024 ? "trilho" : "amplo");
    };
    calcular();
    window.addEventListener("resize", calcular);
    return () => window.removeEventListener("resize", calcular);
  }, []);
  return largura;
}

export function AppShell({ children }: { children: ReactNode }) {
  const largura = useLargura();
  const [preferenciaRecolhida, setPreferenciaRecolhida] = useState(false);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [conta, setConta] = useState<{ nome: string; email: string } | null>(null);
  const { data: acesso } = useAcesso();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_RECOLHIDO);
    if (salvo != null) setPreferenciaRecolhida(salvo === "true");
  }, []);

  useEffect(() => {
    setGavetaAberta(false);
  }, [pathname]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      setConta({
        nome: (user.user_metadata?.["nome"] as string | undefined) ?? "Minha conta",
        email: user.email ?? "",
      });
    });
  }, []);

  const recolhida =
    largura === "trilho" ? true : largura === "amplo" ? preferenciaRecolhida : false;

  const alternarBarra = () => {
    if (largura === "compacto") {
      setGavetaAberta((a) => !a);
      return;
    }
    const novo = !preferenciaRecolhida;
    setPreferenciaRecolhida(novo);
    window.localStorage.setItem(CHAVE_RECOLHIDO, String(novo));
  };

  const sair = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const trilha = migalhas(pathname);
  const iniciais = (conta?.nome ?? "?").trim().slice(0, 1).toUpperCase();

  const barra = (
    <Sidebar
      recolhida={recolhida && largura !== "compacto"}
      pathname={pathname}
      acesso={acesso ?? null}
      conta={conta}
      onSair={sair}
    />
  );

  return (
    <div className="h-screen overflow-hidden bg-jt-bg-top">
      {largura !== "compacto" ? (
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 border-r border-jt-line bg-jt-panel transition-[width] duration-200",
            recolhida ? "w-[68px]" : "w-64",
          )}
        >
          {barra}
        </aside>
      ) : null}

      {largura === "compacto" && gavetaAberta ? (
        <>
          <button
            aria-label="Fechar menu"
            onClick={() => setGavetaAberta(false)}
            className="fixed inset-0 z-30 bg-black/50"
          />
          <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-jt-line bg-jt-panel">
            <button
              aria-label="Fechar menu"
              onClick={() => setGavetaAberta(false)}
              className="absolute right-2 top-3 rounded-lg p-2 text-jt-muted hover:bg-jt-panel-2"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            {barra}
          </aside>
        </>
      ) : null}

      <div
        className={cn(
          "flex h-screen flex-col transition-[padding] duration-200",
          largura === "compacto" ? "pl-0" : recolhida ? "pl-[68px]" : "pl-64",
        )}
      >
        <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-jt-line bg-jt-panel/80 px-3 backdrop-blur sm:px-4">
          <button
            onClick={alternarBarra}
            aria-label={recolhida ? "Expandir barra lateral" : "Recolher barra lateral"}
            className="rounded-lg p-2 text-jt-muted hover:bg-jt-panel-2 hover:text-jt-text"
          >
            {largura === "compacto" ? (
              <Menu className="h-5 w-5" aria-hidden />
            ) : recolhida ? (
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            ) : (
              <PanelLeftClose className="h-5 w-5" aria-hidden />
            )}
          </button>

          <div className="relative max-w-md flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-jt-muted"
              aria-hidden
            />
            <input
              placeholder="Buscar…"
              aria-label="Busca global"
              className="h-9 w-full rounded-full border border-jt-line bg-jt-panel-2 pl-9 pr-14 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-jt-line bg-jt-panel px-1.5 py-0.5 text-[10px] text-jt-muted sm:block">
              ⌘K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/configuracoes"
              aria-label="Configurações"
              className="rounded-lg p-2 text-jt-muted hover:bg-jt-panel-2 hover:text-jt-text"
            >
              <Settings className="h-5 w-5" aria-hidden />
            </Link>
            <button
              aria-label="Notificações"
              className="rounded-lg p-2 text-jt-muted hover:bg-jt-panel-2 hover:text-jt-text"
            >
              <Bell className="h-5 w-5" aria-hidden />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Opções da conta"
                  className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-jt-blue text-xs font-medium text-white"
                >
                  {iniciais}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs text-jt-muted">
                  {conta?.email ?? "—"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/perfil">
                    <UserRound className="mr-2 h-4 w-4" aria-hidden />
                    Meus dados
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={sair}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {trilha.length > 0 ? (
            <nav
              aria-label="Migalhas de pão"
              className="mb-3 flex flex-wrap items-center gap-1 text-sm"
            >
              {trilha.map((m, i) => (
                <span key={`${m.rotulo}-${i}`} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="h-4 w-4 text-jt-muted" aria-hidden /> : null}
                  {m.rota && i < trilha.length - 1 ? (
                    <Link to={m.rota} className="text-jt-muted hover:text-jt-text">
                      {m.rotulo}
                    </Link>
                  ) : (
                    <span className="text-jt-text">{m.rotulo}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  recolhida,
  pathname,
  acesso,
  conta,
  onSair,
}: {
  recolhida: boolean;
  pathname: string;
  acesso: { isAdmin: boolean; modules: string[] } | null;
  conta: { nome: string; email: string } | null;
  onSair: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link
        to={HOME_ROTA}
        className="flex h-14 items-center gap-2 border-b border-jt-line px-4"
        aria-label="Ir para o Menu inicial"
      >
        <img
          src={logoCrm}
          alt=""
          aria-hidden
          className="h-8 w-8 shrink-0 rounded-lg object-cover"
        />
        {!recolhida ? (
          <span className="flex flex-col leading-tight">
            <span className="font-display text-sm text-jt-text">AD CRM</span>
            <span className="text-[11px] text-jt-muted">Jovens e Teens AD</span>
          </span>
        ) : null}
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navegacao.map((grupo) => {
          const itens = itensVisiveis(grupo.itens, acesso as never);
          if (!itens.length) return null;
          return (
            <div key={grupo.titulo} className="mb-4">
              {!recolhida ? (
                <p className="px-3 pb-2 text-[11px] uppercase tracking-wider text-jt-muted">
                  {grupo.titulo}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {itens.map((item) => (
                  <ItemBarra
                    key={item.rota + item.rotulo}
                    item={item}
                    recolhida={recolhida}
                    pathname={pathname}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-jt-line p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Opções da conta"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-jt-panel-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jt-blue text-xs font-medium text-white">
                {(conta?.nome ?? "?").trim().slice(0, 1).toUpperCase()}
              </span>
              {!recolhida ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-jt-text">
                    {conta?.nome ?? "Minha conta"}
                  </span>
                  <span className="block truncate text-xs text-jt-muted">
                    {conta?.email ?? "—"}
                  </span>
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/perfil">
                <UserRound className="mr-2 h-4 w-4" aria-hidden />
                Meus dados
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSair}>
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ItemBarra({
  item,
  recolhida,
  pathname,
}: {
  item: NavItem;
  recolhida: boolean;
  pathname: string;
}) {
  const naArea =
    pathname === item.rota ||
    (item.rota !== "/" && pathname.startsWith(item.rota + "/")) ||
    (item.filhos ?? []).some((f) => f.rota === pathname);
  const [aberta, setAberta] = useState(naArea);
  const Icone = item.icone;
  const temFilhos = (item.filhos?.length ?? 0) > 0;

  useEffect(() => {
    if (naArea) setAberta(true);
  }, [naArea]);

  const classesLink = cn(
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
    naArea ? "bg-jt-blue/10 font-medium text-jt-blue" : "text-jt-text hover:bg-jt-panel-2",
  );

  if (!temFilhos || recolhida) {
    return (
      <li>
        <Link to={item.rota} className={classesLink} title={item.rotulo}>
          <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {!recolhida ? <span className="truncate">{item.rotulo}</span> : null}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <div className="flex items-center">
        <Link to={item.rota} className={cn(classesLink, "flex-1")}>
          <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="truncate">{item.rotulo}</span>
        </Link>
        <button
          onClick={() => setAberta((a) => !a)}
          aria-label={aberta ? `Recolher ${item.rotulo}` : `Expandir ${item.rotulo}`}
          aria-expanded={aberta}
          className="rounded-lg p-1.5 text-jt-muted hover:bg-jt-panel-2"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", aberta && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>
      {aberta ? (
        <ul className="mt-0.5 space-y-0.5 border-l border-jt-line pl-3 ml-5">
          {(item.filhos ?? []).map((filho) => {
            const ativo = pathname === filho.rota;
            return (
              <li key={filho.rota + filho.rotulo}>
                <Link
                  to={filho.rota}
                  className={cn(
                    "block rounded-lg px-3 py-1.5 text-sm transition",
                    ativo
                      ? "bg-jt-blue/10 font-medium text-jt-blue"
                      : "text-jt-muted hover:bg-jt-panel-2 hover:text-jt-text",
                  )}
                >
                  {filho.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
