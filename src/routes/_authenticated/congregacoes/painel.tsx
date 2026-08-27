import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Church, MapPinned, PowerOff, Users } from "lucide-react";

import { PageHeader, StatCard } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/congregacoes/painel")({
  head: () => ({
    meta: [
      { title: "Painel de congregações — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Visão geral das congregações do ministério." },
      { property: "og:title", content: "Painel de congregações — AD CRM" },
      { property: "og:description", content: "Visão geral das congregações do ministério." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CongregacoesPainel,
});

function CongregacoesPainel() {
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "congregacoes" }, acesso);

  const indicadores = useQuery({
    queryKey: ["congregacoes-indicadores"],
    enabled: pode,
    queryFn: async () => {
      const [congregacoes, cadastros] = await Promise.all([
        supabase.from("congregacoes").select("id, status, estado"),
        supabase.from("cadastros").select("congregacao_id"),
      ]);
      if (congregacoes.error) throw congregacoes.error;
      if (cadastros.error) throw cadastros.error;

      const lista = congregacoes.data ?? [];
      const ativas = lista.filter((c) => c.status === "ativa");
      const vinculados = (cadastros.data ?? []).filter((c) => c.congregacao_id).length;
      const estados = new Set(lista.map((c) => c.estado).filter(Boolean));

      return {
        ativas: ativas.length,
        inativas: lista.length - ativas.length,
        membros: vinculados,
        estados: estados.size,
      };
    },
  });

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Painel — Congregações" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Painel — Congregações" />
        <SemPermissao mensagem="Sua conta não tem permissão de liderança para ver as congregações." />
      </>
    );
  }

  const dados = indicadores.data;
  const numero = (v: number | undefined) => (indicadores.isLoading ? "—" : String(v ?? 0));

  return (
    <>
      <PageHeader titulo="Painel — Congregações" />

      {indicadores.isError ? (
        <p className="mb-4 text-xs text-jt-coral">
          Não foi possível carregar os indicadores. Tente novamente em instantes.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icone={Church} rotulo="Congregações ativas" valor={numero(dados?.ativas)} />
        <StatCard icone={PowerOff} rotulo="Congregações inativas" valor={numero(dados?.inativas)} />
        <StatCard icone={Users} rotulo="Membros vinculados" valor={numero(dados?.membros)} />
        <StatCard
          icone={MapPinned}
          rotulo="Estados com congregação"
          valor={numero(dados?.estados)}
        />
      </div>
    </>
  );
}
