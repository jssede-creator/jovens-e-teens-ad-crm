import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { KanbanSquare, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, PillButton, TextInput } from "@/components/cadastro/ui";
import { DataCampo, SelectCampo } from "@/components/crm/campos";
import { PageHeader } from "@/components/crm/pagina";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { dataParaBR, mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/novosprojetos")({
  head: () => ({
    meta: [
      { title: "Novos projetos — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Quadro dos projetos do ministério, da ideia à entrega." },
      { property: "og:title", content: "Novos projetos — AD CRM" },
      {
        property: "og:description",
        content: "Quadro dos projetos do ministério, da ideia à entrega.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NovosProjetos,
});

type Status = "ideias" | "planejado" | "em_andamento" | "revisao" | "concluido";

type Projeto = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: Status;
  responsavel: string | null;
  prazo: string | null;
};

const COLUNAS: { chave: Status; rotulo: string; ponto: string }[] = [
  { chave: "ideias", rotulo: "Ideias", ponto: "bg-jt-muted" },
  { chave: "planejado", rotulo: "Planejado", ponto: "bg-jt-blue" },
  { chave: "em_andamento", rotulo: "Em andamento", ponto: "bg-blue-500" },
  { chave: "revisao", rotulo: "Revisão", ponto: "bg-violet-500" },
  { chave: "concluido", rotulo: "Concluído", ponto: "bg-jt-success" },
];

const FORM_VAZIO = {
  titulo: "",
  descricao: "",
  status: "ideias" as Status,
  responsavel: "",
  prazo: "",
};
type Formulario = typeof FORM_VAZIO;

function ProjetoDialog({
  aberto,
  onOpenChange,
  editando,
  statusInicial,
  onSalvar,
  salvando,
  erro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: Projeto | null;
  statusInicial: Status;
  onSalvar: (form: Formulario) => void;
  salvando: boolean;
  erro: string;
}) {
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [erroTitulo, setErroTitulo] = useState("");
  const [chaveAtual, setChaveAtual] = useState<string | null>(null);

  const chave = aberto ? (editando?.id ?? `novo-${statusInicial}`) : null;
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setErroTitulo("");
    setForm(
      editando
        ? {
            titulo: editando.titulo,
            descricao: editando.descricao ?? "",
            status: editando.status,
            responsavel: editando.responsavel ?? "",
            prazo: editando.prazo ?? "",
          }
        : { ...FORM_VAZIO, status: statusInicial },
    );
  }

  const campo = <K extends keyof Formulario>(nome: K, valor: Formulario[K]) =>
    setForm((atual) => ({ ...atual, [nome]: valor }));

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <KanbanSquare className="h-5 w-5 text-jt-gold" aria-hidden />
            {editando ? "Editar projeto" : "Novo projeto"}
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            O projeto aparece na coluna escolhida e pode ser movido depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Título" obrigatorio erro={erroTitulo}>
            <TextInput
              placeholder="Ex.: Retiro de jovens 2027"
              value={form.titulo}
              onValueChange={(v) => {
                campo("titulo", v);
                setErroTitulo("");
              }}
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={form.descricao}
              onChange={(e) => campo("descricao", e.target.value)}
              rows={3}
              className="w-full rounded-[12px] border border-jt-line bg-jt-panel-2 p-3 text-sm text-jt-text placeholder:text-jt-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
              placeholder="O que precisa acontecer?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coluna">
              <SelectCampo
                opcoes={COLUNAS.map((c) => ({ valor: c.chave, rotulo: c.rotulo }))}
                placeholder="Selecione"
                valor={form.status}
                onValueChange={(v) => campo("status", v as Status)}
              />
            </Field>
            <Field label="Responsável">
              <TextInput
                value={form.responsavel}
                onValueChange={(v) => campo("responsavel", v)}
                placeholder="Nome de quem toca"
              />
            </Field>
          </div>
          <Field label="Prazo">
            <DataCampo valor={form.prazo} onValueChange={(v) => campo("prazo", v)} />
          </Field>
          {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </PillButton>
          <PillButton
            disabled={salvando}
            onClick={() => {
              if (!form.titulo.trim()) {
                setErroTitulo("Campo obrigatório.");
                return;
              }
              onSalvar(form);
            }}
          >
            {editando ? "Salvar alterações" : "Criar projeto"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovosProjetos() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "projetos" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "projetos_gerenciar" }, acesso);

  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [statusInicial, setStatusInicial] = useState<Status>("ideias");
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["projetos"],
    enabled: pode,
    queryFn: async (): Promise<Projeto[]> => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, titulo, descricao, status, responsavel, prazo")
        .order("ordem")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, status: p.status as Status }));
    },
  });

  const salvar = useMutation({
    mutationFn: async (form: Formulario) => {
      const registro = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        status: form.status,
        responsavel: form.responsavel.trim() || null,
        prazo: form.prazo || null,
      };
      if (editando) {
        const { error } = await supabase.from("projetos").update(registro).eq("id", editando.id);
        if (error) throw error;
        await registrarAuditoria({
          acao: "editou",
          entidade: "projeto",
          entidadeId: editando.id,
          detalhe: registro.titulo,
        });
        return;
      }
      const { data, error } = await supabase
        .from("projetos")
        .insert(registro)
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria({
        acao: "criou",
        entidade: "projeto",
        entidadeId: data.id,
        detalhe: registro.titulo,
      });
    },
    onSuccess: async () => {
      setAberto(false);
      setEditando(null);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const mover = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("projetos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const excluir = useMutation({
    mutationFn: async (p: Projeto) => {
      const { error } = await supabase.from("projetos").delete().eq("id", p.id);
      if (error) throw error;
      await registrarAuditoria({
        acao: "excluiu",
        entidade: "projeto",
        entidadeId: p.id,
        detalhe: p.titulo,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const projetos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = consulta.data ?? [];
    if (!termo) return lista;
    return lista.filter((p) =>
      [p.titulo, p.descricao ?? "", p.responsavel ?? ""].some((v) =>
        v.toLowerCase().includes(termo),
      ),
    );
  }, [consulta.data, busca]);

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Novos projetos" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Novos projetos" />
        <SemPermissao mensagem="Sua conta não tem permissão para ver os projetos do ministério." />
      </>
    );
  }

  const abrirNovo = (status: Status) => {
    setEditando(null);
    setStatusInicial(status);
    setErro("");
    setAberto(true);
  };

  return (
    <>
      <PageHeader
        titulo="Novos projetos"
        descricao={`${projetos.length} projeto(s) da ideia até a entrega.`}
        acoes={
          <div className="flex flex-col items-end gap-2">
            <div className="relative w-full max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-jt-muted"
                aria-hidden
              />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar projeto…"
                aria-label="Buscar projeto"
                className="h-9 w-64 rounded-full border border-jt-line bg-jt-panel-2 pl-8 pr-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
              />
            </div>
            {podeGerenciar ? (
              <PillButton
                onClick={() => abrirNovo("ideias")}
                className="h-9 rounded-full px-4 text-[13px]"
              >
                <Plus className="h-4 w-4" aria-hidden /> Novo projeto
              </PillButton>
            ) : null}
          </div>
        }
      />

      {erro ? <p className="mb-3 text-xs text-jt-coral">{erro}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUNAS.map((coluna) => {
          const daColuna = projetos.filter((p) => p.status === coluna.chave);
          return (
            <section
              key={coluna.chave}
              className="rounded-[20px] border border-jt-line bg-jt-panel p-3"
            >
              <header className="mb-3 flex items-center gap-2 px-1">
                <span className={cn("h-2 w-2 rounded-full", coluna.ponto)} />
                <h2 className="text-sm font-semibold text-jt-text">{coluna.rotulo}</h2>
                <span className="num text-xs text-jt-muted">{daColuna.length}</span>
                {podeGerenciar ? (
                  <button
                    type="button"
                    aria-label={`Novo projeto em ${coluna.rotulo}`}
                    onClick={() => abrirNovo(coluna.chave)}
                    className="ml-auto grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </header>

              {consulta.isLoading ? (
                <p className="rounded-xl border border-dashed border-jt-line py-8 text-center text-xs text-jt-muted">
                  Carregando…
                </p>
              ) : daColuna.length === 0 ? (
                <p className="rounded-xl border border-dashed border-jt-line py-8 text-center text-xs text-jt-muted">
                  Nada por aqui
                </p>
              ) : (
                <ul className="space-y-2">
                  {daColuna.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl border border-jt-line bg-jt-panel-2 p-3 transition hover:border-jt-gold/40"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!podeGerenciar) return;
                            setEditando(p);
                            setErro("");
                            setAberto(true);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-medium text-jt-text">{p.titulo}</p>
                          {p.descricao ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-jt-muted">
                              {p.descricao}
                            </p>
                          ) : null}
                        </button>
                        {podeGerenciar ? (
                          <button
                            type="button"
                            aria-label={`Excluir ${p.titulo}`}
                            onClick={() => excluir.mutate(p)}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-jt-muted">
                        {p.responsavel ? <span className="truncate">{p.responsavel}</span> : null}
                        {p.prazo ? <span className="num">{dataParaBR(p.prazo)}</span> : null}
                      </div>

                      {podeGerenciar ? (
                        <label className="mt-2 block">
                          <span className="sr-only">Mover {p.titulo}</span>
                          <select
                            value={p.status}
                            onChange={(e) =>
                              mover.mutate({ id: p.id, status: e.target.value as Status })
                            }
                            className="h-8 w-full rounded-md border border-jt-line bg-jt-panel px-2 text-xs text-jt-muted outline-none transition hover:text-jt-text focus:ring-2 focus:ring-jt-blue/30"
                          >
                            {COLUNAS.map((c) => (
                              <option key={c.chave} value={c.chave}>
                                {c.rotulo}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <ProjetoDialog
        aberto={aberto}
        onOpenChange={setAberto}
        editando={editando}
        statusInicial={statusInicial}
        onSalvar={(form) => salvar.mutate(form)}
        salvando={salvar.isPending}
        erro={erro}
      />
    </>
  );
}
