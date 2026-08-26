import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ebd/turmas")({
  head: () => ({
    meta: [
      { title: "Turmas da EBD — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Turmas da EBD e seus matriculados." },
      { property: "og:title", content: "Turmas da EBD — AD CRM" },
      { property: "og:description", content: "Turmas da EBD e seus matriculados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EbdTurmas,
});

function EbdTurmas() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-jt-text">Turmas da EBD</h1>
      <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center text-sm text-jt-muted">
        Esta área ainda será construída.
      </div>
    </div>
  );
}
