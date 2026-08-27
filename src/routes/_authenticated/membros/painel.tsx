import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Church, ClipboardCheck, Users } from "lucide-react";

import { AvatarIniciais, Bloco, PageHeader, StatCard, VazioBloco } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { diasAtras, iniciais, iso } from "@/lib/ebd";
import { dataParaBR } from "@/lib/formato";
import { podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/membros/painel")({
  head: () => ({
    meta: [
      { title: "Painel de membros — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Resumo dos cadastros do ministério." },
      { property: "og:title", content: "Painel de membros — AD CRM" },
      { property: "og:description", content: "Resumo dos cadastros do ministério." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MembrosPainel,
});

/** Oito semanas fechadas (segunda a domingo), da mais antiga para a mais nova. */
function ultimasSemanas(hoje = new Date()) {
  const dia = hoje.getDay();
  const offset = dia === 0 ? -6 : 1 - dia;
  const segundaAtual = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + offset);
  return Array.from({ length: 8 }, (_, i) => {
    const inicio = new Date(
      segundaAtual.getFullYear(),
      segundaAtual.getMonth(),
      segundaAtual.getDate() - (7 - i) * 7,
    );
    const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
    return { inicio: iso(inicio), fim: iso(fim), rotulo: rotuloSemana(inicio) };
  });
}

function rotuloSemana(data: Date) {
  const meses = [
    "jan.",
    "fev.",
    "mar.",
    "abr.",
    "mai.",
    "jun.",
    "jul.",
    "ago.",
    "set.",
    "out.",
    "nov.",
    "dez.",
  ];
  return `${String(data.getDate()).padStart(2, "0")} de ${meses[data.getMonth()]}`;
}

function MembrosPainel() {
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "membros" }, acesso);

  const consulta = useQuery({
    queryKey: ["membros-painel"],
    enabled: pode,
    queryFn: async () => {
      const [cadastros, congregacoes] = await Promise.all([
        supabase
          .from("cadastros")
          .select(
            "id, nome_completo, congregacao_id, compartilhou_dados_complementares, data_cadastro",
          )
          .order("data_cadastro", { ascending: false }),
        supabase.from("congregacoes").select("id, nome"),
      ]);
      if (cadastros.error) throw cadastros.error;
      if (congregacoes.error) throw congregacoes.error;

      const nomePorId = new Map((congregacoes.data ?? []).map((c) => [c.id, c.nome]));
      const lista = cadastros.data ?? [];

      const completos = lista.filter((c) => c.compartilhou_dados_complementares).length;
      const inicioMes = iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const novosMes = lista.filter((c) => c.data_cadastro.slice(0, 10) >= inicioMes).length;

      const porCongregacao = new Map<string, number>();
      for (const c of lista) {
        if (!c.congregacao_id) continue;
        porCongregacao.set(c.congregacao_id, (porCongregacao.get(c.congregacao_id) ?? 0) + 1);
      }
      const maior = [...porCongregacao.entries()].sort((a, b) => b[1] - a[1])[0];

      const semanas = ultimasSemanas().map((s) => ({
        ...s,
        total: lista.filter((c) => {
          const d = c.data_cadastro.slice(0, 10);
          return d >= s.inicio && d <= s.fim;
        }).length,
      }));

      return {
        total: lista.length,
        percentualCompletos: lista.length ? Math.round((completos / lista.length) * 100) : 0,
        novosMes,
        maiorCongregacao: maior ? (nomePorId.get(maior[0]) ?? "—") : "—",
        semanas,
        recentes: lista.slice(0, 6).map((c) => ({
          id: c.id,
          nome: c.nome_completo,
          congregacao: c.congregacao_id ? (nomePorId.get(c.congregacao_id) ?? "—") : "—",
          data: c.data_cadastro,
        })),
        desdeUltimoMes: lista.filter((c) => c.data_cadastro.slice(0, 10) >= diasAtras(30)).length,
      };
    },
  });

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Painel — Membros" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Painel — Membros" />
        <SemPermissao mensagem="Sua conta não tem permissão de liderança para ver os membros." />
      </>
    );
  }

  const dados = consulta.data;
  const numero = (v: number | undefined) => (consulta.isLoading ? "—" : String(v ?? 0));
  const semanas = dados?.semanas ?? [];
  const maiorBarra = Math.max(1, ...semanas.map((s) => s.total));
  const totalSemanas = semanas.reduce((soma, s) => soma + s.total, 0);

  return (
    <>
      <PageHeader titulo="Painel — Membros" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icone={Users} rotulo="Total de membros" valor={numero(dados?.total)} />
        <StatCard
          icone={ClipboardCheck}
          rotulo="Cadastros completos"
          valor={consulta.isLoading ? "—" : `${dados?.percentualCompletos ?? 0}%`}
        />
        <StatCard icone={CalendarPlus} rotulo="Novos este mês" valor={numero(dados?.novosMes)} />
        <StatCard
          icone={Church}
          rotulo="Maior congregação"
          valor={consulta.isLoading ? "—" : (dados?.maiorCongregacao ?? "—")}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Bloco
          titulo="Novos membros por semana"
          descricao="Últimas 8 semanas"
          acao={<span className="num text-2xl font-bold text-jt-text">{totalSemanas}</span>}
        >
          <div className="flex h-64 items-end gap-2">
            {semanas.map((s) => (
              <div key={s.inicio} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div
                  className="w-full rounded-sm bg-jt-blue"
                  style={{ height: `${Math.max((s.total / maiorBarra) * 100, 1)}%` }}
                  title={`${s.total} cadastro(s) na semana de ${s.rotulo}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            {semanas.map((s) => (
              <span key={s.inicio} className="flex-1 text-center text-[11px] text-jt-muted">
                {s.rotulo}
              </span>
            ))}
          </div>
        </Bloco>

        <Bloco titulo="Membros recentes" descricao="Últimos cadastros no CRM">
          {consulta.isLoading ? (
            <VazioBloco>Carregando…</VazioBloco>
          ) : (dados?.recentes.length ?? 0) === 0 ? (
            <VazioBloco>Nenhum cadastro ainda.</VazioBloco>
          ) : (
            <ul className="space-y-3">
              {dados?.recentes.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5">
                  <AvatarIniciais texto={iniciais(m.nome)} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-jt-text">{m.nome}</p>
                    <p className="truncate text-xs text-jt-muted">{m.congregacao}</p>
                  </div>
                  <span className="num shrink-0 text-xs text-jt-muted">
                    {dataParaBR(m.data.slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </>
  );
}
