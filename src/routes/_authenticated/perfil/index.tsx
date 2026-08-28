import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Cake,
  Camera,
  Church,
  Copy,
  CreditCard,
  Fingerprint,
  GraduationCap,
  Home,
  IdCard,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { PageHeader } from "@/components/crm/pagina";
import { Carregando } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { idadeEm, iniciais } from "@/lib/ebd";
import { dataParaBR, mensagemErro } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil/")({
  head: () => ({
    meta: [
      { title: "Meus dados — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Informações da sua conta no ministério." },
      { property: "og:title", content: "Meus dados — AD CRM" },
      { property: "og:description", content: "Informações da sua conta no ministério." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeusDados,
});

type Aba = "cadastrais" | "endereco" | "socioeconomico" | "familia";

const ABAS: { chave: Aba; rotulo: string; icone: ComponentType<{ className?: string }> }[] = [
  { chave: "cadastrais", rotulo: "Dados cadastrais", icone: IdCard },
  { chave: "endereco", rotulo: "Endereço", icone: Home },
  { chave: "socioeconomico", rotulo: "Socioeconômico", icone: Briefcase },
  { chave: "familia", rotulo: "Composição familiar", icone: Users },
];

/** Campo em cartão, com ícone à esquerda — o formato do print. */
function Campo({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: ComponentType<{ className?: string }>;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-jt-panel-2 px-3.5 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-jt-panel text-jt-muted">
        <Icone className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-jt-muted">{rotulo}</p>
        <p className="truncate text-sm font-medium text-jt-text">{valor || "—"}</p>
      </div>
    </div>
  );
}

function Resumo({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-xl border border-jt-line bg-jt-panel px-4 py-3">
      <p className="text-xs text-jt-muted">{rotulo}</p>
      <p
        className={cn("mt-1 text-sm font-semibold", destaque ? "text-jt-success" : "text-jt-text")}
      >
        {valor}
      </p>
    </div>
  );
}

function MeusDados() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: acesso } = useAcesso();
  const inputFoto = useRef<HTMLInputElement>(null);

  const [aba, setAba] = useState<Aba>("cadastrais");
  const [conta, setConta] = useState<{
    id: string;
    nome: string;
    email: string;
    foto: string | null;
  } | null>(null);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  const carregarConta = async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    setConta({
      id: user.id,
      nome: (user.user_metadata?.["nome"] as string | undefined) ?? user.email ?? "—",
      email: user.email ?? "—",
      foto: (user.user_metadata?.["avatar_url"] as string | undefined) ?? null,
    });
  };

  useEffect(() => {
    void carregarConta();
  }, []);

  const cadastro = useQuery({
    queryKey: ["meu-cadastro"],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user?.id;
      if (!userId) return null;
      const { data, error } = await supabase
        .from("cadastros")
        .select(
          "*, congregacoes(nome), composicao_familiar(id, nome_completo, parentesco, idade, ocupacao)",
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const trocarFoto = useMutation({
    mutationFn: async (file: File) => {
      if (!conta) throw new Error("sessao");
      if (file.size > 2 * 1024 * 1024) throw new Error("tamanho");
      const extensao = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const caminho = `${conta.id}/perfil.${extensao}`;

      const upload = await supabase.storage
        .from("avatares")
        .upload(caminho, file, { upsert: true, contentType: file.type || "image/png" });
      if (upload.error) throw upload.error;

      const { data } = supabase.storage.from("avatares").getPublicUrl(caminho);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (error) throw error;
      await registrarAuditoria({ acao: "trocou foto", entidade: "usuario", detalhe: conta.email });
      return url;
    },
    onSuccess: async () => {
      setErro("");
      setAviso("Foto atualizada.");
      await carregarConta();
    },
    onError: (e) =>
      setErro(
        (e as Error).message === "tamanho"
          ? "A imagem passa de 2 MB. Envie uma menor."
          : mensagemErro(e),
      ),
  });

  const removerFoto = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (error) throw error;
    },
    onSuccess: async () => {
      setErro("");
      setAviso("Foto removida.");
      await carregarConta();
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const sair = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!conta) {
    return (
      <>
        <PageHeader titulo="Meus dados" />
        <Carregando />
      </>
    );
  }

  const c = cadastro.data as
    | (Record<string, string | boolean | null> & {
        congregacoes: { nome: string } | null;
        composicao_familiar: {
          id: string;
          nome_completo: string;
          parentesco: string | null;
          idade: number | null;
          ocupacao: string | null;
        }[];
      })
    | null;

  const congregacao = c?.congregacoes?.nome ?? "—";
  const completo = c?.["compartilhou_dados_complementares"] === true;
  const percentual = !c ? 0 : completo ? 100 : 50;
  const idade = idadeEm(c?.["data_nascimento"] as string | null);
  const familia = c?.composicao_familiar ?? [];
  const texto = (chave: string) => (c?.[chave] as string | null) ?? "";
  const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader titulo="Meus dados" />

      <section className="rounded-[20px] border border-jt-line bg-jt-panel p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative">
            {conta.foto ? (
              <img
                src={conta.foto}
                alt={`Foto de ${conta.nome}`}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full bg-jt-blue text-lg font-semibold text-white">
                {iniciais(conta.nome)}
              </div>
            )}
            <button
              type="button"
              aria-label="Trocar foto"
              onClick={() => inputFoto.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-jt-line bg-jt-panel text-jt-muted transition hover:text-jt-text"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold text-jt-text">{conta.nome}</h2>
            <p className="text-sm text-jt-muted">
              {conta.email} · {acesso?.isAdmin ? "Administrador" : "Usuário"}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "border-transparent font-normal",
                  percentual === 100
                    ? "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
                )}
              >
                {percentual}% completo
              </Badge>
              <Badge className="border-transparent bg-jt-panel-2 font-normal text-jt-text">
                {c ? "Cadastro vinculado" : "Sem cadastro"}
              </Badge>
              {c ? (
                <>
                  <Badge variant="outline" className="border-jt-line font-normal text-jt-muted">
                    {congregacao}
                  </Badge>
                  <Badge variant="outline" className="border-jt-line font-normal text-jt-muted">
                    {texto("cidade")}
                  </Badge>
                </>
              ) : null}
              <span className="num text-xs text-jt-muted">· agora {agora}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PillButton
              variante="outline"
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={() => inputFoto.current?.click()}
              disabled={trocarFoto.isPending}
            >
              <Camera className="h-4 w-4" aria-hidden />
              {trocarFoto.isPending ? "Enviando…" : "Trocar foto"}
            </PillButton>
            <PillButton
              variante="outline"
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={() => {
                void navigator.clipboard.writeText(conta.email);
                setAviso("E-mail copiado.");
              }}
            >
              <Copy className="h-4 w-4" aria-hidden /> Copiar e-mail
            </PillButton>
            {conta.foto ? (
              <PillButton
                variante="ghost"
                className="h-9 rounded-full px-4 text-[13px]"
                onClick={() => removerFoto.mutate()}
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Remover
              </PillButton>
            ) : null}
            <PillButton
              variante="ghost"
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={sair}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sair
            </PillButton>
          </div>

          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) trocarFoto.mutate(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-jt-panel-2">
          <div
            className="h-full rounded-full bg-jt-success transition-[width]"
            style={{ width: `${percentual}%` }}
          />
        </div>

        {erro ? <p className="mt-2 text-xs text-jt-coral">{erro}</p> : null}
        {!erro && aviso ? <p className="mt-2 text-xs text-jt-success">{aviso}</p> : null}
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-jt-line">
        <div className="flex flex-wrap">
          {ABAS.map(({ chave, rotulo, icone: Icone }) => (
            <button
              key={chave}
              type="button"
              onClick={() => setAba(chave)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm transition",
                aba === chave
                  ? "border-jt-blue font-medium text-jt-text"
                  : "border-transparent text-jt-muted hover:text-jt-text",
              )}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
            </button>
          ))}
        </div>
        <Link to="/" className="mb-2">
          <PillButton variante="outline" className="h-9 rounded-full px-4 text-[13px]">
            <Pencil className="h-4 w-4" aria-hidden /> Editar dados
          </PillButton>
        </Link>
      </div>

      {cadastro.isLoading ? (
        <Carregando />
      ) : !c ? (
        <div className="mt-4 rounded-[20px] border border-jt-line bg-jt-panel px-6 py-14 text-center">
          <p className="text-sm text-jt-muted">
            Você ainda não preencheu o cadastro do ministério.
          </p>
          <Link to="/" className="mt-4 inline-block">
            <PillButton>Fazer meu cadastro</PillButton>
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo rotulo="Vínculo" valor="Cadastro vinculado" destaque />
            <Resumo
              rotulo="Dados complementares"
              valor={completo ? "Preenchidos" : "Pendentes"}
              destaque={completo}
            />
            <Resumo rotulo="Congregação" valor={congregacao} />
            <Resumo
              rotulo="Cadastro feito em"
              valor={dataParaBR(String(c["data_cadastro"]).slice(0, 10))}
            />
          </div>

          <section className="mt-3 rounded-[20px] border border-jt-line bg-jt-panel p-4">
            {aba === "cadastrais" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo icone={IdCard} rotulo="Nome" valor={texto("nome_completo")} />
                <Campo
                  icone={Cake}
                  rotulo="Nascimento"
                  valor={`${dataParaBR(texto("data_nascimento"))}${idade != null ? ` · ${idade} anos` : ""}`}
                />
                <Campo icone={Fingerprint} rotulo="CPF" valor={texto("cpf")} />
                <Campo icone={CreditCard} rotulo="RG" valor={texto("rg")} />
                <Campo icone={Phone} rotulo="Telefone" valor={texto("telefone")} />
                <Campo icone={Mail} rotulo="E-mail" valor={texto("email")} />
                <Campo icone={Church} rotulo="Congregação" valor={congregacao} />
              </div>
            ) : null}

            {aba === "endereco" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo icone={Home} rotulo="Endereço" valor={texto("endereco")} />
                <Campo icone={MapPin} rotulo="Número" valor={texto("numero")} />
                <Campo icone={MapPin} rotulo="Complemento" valor={texto("complemento")} />
                <Campo icone={MapPin} rotulo="Cidade" valor={texto("cidade")} />
                <Campo icone={MapPin} rotulo="CEP" valor={texto("cep")} />
              </div>
            ) : null}

            {aba === "socioeconomico" ? (
              !completo ? (
                <p className="py-10 text-center text-sm text-jt-muted">
                  Você optou por não compartilhar os dados complementares.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo
                    icone={GraduationCap}
                    rotulo="Escolaridade"
                    valor={texto("escolaridade")}
                  />
                  <Campo
                    icone={GraduationCap}
                    rotulo="Local de estudo"
                    valor={texto("local_estudo")}
                  />
                  <Campo icone={GraduationCap} rotulo="Curso" valor={texto("curso")} />
                  <Campo icone={UserRound} rotulo="Estado civil" valor={texto("estado_civil")} />
                  <Campo
                    icone={Briefcase}
                    rotulo="Trabalha atualmente"
                    valor={
                      c["trabalha_atualmente"] === null
                        ? "—"
                        : c["trabalha_atualmente"]
                          ? "Sim"
                          : "Não"
                    }
                  />
                  <Campo icone={Wallet} rotulo="Renda mensal" valor={texto("renda_mensal")} />
                  <Campo
                    icone={Home}
                    rotulo="Mora com os pais"
                    valor={c["mora_com_pais"] === null ? "—" : c["mora_com_pais"] ? "Sim" : "Não"}
                  />
                  <Campo icone={Wallet} rotulo="Renda familiar" valor={texto("renda_familiar")} />
                </div>
              )
            ) : null}

            {aba === "familia" ? (
              familia.length === 0 ? (
                <p className="py-10 text-center text-sm text-jt-muted">
                  Nenhuma pessoa cadastrada na composição familiar.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {familia.map((p) => (
                    <li key={p.id} className="rounded-xl bg-jt-panel-2 px-3.5 py-3">
                      <p className="text-sm font-medium text-jt-text">{p.nome_completo}</p>
                      <p className="mt-0.5 text-xs text-jt-muted">
                        {[p.parentesco, p.idade != null ? `${p.idade} anos` : null, p.ocupacao]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </section>
        </>
      )}
    </>
  );
}
