import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Layers, Users } from "lucide-react";

import { Bloco, PageHeader, StatCard } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { MODULOS } from "@/lib/modulos";
import { navegacao, podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/configuracoes/sistema")({
  head: () => ({
    meta: [
      { title: "Sistema — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Informações do ambiente e dos módulos." },
      { property: "og:title", content: "Sistema — AD CRM" },
      { property: "og:description", content: "Informações do ambiente e dos módulos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfiguracoesSistema,
});

function ConfiguracoesSistema() {
  const { data: acesso, isLoading } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "configuracoes" }, acesso);

  const contagens = useQuery({
    queryKey: ["configuracoes-sistema"],
    enabled: pode,
    queryFn: async () => {
      const tabelas = ["cadastros", "congregacoes", "ebd_turmas", "projetos", "arquivos"] as const;
      const resultados = await Promise.all(
        tabelas.map((t) => supabase.from(t).select("id", { count: "exact", head: true })),
      );
      const saida: Record<string, number> = {};
      tabelas.forEach((t, i) => {
        saida[t] = resultados[i]?.count ?? 0;
      });
      return saida;
    },
  });

  if (isLoading) {
    return (
      <>
        <PageHeader titulo="Sistema — Configurações" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Sistema — Configurações" />
        <SemPermissao mensagem="Sua conta não tem permissão para abrir as configurações." />
      </>
    );
  }

  const areas = navegacao.flatMap((g) => g.itens);
  const registros = Object.values(contagens.data ?? {}).reduce((s, n) => s + n, 0);

  return (
    <>
      <PageHeader
        titulo="Sistema — Configurações"
        descricao="O que existe hoje no CRM: áreas, permissões e volume de registros."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icone={Layers} rotulo="Áreas do menu" valor={String(areas.length)} />
        <StatCard icone={Users} rotulo="Permissões disponíveis" valor={String(MODULOS.length)} />
        <StatCard
          icone={Database}
          rotulo="Registros guardados"
          valor={contagens.isLoading ? "—" : String(registros)}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Áreas e subpáginas" descricao="A mesma lista alimenta menu e migalhas">
          <ul className="space-y-2">
            {areas.map((item) => (
              <li key={item.rota} className="rounded-xl border border-jt-line px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-jt-text">{item.rotulo}</span>
                  <Badge variant="outline" className="border-jt-line font-normal text-jt-muted">
                    {item.rota}
                  </Badge>
                </div>
                {item.filhos?.length ? (
                  <p className="mt-1 text-xs text-jt-muted">
                    {item.filhos.map((f) => f.rota).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Bloco>

        <Bloco titulo="Volume por tabela" descricao="Contagem direta do banco">
          <ul className="space-y-2">
            {Object.entries(contagens.data ?? {}).map(([tabela, total]) => (
              <li
                key={tabela}
                className="flex items-center justify-between rounded-xl border border-jt-line px-3 py-2"
              >
                <span className="text-sm text-jt-text">{tabela}</span>
                <span className="num text-sm text-jt-muted">{total}</span>
              </li>
            ))}
            {contagens.isLoading ? <li className="text-sm text-jt-muted">Carregando…</li> : null}
          </ul>
        </Bloco>
      </div>
    </>
  );
}
