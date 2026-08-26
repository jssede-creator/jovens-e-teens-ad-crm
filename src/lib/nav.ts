import {
  ClipboardCheck,
  Church,
  GraduationCap,
  LayoutGrid,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Fonte única da navegação do AD CRM.
 * A mesma estrutura alimenta a barra lateral, os cartões do Menu inicial
 * e as migalhas de pão. Registrar aqui basta para aparecer nos três lugares.
 */

export type ModuleKey =
  | "congregacoes"
  | "congregacoes_gerenciar"
  | "ebd"
  | "ebd_chamada"
  | "ebd_turmas";

export type Permissao = { tipo: "todos" } | { tipo: "modulo"; modulo: ModuleKey };

export type NavItem = {
  rota: string;
  rotulo: string;
  descricao: string;
  icone: LucideIcon;
  permissao: Permissao;
  filhos?: NavItem[];
};

export type NavGrupo = {
  titulo: string;
  itens: NavItem[];
};

export const TODOS: Permissao = { tipo: "todos" };
const modulo = (m: ModuleKey): Permissao => ({ tipo: "modulo", modulo: m });

export const HOME_ROTA = "/inicio";

export const navegacao: NavGrupo[] = [
  {
    titulo: "Menu",
    itens: [
      {
        rota: "/inicio",
        rotulo: "Menu inicial",
        descricao: "Atalhos, pendências e resumo do seu acesso.",
        icone: LayoutGrid,
        permissao: TODOS,
      },
      {
        rota: "/",
        rotulo: "Complementar cadastro",
        descricao: "Complete ou revise os seus dados no ministério.",
        icone: ClipboardCheck,
        permissao: TODOS,
      },
      {
        rota: "/congregacoes",
        rotulo: "Congregações",
        descricao: "Congregações cadastradas e seus membros vinculados.",
        icone: Church,
        permissao: modulo("congregacoes"),
        filhos: [
          {
            rota: "/congregacoes/painel",
            rotulo: "Painel",
            descricao: "Visão geral das congregações do ministério.",
            icone: Church,
            permissao: modulo("congregacoes"),
          },
          {
            rota: "/congregacoes/lista",
            rotulo: "Lista",
            descricao: "Todas as congregações cadastradas.",
            icone: Church,
            permissao: modulo("congregacoes"),
          },
        ],
      },
      {
        rota: "/ebd",
        rotulo: "EBD",
        descricao: "Turmas, aulas e frequência da Escola Bíblica Dominical.",
        icone: GraduationCap,
        permissao: modulo("ebd"),
        filhos: [
          {
            rota: "/ebd/painel",
            rotulo: "Painel",
            descricao: "Resumo das turmas e da frequência.",
            icone: GraduationCap,
            permissao: modulo("ebd"),
          },
          {
            rota: "/ebd/turmas",
            rotulo: "Turmas",
            descricao: "Turmas da EBD e seus matriculados.",
            icone: GraduationCap,
            permissao: modulo("ebd"),
          },
          {
            rota: "/ebd/aulas",
            rotulo: "Cadastrar aulas",
            descricao: "Agende as aulas de cada turma.",
            icone: GraduationCap,
            permissao: modulo("ebd"),
          },
        ],
      },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      {
        rota: "/perfil",
        rotulo: "Meu usuário",
        descricao: "Meus dados e informações da conta.",
        icone: UserRound,
        permissao: TODOS,
        filhos: [
          {
            rota: "/perfil",
            rotulo: "Meus dados",
            descricao: "Informações da sua conta no ministério.",
            icone: UserRound,
            permissao: TODOS,
          },
        ],
      },
    ],
  },
];

export type Acesso = { isAdmin: boolean; modules: ModuleKey[] };

export function podeVer(permissao: Permissao, acesso: Acesso | null | undefined): boolean {
  if (permissao.tipo === "todos") return true;
  if (!acesso) return false;
  return acesso.isAdmin || acesso.modules.includes(permissao.modulo);
}

export function itensVisiveis(itens: NavItem[], acesso: Acesso | null | undefined): NavItem[] {
  return itens
    .filter((item) => podeVer(item.permissao, acesso))
    .map((item) => ({
      ...item,
      filhos: item.filhos?.filter((filho) => podeVer(filho.permissao, acesso)),
    }));
}

function todosItens(): NavItem[] {
  const saida: NavItem[] = [];
  for (const grupo of navegacao) {
    for (const item of grupo.itens) {
      saida.push(item);
      for (const filho of item.filhos ?? []) saida.push(filho);
    }
  }
  return saida;
}

export function encontrarItem(rota: string): NavItem | undefined {
  return todosItens().find((item) => item.rota === rota);
}

export type Migalha = { rotulo: string; rota?: string };

/** Migalhas no formato `Menu inicial › Área › Subpágina`. */
export function migalhas(pathname: string): Migalha[] {
  if (pathname === HOME_ROTA) return [];
  const raiz: Migalha = { rotulo: "Menu inicial", rota: HOME_ROTA };

  for (const grupo of navegacao) {
    for (const item of grupo.itens) {
      const filho = item.filhos?.find((f) => f.rota === pathname);
      if (filho && filho.rota !== item.rota) {
        return [raiz, { rotulo: item.rotulo, rota: item.rota }, { rotulo: filho.rotulo }];
      }
      if (item.rota === pathname) {
        return [raiz, { rotulo: item.rotulo }];
      }
    }
  }
  return [raiz];
}
