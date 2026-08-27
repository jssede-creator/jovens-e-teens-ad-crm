import { createFileRoute } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";

import { Bloco, PageHeader } from "@/components/crm/pagina";
import { Carregando } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { useAcesso } from "@/hooks/use-acesso";
import { MODULOS } from "@/lib/modulos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil/acessos")({
  head: () => ({
    meta: [
      { title: "Meus acessos — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Módulos liberados para a sua conta." },
      { property: "og:title", content: "Meus acessos — AD CRM" },
      { property: "og:description", content: "Módulos liberados para a sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeusAcessos,
});

function MeusAcessos() {
  const { data: acesso, isLoading } = useAcesso();

  if (isLoading) {
    return (
      <>
        <PageHeader titulo="Meus acessos" />
        <Carregando />
      </>
    );
  }

  const liberados = new Set(acesso?.modules ?? []);
  const admin = acesso?.isAdmin === true;
  const grupos = [...new Set(MODULOS.map((m) => m.grupo))];

  return (
    <>
      <PageHeader
        titulo="Meus acessos"
        descricao="O que a sua conta pode ver e fazer. Para mudar, fale com a liderança."
        contagem={
          <Badge variant="outline" className="border-jt-line font-medium text-jt-muted">
            {admin ? "Administrador" : `${liberados.size} de ${MODULOS.length}`}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grupos.map((grupo) => (
          <Bloco key={grupo} titulo={grupo}>
            <ul className="space-y-2">
              {MODULOS.filter((m) => m.grupo === grupo).map((m) => {
                const tem = admin || liberados.has(m.chave);
                return (
                  <li key={m.chave} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                        tem ? "bg-jt-success/15 text-jt-success" : "bg-jt-panel-2 text-jt-muted",
                      )}
                    >
                      {tem ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Lock className="h-3 w-3" aria-hidden />
                      )}
                    </span>
                    <span className={cn("text-sm", tem ? "text-jt-text" : "text-jt-muted")}>
                      {m.rotulo}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Bloco>
        ))}
      </div>
    </>
  );
}
