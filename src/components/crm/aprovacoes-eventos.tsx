import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";

import { PillButton } from "@/components/cadastro/ui";
import { Comprovante, type DadosComprovante } from "@/components/crm/comprovante";
import { AvatarIniciais, Bloco, VazioBloco } from "@/components/crm/pagina";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { iniciais } from "@/lib/ebd";
import {
  aprovarInscricao,
  carregarPendentes,
  taxaFormatada,
  type Evento,
  type Inscricao,
} from "@/lib/eventos";
import { dataParaBR, mensagemErro } from "@/lib/formato";

/** Chave da consulta; fica sob ["eventos"] para atualizar junto com as reservas. */
const CHAVE_PENDENTES = ["eventos", "pendentes"] as const;

/** Quantas inscrições aguardam aprovação da liderança. */
function usePendentes(ativo: boolean) {
  return useQuery({
    queryKey: CHAVE_PENDENTES,
    enabled: ativo,
    queryFn: carregarPendentes,
  });
}

/**
 * Fila de aprovação da liderança: todas as inscrições com PIX pendente, de
 * todos os eventos, com o botão de aprovar na própria linha.
 */
export function AprovacoesEventos({
  eventos,
  ocultarVazio = false,
}: {
  eventos: Evento[];
  ocultarVazio?: boolean;
}) {
  const queryClient = useQueryClient();
  const consulta = usePendentes(true);
  const [erro, setErro] = useState("");
  const [comprovante, setComprovante] = useState<DadosComprovante | null>(null);

  const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
  const pendentes = (consulta.data ?? []).filter((i) => eventoPorId.has(i.evento_id));

  const aprovar = useMutation({
    mutationFn: async (inscricao: Inscricao) => {
      const evento = eventoPorId.get(inscricao.evento_id) ?? null;
      const gravado = await aprovarInscricao(inscricao, evento, true);
      return { inscricao, evento, ...gravado };
    },
    onSuccess: async ({ inscricao, evento, confirmadoEm, confirmadoPor }) => {
      setErro("");
      await queryClient.invalidateQueries({ queryKey: ["eventos"] });
      await queryClient.invalidateQueries({ queryKey: ["evento-inscritos", inscricao.evento_id] });
      if (evento) {
        setComprovante({
          codigo: inscricao.codigo ?? "—",
          participante: inscricao.nome,
          email: inscricao.email,
          evento: evento.titulo,
          data: evento.data,
          horaInicio: evento.hora_inicio,
          local: evento.local,
          taxa: evento.taxa,
          confirmadoEm,
          confirmadoPor,
        });
      }
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  if (ocultarVazio && pendentes.length === 0) return null;

  return (
    <>
      <Bloco
        titulo="Aprovações pendentes"
        descricao={
          consulta.isLoading
            ? "Carregando…"
            : pendentes.length === 0
              ? "Nenhum PIX aguardando conferência"
              : `${pendentes.length} inscrição(ões) aguardando a conferência do PIX`
        }
      >
        {consulta.isLoading ? (
          <VazioBloco>Carregando…</VazioBloco>
        ) : pendentes.length === 0 ? (
          <VazioBloco>Tudo em dia. Novas solicitações de eventos pagos aparecem aqui.</VazioBloco>
        ) : (
          <ul className="space-y-2">
            {pendentes.map((i) => {
              const evento = eventoPorId.get(i.evento_id);
              return (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-jt-line px-3 py-2.5"
                >
                  <AvatarIniciais texto={iniciais(i.nome)} tamanho="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-jt-text">{i.nome}</p>
                    <p className="num truncate text-xs text-jt-muted">
                      {evento?.titulo ?? "—"} · {evento ? dataParaBR(evento.data) : ""} · reservou
                      em {dataParaBR(i.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-jt-text">
                    {taxaFormatada(evento?.taxa ?? null)}
                  </span>
                  <PillButton
                    className="h-8 shrink-0 rounded-full px-3 text-xs"
                    disabled={aprovar.isPending}
                    onClick={() => aprovar.mutate(i)}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    {aprovar.isPending && aprovar.variables?.id === i.id ? "Aprovando…" : "Aprovar"}
                  </PillButton>
                </li>
              );
            })}
          </ul>
        )}
        {erro ? <p className="mt-2 text-xs text-jt-coral">{erro}</p> : null}
      </Bloco>

      <Dialog
        open={comprovante !== null}
        onOpenChange={(v) => (!v ? setComprovante(null) : undefined)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-none bg-transparent p-0 shadow-none sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Comprovante de inscrição</DialogTitle>
            <DialogDescription>Pagamento aprovado.</DialogDescription>
          </DialogHeader>
          {comprovante ? <Comprovante dados={comprovante} comemorar /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
