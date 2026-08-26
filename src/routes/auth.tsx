import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Field, Panel, PillButton, TextInput } from "@/components/cadastro/ui";
import { supabase } from "@/integrations/supabase/client";
import { mensagemErro } from "@/lib/formato";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — AD CRM | Jovens e Teens AD" },
      {
        name: "description",
        content:
          "Acesse o AD CRM, o sistema interno do ministério de jovens e adolescentes Jovens e Teens AD.",
      },
      { property: "og:title", content: "Entrar — AD CRM" },
      {
        property: "og:description",
        content: "Acesse o sistema interno do ministério Jovens e Teens AD.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: "/inicio", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: { nome },
            emailRedirectTo: `${window.location.origin}/inicio`,
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/inicio", replace: true });
        else setAviso("Conta criada! Confirme o e-mail que enviamos para entrar.");
      }
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-jt-bg-top lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-jt-blue text-xs font-semibold text-white">
              AD
            </span>
            <div className="leading-tight">
              <p className="font-display text-base text-jt-text">AD CRM</p>
              <p className="text-[11px] text-jt-muted">Jovens e Teens AD</p>
            </div>
          </div>

          <Panel>
            <h1 className="font-display text-2xl text-jt-text">
              {modo === "entrar" ? "Que bom te ver de novo" : "Vamos criar sua conta"}
            </h1>
            <p className="mt-1 text-sm text-jt-muted">
              {modo === "entrar"
                ? "Entre para acompanhar o ministério de perto."
                : "Poucos passos e você já faz parte do sistema."}
            </p>

            <form onSubmit={enviar} className="mt-5 space-y-4">
              {modo === "criar" ? (
                <Field label="Nome completo" htmlFor="nome" obrigatorio>
                  <TextInput
                    id="nome"
                    required
                    value={nome}
                    autoComplete="name"
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Como podemos te chamar?"
                  />
                </Field>
              ) : null}

              <Field label="E-mail" htmlFor="email" obrigatorio>
                <TextInput
                  id="email"
                  type="email"
                  required
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                />
              </Field>

              <Field
                label="Senha"
                htmlFor="senha"
                obrigatorio
                dica={modo === "criar" ? "Use pelo menos 6 caracteres." : ""}
              >
                <TextInput
                  id="senha"
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••"
                />
              </Field>

              {erro ? <p className="text-sm text-jt-coral">{erro}</p> : null}
              {aviso ? <p className="text-sm text-jt-success">{aviso}</p> : null}

              <PillButton type="submit" className="w-full" disabled={enviando}>
                {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
              </PillButton>
            </form>

            <p className="mt-4 text-center text-sm text-jt-muted">
              {modo === "entrar" ? "Ainda não tem conta?" : "Já faz parte?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setModo(modo === "entrar" ? "criar" : "entrar");
                  setErro(null);
                  setAviso(null);
                }}
                className="font-medium text-jt-gold hover:underline"
              >
                {modo === "entrar" ? "Criar conta" : "Entrar"}
              </button>
            </p>
          </Panel>
        </div>
      </div>

      <div className="relative hidden items-end bg-jt-blue p-12 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative max-w-md">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">
            Ministério Jovens e Teens AD
          </p>
          <p className="mt-3 font-display text-3xl leading-tight text-white">
            Cuidar de cada jovem começa por conhecer cada história.
          </p>
          <p className="mt-4 text-sm text-white/80">
            Cadastros, congregações e a Escola Bíblica Dominical reunidos num só lugar, com
            carinho e organização.
          </p>
        </div>
      </div>
    </div>
  );
}
