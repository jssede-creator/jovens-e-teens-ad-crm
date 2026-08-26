import { supabase } from "@/integrations/supabase/client";

/** Registra uma ação relevante na trilha de auditoria. Nunca interrompe o fluxo. */
export async function registrarAuditoria(entrada: {
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhe?: string;
}) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    await supabase.from("auditoria").insert({
      user_id: user.id,
      user_nome:
        (user.user_metadata?.["nome"] as string | undefined) ?? user.email ?? "—",
      acao: entrada.acao,
      entidade: entrada.entidade,
      entidade_id: entrada.entidadeId ?? null,
      detalhe: entrada.detalhe ?? null,
    });
  } catch {
    // auditoria nunca deve quebrar a operação principal
  }
}
