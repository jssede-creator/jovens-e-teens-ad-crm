import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Lock, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { useAcesso } from "@/hooks/use-acesso";
import { MODULOS } from "@/lib/modulos";
import { navegacao, podeVer, type NavItem, type Permissao } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil/painel-adm")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Todas as telas do CRM em um lugar só." },
      { property: "og:title", content: "Painel administrativo — AD CRM" },
      { property: "og:description", content: "Todas as telas do CRM em um lugar só." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PainelAdministrativo,
});

/** Rótulo curto da permissão que a área exige. */
function rotuloPermissao(permissao: Permissao) {
  if (permissao.tipo === "todos") return { texto: "Livre", livre: true };
  if (permissao.tipo === "admin") return { texto: "Admin", livre: false };
  const modulo = MODULOS.find((m) => m.chave === permissao.modulo);
  return { texto: modulo?.grupo ?? permissao.modulo, livre: false };
}

function CartaoArea({ item, liberado }: { item: NavItem; liberado: boolean }) {
  const Icone = item.icone;
  const permissao = rotuloPermissao(item.permissao);

  return (
    <section
      className={cn(
        "rounded-[20px] border border-jt-line bg-jt-panel p-4",
        !liberado && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jt-panel-2 text-jt-muted">
          <Icone className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={item.rota}
              className="font-display text-base font-semibold text-jt-text hover:underline"
            >
              {item.rotulo}
            </Link>
            <Badge
              variant="outline"
              className={cn(
                "gap-1 border-jt-line font-normal",
                permissao.livre ? "text-jt-muted" : "text-jt-blue",
              )}
            >
              {permissao.livre ? null : <Lock className="h-3 w-3" aria-hidden />}
              {permissao.texto}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-jt-muted">{item.descricao}</p>
        </div>
      </div>

      {item.filhos?.length ? (
        <ul className="mt-3 space-y-1 border-t border-jt-line pt-3">
          {item.filhos.map((filho) => {
            const IconeFilho = filho.icone;
            return (
              <li key={filho.rota + filho.rotulo}>
                <Link
                  to={filho.rota}
                  className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-jt-text transition hover:bg-jt-panel-2"
                >
                  <IconeFilho className="h-4 w-4 text-jt-muted" aria-hidden />
                  {filho.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function PainelAdministrativo() {
  const { data: acesso, isLoading } = useAcesso();

  if (isLoading) {
    return (
      <>
        <PageHeader titulo="Painel administrativo" />
        <Carregando />
      </>
    );
  }

  if (!acesso?.isAdmin) {
    return (
      <>
        <PageHeader titulo="Painel administrativo" />
        <SemPermissao mensagem="Só administradores enxergam o mapa completo do CRM." />
      </>
    );
  }

  const totalPaginas =
    navegacao.reduce(
      (soma, grupo) =>
        soma + grupo.itens.reduce((s, item) => s + 1 + (item.filhos?.length ?? 0), 0),
      0,
    ) + 1; // + a página de login, fora da área logada

  return (
    <>
      <PageHeader
        titulo="Painel administrativo"
        descricao="Todas as telas do CRM em um lugar só, com a permissão que cada uma exige."
        acoes={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {totalPaginas} páginas
          </Badge>
        }
      />

      {navegacao.map((grupo) => (
        <div key={grupo.titulo} className="mb-6">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-jt-muted">
            {grupo.titulo}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {grupo.itens.map((item) => (
              <CartaoArea
                key={item.rota + item.rotulo}
                item={item}
                liberado={podeVer(item.permissao, acesso)}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-jt-muted">
          Fora da área logada
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <section className="rounded-[20px] border border-jt-line bg-jt-panel p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jt-panel-2 text-jt-muted">
                <ExternalLink className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <a
                  href="/auth"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-display text-base font-semibold text-jt-text hover:underline"
                >
                  Página de login
                </a>
                <p className="mt-1 text-sm text-jt-muted">
                  Abre em nova aba, sem encerrar a sua sessão.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-jt-muted">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        As permissões acima filtram só o que aparece na tela. Quem manda de verdade é o banco, pelas
        políticas de acesso de cada tabela.
      </p>
    </>
  );
}
