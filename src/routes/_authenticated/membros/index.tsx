import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/membros/")({
  beforeLoad: () => {
    throw redirect({ to: "/membros/painel" });
  },
});
