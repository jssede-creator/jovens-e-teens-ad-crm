import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ebd/aulas")({
  head: () => ({
    meta: [
      { title: "Cadastrar aulas — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Agende as aulas de cada turma." },
      { property: "og:title", content: "Cadastrar aulas — AD CRM" },
      { property: "og:description", content: "Agende as aulas de cada turma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EbdAulas,
});

function EbdAulas() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-jt-text">Cadastrar aulas</h1>
      <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center text-sm text-jt-muted">
        Esta área ainda será construída.
      </div>
    </div>
  );
}
