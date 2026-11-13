import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Situação do cadastro da própria conta no ministério:
 * - "sem": ainda não fez o cadastro;
 * - "basico": fez o cadastro, mas não respondeu aos dados complementares;
 * - "completo": respondeu aos complementares, compartilhando ou não.
 */
export type SituacaoCadastro = "sem" | "basico" | "completo";

/** Complementares respondidos: compartilhou, ou disse que prefere não compartilhar. */
export function complementaresRespondidos(c: Record<string, unknown> | null | undefined) {
  return (
    c?.["compartilhou_dados_complementares"] === true || c?.["complementares_respondido"] === true
  );
}

/**
 * A chave fica sob ["meu-cadastro"]: quem salva o cadastro invalida essa raiz
 * e o menu e o Menu inicial se atualizam juntos.
 */
export function useSituacaoCadastro() {
  return useQuery({
    queryKey: ["meu-cadastro", "situacao"],
    queryFn: async (): Promise<{ situacao: SituacaoCadastro; congregacao: string }> => {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user?.id;
      if (!userId) return { situacao: "sem", congregacao: "—" };

      const consultar = (colunas: string) =>
        supabase.from("cadastros").select(colunas).eq("user_id", userId).maybeSingle();

      let resposta = await consultar(
        "compartilhou_dados_complementares, complementares_respondido, congregacoes(nome)",
      );
      // Banco ainda sem a coluna complementares_respondido (migração 20261114120000).
      if (resposta.error) {
        resposta = await consultar("compartilhou_dados_complementares, congregacoes(nome)");
      }
      if (resposta.error) throw resposta.error;

      const data = resposta.data as unknown as Record<string, unknown> | null;
      if (!data) return { situacao: "sem", congregacao: "—" };
      return {
        situacao: complementaresRespondidos(data) ? "completo" : "basico",
        congregacao: (data["congregacoes"] as { nome: string } | null)?.nome ?? "—",
      };
    },
  });
}
