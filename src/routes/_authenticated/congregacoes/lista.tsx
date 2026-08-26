import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/congregacoes/lista")({
  head: () => ({
    meta: [
      { title: "Lista de congregações — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Todas as congregações cadastradas." },
      { property: "og:title", content: "Lista de congregações — AD CRM" },
      { property: "og:description", content: "Todas as congregações cadastradas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CongregacoesLista,
});

function CongregacoesLista() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-jt-text">Lista de congregações</h1>
      <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center text-sm text-jt-muted">
        Esta área ainda será construída.
      </div>
    </div>
  );
}
