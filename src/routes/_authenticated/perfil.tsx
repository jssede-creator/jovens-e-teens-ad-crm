import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/perfil")({
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

function MeusDados() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-jt-text">Meus dados</h1>
      <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center text-sm text-jt-muted">
        Esta área ainda será construída.
      </div>
    </div>
  );
}
