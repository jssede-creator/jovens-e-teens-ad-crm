import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Acesso, ModuleKey } from "@/lib/nav";

/**
 * Carrega uma única vez o acesso da conta: { isAdmin, modules[] }.
 * Serve só para filtrar menu e botões — a validação real é sempre do banco (RLS).
 */
export function useAcesso() {
  return useQuery<Acesso>({
    queryKey: ["acesso"],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao.user?.id;
      if (!userId) return { isAdmin: false, modules: [] };

      const [papeis, modulos] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("module_access").select("module_key").eq("user_id", userId),
      ]);

      const isAdmin = (papeis.data ?? []).some((p) => p.role === "admin");
      const modules = (modulos.data ?? []).map((m) => m.module_key as ModuleKey);
      return { isAdmin, modules };
    },
  });
}
