import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, LifeBuoy, MessageCircle, ShieldCheck } from "lucide-react";

import { Bloco, PageHeader } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { useAcesso } from "@/hooks/use-acesso";
import { podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/suporte/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Como falar com quem cuida do CRM." },
      { property: "og:title", content: "Ajuda — AD CRM" },
      { property: "og:description", content: "Como falar com quem cuida do CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuporteAjuda,
});

const ASSUNTOS = [
  {
    icone: ShieldCheck,
    titulo: "Não consigo abrir um módulo",
    texto:
      "Cada área do CRM depende de uma permissão. Se um item some do menu ou aparece o aviso de permissão, peça a liberação à liderança em Configurações › Usuários.",
  },
  {
    icone: BookOpen,
    titulo: "Meus dados estão errados",
    texto:
      "Abra Complementar cadastro e revise as informações. O que você salva vale na hora para os painéis e listas.",
  },
  {
    icone: MessageCircle,
    titulo: "Quero falar com a liderança",
    texto:
      "Use o Papo reto: escolha um dos horários abertos e mande o assunto. A resposta aparece na mesma tela.",
  },
];

function SuporteAjuda() {
  const { data: acesso, isLoading } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "suporte" }, acesso);

  if (isLoading) {
    return (
      <>
        <PageHeader titulo="Ajuda — Suporte" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Ajuda — Suporte" />
        <SemPermissao mensagem="Sua conta não tem permissão para ver o suporte." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Ajuda — Suporte"
        descricao="Dúvidas comuns e por onde seguir quando algo não sai como esperado."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {ASSUNTOS.map(({ icone: Icone, titulo, texto }) => (
          <Bloco key={titulo}>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-jt-blue/10 text-jt-blue">
              <Icone className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="font-display text-base font-semibold text-jt-text">{titulo}</h2>
            <p className="mt-1 text-sm text-jt-muted">{texto}</p>
          </Bloco>
        ))}
      </div>

      <Bloco className="mt-4" titulo="Continua travado?">
        <p className="text-sm text-jt-muted">
          O histórico do sistema guarda cada ação feita no CRM e costuma explicar o que aconteceu
          com um registro. Se ainda assim não fizer sentido, fale com a liderança do ministério
          levando a data e a hora do que você tentou fazer.
        </p>
        <Link
          to="/suporte/historico"
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-jt-blue hover:underline"
        >
          <LifeBuoy className="h-4 w-4" aria-hidden />
          Abrir o histórico do sistema
        </Link>
      </Bloco>
    </>
  );
}
