import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/eventos/")({
  beforeLoad: () => {
    throw redirect({ to: "/eventos/painel" });
  },
});
