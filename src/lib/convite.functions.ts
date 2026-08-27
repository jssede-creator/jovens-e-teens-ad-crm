import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Convida por e-mail alguém cadastrado pela liderança.
 * Só admin pode disparar; a pessoa define a própria senha pelo link.
 */
export const convidarPessoa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ email: z.string().email(), nome: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) return { enviado: false as const };

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { nome: data.nome },
      });
      if (error) return { enviado: false as const };
      return { enviado: true as const };
    } catch {
      return { enviado: false as const };
    }
  });
