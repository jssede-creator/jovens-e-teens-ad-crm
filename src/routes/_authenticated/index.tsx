import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ministerioFoto from "@/assets/inabalaveis.png";
import {
  DateInput,
  Eyebrow,
  Field,
  Panel,
  PillButton,
  ProgressTrail,
  SelectInput,
  TextInput,
  YesNoToggle,
} from "@/components/cadastro/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { convidarPessoa } from "@/lib/convite.functions";
import { dataParaBR, semMascara } from "@/lib/formato";
import { useAcesso } from "@/hooks/use-acesso";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Complementar cadastro — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Complete ou revise os seus dados no ministério." },
      { property: "og:title", content: "Complementar cadastro — AD CRM" },
      { property: "og:description", content: "Complete ou revise os seus dados no ministério." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComplementarCadastro,
});

/* ------------------------------------------------------------------ */
/* Listas                                                              */
/* ------------------------------------------------------------------ */

const ESCOLARIDADES = [
  "Fundamental incompleto",
  "Fundamental completo",
  "Médio incompleto",
  "Médio completo",
  "Superior incompleto",
  "Superior completo",
  "Pós-graduação",
];

const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "União estável",
  "Divorciado(a)",
  "Separado(a)",
  "Viúvo(a)",
];

const RENDAS_MENSAIS = [
  "Sem renda própria",
  "Até 1 SM",
  "De 1 a 2 SM",
  "De 2 a 3 SM",
  "De 3 a 5 SM",
  "Acima de 5 SM",
];

const RENDAS_FAMILIARES = [
  "Até 2 SM",
  "De 2 a 4 SM",
  "De 4 a 6 SM",
  "De 6 a 10 SM",
  "Acima de 10 SM",
];

const DICA_SM = "SM = salário mínimo nacional (R$ 1.621 em 2026)";

const TEXTO_LGPD =
  "Declaro, para os devidos fins, que as informações prestadas neste formulário são verdadeiras e de minha inteira responsabilidade, comprometendo-me a atualizá-las sempre que houver mudança na situação familiar. Autorizo a igreja a tratar os dados pessoais aqui informados exclusivamente para fins de análise, acompanhamento social e pastoral, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais – LGPD).";

const opcoes = (lista: string[]) => lista.map((v) => ({ valor: v, rotulo: v }));

/* ------------------------------------------------------------------ */
/* Tipos do formulário                                                 */
/* ------------------------------------------------------------------ */

type Etapa =
  "boas-vindas" | "dados" | "bifurcacao" | "familia" | "socioeconomico" | "revisao" | "sucesso";

type Pessoa = { nome_completo: string; parentesco: string; idade: string; ocupacao: string };

type Formulario = {
  nome_completo: string;
  email: string;
  congregacao_id: string;
  data_nascimento: string;
  telefone: string;
  cpf: string;
  rg: string;
  endereco: string;
  numero: string;
  complemento: string;
  cidade: string;
  cep: string;
  escolaridade: string;
  local_estudo: string;
  curso: string;
  estado_civil: string;
  trabalha_atualmente: boolean | null;
  renda_mensal: string;
  mora_com_pais: boolean | null;
  renda_familiar: string;
};

const FORM_INICIAL: Formulario = {
  nome_completo: "",
  email: "",
  congregacao_id: "",
  data_nascimento: "",
  telefone: "",
  cpf: "",
  rg: "",
  endereco: "",
  numero: "",
  complemento: "",
  cidade: "",
  cep: "",
  escolaridade: "",
  local_estudo: "",
  curso: "",
  estado_civil: "",
  trabalha_atualmente: null,
  renda_mensal: "",
  mora_com_pais: null,
  renda_familiar: "",
};

const OBRIGATORIO = "Este campo é obrigatório.";
const CEP_INCOMPLETO = "Informe o CEP completo, com 8 dígitos.";

const temFamiliaPropria = (estadoCivil: string) =>
  estadoCivil === "Casado(a)" || estadoCivil === "União estável";

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

function ComplementarCadastro() {
  const { data: acesso } = useAcesso();
  const [etapa, setEtapa] = useState<Etapa>("boas-vindas");
  const [aba, setAba] = useState<"dados" | "endereco">("dados");
  const [form, setForm] = useState<Formulario>(FORM_INICIAL);
  const [familia, setFamilia] = useState<Pessoa[]>([
    { nome_completo: "", parentesco: "", idade: "", ocupacao: "" },
  ]);
  const [compartilhar, setCompartilhar] = useState<boolean | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [lgpd, setLgpd] = useState(false);
  const [erroLgpd, setErroLgpd] = useState("");
  const [erroEnvio, setErroEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [convidou, setConvidou] = useState(false);

  const congregacoes = useQuery({
    queryKey: ["congregacoes-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("congregacoes")
        .select("id, nome")
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setCampo = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setForm((atual) => {
      const proximo = { ...atual, [campo]: valor };
      // Estado civil com família própria esconde "mora com os pais": limpe o valor.
      if (campo === "estado_civil" && temFamiliaPropria(String(valor))) {
        proximo.mora_com_pais = null;
      }
      return proximo;
    });
    setErros((atual) => ({ ...atual, [campo]: "" }));
  };

  const trilha = compartilhar
    ? ["Dados", "Complementares", "Família", "Socioeconômico", "Revisão"]
    : ["Dados", "Complementares", "Revisão"];

  const indiceTrilha: Record<string, number> = compartilhar
    ? { dados: 0, bifurcacao: 1, familia: 2, socioeconomico: 3, revisao: 4 }
    : { dados: 0, bifurcacao: 1, revisao: 2 };

  function validarDados(): boolean {
    const novos: Record<string, string> = {};
    const obrigatorios: (keyof Formulario)[] = [
      "nome_completo",
      "email",
      "congregacao_id",
      "data_nascimento",
      "telefone",
      "cpf",
      "rg",
      "endereco",
      "numero",
      "cidade",
      "cep",
    ];
    for (const campo of obrigatorios) {
      if (!String(form[campo] ?? "").trim()) novos[campo] = OBRIGATORIO;
    }
    if (!novos["cep"] && semMascara(form.cep).length < 8) novos["cep"] = CEP_INCOMPLETO;
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      const camposEndereco = ["endereco", "numero", "cidade", "cep"];
      const temErroDados = Object.keys(novos).some((c) => !camposEndereco.includes(c));
      setAba(temErroDados ? "dados" : "endereco");
      return false;
    }
    return true;
  }

  const familiaPropria = temFamiliaPropria(form.estado_civil);
  const mostraRendaMensal = form.trabalha_atualmente === true;
  const mostraMoraComPais = !familiaPropria;
  const mostraRendaFamiliar = familiaPropria || form.mora_com_pais === true;

  async function enviar() {
    setErroLgpd("");
    setErroEnvio("");
    if (!lgpd) {
      setErroLgpd("É necessário aceitar os termos para concluir.");
      return;
    }
    setEnviando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const user = sessao.user;
      const emailInformado = form.email.trim().toLowerCase();
      const emailDaConta = (user?.email ?? "").trim().toLowerCase();
      const eOutraPessoa = emailInformado !== emailDaConta;

      if (eOutraPessoa && !acesso?.isAdmin) {
        setErroEnvio(
          "Esse e-mail não é o da sua conta. Só a liderança pode cadastrar em nome de outra pessoa.",
        );
        setEnviando(false);
        return;
      }

      const compartilhou = compartilhar === true;
      const registro = {
        user_id: eOutraPessoa ? null : (user?.id ?? null),
        nome_completo: form.nome_completo.trim(),
        data_nascimento: form.data_nascimento,
        cpf: form.cpf,
        rg: form.rg,
        telefone: form.telefone,
        email: emailInformado,
        congregacao_id: form.congregacao_id || null,
        endereco: form.endereco.trim(),
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        cidade: form.cidade.trim(),
        cep: form.cep,
        compartilhou_dados_complementares: compartilhou,
        escolaridade: compartilhou ? form.escolaridade || null : null,
        local_estudo: compartilhou ? form.local_estudo.trim() || null : null,
        curso: compartilhou ? form.curso.trim() || null : null,
        estado_civil: compartilhou ? form.estado_civil || null : null,
        trabalha_atualmente: compartilhou ? form.trabalha_atualmente : null,
        renda_mensal: compartilhou && mostraRendaMensal ? form.renda_mensal || null : null,
        mora_com_pais: compartilhou && mostraMoraComPais ? form.mora_com_pais : null,
        renda_familiar: compartilhou && mostraRendaFamiliar ? form.renda_familiar || null : null,
        lgpd_aceito: true,
      };

      const { data: criado, error } = await supabase
        .from("cadastros")
        .insert(registro)
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505" || /duplicate key/i.test(error.message)) {
          setErroEnvio("Já existe um cadastro com este CPF. Fale com a liderança do ministério.");
        } else {
          setErroEnvio("Não conseguimos salvar seu cadastro agora. Tente novamente em instantes.");
        }
        setEnviando(false);
        return;
      }

      const pessoas = compartilhou
        ? familia
            .filter((p) => p.nome_completo.trim())
            .map((p) => ({
              cadastro_id: criado.id,
              nome_completo: p.nome_completo.trim(),
              parentesco: p.parentesco.trim() || null,
              idade: p.idade ? Number(p.idade) : null,
              ocupacao: p.ocupacao.trim() || null,
            }))
        : [];
      if (pessoas.length > 0) await supabase.from("composicao_familiar").insert(pessoas);

      await registrarAuditoria({
        acao: "criou",
        entidade: "cadastro",
        entidadeId: criado.id,
        detalhe: registro.nome_completo,
      });

      let enviouConvite = false;
      if (eOutraPessoa) {
        try {
          const r = await convidarPessoa({
            data: { email: emailInformado, nome: registro.nome_completo },
          });
          enviouConvite = r.enviado;
        } catch {
          enviouConvite = false;
        }
      }
      setConvidou(enviouConvite);
      setEtapa("sucesso");
    } catch {
      setErroEnvio("Não conseguimos salvar seu cadastro agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setForm(FORM_INICIAL);
    setFamilia([{ nome_completo: "", parentesco: "", idade: "", ocupacao: "" }]);
    setCompartilhar(null);
    setErros({});
    setLgpd(false);
    setErroLgpd("");
    setErroEnvio("");
    setConvidou(false);
    setAba("dados");
    setEtapa("boas-vindas");
  }

  if (etapa === "boas-vindas") {
    return <BoasVindas onIniciar={() => setEtapa("dados")} />;
  }

  if (etapa === "sucesso") {
    return <Sucesso nome={form.nome_completo} convidou={convidou} onVoltar={reiniciar} />;
  }

  return (
    <div className="mx-auto w-full max-w-[672px] space-y-5">
      <div className="rounded-xl border border-jt-line bg-jt-panel p-4">
        <ProgressTrail etapas={trilha} atual={indiceTrilha[etapa] ?? 0} />
      </div>

      {etapa === "dados" ? (
        <EtapaDados
          form={form}
          erros={erros}
          aba={aba}
          setAba={setAba}
          setCampo={setCampo}
          congregacoes={congregacoes.data ?? []}
          onVoltar={() => setEtapa("boas-vindas")}
          onAvancar={() => {
            if (validarDados()) setEtapa("bifurcacao");
          }}
        />
      ) : null}

      {etapa === "bifurcacao" ? (
        <EtapaBifurcacao
          onSim={() => {
            setCompartilhar(true);
            setEtapa("familia");
          }}
          onNao={() => {
            setCompartilhar(false);
            setEtapa("revisao");
          }}
          onVoltar={() => setEtapa("dados")}
        />
      ) : null}

      {etapa === "familia" ? (
        <EtapaFamilia
          familia={familia}
          setFamilia={setFamilia}
          onVoltar={() => setEtapa("bifurcacao")}
          onAvancar={() => setEtapa("socioeconomico")}
        />
      ) : null}

      {etapa === "socioeconomico" ? (
        <EtapaSocio
          form={form}
          setCampo={setCampo}
          mostraRendaMensal={mostraRendaMensal}
          mostraMoraComPais={mostraMoraComPais}
          mostraRendaFamiliar={mostraRendaFamiliar}
          onVoltar={() => setEtapa("familia")}
          onAvancar={() => setEtapa("revisao")}
        />
      ) : null}

      {etapa === "revisao" ? (
        <EtapaRevisao
          form={form}
          familia={familia}
          compartilhou={compartilhar === true}
          congregacaoNome={
            (congregacoes.data ?? []).find((c) => c.id === form.congregacao_id)?.nome ?? "—"
          }
          lgpd={lgpd}
          setLgpd={(v) => {
            setLgpd(v);
            setErroLgpd("");
          }}
          erroLgpd={erroLgpd}
          erroEnvio={erroEnvio}
          enviando={enviando}
          onVoltar={() => setEtapa(compartilhar ? "socioeconomico" : "bifurcacao")}
          onConcluir={enviar}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Boas-vindas                                                         */
/* ------------------------------------------------------------------ */

function BoasVindas({ onIniciar }: { onIniciar: () => void }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div className="space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-jt-blue/10 px-3 py-1.5 text-xs font-medium text-jt-blue">
          <Sparkles className="h-4 w-4" aria-hidden />
          Bem vindo a nova plataforma!
        </span>
        <h1 className="font-display text-5xl leading-[1.05] text-jt-text sm:text-6xl xl:text-7xl">
          Olá, Jovens e Teens AD
        </h1>
        <p className="max-w-xl text-base text-jt-muted">
          Que bom ter você aqui. Faça seu cadastro no ministério para que a gente possa te
          acompanhar de perto, cuidar de você e te avisar de tudo que vai acontecer.
        </p>
        <PillButton onClick={onIniciar}>Iniciar cadastro</PillButton>
      </div>
      <div className="mx-auto w-full max-w-[340px] self-center overflow-hidden rounded-3xl shadow-[0_30px_70px_-30px_rgba(15,23,42,0.55)]">
        <img
          src={ministerioFoto}
          alt="Jovens e adolescentes do ministério reunidos e sorrindo"
          width={1024}
          height={1280}
          className="h-auto w-full object-cover"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Etapa 01 — dados                                                    */
/* ------------------------------------------------------------------ */

function EtapaDados({
  form,
  erros,
  aba,
  setAba,
  setCampo,
  congregacoes,
  onVoltar,
  onAvancar,
}: {
  form: Formulario;
  erros: Record<string, string>;
  aba: "dados" | "endereco";
  setAba: (v: "dados" | "endereco") => void;
  setCampo: <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => void;
  congregacoes: { id: string; nome: string }[];
  onVoltar: () => void;
  onAvancar: () => void;
}) {
  const pilula = (chave: "dados" | "endereco", rotulo: string) => (
    <button
      type="button"
      onClick={() => setAba(chave)}
      aria-current={aba === chave}
      className={cn(
        "jt-pill h-9 border text-sm",
        aba === chave
          ? "border-transparent bg-jt-blue text-white shadow-pill"
          : "border-jt-line bg-jt-panel text-jt-muted hover:bg-jt-panel-2",
      )}
    >
      {rotulo}
    </button>
  );

  return (
    <Panel>
      <Eyebrow>Etapa 01</Eyebrow>
      <h1 className="mt-1 font-display text-2xl text-jt-text">Seus dados iniciais</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {pilula("dados", "01 · Dados cadastrais")}
        {pilula("endereco", "02 · Endereço")}
      </div>

      <div className="mt-6 space-y-4">
        {aba === "dados" ? (
          <>
            <Field label="Nome completo" obrigatorio erro={erros["nome_completo"]} htmlFor="nome">
              <TextInput
                id="nome"
                value={form.nome_completo}
                onValueChange={(v) => setCampo("nome_completo", v)}
                placeholder="Como está no documento"
              />
            </Field>
            <Field label="E-mail" obrigatorio erro={erros["email"]} htmlFor="email">
              <TextInput
                id="email"
                type="email"
                value={form.email}
                onValueChange={(v) => setCampo("email", v)}
                placeholder="voce@email.com"
              />
            </Field>
            <Field
              label="Congregação local"
              obrigatorio
              erro={erros["congregacao_id"]}
              htmlFor="congregacao"
            >
              <SelectInput
                id="congregacao"
                value={form.congregacao_id}
                onValueChange={(v) => setCampo("congregacao_id", v)}
                opcoes={congregacoes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
                placeholder="Selecione sua congregação…"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Data de nascimento"
                obrigatorio
                erro={erros["data_nascimento"]}
                htmlFor="nascimento"
              >
                <DateInput
                  id="nascimento"
                  value={form.data_nascimento}
                  onValueChange={(v) => setCampo("data_nascimento", v)}
                />
              </Field>
              <Field label="Telefone" obrigatorio erro={erros["telefone"]} htmlFor="telefone">
                <TextInput
                  id="telefone"
                  mascara="telefone"
                  value={form.telefone}
                  onValueChange={(v) => setCampo("telefone", v)}
                  placeholder="(00) 00000-0000"
                />
              </Field>
              <Field label="CPF" obrigatorio erro={erros["cpf"]} htmlFor="cpf">
                <TextInput
                  id="cpf"
                  mascara="cpf"
                  value={form.cpf}
                  onValueChange={(v) => setCampo("cpf", v)}
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="RG" obrigatorio erro={erros["rg"]} htmlFor="rg">
                <TextInput
                  id="rg"
                  mascara="rg"
                  value={form.rg}
                  onValueChange={(v) => setCampo("rg", v)}
                  placeholder="00.000.000-0"
                />
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Endereço" obrigatorio erro={erros["endereco"]} htmlFor="endereco">
              <TextInput
                id="endereco"
                value={form.endereco}
                onValueChange={(v) => setCampo("endereco", v)}
                placeholder="Rua e bairro"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Número" obrigatorio erro={erros["numero"]} htmlFor="numero">
                <TextInput
                  id="numero"
                  value={form.numero}
                  onValueChange={(v) => setCampo("numero", v)}
                  placeholder="123"
                />
              </Field>
              <Field label="Complemento" dica="Opcional" htmlFor="complemento">
                <TextInput
                  id="complemento"
                  value={form.complemento}
                  onValueChange={(v) => setCampo("complemento", v)}
                  placeholder="Apto, bloco…"
                />
              </Field>
              <Field label="Cidade" obrigatorio erro={erros["cidade"]} htmlFor="cidade">
                <TextInput
                  id="cidade"
                  value={form.cidade}
                  onValueChange={(v) => setCampo("cidade", v)}
                />
              </Field>
              <Field label="CEP" obrigatorio erro={erros["cep"]} htmlFor="cep">
                <TextInput
                  id="cep"
                  mascara="cep"
                  value={form.cep}
                  onValueChange={(v) => setCampo("cep", v)}
                  placeholder="00000-000"
                />
              </Field>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <PillButton variante="ghost" onClick={onVoltar}>
          Voltar
        </PillButton>
        <PillButton onClick={onAvancar}>Avançar</PillButton>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Etapa 02 — bifurcação                                               */
/* ------------------------------------------------------------------ */

function EtapaBifurcacao({
  onSim,
  onNao,
  onVoltar,
}: {
  onSim: () => void;
  onNao: () => void;
  onVoltar: () => void;
}) {
  const cartao = (titulo: string, sub: string, acao: () => void) => (
    <button
      type="button"
      onClick={acao}
      className="flex-1 rounded-xl border border-jt-line bg-jt-panel-2 p-5 text-left transition hover:border-jt-blue/40 hover:bg-jt-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
    >
      <p className="font-medium text-jt-text">{titulo}</p>
      <p className="mt-1 text-sm text-jt-muted">{sub}</p>
    </button>
  );

  return (
    <Panel className="text-center">
      <Eyebrow>Etapa 02</Eyebrow>
      <h1 className="mx-auto mt-2 max-w-lg font-display text-2xl text-jt-text">
        Gostaria de compartilhar também informações de formação e socioeconômicas?
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-jt-muted">
        É opcional e nos ajuda a entender você melhor e a cuidar de você e da sua família.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {cartao("Sim, quero compartilhar", "Mais duas etapas rápidas.", onSim)}
        {cartao("Não, prefiro não compartilhar", "Vamos direto à conclusão.", onNao)}
      </div>
      <div className="mt-6 flex justify-start">
        <PillButton variante="ghost" onClick={onVoltar}>
          Voltar
        </PillButton>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Etapa 03 — família                                                  */
/* ------------------------------------------------------------------ */

function EtapaFamilia({
  familia,
  setFamilia,
  onVoltar,
  onAvancar,
}: {
  familia: Pessoa[];
  setFamilia: (f: Pessoa[]) => void;
  onVoltar: () => void;
  onAvancar: () => void;
}) {
  const [removendo, setRemovendo] = useState<number | null>(null);

  const atualizar = (indice: number, campo: keyof Pessoa, valor: string) => {
    setFamilia(familia.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)));
  };

  return (
    <Panel>
      <Eyebrow>Etapa 03</Eyebrow>
      <h1 className="mt-1 font-display text-2xl text-jt-text">Composição familiar</h1>
      <p className="mt-1 text-sm text-jt-muted">Adicione as pessoas que moram com você.</p>

      <div className="mt-5 space-y-4">
        {familia.map((pessoa, i) => (
          <div key={i} className="rounded-xl border border-jt-line bg-jt-panel-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="num text-sm font-medium text-jt-text">
                Pessoa {String(i + 1).padStart(2, "0")}
              </p>
              {familia.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setRemovendo(i)}
                  aria-label={`Remover pessoa ${i + 1}`}
                  className="rounded-full p-1.5 text-jt-muted hover:bg-jt-panel hover:text-jt-coral"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="space-y-4">
              <Field label="Nome completo" htmlFor={`fam-nome-${i}`}>
                <TextInput
                  id={`fam-nome-${i}`}
                  value={pessoa.nome_completo}
                  onValueChange={(v) => atualizar(i, "nome_completo", v)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Parentesco" htmlFor={`fam-par-${i}`}>
                  <TextInput
                    id={`fam-par-${i}`}
                    value={pessoa.parentesco}
                    onValueChange={(v) => atualizar(i, "parentesco", v)}
                  />
                </Field>
                <Field label="Idade" htmlFor={`fam-idade-${i}`}>
                  <TextInput
                    id={`fam-idade-${i}`}
                    inputMode="numeric"
                    value={pessoa.idade}
                    onValueChange={(v) => atualizar(i, "idade", v.replace(/\D/g, "").slice(0, 3))}
                  />
                </Field>
                <Field label="Ocupação" htmlFor={`fam-ocup-${i}`}>
                  <TextInput
                    id={`fam-ocup-${i}`}
                    value={pessoa.ocupacao}
                    onValueChange={(v) => atualizar(i, "ocupacao", v)}
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>

      {familia.length < 20 ? (
        <PillButton
          variante="outline"
          className="mt-4"
          onClick={() =>
            setFamilia([...familia, { nome_completo: "", parentesco: "", idade: "", ocupacao: "" }])
          }
        >
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar pessoa
        </PillButton>
      ) : (
        <p className="mt-4 text-xs text-jt-muted">Máximo de 20 pessoas por cadastro.</p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <PillButton variante="ghost" onClick={onVoltar}>
          Voltar
        </PillButton>
        <PillButton onClick={onAvancar}>Avançar</PillButton>
      </div>

      <AlertDialog open={removendo !== null} onOpenChange={(v) => !v && setRemovendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta pessoa?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados preenchidos para essa pessoa serão apagados do formulário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removendo !== null) setFamilia(familia.filter((_, i) => i !== removendo));
                setRemovendo(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Etapa 04 — socioeconômico                                           */
/* ------------------------------------------------------------------ */

function EtapaSocio({
  form,
  setCampo,
  mostraRendaMensal,
  mostraMoraComPais,
  mostraRendaFamiliar,
  onVoltar,
  onAvancar,
}: {
  form: Formulario;
  setCampo: <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => void;
  mostraRendaMensal: boolean;
  mostraMoraComPais: boolean;
  mostraRendaFamiliar: boolean;
  onVoltar: () => void;
  onAvancar: () => void;
}) {
  return (
    <Panel>
      <Eyebrow>Etapa 04</Eyebrow>
      <h1 className="mt-1 font-display text-2xl text-jt-text">
        Escolaridade e dados socioeconômicos
      </h1>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nível de escolaridade" htmlFor="escolaridade">
            <SelectInput
              id="escolaridade"
              value={form.escolaridade}
              onValueChange={(v) => setCampo("escolaridade", v)}
              opcoes={opcoes(ESCOLARIDADES)}
            />
          </Field>
          <Field label="Estado civil" htmlFor="estado-civil">
            <SelectInput
              id="estado-civil"
              value={form.estado_civil}
              onValueChange={(v) => setCampo("estado_civil", v)}
              opcoes={opcoes(ESTADOS_CIVIS)}
            />
          </Field>
          <Field label="Local de estudo" htmlFor="local-estudo">
            <TextInput
              id="local-estudo"
              value={form.local_estudo}
              onValueChange={(v) => setCampo("local_estudo", v)}
              placeholder="Escola, faculdade…"
            />
          </Field>
          <Field label="Curso" htmlFor="curso">
            <TextInput id="curso" value={form.curso} onValueChange={(v) => setCampo("curso", v)} />
          </Field>
        </div>

        <Field label="Trabalha atualmente">
          <YesNoToggle
            nome="Trabalha atualmente"
            valor={form.trabalha_atualmente}
            onChange={(v) => setCampo("trabalha_atualmente", v)}
          />
        </Field>

        {mostraRendaMensal ? (
          <Field label="Renda mensal" dica={DICA_SM} htmlFor="renda-mensal">
            <SelectInput
              id="renda-mensal"
              value={form.renda_mensal}
              onValueChange={(v) => setCampo("renda_mensal", v)}
              opcoes={opcoes(RENDAS_MENSAIS)}
            />
          </Field>
        ) : null}

        {mostraMoraComPais ? (
          <Field label="Mora com os pais">
            <YesNoToggle
              nome="Mora com os pais"
              valor={form.mora_com_pais}
              onChange={(v) => setCampo("mora_com_pais", v)}
            />
          </Field>
        ) : null}

        {mostraRendaFamiliar ? (
          <Field label="Renda familiar" dica={DICA_SM} htmlFor="renda-familiar">
            <SelectInput
              id="renda-familiar"
              value={form.renda_familiar}
              onValueChange={(v) => setCampo("renda_familiar", v)}
              opcoes={opcoes(RENDAS_FAMILIARES)}
            />
          </Field>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <PillButton variante="ghost" onClick={onVoltar}>
          Voltar
        </PillButton>
        <PillButton onClick={onAvancar}>Avançar</PillButton>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Etapa 05 — revisão                                                  */
/* ------------------------------------------------------------------ */

type AbaRevisao = "dados" | "endereco" | "familia" | "socio";

function EtapaRevisao({
  form,
  familia,
  compartilhou,
  congregacaoNome,
  lgpd,
  setLgpd,
  erroLgpd,
  erroEnvio,
  enviando,
  onVoltar,
  onConcluir,
}: {
  form: Formulario;
  familia: Pessoa[];
  compartilhou: boolean;
  congregacaoNome: string;
  lgpd: boolean;
  setLgpd: (v: boolean) => void;
  erroLgpd: string;
  erroEnvio: string;
  enviando: boolean;
  onVoltar: () => void;
  onConcluir: () => void;
}) {
  const abas = useMemo(() => {
    const base: { chave: AbaRevisao; rotulo: string }[] = [
      { chave: "dados", rotulo: "Dados" },
      { chave: "endereco", rotulo: "Endereço" },
    ];
    if (compartilhou) {
      base.push({ chave: "familia", rotulo: "Família" });
      base.push({ chave: "socio", rotulo: "Socioeconômico" });
    }
    return base;
  }, [compartilhou]);

  const [aba, setAba] = useState<AbaRevisao>("dados");

  // Se a bifurcação mudou, a aba selecionada pode ter deixado de existir.
  useEffect(() => {
    if (!abas.some((a) => a.chave === aba)) setAba("dados");
  }, [abas, aba]);

  const linha = (rotulo: string, valor: string | null | undefined) => (
    <div key={rotulo} className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-jt-muted">{rotulo}</span>
      <span className="text-right text-sm text-jt-text">{valor?.trim() ? valor : "—"}</span>
    </div>
  );

  const familiaPropria = temFamiliaPropria(form.estado_civil);
  const pessoas = familia.filter((p) => p.nome_completo.trim());

  return (
    <Panel>
      <Eyebrow>Última etapa</Eyebrow>
      <h1 className="mt-1 font-display text-2xl text-jt-text">Revisar e concluir</h1>

      <div className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr]">
        <ul className="space-y-1">
          {abas.map((a) => (
            <li key={a.chave}>
              <button
                type="button"
                onClick={() => setAba(a.chave)}
                aria-current={aba === a.chave}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                  aba === a.chave
                    ? "bg-jt-panel-2 font-medium text-jt-text"
                    : "text-jt-muted hover:bg-jt-panel-2",
                )}
              >
                <span
                  className={cn(
                    "h-5 w-1 rounded-full",
                    aba === a.chave ? "bg-jt-gold" : "bg-transparent",
                  )}
                  aria-hidden
                />
                {a.rotulo}
              </button>
            </li>
          ))}
        </ul>

        <div className="h-[300px] overflow-y-auto rounded-xl border border-jt-line bg-jt-panel-2 px-4 py-2">
          {aba === "dados"
            ? [
                linha("Nome completo", form.nome_completo),
                linha("E-mail", form.email),
                linha("Congregação", congregacaoNome),
                linha("Data de nascimento", dataParaBR(form.data_nascimento)),
                linha("Telefone", form.telefone),
                linha("CPF", form.cpf),
                linha("RG", form.rg),
              ]
            : null}
          {aba === "endereco"
            ? [
                linha("Endereço", form.endereco),
                linha("Número", form.numero),
                linha("Complemento", form.complemento),
                linha("Cidade", form.cidade),
                linha("CEP", form.cep),
              ]
            : null}
          {aba === "familia" ? (
            pessoas.length === 0 ? (
              <p className="py-10 text-center text-sm text-jt-muted">Nenhuma pessoa adicionada.</p>
            ) : (
              pessoas.map((p, i) => (
                <div key={i} className="border-b border-jt-line py-2 last:border-0">
                  <p className="text-sm text-jt-text">{p.nome_completo}</p>
                  <p className="text-xs text-jt-muted">
                    {[p.parentesco, p.idade ? `${p.idade} anos` : "", p.ocupacao]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              ))
            )
          ) : null}
          {aba === "socio"
            ? [
                linha("Escolaridade", form.escolaridade),
                linha("Local de estudo", form.local_estudo),
                linha("Curso", form.curso),
                linha("Estado civil", form.estado_civil),
                linha(
                  "Trabalha atualmente",
                  form.trabalha_atualmente === null
                    ? "—"
                    : form.trabalha_atualmente
                      ? "Sim"
                      : "Não",
                ),
                form.trabalha_atualmente === true ? linha("Renda mensal", form.renda_mensal) : null,
                !familiaPropria
                  ? linha(
                      "Mora com os pais",
                      form.mora_com_pais === null ? "—" : form.mora_com_pais ? "Sim" : "Não",
                    )
                  : null,
                familiaPropria || form.mora_com_pais === true
                  ? linha("Renda familiar", form.renda_familiar)
                  : null,
              ]
            : null}
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-jt-line bg-jt-panel-2 p-4">
        <input
          type="checkbox"
          checked={lgpd}
          onChange={(e) => setLgpd(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--jt-blue)]"
        />
        <span className="text-xs leading-relaxed text-jt-muted">{TEXTO_LGPD}</span>
      </label>
      {erroLgpd ? <p className="mt-2 text-xs text-jt-coral">{erroLgpd}</p> : null}
      {erroEnvio ? <p className="mt-2 text-sm text-jt-coral">{erroEnvio}</p> : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <PillButton variante="ghost" onClick={onVoltar} disabled={enviando}>
          Voltar
        </PillButton>
        <PillButton onClick={onConcluir} disabled={enviando}>
          {enviando ? "Salvando…" : "Concluir cadastro"}
        </PillButton>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Sucesso                                                             */
/* ------------------------------------------------------------------ */

function Sucesso({
  nome,
  convidou,
  onVoltar,
}: {
  nome: string;
  convidou: boolean;
  onVoltar: () => void;
}) {
  const navegar = useNavigate();
  useEffect(() => {
    const t = setTimeout(onVoltar, 5000);
    return () => clearTimeout(t);
  }, [onVoltar]);

  const primeiro = nome.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="mx-auto w-full max-w-[672px]">
      <Panel className="text-center">
        <div className="mx-auto flex h-16 w-16 animate-in zoom-in items-center justify-center rounded-full bg-jt-success/15">
          <Check className="h-8 w-8 text-jt-success" aria-hidden />
        </div>
        <h1 className="mt-4 font-display text-2xl text-jt-text">Obrigado, {primeiro}!</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-jt-muted">
          {convidou
            ? "Cadastro registrado! Enviamos um e-mail para essa pessoa definir uma senha e acessar o site."
            : "Seu cadastro foi registrado. Em breve a liderança do ministério vai falar com você."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <PillButton
            onClick={() => {
              onVoltar();
              void navegar({ to: "/inicio" });
            }}
          >
            Voltar ao início
          </PillButton>
        </div>
      </Panel>
    </div>
  );
}
