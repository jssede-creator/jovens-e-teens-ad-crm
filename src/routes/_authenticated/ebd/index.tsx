import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ebd/")({
  beforeLoad: () => {
    throw redirect({ to: "/ebd/painel" });
  },
});
