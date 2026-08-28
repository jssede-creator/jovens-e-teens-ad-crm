import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, PillButton, TextInput } from "@/components/cadastro/ui";
import { AvatarIniciais, PageHeader } from "@/components/crm/pagina";
import { EmptyRow, TableShell } from "@/components/crm/tabela";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAcesso } from "@/hooks/use-acesso";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { iniciais } from "@/lib/ebd";
import { mensagemErro } from "@/lib/formato";
import { MODULOS } from "@/lib/modulos";
import { podeVer, type ModuleKey } from "@/lib/nav";
import {
  carregarPapeis,
  salvarPermissoes,
  vincularPapel,
  type ContaSistema,
  type Papel,
} from "@/lib/papeis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes/papeis")({
  head: () => ({
    meta: [
      { title: "Papéis e permissões — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Papéis do ministério, permissões e quem carrega cada um." },
      { property: "og:title", content: "Papéis e permissões — AD CRM" },
      {
        property: "og:description",
        content: "Papéis do ministério, permissões e quem carrega cada um.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PapeisPermissoes,
});

type Aba = "papeis" | "permissoes" | "usuarios";

const GRUPOS = [...new Set(MODULOS.map((m) => m.grupo))];

/* ------------------------------------------------------------------ */
/* Diálogo de papel                                                    */
/* ------------------------------------------------------------------ */

function PapelDialog({
  aberto,
  onOpenChange,
  editando,
  onSalvar,
  salvando,
  erro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: Papel | null;
  onSalvar: (dados: { nome: string; descricao: string; permissoes: ModuleKey[] }) => void;
  salvando: boolean;
  erro: string;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [permissoes, setPermissoes] = useState<Set<ModuleKey>>(new Set());
  const [erroNome, setErroNome] = useState("");
  const [chaveAtual, setChaveAtual] = useState<string | null>(null);

  const chave = aberto ? (editando?.id ?? "novo") : null;
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setErroNome("");
    setNome(editando?.nome ?? "");
    setDescricao(editando?.descricao ?? "");
    setPermissoes(new Set(editando?.permissoes ?? []));
  }

  const alternar = (chaveModulo: ModuleKey) =>
    setPermissoes((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chaveModulo)) proximo.delete(chaveModulo);
      else proximo.add(chaveModulo);
      return proximo;
    });

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldCheck className="h-5 w-5 text-jt-gold" aria-hidden />
            {editando ? `Editar ${editando.nome}` : "Novo papel"}
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            O papel junta permissões e é atribuído às contas. Quem tem o papel herda tudo o que
            estiver marcado aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-1">
          <Field label="Nome do papel" obrigatorio erro={erroNome}>
            <TextInput
              value={nome}
              onValueChange={(v) => {
                setNome(v);
                setErroNome("");
              }}
              placeholder="Ex.: Líder de louvor"
            />
          </Field>

          <Field label="Descrição" dica="Uma linha que explique o que esse papel faz.">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-jt-line bg-jt-panel p-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
            />
          </Field>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-jt-text">Permissões</span>
              <span className="num text-xs text-jt-muted">
                {permissoes.size} de {MODULOS.length}
              </span>
            </div>

            <div className="space-y-3">
              {GRUPOS.map((grupo) => {
                const doGrupo = MODULOS.filter((m) => m.grupo === grupo);
                const todas = doGrupo.every((m) => permissoes.has(m.chave));
                return (
                  <div key={grupo} className="rounded-xl border border-jt-line p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-jt-muted">
                        {grupo}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setPermissoes((atual) => {
                            const proximo = new Set(atual);
                            for (const m of doGrupo) {
                              if (todas) proximo.delete(m.chave);
                              else proximo.add(m.chave);
                            }
                            return proximo;
                          })
                        }
                        className="text-[11px] font-medium text-jt-blue hover:underline"
                      >
                        {todas ? "limpar" : "marcar tudo"}
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {doGrupo.map((m) => (
                        <li key={m.chave}>
                          <label className="flex items-center gap-2 text-sm text-jt-text">
                            <input
                              type="checkbox"
                              checked={permissoes.has(m.chave)}
                              onChange={() => alternar(m.chave)}
                            />
                            {m.rotulo}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </PillButton>
          <PillButton
            disabled={salvando}
            onClick={() => {
              if (!nome.trim()) {
                setErroNome("Campo obrigatório.");
                return;
              }
              onSalvar({
                nome: nome.trim(),
                descricao: descricao.trim(),
                permissoes: [...permissoes],
              });
            }}
          >
            {salvando ? "Salvando…" : editando ? "Salvar papel" : "Criar papel"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

function PapeisPermissoes() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "configuracoes" }, acesso);
  const ehAdmin = acesso?.isAdmin === true;

  const [aba, setAba] = useState<Aba>("papeis");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Papel | null>(null);
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["papeis"],
    enabled: pode,
    queryFn: carregarPapeis,
  });

  const papeis = useMemo(() => consulta.data?.papeis ?? [], [consulta.data]);
  const contas = useMemo(() => consulta.data?.contas ?? [], [consulta.data]);

  const salvarPapel = useMutation({
    mutationFn: async (dados: { nome: string; descricao: string; permissoes: ModuleKey[] }) => {
      let papelId = editando?.id;

      if (editando) {
        const { error } = await supabase
          .from("papeis")
          .update({ nome: dados.nome, descricao: dados.descricao || null })
          .eq("id", editando.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("papeis")
          .insert({ nome: dados.nome, descricao: dados.descricao || null })
          .select("id")
          .single();
        if (error) throw error;
        papelId = data.id;
      }

      await salvarPermissoes(papelId!, dados.permissoes);
      await registrarAuditoria({
        acao: editando ? "editou" : "criou",
        entidade: "papel",
        entidadeId: papelId ?? null,
        detalhe: `${dados.nome} · ${dados.permissoes.length} permissão(ões)`,
      });
    },
    onSuccess: async () => {
      setAberto(false);
      setEditando(null);
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["papeis"] });
      await queryClient.invalidateQueries({ queryKey: ["acesso"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const excluirPapel = useMutation({
    mutationFn: async (papel: Papel) => {
      const { error } = await supabase.from("papeis").delete().eq("id", papel.id);
      if (error) throw error;
      await registrarAuditoria({ acao: "excluiu", entidade: "papel", detalhe: papel.nome });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["papeis"] });
      await queryClient.invalidateQueries({ queryKey: ["acesso"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const alternarPermissao = useMutation({
    mutationFn: async ({ papel, modulo }: { papel: Papel; modulo: ModuleKey }) => {
      const tem = papel.permissoes.includes(modulo);
      const proximas = tem
        ? papel.permissoes.filter((p) => p !== modulo)
        : [...papel.permissoes, modulo];
      await salvarPermissoes(papel.id, proximas);
    },
    onSuccess: async () => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["papeis"] });
      await queryClient.invalidateQueries({ queryKey: ["acesso"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const alternarPapelDaConta = useMutation({
    mutationFn: async ({
      conta,
      papel,
      vincular,
    }: {
      conta: ContaSistema;
      papel: Papel;
      vincular: boolean;
    }) => {
      await vincularPapel(conta.userId, papel.id, vincular);
      await registrarAuditoria({
        acao: vincular ? "atribuiu papel" : "removeu papel",
        entidade: "papel",
        entidadeId: papel.id,
        detalhe: `${papel.nome} · ${conta.nome}`,
      });
    },
    onSuccess: async () => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["papeis"] });
      await queryClient.invalidateQueries({ queryKey: ["acesso"] });
      await queryClient.invalidateQueries({ queryKey: ["configuracoes-usuarios"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const termo = busca.trim().toLowerCase();
  const papeisVisiveis = papeis.filter((p) =>
    termo ? [p.nome, p.descricao ?? ""].some((v) => v.toLowerCase().includes(termo)) : true,
  );
  const contasVisiveis = contas.filter((c) =>
    termo ? [c.nome, c.email].some((v) => v.toLowerCase().includes(termo)) : true,
  );

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Papéis e permissões" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Papéis e permissões" />
        <SemPermissao mensagem="Sua conta não tem permissão para abrir as configurações." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Papéis e permissões"
        descricao="Quem pode o quê no CRM: papéis nomeados, permissões por módulo e as contas de cada papel."
        acoes={
          ehAdmin && aba === "papeis" ? (
            <PillButton
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={() => {
                setEditando(null);
                setErro("");
                setAberto(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Novo papel
            </PillButton>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-jt-line">
        {(
          [
            ["papeis", "Papéis", papeis.length],
            ["permissoes", "Permissões", MODULOS.length],
            ["usuarios", "Usuários do sistema", contas.length],
          ] as const
        ).map(([chave, rotulo, contagem]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setAba(chave)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm transition",
              aba === chave
                ? "border-jt-blue font-medium text-jt-text"
                : "border-transparent text-jt-muted hover:text-jt-text",
            )}
          >
            {rotulo}
            <span className="num text-xs opacity-70">{contagem}</span>
          </button>
        ))}
      </div>

      {erro ? <p className="mb-3 text-xs text-jt-coral">{erro}</p> : null}
      {!ehAdmin ? (
        <p className="mb-3 text-xs text-jt-muted">
          Só administradores mudam papéis e permissões. Você está vendo em modo leitura.
        </p>
      ) : null}

      <div className="mb-3 relative max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-jt-muted"
          aria-hidden
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={aba === "usuarios" ? "Buscar pessoa…" : "Buscar papel…"}
          aria-label="Buscar"
          className="h-9 w-full rounded-full border border-jt-line bg-jt-panel-2 pl-8 pr-3 text-sm text-jt-text placeholder:text-jt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-gold"
        />
      </div>

      {/* --- Aba: papéis --- */}
      {aba === "papeis" ? (
        <TableShell>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-jt-line hover:bg-transparent">
                  <TableHead className="text-jt-muted">Papel</TableHead>
                  <TableHead className="text-jt-muted">Descrição</TableHead>
                  <TableHead className="text-jt-muted">Contas com o papel</TableHead>
                  <TableHead className="text-jt-muted">Permissões</TableHead>
                  <TableHead className="text-jt-muted">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.isLoading ? (
                  <EmptyRow colSpan={5}>Carregando…</EmptyRow>
                ) : consulta.isError ? (
                  <EmptyRow colSpan={5}>
                    Não foi possível carregar os papéis. Se a área é nova, pode faltar aplicar a
                    migração no banco.
                  </EmptyRow>
                ) : papeisVisiveis.length === 0 ? (
                  <EmptyRow colSpan={5}>Nenhum papel encontrado.</EmptyRow>
                ) : (
                  papeisVisiveis.map((p) => (
                    <TableRow key={p.id} className="border-jt-line hover:bg-jt-panel-2">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-jt-text">{p.nome}</span>
                          {p.sistema ? (
                            <Badge
                              variant="outline"
                              className="border-jt-line text-[10px] font-normal text-jt-muted"
                            >
                              padrão
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md text-jt-muted">
                        <span className="line-clamp-1">{p.descricao ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        {p.usuarios.length === 0 ? (
                          <span className="text-jt-muted">—</span>
                        ) : (
                          <div className="flex items-center">
                            {p.usuarios.slice(0, 4).map((u, i) => (
                              <span
                                key={u.id}
                                title={u.nome}
                                className={cn("ring-2 ring-jt-panel", i > 0 && "-ml-2")}
                              >
                                <AvatarIniciais texto={iniciais(u.nome)} tamanho="sm" />
                              </span>
                            ))}
                            {p.usuarios.length > 4 ? (
                              <span className="num -ml-2 grid h-7 w-7 place-items-center rounded-full bg-jt-panel-2 text-[10px] font-medium text-jt-muted ring-2 ring-jt-panel">
                                +{p.usuarios.length - 4}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="num text-jt-text">{p.permissoes.length}</TableCell>
                      <TableCell>
                        {ehAdmin ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Editar ${p.nome}`}
                              onClick={() => {
                                setEditando(p);
                                setErro("");
                                setAberto(true);
                              }}
                              className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            {p.sistema ? null : (
                              <button
                                type="button"
                                aria-label={`Excluir ${p.nome}`}
                                onClick={() => excluirPapel.mutate(p)}
                                className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-jt-muted">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TableShell>
      ) : null}

      {/* --- Aba: permissões (matriz permissão × papel) --- */}
      {aba === "permissoes" ? (
        <TableShell>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-jt-line hover:bg-transparent">
                  <TableHead className="sticky left-0 bg-jt-panel text-jt-muted">
                    Permissão
                  </TableHead>
                  {papeis.map((p) => (
                    <TableHead key={p.id} className="whitespace-nowrap text-center text-jt-muted">
                      {p.nome}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {GRUPOS.map((grupo) => (
                  <Fragmento key={grupo}>
                    <TableRow className="border-jt-line hover:bg-transparent">
                      <TableCell
                        colSpan={papeis.length + 1}
                        className="bg-jt-panel-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-jt-muted"
                      >
                        {grupo}
                      </TableCell>
                    </TableRow>
                    {MODULOS.filter((m) => m.grupo === grupo).map((m) => (
                      <TableRow key={m.chave} className="border-jt-line hover:bg-jt-panel-2">
                        <TableCell className="sticky left-0 bg-jt-panel text-jt-text">
                          {m.rotulo}
                        </TableCell>
                        {papeis.map((p) => {
                          const tem = p.permissoes.includes(m.chave);
                          return (
                            <TableCell key={p.id} className="text-center">
                              <button
                                type="button"
                                disabled={!ehAdmin || alternarPermissao.isPending}
                                aria-label={`${tem ? "Remover" : "Dar"} ${m.rotulo} de ${p.nome}`}
                                aria-pressed={tem}
                                onClick={() =>
                                  alternarPermissao.mutate({ papel: p, modulo: m.chave })
                                }
                                className={cn(
                                  "grid h-6 w-6 place-items-center rounded-full transition",
                                  tem
                                    ? "bg-jt-success/15 text-jt-success"
                                    : "bg-jt-panel-2 text-jt-muted",
                                  ehAdmin && "hover:brightness-95",
                                  !ehAdmin && "cursor-default",
                                )}
                              >
                                {tem ? (
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                ) : (
                                  <X className="h-3 w-3" aria-hidden />
                                )}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </Fragmento>
                ))}
              </TableBody>
            </Table>
          </div>
        </TableShell>
      ) : null}

      {/* --- Aba: usuários do sistema (matriz conta × papel) --- */}
      {aba === "usuarios" ? (
        <TableShell>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-jt-line hover:bg-transparent">
                  <TableHead className="sticky left-0 bg-jt-panel text-jt-muted">Pessoa</TableHead>
                  {papeis.map((p) => (
                    <TableHead key={p.id} className="whitespace-nowrap text-center text-jt-muted">
                      {p.nome}
                    </TableHead>
                  ))}
                  <TableHead className="whitespace-nowrap text-jt-muted">
                    Permissões soltas
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consulta.isLoading ? (
                  <EmptyRow colSpan={papeis.length + 2}>Carregando…</EmptyRow>
                ) : contasVisiveis.length === 0 ? (
                  <EmptyRow colSpan={papeis.length + 2}>Nenhuma conta encontrada.</EmptyRow>
                ) : (
                  contasVisiveis.map((c) => (
                    <TableRow key={c.userId} className="border-jt-line hover:bg-jt-panel-2">
                      <TableCell className="sticky left-0 bg-jt-panel">
                        <div className="flex items-center gap-2.5">
                          <AvatarIniciais texto={iniciais(c.nome)} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate text-sm font-medium text-jt-text">
                              {c.nome}
                              {c.admin ? (
                                <Badge
                                  variant="outline"
                                  className="border-jt-line text-[10px] font-normal text-jt-gold"
                                >
                                  admin
                                </Badge>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-jt-muted">{c.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      {papeis.map((p) => {
                        const tem = c.papeis.includes(p.id);
                        return (
                          <TableCell key={p.id} className="text-center">
                            <button
                              type="button"
                              disabled={!ehAdmin || alternarPapelDaConta.isPending}
                              aria-label={`${tem ? "Remover" : "Atribuir"} ${p.nome} de ${c.nome}`}
                              aria-pressed={tem}
                              onClick={() =>
                                alternarPapelDaConta.mutate({
                                  conta: c,
                                  papel: p,
                                  vincular: !tem,
                                })
                              }
                              className={cn(
                                "grid h-6 w-6 place-items-center rounded-full transition",
                                tem
                                  ? "bg-jt-success/15 text-jt-success"
                                  : "bg-jt-panel-2 text-jt-muted",
                                ehAdmin && "hover:brightness-95",
                                !ehAdmin && "cursor-default",
                              )}
                            >
                              {tem ? (
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              ) : (
                                <X className="h-3 w-3" aria-hidden />
                              )}
                            </button>
                          </TableCell>
                        );
                      })}

                      <TableCell className="num text-jt-muted">
                        {c.admin ? "todas (admin)" : c.extras.length}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TableShell>
      ) : null}

      <PapelDialog
        aberto={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          if (!v) setEditando(null);
        }}
        editando={editando}
        onSalvar={(dados) => salvarPapel.mutate(dados)}
        salvando={salvarPapel.isPending}
        erro={erro}
      />
    </>
  );
}

/** Agrupador sem marcação extra — a tabela não aceita div entre linhas. */
function Fragmento({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
