import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Complementar cadastro — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Complete ou revise os seus dados no ministério." },
      { property: "og:title", content: "Complementar cadastro — AD CRM" },
      { property: "og:description", content: "Complete ou revise os seus dados no ministério." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComplementarCadastro,
});

function ComplementarCadastro() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-jt-text">Complementar cadastro</h1>
      <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center text-sm text-jt-muted">
        Esta área ainda será construída.
      </div>
    </div>
  );
}
