import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AvatarIniciais, Bloco, PageHeader } from "@/components/crm/pagina";
import { Carregando } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { idadeEm, iniciais } from "@/lib/ebd";
import { dataParaBR } from "@/lib/formato";

export const Route = createFileRoute("/_authenticated/perfil/")({
  head: () => ({
    meta: [
      { title: "Meus dados — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Informações da sua conta no ministério." },
      { property: "og:title", content: "Meus dados — AD CRM" },
      { property: "og:description", content: "Informações da sua conta no ministério." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeusDados,
});

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-jt-line py-2 last:border-0">
      <span className="text-xs text-jt-muted">{rotulo}</span>
      <span className="text-sm text-jt-text">{valor}</span>
    </div>
  );
}

function MeusDados() {
  const [conta, setConta] = useState<{ nome: string; email: string; criado: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      setConta({
        nome: (user.user_metadata?.["nome"] as string | undefined) ?? user.email ?? "—",
        email: user.email ?? "—",
        criado: user.created_at ?? "",
      });
    });
  }, []);

  const cadastro = useQuery({
    queryKey: ["meu-cadastro"],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user?.id;
      if (!userId) return null;
      const { data, error } = await supabase
        .from("cadastros")
        .select(
          "nome_completo, data_nascimento, telefone, email, cidade, congregacao_id, compartilhou_dados_complementares, data_cadastro, congregacoes(nome)",
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!conta) {
    return (
      <>
        <PageHeader titulo="Meus dados" />
        <Carregando />
      </>
    );
  }

  const c = cadastro.data;
  const congregacao = (c?.congregacoes as unknown as { nome: string } | null)?.nome ?? "—";
  const idade = idadeEm(c?.data_nascimento);

  return (
    <>
      <PageHeader titulo="Meus dados" descricao="Informações da sua conta no ministério." />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Bloco>
          <div className="flex items-center gap-3">
            <AvatarIniciais texto={iniciais(conta.nome)} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-jt-text">{conta.nome}</p>
              <p className="truncate text-xs text-jt-muted">{conta.email}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-jt-line pt-3">
            <Badge
              variant="outline"
              className={
                c?.compartilhou_dados_complementares
                  ? "border-jt-line font-normal text-jt-success"
                  : "border-jt-line font-normal text-jt-muted"
              }
            >
              {c
                ? c.compartilhou_dados_complementares
                  ? "Cadastro completo"
                  : "Cadastro básico"
                : "Sem cadastro"}
            </Badge>
          </div>
          <Link
            to="/"
            className="mt-4 inline-flex text-sm font-medium text-jt-blue hover:underline"
          >
            Complementar ou revisar cadastro →
          </Link>
        </Bloco>

        <Bloco titulo="Cadastro no ministério">
          {cadastro.isLoading ? (
            <p className="py-6 text-center text-sm text-jt-muted">Carregando…</p>
          ) : !c ? (
            <p className="py-6 text-center text-sm text-jt-muted">
              Você ainda não preencheu o cadastro do ministério.
            </p>
          ) : (
            <div>
              <Linha rotulo="Nome completo" valor={c.nome_completo} />
              <Linha
                rotulo="Nascimento"
                valor={`${dataParaBR(c.data_nascimento)}${idade != null ? ` · ${idade} anos` : ""}`}
              />
              <Linha rotulo="Congregação" valor={congregacao} />
              <Linha rotulo="Telefone" valor={c.telefone} />
              <Linha rotulo="E-mail" valor={c.email} />
              <Linha rotulo="Cidade" valor={c.cidade} />
              <Linha rotulo="Cadastrado em" valor={dataParaBR(c.data_cadastro.slice(0, 10))} />
            </div>
          )}
        </Bloco>
      </div>
    </>
  );
}
