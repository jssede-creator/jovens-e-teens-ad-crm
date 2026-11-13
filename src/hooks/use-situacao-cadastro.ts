import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Situação do cadastro da própria conta no ministério:
 * - "sem": ainda não fez o cadastro;
 * - "basico": fez o cadastro, falta a parte complementar;
 * - "completo": cadastro e complementares preenchidos.
 */
export type SituacaoCadastro = "sem" | "basico" | "completo";

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
      const { data, error } = await supabase
        .from("cadastros")
        .select("compartilhou_dados_complementares, congregacoes(nome)")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { situacao: "sem", congregacao: "—" };
      return {
        situacao: data.compartilhou_dados_complementares ? "completo" : "basico",
        congregacao: (data.congregacoes as unknown as { nome: string } | null)?.nome ?? "—",
      };
    },
  });
}
