import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { AvatarIniciais, PageHeader } from "@/components/crm/pagina";
import {
  EmptyRow,
  TableSearch,
  TableShell,
  TableToolbar,
  TableToolbarActions,
} from "@/components/crm/tabela";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Contas do CRM, funções e módulos liberados." },
      { property: "og:title", content: "Usuários — AD CRM" },
      { property: "og:description", content: "Contas do CRM, funções e módulos liberados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfiguracoesUsuarios,
});

type Usuario = {
  userId: string;
  nome: string;
  email: string;
  admin: boolean;
  modulos: Set<ModuleKey>;
};

function ConfiguracoesUsuarios() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "configuracoes" }, acesso);
  const ehAdmin = acesso?.isAdmin === true;

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["configuracoes-usuarios"],
    enabled: pode,
    queryFn: async (): Promise<Usuario[]> => {
      const [cadastros, papeis, modulos] = await Promise.all([
        supabase
          .from("cadastros")
          .select("user_id, nome_completo, email")
          .not("user_id", "is", null)
          .order("nome_completo"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("module_access").select("user_id, module_key"),
      ]);
      if (cadastros.error) throw cadastros.error;
      if (papeis.error) throw papeis.error;
      if (modulos.error) throw modulos.error;

      const admins = new Set(
        (papeis.data ?? []).filter((p) => p.role === "admin").map((p) => p.user_id),
      );
      const porUsuario = new Map<string, Set<ModuleKey>>();
      for (const m of modulos.data ?? []) {
        const atual = porUsuario.get(m.user_id) ?? new Set<ModuleKey>();
        atual.add(m.module_key as ModuleKey);
        porUsuario.set(m.user_id, atual);
      }

      const vistos = new Set<string>();
      const lista: Usuario[] = [];
      for (const c of cadastros.data ?? []) {
        const id = c.user_id as string;
        if (vistos.has(id)) continue;
        vistos.add(id);
        lista.push({
          userId: id,
          nome: c.nome_completo,
          email: c.email,
          admin: admins.has(id),
          modulos: porUsuario.get(id) ?? new Set(),
        });
      }
      // Contas com acesso mas sem cadastro completo continuam aparecendo.
      for (const [id, mods] of porUsuario) {
        if (vistos.has(id)) continue;
        vistos.add(id);
        lista.push({
          userId: id,
          nome: "Conta sem cadastro",
          email: id,
          admin: admins.has(id),
          modulos: mods,
        });
      }
      return lista;
    },
  });

  const salvarModulo = useMutation({
    mutationFn: async ({
      userId,
      modulo,
      liberar,
    }: {
      userId: string;
      modulo: ModuleKey;
      liberar: boolean;
    }) => {
      if (liberar) {
        const { error } = await supabase
          .from("module_access")
          .insert({ user_id: userId, module_key: modulo });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("module_access")
          .delete()
          .eq("user_id", userId)
          .eq("module_key", modulo);
        if (error) throw error;
      }
      await registrarAuditoria({
        acao: liberar ? "liberou" : "removeu",
        entidade: "acesso",
        detalhe: `${modulo}`,
      });
    },
    onSuccess: async () => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["configuracoes-usuarios"] });
      await queryClient.invalidateQueries({ queryKey: ["acesso"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const usuarios = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = consulta.data ?? [];
    if (!termo) return lista;
    return lista.filter((u) => [u.nome, u.email].some((v) => v.toLowerCase().includes(termo)));
  }, [consulta.data, busca]);

  const emEdicao = editando
    ? ((consulta.data ?? []).find((u) => u.userId === editando.userId) ?? editando)
    : null;

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Usuários — Configurações" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Usuários — Configurações" />
        <SemPermissao mensagem="Sua conta não tem permissão para abrir as configurações." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Usuários — Configurações"
        descricao="Quem tem conta no CRM e o que cada um enxerga. Para trabalhar por papel, use Papéis e permissões."
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {usuarios.length}
          </Badge>
        }
      />

      {erro ? <p className="mb-3 text-xs text-jt-coral">{erro}</p> : null}
      {!ehAdmin ? (
        <p className="mb-3 text-xs text-jt-muted">
          Só administradores mudam permissões. Você está vendo os acessos em modo leitura.
        </p>
      ) : null}

      <TableShell>
        <TableToolbar>
          <TableSearch valor={busca} onChange={setBusca} placeholder="Buscar por nome ou e-mail…" />
          <TableToolbarActions>
            <span className="num text-xs text-jt-muted">{MODULOS.length} permissões</span>
          </TableToolbarActions>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <TableHead className="text-jt-muted">Usuário</TableHead>
                <TableHead className="text-jt-muted">Função</TableHead>
                <TableHead className="text-jt-muted">Módulos liberados</TableHead>
                <TableHead className="text-jt-muted">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consulta.isLoading ? (
                <EmptyRow colSpan={4}>Carregando…</EmptyRow>
              ) : consulta.isError ? (
                <EmptyRow colSpan={4}>Não foi possível carregar os usuários.</EmptyRow>
              ) : usuarios.length === 0 ? (
                <EmptyRow colSpan={4}>Nenhuma conta encontrada.</EmptyRow>
              ) : (
                usuarios.map((u) => (
                  <TableRow key={u.userId} className="border-jt-line hover:bg-jt-panel-2">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <AvatarIniciais texto={iniciais(u.nome)} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-jt-text">{u.nome}</p>
                          <p className="truncate text-xs text-jt-muted">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-jt-line font-normal",
                          u.admin ? "text-jt-gold" : "text-jt-muted",
                        )}
                      >
                        {u.admin ? "Administrador" : "Usuário"}
                      </Badge>
                    </TableCell>
                    <TableCell className="num text-jt-muted">
                      {u.admin ? "todos (admin)" : u.modulos.size}
                    </TableCell>
                    <TableCell>
                      <PillButton
                        variante="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => setEditando(u)}
                      >
                        Ver acessos
                      </PillButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TableShell>

      <Dialog open={emEdicao !== null} onOpenChange={(v) => (!v ? setEditando(null) : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <ShieldCheck className="h-5 w-5 text-jt-gold" aria-hidden />
              {emEdicao?.nome ?? ""}
            </DialogTitle>
            <DialogDescription className="text-jt-muted">
              {emEdicao?.admin
                ? "Esta conta é administradora e enxerga todos os módulos, independente das marcações."
                : "Marque o que essa pessoa pode ver e fazer no CRM."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {[...new Set(MODULOS.map((m) => m.grupo))].map((grupo) => (
              <div key={grupo}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-jt-muted">
                  {grupo}
                </p>
                <ul className="space-y-1.5">
                  {MODULOS.filter((m) => m.grupo === grupo).map((m) => (
                    <li key={m.chave}>
                      <label className="flex items-center gap-2 text-sm text-jt-text">
                        <input
                          type="checkbox"
                          disabled={!ehAdmin || salvarModulo.isPending}
                          checked={emEdicao?.modulos.has(m.chave) ?? false}
                          onChange={(e) => {
                            if (!emEdicao) return;
                            salvarModulo.mutate({
                              userId: emEdicao.userId,
                              modulo: m.chave,
                              liberar: e.target.checked,
                            });
                          }}
                        />
                        {m.rotulo}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <DialogFooter>
            <PillButton variante="ghost" onClick={() => setEditando(null)}>
              Fechar
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
