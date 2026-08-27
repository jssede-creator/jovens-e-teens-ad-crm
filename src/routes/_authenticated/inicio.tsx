import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, ClipboardCheck, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { Bloco } from "@/components/crm/pagina";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO } from "@/lib/ebd";
import { dataParaBR, hora } from "@/lib/formato";
import { itensVisiveis, navegacao, podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Menu inicial — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Atalhos, pendências e resumo do seu acesso." },
      { property: "og:title", content: "Menu inicial — AD CRM" },
      { property: "og:description", content: "Atalhos, pendências e resumo do seu acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MenuInicial,
});

function saudacao(h = new Date().getHours()) {
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function CartaoResumo({
  icone: Icone,
  rotulo,
  valor,
  rodape,
}: {
  icone: typeof CalendarClock;
  rotulo: string;
  valor: string;
  rodape: string;
}) {
  return (
    <div className="rounded-[20px] border border-jt-line bg-jt-panel p-5">
      <p className="flex items-center gap-2 text-xs text-jt-muted">
        <Icone className="h-4 w-4" aria-hidden />
        {rotulo}
      </p>
      <p className="num mt-2 truncate text-2xl font-bold leading-tight text-jt-text">{valor}</p>
      <p className="mt-1 text-xs text-jt-muted">{rodape}</p>
    </div>
  );
}

function MenuInicial() {
  const { data: acesso } = useAcesso();
  const [nome, setNome] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setNome((data.user?.user_metadata?.["nome"] as string | undefined) ?? "");
    });
  }, []);

  const vePapo = podeVer({ tipo: "modulo", modulo: "papo_reto" }, acesso);

  const resumo = useQuery({
    queryKey: ["inicio", vePapo],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao.user?.id;

      const cadastro = userId
        ? await supabase
            .from("cadastros")
            .select("compartilhou_dados_complementares, congregacoes(nome)")
            .eq("user_id", userId)
            .maybeSingle()
        : null;

      let proximo: { data: string; hora_inicio: string; assunto: string } | null = null;
      let pendentes = 0;
      let total = 0;

      if (vePapo && userId) {
        const { data } = await supabase
          .from("papo_reto_agendamentos")
          .select("data, hora_inicio, assunto, status")
          .eq("user_id", userId)
          .order("data");
        const lista = data ?? [];
        total = lista.length;
        pendentes = lista.filter((a) => a.status === "pendente").length;
        proximo =
          lista.find((a) => a.status === "confirmado" && a.data >= hojeISO()) ??
          lista.find((a) => a.status === "pendente" && a.data >= hojeISO()) ??
          null;
      }

      return {
        temCadastro: Boolean(cadastro?.data),
        completo: cadastro?.data?.compartilhou_dados_complementares ?? false,
        congregacao:
          (cadastro?.data?.congregacoes as unknown as { nome: string } | null)?.nome ?? "—",
        proximo,
        pendentes,
        totalAgendamentos: total,
      };
    },
  });

  const d = resumo.data;
  const etapas = d ? (d.temCadastro ? 1 : 0) + (d.completo ? 1 : 0) : 0;
  const percentual = Math.round((etapas / 2) * 100);

  const areas = navegacao.flatMap((grupo) =>
    itensVisiveis(grupo.itens, acesso).filter((i) => i.rota !== "/inicio" && i.rota !== "/"),
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-jt-text">
        {saudacao()}
        {nome ? `, ${nome}` : ""}. Tudo o que você acessa no CRM começa por aqui.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Bloco className="flex flex-col">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jt-blue/10 text-jt-blue">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="font-display text-base font-semibold text-jt-text">
              Complemento de cadastro
            </h2>
          </div>

          <p className="mt-3 max-w-lg text-sm text-jt-muted">
            {!d?.temCadastro
              ? "Você ainda não preencheu o cadastro do ministério. Leva poucos minutos."
              : d.completo
                ? "Seu cadastro está completo. Se algo mudou — endereço, estudo, trabalho ou renda — atualize quando quiser."
                : "Falta a parte complementar do seu cadastro: estudo, trabalho e composição familiar."}
          </p>

          <div className="mt-auto pt-6">
            <div className="flex items-baseline justify-between text-xs text-jt-muted">
              <span className="num">{etapas} de 2 etapas concluídas</span>
              <span className="num">{percentual}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-jt-panel-2">
              <div
                className="h-full rounded-full bg-jt-success transition-[width]"
                style={{ width: `${percentual}%` }}
              />
            </div>

            <Link to="/" className="mt-4 inline-block">
              <PillButton className="h-11 px-6">
                {d?.temCadastro ? "Revisar meu cadastro" : "Fazer meu cadastro"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </PillButton>
            </Link>
          </div>
        </Bloco>

        <div className="space-y-4">
          <CartaoResumo
            icone={ClipboardCheck}
            rotulo="Situação do cadastro"
            valor={!d?.temCadastro ? "Pendente" : d.completo ? "Completo" : "Básico"}
            rodape={d?.temCadastro ? `Congregação ${d.congregacao}` : "Sem cadastro no ministério"}
          />
          <CartaoResumo
            icone={CalendarClock}
            rotulo="Próximo papo reto"
            valor={d?.proximo ? dataParaBR(d.proximo.data) : "—"}
            rodape={
              d?.proximo
                ? `${hora(d.proximo.hora_inicio)} · ${d.proximo.assunto}`
                : vePapo
                  ? "nada marcado"
                  : "sem acesso ao papo reto"
            }
          />
          <CartaoResumo
            icone={MessageCircle}
            rotulo="Agendamentos"
            valor={String(d?.totalAgendamentos ?? 0)}
            rodape={`${d?.pendentes ?? 0} aguardando resposta`}
          />
        </div>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-jt-text">Acesso rápido</h2>
          <span className="text-xs text-jt-muted">{areas.length} áreas liberadas para você</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((item) => {
            const Icone = item.icone;
            return (
              <Link
                key={item.rota}
                to={item.rota}
                className="flex items-start gap-3 rounded-[20px] border border-jt-line bg-jt-panel p-4 transition hover:bg-jt-panel-2"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jt-panel-2 text-jt-muted">
                  <Icone className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-jt-text">{item.rotulo}</p>
                  <p className="mt-0.5 text-xs text-jt-muted">{item.descricao}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
