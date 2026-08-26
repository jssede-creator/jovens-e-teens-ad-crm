/** Máscaras e formatações em português do Brasil. */

const digitos = (valor: string) => valor.replace(/\D/g, "");

export function mascaraCPF(valor: string): string {
  const d = digitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function mascaraRG(valor: string): string {
  const d = digitos(valor).slice(0, 9);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1})$/, ".$1-$2");
}

export function mascaraTelefone(valor: string): string {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function mascaraCEP(valor: string): string {
  return digitos(valor)
    .slice(0, 8)
    .replace(/^(\d{5})(\d{1,3})$/, "$1-$2");
}

export const semMascara = digitos;

/** ISO (aaaa-mm-dd) → dd/mm/aaaa */
export function dataParaBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return "—";
  return `${dia}/${mes}/${ano}`;
}

/** dd/mm/aaaa → ISO (aaaa-mm-dd) */
export function dataParaISO(br: string): string | null {
  const d = digitos(br);
  if (d.length !== 8) return null;
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

export function mascaraData(valor: string): string {
  const d = digitos(valor).slice(0, 8);
  return d.replace(/^(\d{2})(\d)/, "$1/$2").replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
}

/** HH:MM */
export function hora(valor: string | null | undefined): string {
  if (!valor) return "—";
  return valor.slice(0, 5);
}

export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Mensagens de erro legíveis a partir de erros do banco. */
export function mensagemErro(erro: unknown): string {
  const e = erro as { code?: string; message?: string } | null;
  const msg = e?.message ?? "";
  if (!e) return "Não foi possível concluir a operação. Tente novamente.";
  if (e.code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "Sua conta não tem permissão para realizar esta ação.";
  }
  if (e.code === "23505" || /duplicate key/i.test(msg)) {
    return "Já existe um registro com estes dados.";
  }
  if (e.code === "23503" || /foreign key/i.test(msg)) {
    return "Este registro está em uso e não pode ser removido.";
  }
  if (e.code === "23514" || /check constraint/i.test(msg)) {
    return "Alguns dados informados não são válidos. Revise o formulário.";
  }
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/user already registered/i.test(msg)) return "Já existe uma conta com este e-mail.";
  if (/password should be/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  return "Não foi possível concluir a operação. Tente novamente.";
}
