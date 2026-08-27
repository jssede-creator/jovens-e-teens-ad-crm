import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FolderClosed, FolderPlus, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Field, PillButton, SelectInput, TextInput } from "@/components/cadastro/ui";
import { PageHeader } from "@/components/crm/pagina";
import {
  EmptyRow,
  TableSearch,
  TableShell,
  TableToolbar,
  TableToolbarActions,
  ToolbarIconButton,
} from "@/components/crm/tabela";
import { Carregando, SemPermissao } from "@/components/sem-permissao";
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
import { dataParaBR, mensagemErro, tamanhoArquivo } from "@/lib/formato";
import { podeVer } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/arquivos")({
  head: () => ({
    meta: [
      { title: "Arquivos — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Documentos e mídias do ministério, organizados por pasta." },
      { property: "og:title", content: "Arquivos — AD CRM" },
      {
        property: "og:description",
        content: "Documentos e mídias do ministério, organizados por pasta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Arquivos,
});

const LIMITE_BYTES = 25 * 1024 * 1024;

type Pasta = { id: string; nome: string };
type Arquivo = {
  id: string;
  nome: string;
  caminho: string;
  tamanho: number;
  tipo: string | null;
  pastaId: string | null;
  enviadoPor: string | null;
  created_at: string;
};

function Arquivos() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "arquivos" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "arquivos_gerenciar" }, acesso);

  const inputArquivo = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [pastaAtiva, setPastaAtiva] = useState<string | null>(null);
  const [novaPasta, setNovaPasta] = useState(false);
  const [nomePasta, setNomePasta] = useState("");
  const [pastaDestino, setPastaDestino] = useState("");
  const [erro, setErro] = useState("");

  const consulta = useQuery({
    queryKey: ["arquivos"],
    enabled: pode,
    queryFn: async () => {
      const [pastas, arquivos] = await Promise.all([
        supabase.from("arquivos_pastas").select("id, nome").order("nome"),
        supabase
          .from("arquivos")
          .select("id, nome, caminho, tamanho, tipo, pasta_id, enviado_por_nome, created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (pastas.error) throw pastas.error;
      if (arquivos.error) throw arquivos.error;
      return {
        pastas: (pastas.data ?? []) as Pasta[],
        arquivos: (arquivos.data ?? []).map((a) => ({
          id: a.id,
          nome: a.nome,
          caminho: a.caminho,
          tamanho: a.tamanho,
          tipo: a.tipo,
          pastaId: a.pasta_id,
          enviadoPor: a.enviado_por_nome,
          created_at: a.created_at,
        })) as Arquivo[],
      };
    },
  });

  const pastas = useMemo(() => consulta.data?.pastas ?? [], [consulta.data]);
  const arquivos = useMemo(() => consulta.data?.arquivos ?? [], [consulta.data]);

  const criarPasta = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("arquivos_pastas").insert({ nome: nome.trim() });
      if (error) throw error;
      await registrarAuditoria({ acao: "criou", entidade: "pasta", detalhe: nome.trim() });
    },
    onSuccess: async () => {
      setNovaPasta(false);
      setNomePasta("");
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["arquivos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const enviar = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > LIMITE_BYTES) throw new Error("tamanho");
      const { data: sessao } = await supabase.auth.getUser();
      const user = sessao.user;
      const caminho = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;

      const upload = await supabase.storage.from("arquivos").upload(caminho, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (upload.error) throw upload.error;

      const { error } = await supabase.from("arquivos").insert({
        pasta_id: pastaDestino || pastaAtiva || null,
        nome: file.name,
        caminho,
        tamanho: file.size,
        tipo: file.type || null,
        enviado_por: user?.id ?? null,
        enviado_por_nome:
          (user?.user_metadata?.["nome"] as string | undefined) ?? user?.email ?? null,
      });
      if (error) {
        await supabase.storage.from("arquivos").remove([caminho]);
        throw error;
      }
      await registrarAuditoria({ acao: "enviou", entidade: "arquivo", detalhe: file.name });
    },
    onSuccess: async () => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["arquivos"] });
    },
    onError: (e) =>
      setErro(
        (e as Error).message === "tamanho"
          ? "O arquivo passa de 25 MB. Envie um arquivo menor."
          : mensagemErro(e),
      ),
  });

  const excluir = useMutation({
    mutationFn: async (a: Arquivo) => {
      const { error } = await supabase.from("arquivos").delete().eq("id", a.id);
      if (error) throw error;
      await supabase.storage.from("arquivos").remove([a.caminho]);
      await registrarAuditoria({ acao: "excluiu", entidade: "arquivo", detalhe: a.nome });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["arquivos"] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const baixar = async (a: Arquivo) => {
    const { data, error } = await supabase.storage
      .from("arquivos")
      .createSignedUrl(a.caminho, 60, { download: a.nome });
    if (error || !data) {
      setErro(mensagemErro(error));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return arquivos.filter((a) => {
      if (pastaAtiva && a.pastaId !== pastaAtiva) return false;
      if (!termo) return true;
      return a.nome.toLowerCase().includes(termo);
    });
  }, [arquivos, busca, pastaAtiva]);

  const totalBytes = arquivos.reduce((soma, a) => soma + a.tamanho, 0);
  const porPasta = (id: string) => arquivos.filter((a) => a.pastaId === id);

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Arquivos" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Arquivos" />
        <SemPermissao mensagem="Sua conta não tem permissão para ver os arquivos do ministério." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Arquivos"
        descricao={`${arquivos.length} arquivo(s) · ${tamanhoArquivo(totalBytes)} guardados`}
        acoes={
          podeGerenciar ? (
            <>
              <PillButton
                variante="outline"
                onClick={() => {
                  setErro("");
                  setNovaPasta(true);
                }}
                className="h-9 rounded-full px-4 text-[13px]"
              >
                <FolderPlus className="h-4 w-4" aria-hidden /> Nova pasta
              </PillButton>
              <PillButton
                onClick={() => inputArquivo.current?.click()}
                disabled={enviar.isPending}
                className="h-9 rounded-full px-4 text-[13px]"
              >
                <Upload className="h-4 w-4" aria-hidden />
                {enviar.isPending ? "Enviando…" : "Enviar arquivo"}
              </PillButton>
              <input
                ref={inputArquivo}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) enviar.mutate(file);
                  e.target.value = "";
                }}
              />
            </>
          ) : null
        }
      />

      {erro ? <p className="mb-3 text-xs text-jt-coral">{erro}</p> : null}

      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-jt-text">Pastas</h2>
          <span className="num text-xs text-jt-muted">{pastas.length} pastas</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pastas.map((p) => {
            const daPasta = porPasta(p.id);
            const bytes = daPasta.reduce((s, a) => s + a.tamanho, 0);
            const ativa = pastaAtiva === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPastaAtiva(ativa ? null : p.id)}
                aria-pressed={ativa}
                className={cn(
                  "rounded-[20px] border bg-jt-panel p-4 text-left transition hover:bg-jt-panel-2",
                  ativa ? "border-jt-gold/60" : "border-jt-line",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jt-panel-2 text-jt-muted">
                    <FolderClosed className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-jt-text">{p.nome}</p>
                    <p className="num text-xs text-jt-muted">{daPasta.length} arquivos</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-jt-line pt-2 text-xs text-jt-muted">
                  <span>{daPasta.length === 0 ? "Vazia" : "Com conteúdo"}</span>
                  <span className="num">{tamanhoArquivo(bytes)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <TableShell>
        <TableToolbar>
          <TableSearch valor={busca} onChange={setBusca} placeholder="Buscar arquivos e pastas…" />
          <TableToolbarActions>
            {pastaAtiva ? (
              <ToolbarIconButton
                rotulo="Limpar filtro de pasta"
                ativo
                onClick={() => setPastaAtiva(null)}
              >
                <FolderClosed className="h-4 w-4" aria-hidden />
              </ToolbarIconButton>
            ) : null}
            <ToolbarIconButton rotulo="Buscar" onClick={() => undefined}>
              <Search className="h-4 w-4" aria-hidden />
            </ToolbarIconButton>
          </TableToolbarActions>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <TableHead className="text-jt-muted">Arquivo</TableHead>
                <TableHead className="text-jt-muted">Pasta</TableHead>
                <TableHead className="text-jt-muted">Tamanho</TableHead>
                <TableHead className="text-jt-muted">Enviado por</TableHead>
                <TableHead className="text-jt-muted">Data</TableHead>
                <TableHead className="text-jt-muted">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consulta.isLoading ? (
                <EmptyRow colSpan={6}>Carregando…</EmptyRow>
              ) : visiveis.length === 0 ? (
                <EmptyRow colSpan={6}>Nenhum arquivo enviado ainda.</EmptyRow>
              ) : (
                visiveis.map((a) => (
                  <TableRow key={a.id} className="border-jt-line hover:bg-jt-panel-2">
                    <TableCell className="font-medium text-jt-text">{a.nome}</TableCell>
                    <TableCell className="text-jt-muted">
                      {pastas.find((p) => p.id === a.pastaId)?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="num text-jt-muted">{tamanhoArquivo(a.tamanho)}</TableCell>
                    <TableCell className="text-jt-muted">{a.enviadoPor ?? "—"}</TableCell>
                    <TableCell className="num text-jt-muted">
                      {dataParaBR(a.created_at.slice(0, 10))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Baixar ${a.nome}`}
                          onClick={() => baixar(a)}
                          className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        {podeGerenciar ? (
                          <button
                            type="button"
                            aria-label={`Excluir ${a.nome}`}
                            onClick={() => excluir.mutate(a)}
                            className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-red-50 hover:text-jt-coral dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TableShell>

      <Dialog open={novaPasta} onOpenChange={setNovaPasta}>
        <DialogContent className="border-jt-line bg-jt-panel text-jt-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <FolderPlus className="h-5 w-5 text-jt-gold" aria-hidden />
              Nova pasta
            </DialogTitle>
            <DialogDescription className="text-jt-muted">
              O nome da pasta precisa ser único.
            </DialogDescription>
          </DialogHeader>
          <Field label="Nome da pasta" obrigatorio>
            <TextInput value={nomePasta} onValueChange={setNomePasta} placeholder="Ex.: Eventos" />
          </Field>
          <DialogFooter>
            <PillButton variante="ghost" onClick={() => setNovaPasta(false)}>
              Cancelar
            </PillButton>
            <PillButton
              disabled={!nomePasta.trim() || criarPasta.isPending}
              onClick={() => criarPasta.mutate(nomePasta)}
            >
              Criar pasta
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {podeGerenciar && pastas.length > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-jt-muted">Enviar para a pasta:</span>
          <div className="w-56">
            <SelectInput
              opcoes={pastas.map((p) => ({ valor: p.id, rotulo: p.nome }))}
              placeholder="Sem pasta"
              value={pastaDestino}
              onValueChange={setPastaDestino}
              className="h-9"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
