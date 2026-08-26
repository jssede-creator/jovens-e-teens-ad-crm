import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/congregacoes/")({
  beforeLoad: () => {
    throw redirect({ to: "/congregacoes/painel" });
  },
});
