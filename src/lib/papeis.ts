import { supabase } from "@/integrations/supabase/client";
import type { ModuleKey } from "@/lib/nav";

/**
 * Papéis e permissões.
 * Um papel é um conjunto nomeado de permissões; a conta pode ter vários. O
 * acesso efetivo continua sendo decidido pelo banco (has_module_access), que
 * soma admin + permissões soltas + permissões vindas dos papéis.
 */

export type Papel = {
  id: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  permissoes: ModuleKey[];
  usuarios: { id: string; nome: string }[];
};

export type ContaSistema = {
  userId: string;
  nome: string;
  email: string;
  admin: boolean;
  papeis: string[];
  /** Permissões soltas, fora de qualquer papel. */
  extras: ModuleKey[];
};

/** Papéis com suas permissões e quem os carrega, além das contas do CRM. */
export async function carregarPapeis() {
  const [papeis, permissoes, vinculos, cadastros, admins, modulos] = await Promise.all([
    supabase.from("papeis").select("id, nome, descricao, sistema").order("nome"),
    supabase.from("papel_permissoes").select("papel_id, module_key"),
    supabase.from("usuario_papeis").select("user_id, papel_id"),
    supabase
      .from("cadastros")
      .select("user_id, nome_completo, email")
      .not("user_id", "is", null)
      .order("nome_completo"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("module_access").select("user_id, module_key"),
  ]);
  for (const r of [papeis, permissoes, vinculos, cadastros, admins, modulos]) {
    if (r.error) throw r.error;
  }

  const ehAdmin = new Set(
    (admins.data ?? []).filter((a) => a.role === "admin").map((a) => a.user_id),
  );

  // Contas: quem tem cadastro vinculado, mais quem só aparece em papéis ou acessos.
  const contas = new Map<string, ContaSistema>();
  for (const c of cadastros.data ?? []) {
    const id = c.user_id as string;
    if (contas.has(id)) continue;
    contas.set(id, {
      userId: id,
      nome: c.nome_completo,
      email: c.email,
      admin: ehAdmin.has(id),
      papeis: [],
      extras: [],
    });
  }
  const garantir = (id: string) => {
    if (!contas.has(id)) {
      contas.set(id, {
        userId: id,
        nome: "Conta sem cadastro",
        email: id,
        admin: ehAdmin.has(id),
        papeis: [],
        extras: [],
      });
    }
    return contas.get(id)!;
  };

  for (const v of vinculos.data ?? []) garantir(v.user_id).papeis.push(v.papel_id);
  for (const m of modulos.data ?? []) garantir(m.user_id).extras.push(m.module_key as ModuleKey);
  for (const id of ehAdmin) garantir(id);

  const lista: Papel[] = (papeis.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    sistema: p.sistema,
    permissoes: (permissoes.data ?? [])
      .filter((x) => x.papel_id === p.id)
      .map((x) => x.module_key as ModuleKey),
    usuarios: [...contas.values()]
      .filter((c) => c.papeis.includes(p.id))
      .map((c) => ({ id: c.userId, nome: c.nome })),
  }));

  return { papeis: lista, contas: [...contas.values()] };
}

/** Troca as permissões de um papel de uma vez só. */
export async function salvarPermissoes(papelId: string, permissoes: ModuleKey[]) {
  const { error: erroLimpeza } = await supabase
    .from("papel_permissoes")
    .delete()
    .eq("papel_id", papelId);
  if (erroLimpeza) throw erroLimpeza;
  if (permissoes.length === 0) return;

  const { error } = await supabase
    .from("papel_permissoes")
    .insert(permissoes.map((module_key) => ({ papel_id: papelId, module_key })));
  if (error) throw error;
}

export async function vincularPapel(userId: string, papelId: string, vincular: boolean) {
  if (vincular) {
    const { error } = await supabase
      .from("usuario_papeis")
      .insert({ user_id: userId, papel_id: papelId });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("usuario_papeis")
    .delete()
    .eq("user_id", userId)
    .eq("papel_id", papelId);
  if (error) throw error;
}
