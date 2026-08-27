import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/papo-reto/")({
  beforeLoad: () => {
    throw redirect({ to: "/papo-reto/agendar" });
  },
});
