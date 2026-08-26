import { createFileRoute } from "@tanstack/react-router";

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

function MenuInicial() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-jt-text">Menu inicial</h1>
      <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center text-sm text-jt-muted">
        Esta área ainda será construída.
      </div>
    </div>
  );
}
