import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Church, GraduationCap, Pencil, Plus } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { Field, PillButton, TextInput } from "@/components/cadastro/ui";
import { SelectCampo } from "@/components/crm/campos";
import { AvatarIniciais, PageHeader } from "@/components/crm/pagina";
import {
  ColumnsMenu,
  EmptyRow,
  FilterMenu,
  GroupHeaderRow,
  GroupToggleButton,
  SortableHead,
  TablePagination,
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
import { DropdownMenuCheckboxItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
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
import { idadeEm, iniciais } from "@/lib/ebd";
import { mensagemErro } from "@/lib/formato";
import { podeVer } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/ebd/classes")({
  head: () => ({
    meta: [
      { title: "Classes da EBD — AD CRM | Jovens e Teens AD" },
      { name: "description", content: "Classes da EBD e seus matriculados." },
      { property: "og:title", content: "Classes da EBD — AD CRM" },
      { property: "og:description", content: "Classes da EBD e seus matriculados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EbdClasses,
});

type Turma = {
  id: string;
  nome: string;
  congregacaoId: string;
  congregacao: string;
  idadeMin: number;
  idadeMax: number;
  matriculados: number;
};

type ColunaKey = "congregacao" | "faixa" | "matriculados";

const COLUNAS_TABELA = [
  { chave: "congregacao", rotulo: "Congregação" },
  { chave: "faixa", rotulo: "Faixa etária" },
  { chave: "matriculados", rotulo: "Matriculados" },
] as const satisfies readonly { chave: ColunaKey; rotulo: string }[];

type OrdemKey = "nome" | "congregacao" | "faixa";

const FORM_VAZIO = { nome: "", congregacao_id: "", idade_min: "", idade_max: "" };
type Formulario = typeof FORM_VAZIO;

function alternarNoSet<T>(conjunto: Set<T>, valor: T, marcado: boolean) {
  const proximo = new Set(conjunto);
  if (marcado) proximo.add(valor);
  else proximo.delete(valor);
  return proximo;
}

function TurmaDialog({
  aberto,
  onOpenChange,
  editando,
  congregacoes,
  onSalvar,
  salvando,
  erro,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  editando: Turma | null;
  congregacoes: { id: string; nome: string }[];
  onSalvar: (form: Formulario) => void;
  salvando: boolean;
  erro: string;
}) {
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [chaveAtual, setChaveAtual] = useState<string | null>(null);

  const chave = aberto ? (editando?.id ?? "nova") : null;
  if (chave !== chaveAtual) {
    setChaveAtual(chave);
    setErros({});
    setForm(
      editando
        ? {
            nome: editando.nome,
            congregacao_id: editando.congregacaoId,
            idade_min: String(editando.idadeMin),
            idade_max: String(editando.idadeMax),
          }
        : FORM_VAZIO,
    );
  }

  const campo = <K extends keyof Formulario>(nome: K, valor: Formulario[K]) => {
    setForm((atual) => ({ ...atual, [nome]: valor }));
    setErros((atual) => ({ ...atual, [nome]: "" }));
  };

  function enviar() {
    const novos: Record<string, string> = {};
    if (!form.nome.trim()) novos["nome"] = "Campo obrigatório.";
    if (!form.congregacao_id) novos["congregacao_id"] = "Campo obrigatório.";
    const min = Number(form.idade_min);
    const max = Number(form.idade_max);
    if (!form.idade_min || Number.isNaN(min)) novos["idade_min"] = "Informe a idade mínima.";
    if (!form.idade_max || Number.isNaN(max)) novos["idade_max"] = "Informe a idade máxima.";
    if (!novos["idade_max"] && !novos["idade_min"] && max < min) {
      novos["idade_max"] = "A idade máxima precisa ser maior ou igual à mínima.";
    }
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    onSalvar(form);
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <GraduationCap className="h-5 w-5 text-jt-gold" aria-hidden />
            {editando ? "Editar classe" : "Nova classe"}
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            A faixa etária define quem pode ser matriculado nesta classe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Nome da classe" obrigatorio erro={erros["nome"] ?? ""}>
            <TextInput
              placeholder="Ex.: Campeões da Fé"
              value={form.nome}
              onValueChange={(v) => campo("nome", v)}
            />
          </Field>
          <Field label="Congregação" obrigatorio erro={erros["congregacao_id"] ?? ""}>
            <SelectCampo
              opcoes={congregacoes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              placeholder="Selecione"
              valor={form.congregacao_id}
              onValueChange={(v) => campo("congregacao_id", v)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Idade mínima" obrigatorio erro={erros["idade_min"] ?? ""}>
              <TextInput
                inputMode="numeric"
                value={form.idade_min}
                onValueChange={(v) => campo("idade_min", v.replace(/\D/g, ""))}
              />
            </Field>
            <Field label="Idade máxima" obrigatorio erro={erros["idade_max"] ?? ""}>
              <TextInput
                inputMode="numeric"
                value={form.idade_max}
                onValueChange={(v) => campo("idade_max", v.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          {erro ? <p className="text-xs text-jt-coral">{erro}</p> : null}
        </div>

        <DialogFooter>
          <PillButton variante="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </PillButton>
          <PillButton onClick={enviar} disabled={salvando}>
            {editando ? "Salvar alterações" : "Cadastrar classe"}
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerTurmaDialog({ turma, onFechar }: { turma: Turma | null; onFechar: () => void }) {
  const consulta = useQuery({
    queryKey: ["ebd-turma-matriculados", turma?.id],
    enabled: turma !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_matriculas")
        .select("id, cadastro_id, cadastros(nome_completo, data_nascimento, telefone)")
        .eq("turma_id", turma!.id);
      if (error) throw error;
      return (data ?? []).map((m) => {
        const pessoa = m.cadastros as unknown as {
          nome_completo: string;
          data_nascimento: string;
          telefone: string;
        } | null;
        return {
          id: m.id,
          nome: pessoa?.nome_completo ?? "—",
          idade: idadeEm(pessoa?.data_nascimento),
          telefone: pessoa?.telefone ?? "",
        };
      });
    },
  });

  return (
    <Dialog open={turma !== null} onOpenChange={(v) => (!v ? onFechar() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-jt-line bg-jt-panel text-jt-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <GraduationCap className="h-5 w-5 text-jt-gold" aria-hidden />
            {turma?.nome ?? ""}
          </DialogTitle>
          <DialogDescription className="text-jt-muted">
            {turma ? `${turma.congregacao} · ${turma.idadeMin} a ${turma.idadeMax} anos` : ""}
          </DialogDescription>
        </DialogHeader>

        {consulta.isLoading ? (
          <p className="py-8 text-center text-sm text-jt-muted">Carregando…</p>
        ) : (consulta.data?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-jt-muted">
            Nenhum aluno matriculado nesta classe ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {consulta.data?.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                <AvatarIniciais texto={iniciais(m.nome)} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-jt-text">{m.nome}</p>
                  <p className="truncate text-xs text-jt-muted">
                    {m.idade != null ? `${m.idade} anos` : "—"}
                    {m.telefone ? ` · ${m.telefone}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <PillButton variante="ghost" onClick={onFechar}>
            Fechar
          </PillButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EbdClasses() {
  const queryClient = useQueryClient();
  const { data: acesso, isLoading: carregandoAcesso } = useAcesso();
  const pode = podeVer({ tipo: "modulo", modulo: "ebd" }, acesso);
  const podeGerenciar = podeVer({ tipo: "modulo", modulo: "ebd_turmas" }, acesso);

  const [busca, setBusca] = useState("");
  const [agrupado, setAgrupado] = useState(true);
  const [filtroCongregacao, setFiltroCongregacao] = useState<Set<string>>(new Set());
  const [colunas, setColunas] = useState<Set<ColunaKey>>(
    () => new Set(COLUNAS_TABELA.map((c) => c.chave)),
  );
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [ordem, setOrdem] = useState<OrdemKey>("nome");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(10);
  const [novaTurma, setNovaTurma] = useState(false);
  const [editando, setEditando] = useState<Turma | null>(null);
  const [verTurma, setVerTurma] = useState<Turma | null>(null);
  const [erroFormulario, setErroFormulario] = useState("");

  const consulta = useQuery({
    queryKey: ["ebd-turmas"],
    enabled: pode,
    queryFn: async () => {
      const [turmas, congregacoes, matriculas] = await Promise.all([
        supabase
          .from("ebd_turmas")
          .select("id, nome, congregacao_id, idade_min, idade_max")
          .order("nome"),
        supabase.from("congregacoes").select("id, nome").order("nome"),
        supabase.from("ebd_matriculas").select("turma_id"),
      ]);
      if (turmas.error) throw turmas.error;
      if (congregacoes.error) throw congregacoes.error;
      if (matriculas.error) throw matriculas.error;

      const nomePorId = new Map((congregacoes.data ?? []).map((c) => [c.id, c.nome]));
      const contagem = new Map<string, number>();
      for (const m of matriculas.data ?? []) {
        contagem.set(m.turma_id, (contagem.get(m.turma_id) ?? 0) + 1);
      }

      const linhas: Turma[] = (turmas.data ?? []).map((t) => ({
        id: t.id,
        nome: t.nome,
        congregacaoId: t.congregacao_id,
        congregacao: nomePorId.get(t.congregacao_id) ?? "—",
        idadeMin: t.idade_min,
        idadeMax: t.idade_max,
        matriculados: contagem.get(t.id) ?? 0,
      }));
      return { linhas, congregacoes: congregacoes.data ?? [] };
    },
  });

  const todas = useMemo(() => consulta.data?.linhas ?? [], [consulta.data]);
  const congregacoes = consulta.data?.congregacoes ?? [];

  const salvar = useMutation({
    mutationFn: async (form: Formulario) => {
      const registro = {
        nome: form.nome.trim(),
        congregacao_id: form.congregacao_id,
        idade_min: Number(form.idade_min),
        idade_max: Number(form.idade_max),
      };

      if (editando) {
        const { error } = await supabase.from("ebd_turmas").update(registro).eq("id", editando.id);
        if (error) throw error;
        await registrarAuditoria({
          acao: "editou",
          entidade: "ebd_turma",
          entidadeId: editando.id,
          detalhe: registro.nome,
        });
        return;
      }

      const { data, error } = await supabase
        .from("ebd_turmas")
        .insert({
          nome: form.nome.trim(),
          congregacao_id: form.congregacao_id,
          idade_min: Number(form.idade_min),
          idade_max: Number(form.idade_max),
        })
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria({
        acao: "criou",
        entidade: "ebd_turma",
        entidadeId: data.id,
        detalhe: form.nome.trim(),
      });
    },
    onSuccess: async () => {
      setNovaTurma(false);
      setEditando(null);
      setErroFormulario("");
      await queryClient.invalidateQueries({ queryKey: ["ebd-turmas"] });
      await queryClient.invalidateQueries({ queryKey: ["ebd-painel"] });
    },
    onError: (erro) => setErroFormulario(mensagemErro(erro)),
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = todas.filter((t) => {
      if (filtroCongregacao.size > 0 && !filtroCongregacao.has(t.congregacao)) return false;
      if (!termo) return true;
      return [t.nome, t.congregacao].some((v) => v.toLowerCase().includes(termo));
    });
    const sinal = direcao === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (ordem === "faixa") return (a.idadeMin - b.idadeMin) * sinal;
      const va = ordem === "nome" ? a.nome : a.congregacao;
      const vb = ordem === "nome" ? b.nome : b.congregacao;
      return va.localeCompare(vb, "pt-BR") * sinal;
    });
  }, [todas, busca, filtroCongregacao, ordem, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = filtradas.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Turma[]>();
    for (const t of daPagina) mapa.set(t.congregacao, [...(mapa.get(t.congregacao) ?? []), t]);
    return [...mapa];
  }, [daPagina]);

  const colSpan = 2 + colunas.size;

  const ordenar = (chave: OrdemKey) => {
    if (chave === ordem) setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setOrdem(chave);
      setDirecao("asc");
    }
  };

  const linhaTurma = (t: Turma) => (
    <TableRow key={t.id} className="border-jt-line hover:bg-jt-panel-2">
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-jt-blue text-white">
            <GraduationCap className="h-4 w-4" aria-hidden />
          </div>
          <span className="font-medium text-jt-text">{t.nome}</span>
        </div>
      </TableCell>
      {colunas.has("congregacao") ? (
        <TableCell>
          <Badge variant="outline" className="gap-1.5 border-jt-line font-normal text-jt-text">
            <Church className="h-3 w-3 text-jt-muted" aria-hidden />
            {t.congregacao}
          </Badge>
        </TableCell>
      ) : null}
      {colunas.has("faixa") ? (
        <TableCell className="num whitespace-nowrap text-jt-muted">
          {t.idadeMin} a {t.idadeMax} anos
        </TableCell>
      ) : null}
      {colunas.has("matriculados") ? (
        <TableCell className="num text-jt-muted">{t.matriculados}</TableCell>
      ) : null}
      <TableCell>
        <div className="flex items-center gap-1">
          <PillButton
            variante="outline"
            onClick={() => setVerTurma(t)}
            className="h-8 rounded-full px-3 text-xs"
          >
            Ver matriculados
          </PillButton>
          {podeGerenciar ? (
            <button
              type="button"
              aria-label={`Editar ${t.nome}`}
              onClick={() => {
                setEditando(t);
                setErroFormulario("");
                setNovaTurma(true);
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-jt-muted transition hover:bg-jt-panel-2 hover:text-jt-text"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );

  if (carregandoAcesso) {
    return (
      <>
        <PageHeader titulo="Classes — EBD" />
        <Carregando />
      </>
    );
  }

  if (!pode) {
    return (
      <>
        <PageHeader titulo="Classes — EBD" />
        <SemPermissao mensagem="Sua conta não tem permissão de liderança para ver a EBD." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Classes — EBD"
        contagem={
          <Badge variant="outline" className="num border-jt-line font-medium text-jt-muted">
            {filtradas.length} de {todas.length}
          </Badge>
        }
      />

      <TableShell>
        <TableToolbar>
          <TableSearch
            valor={busca}
            onChange={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Buscar por classe, congregação…"
          />

          <TableToolbarActions>
            <FilterMenu contador={filtroCongregacao.size} largura="w-56">
              <DropdownMenuLabel>Congregação</DropdownMenuLabel>
              {congregacoes.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={filtroCongregacao.has(c.nome)}
                  onCheckedChange={(marcado) => {
                    setPagina(1);
                    setFiltroCongregacao((atual) => alternarNoSet(atual, c.nome, marcado === true));
                  }}
                >
                  {c.nome}
                </DropdownMenuCheckboxItem>
              ))}
            </FilterMenu>

            <ColumnsMenu
              colunas={COLUNAS_TABELA}
              visiveis={colunas}
              onToggle={(chave, marcada) =>
                setColunas((atual) => alternarNoSet(atual, chave, marcada))
              }
            />

            <GroupToggleButton
              agrupado={agrupado}
              rotulo="Agrupar por congregação"
              onToggle={() => setAgrupado((g) => !g)}
            />

            {podeGerenciar ? (
              <PillButton
                onClick={() => {
                  setEditando(null);
                  setErroFormulario("");
                  setNovaTurma(true);
                }}
                className="h-9 rounded-full px-4 text-[13px]"
              >
                <Plus className="h-4 w-4" aria-hidden /> Nova classe
              </PillButton>
            ) : null}
          </TableToolbarActions>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-jt-line hover:bg-transparent">
                <SortableHead
                  rotulo="Classe"
                  chave="nome"
                  atual={ordem}
                  direcao={direcao}
                  onOrdenar={ordenar}
                />
                {colunas.has("congregacao") ? (
                  <SortableHead
                    rotulo="Congregação"
                    chave="congregacao"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("faixa") ? (
                  <SortableHead
                    rotulo="Faixa etária"
                    chave="faixa"
                    atual={ordem}
                    direcao={direcao}
                    onOrdenar={ordenar}
                  />
                ) : null}
                {colunas.has("matriculados") ? (
                  <TableHead className="text-jt-muted">Matriculados</TableHead>
                ) : null}
                <TableHead className="text-jt-muted">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {consulta.isLoading ? (
                <EmptyRow colSpan={colSpan}>Carregando…</EmptyRow>
              ) : consulta.isError ? (
                <EmptyRow colSpan={colSpan}>
                  Não foi possível carregar as classes. Tente novamente em instantes.
                </EmptyRow>
              ) : filtradas.length === 0 ? (
                <EmptyRow colSpan={colSpan}>Nenhuma classe corresponde aos filtros.</EmptyRow>
              ) : agrupado ? (
                grupos.map(([congregacao, doGrupo], i) => (
                  <Fragment key={congregacao}>
                    <GroupHeaderRow
                      rotulo={congregacao}
                      contagem={doGrupo.length}
                      indice={i}
                      colSpan={colSpan}
                      recolhido={recolhidos.has(congregacao)}
                      onToggle={() =>
                        setRecolhidos((atual) =>
                          alternarNoSet(atual, congregacao, !atual.has(congregacao)),
                        )
                      }
                    />
                    {recolhidos.has(congregacao) ? null : doGrupo.map(linhaTurma)}
                  </Fragment>
                ))
              ) : (
                daPagina.map(linhaTurma)
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          total={filtradas.length}
          tamanhoPagina={tamanhoPagina}
          onPagina={(atualizar) => setPagina((p) => atualizar(Math.min(p, totalPaginas)))}
          onTamanhoPagina={(n) => {
            setTamanhoPagina(n);
            setPagina(1);
          }}
          unidade="registros"
        />
      </TableShell>

      <TurmaDialog
        aberto={novaTurma}
        onOpenChange={(v) => {
          setNovaTurma(v);
          if (!v) setEditando(null);
        }}
        editando={editando}
        congregacoes={congregacoes}
        onSalvar={(form) => salvar.mutate(form)}
        salvando={salvar.isPending}
        erro={erroFormulario}
      />

      <VerTurmaDialog turma={verTurma} onFechar={() => setVerTurma(null)} />
    </>
  );
}
