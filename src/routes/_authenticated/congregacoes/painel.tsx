import { createFileRoute } from "@tanstack/react-router";

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
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-jt-text">Painel de congregações</h1>
      <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center text-sm text-jt-muted">
        Esta área ainda será construída.
      </div>
    </div>
  );
}
