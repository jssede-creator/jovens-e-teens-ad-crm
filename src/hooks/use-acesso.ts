import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Acesso, ModuleKey } from "@/lib/nav";

export const CHAVE_ACESSO = ["acesso"] as const;

/**
 * Carrega o acesso da conta: { isAdmin, modules[] }.
 * Serve só para filtrar menu e botões — a validação real é sempre do banco (RLS).
 *
 * Nunca devolve "sem acesso" como resposta boa: se a sessão ainda não hidratou ou
 * a consulta falha, o hook erra e tenta de novo. Guardar um resultado vazio deixava
 * a barra lateral só com os itens abertos a todos até o próximo login.
 */
export function useAcesso() {
  const queryClient = useQueryClient();

  // Login, logout e renovação de token derrubam o cache do acesso.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") {
        queryClient.removeQueries({ queryKey: CHAVE_ACESSO });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: CHAVE_ACESSO });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return useQuery<Acesso>({
    queryKey: CHAVE_ACESSO,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 5000),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user?.id;
      if (!userId) throw new Error("Sessão ainda não disponível.");

      const [papeis, modulos] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("module_access").select("module_key").eq("user_id", userId),
      ]);
      if (papeis.error) throw papeis.error;
      if (modulos.error) throw modulos.error;

      const isAdmin = (papeis.data ?? []).some((p) => p.role === "admin");
      const modules = (modulos.data ?? []).map((m) => m.module_key as ModuleKey);
      return { isAdmin, modules };
    },
  });
}
