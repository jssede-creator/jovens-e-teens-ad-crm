import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/suporte/")({
  beforeLoad: () => {
    throw redirect({ to: "/suporte/auditoria" });
  },
});
