import {
  CalendarDays,
  ClipboardCheck,
  Church,
  FolderClosed,
  GraduationCap,
  KanbanSquare,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Fonte única da navegação do AD CRM.
 * A mesma estrutura alimenta a barra lateral, os cartões do Menu inicial
 * e as migalhas de pão. Registrar aqui basta para aparecer nos três lugares.
 */

export type ModuleKey =
  | "membros"
  | "membros_gerenciar"
  | "congregacoes"
  | "congregacoes_gerenciar"
  | "ebd"
  | "ebd_chamada"
  | "ebd_turmas"
  | "calendario"
  | "papo_reto"
  | "papo_reto_gerenciar"
  | "projetos"
  | "projetos_gerenciar"
  | "arquivos"
  | "arquivos_gerenciar"
  | "suporte"
  | "configuracoes";

export type Permissao =
  { tipo: "todos" } | { tipo: "admin" } | { tipo: "modulo"; modulo: ModuleKey };

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
export const SO_ADMIN: Permissao = { tipo: "admin" };
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
        rota: "/membros",
        rotulo: "Membros",
        descricao: "Painel e lista de quem já passou pelo cadastro.",
        icone: Users,
        permissao: modulo("membros"),
        filhos: [
          {
            rota: "/membros/painel",
            rotulo: "Painel",
            descricao: "Resumo dos cadastros do ministério.",
            icone: Users,
            permissao: modulo("membros"),
          },
          {
            rota: "/membros/lista",
            rotulo: "Lista",
            descricao: "Todos os membros cadastrados.",
            icone: Users,
            permissao: modulo("membros"),
          },
        ],
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
        descricao: "Classes, aulas e frequência da Escola Bíblica Dominical.",
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
            rota: "/ebd/classes",
            rotulo: "Classes",
            descricao: "Classes da EBD e seus matriculados.",
            icone: GraduationCap,
            permissao: modulo("ebd"),
          },
          {
            rota: "/ebd/cadastrar-aulas",
            rotulo: "Cadastrar aulas",
            descricao: "Agende as aulas de cada turma.",
            icone: GraduationCap,
            permissao: modulo("ebd"),
          },
        ],
      },
      {
        rota: "/calendario",
        rotulo: "Calendário",
        descricao: "Aulas, papos retos e horários abertos em um mês só.",
        icone: CalendarDays,
        permissao: modulo("calendario"),
      },
      {
        rota: "/novosprojetos",
        rotulo: "Novos projetos",
        descricao: "Quadro dos projetos do ministério, da ideia à entrega.",
        icone: KanbanSquare,
        permissao: modulo("projetos"),
      },
      {
        rota: "/arquivos",
        rotulo: "Arquivos",
        descricao: "Documentos e mídias do ministério, organizados por pasta.",
        icone: FolderClosed,
        permissao: modulo("arquivos"),
      },
      {
        rota: "/papo-reto",
        rotulo: "Papo reto",
        descricao: "Agende uma conversa com a liderança do ministério.",
        icone: MessageCircle,
        permissao: modulo("papo_reto"),
        filhos: [
          {
            rota: "/papo-reto/agendar",
            rotulo: "Agendar",
            descricao: "Escolha um horário aberto e mande seu assunto.",
            icone: MessageCircle,
            permissao: modulo("papo_reto"),
          },
          {
            rota: "/papo-reto/meus-agendamentos",
            rotulo: "Meus agendamentos",
            descricao: "Suas conversas pedidas, confirmadas e realizadas.",
            icone: MessageCircle,
            permissao: modulo("papo_reto"),
          },
          {
            rota: "/papo-reto/cadastrar-horario",
            rotulo: "Cadastrar horário",
            descricao: "Abra dia, sala e horários para os membros.",
            icone: MessageCircle,
            permissao: modulo("papo_reto_gerenciar"),
          },
          {
            rota: "/papo-reto/aprovacoes",
            rotulo: "Aprovações",
            descricao: "Solicitações de conversa aguardando resposta.",
            icone: MessageCircle,
            permissao: modulo("papo_reto_gerenciar"),
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
        descricao: "Seus dados, acesso e preferências da conta.",
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
          {
            rota: "/perfil/acessos",
            rotulo: "Meus acessos",
            descricao: "Módulos liberados para a sua conta.",
            icone: UserRound,
            permissao: TODOS,
          },
          {
            rota: "/perfil/painel-adm",
            rotulo: "Painel administrativo",
            descricao: "Todas as telas do CRM em um lugar só.",
            icone: LayoutGrid,
            permissao: SO_ADMIN,
          },
        ],
      },
      {
        rota: "/suporte",
        rotulo: "Suporte",
        descricao: "Histórico de ações registradas no CRM.",
        icone: LifeBuoy,
        permissao: modulo("suporte"),
        filhos: [
          {
            rota: "/suporte/auditoria",
            rotulo: "Auditoria",
            descricao: "Ações que alteram dado no CRM: quem fez, o quê e quando.",
            icone: LifeBuoy,
            permissao: modulo("suporte"),
          },
          {
            rota: "/suporte/ajuda",
            rotulo: "Ajuda",
            descricao: "Como falar com quem cuida do CRM.",
            icone: LifeBuoy,
            permissao: modulo("suporte"),
          },
        ],
      },
      {
        rota: "/configuracoes",
        rotulo: "Configurações",
        descricao: "Usuários, funções e acessos do sistema.",
        icone: Settings,
        permissao: modulo("configuracoes"),
        filhos: [
          {
            rota: "/configuracoes/usuarios",
            rotulo: "Usuários",
            descricao: "Contas do CRM, funções e módulos liberados.",
            icone: Settings,
            permissao: modulo("configuracoes"),
          },
          {
            rota: "/configuracoes/sistema",
            rotulo: "Sistema",
            descricao: "Informações do ambiente e dos módulos.",
            icone: Settings,
            permissao: modulo("configuracoes"),
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
  if (permissao.tipo === "admin") return acesso.isAdmin;
  return acesso.isAdmin || acesso.modules.includes(permissao.modulo);
}

export function itensVisiveis(itens: NavItem[], acesso: Acesso | null | undefined): NavItem[] {
  return itens
    .filter((item) => podeVer(item.permissao, acesso))
    .map((item) => {
      if (!item.filhos) return item;
      return {
        ...item,
        filhos: item.filhos.filter((filho) => podeVer(filho.permissao, acesso)),
      };
    });
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
