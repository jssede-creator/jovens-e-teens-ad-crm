import type { ModuleKey } from "@/lib/nav";

/** Permissões oferecidas na tela de Configurações, agrupadas por área. */
export const MODULOS: { chave: ModuleKey; rotulo: string; grupo: string }[] = [
  { chave: "membros", rotulo: "Ver membros", grupo: "Membros" },
  { chave: "membros_gerenciar", rotulo: "Gerenciar membros", grupo: "Membros" },
  { chave: "congregacoes", rotulo: "Ver congregações", grupo: "Congregações" },
  { chave: "congregacoes_gerenciar", rotulo: "Gerenciar congregações", grupo: "Congregações" },
  { chave: "ebd", rotulo: "Ver EBD", grupo: "EBD" },
  { chave: "ebd_turmas", rotulo: "Gerenciar turmas e aulas", grupo: "EBD" },
  { chave: "ebd_chamada", rotulo: "Fazer chamada", grupo: "EBD" },
  { chave: "calendario", rotulo: "Ver calendário", grupo: "Calendário" },
  { chave: "papo_reto", rotulo: "Usar papo reto", grupo: "Papo reto" },
  { chave: "papo_reto_gerenciar", rotulo: "Responder papo reto", grupo: "Papo reto" },
  { chave: "projetos", rotulo: "Ver projetos", grupo: "Projetos" },
  { chave: "projetos_gerenciar", rotulo: "Gerenciar projetos", grupo: "Projetos" },
  { chave: "arquivos", rotulo: "Ver arquivos", grupo: "Arquivos" },
  { chave: "arquivos_gerenciar", rotulo: "Enviar e excluir arquivos", grupo: "Arquivos" },
  { chave: "suporte", rotulo: "Ver suporte e histórico", grupo: "Sistema" },
  { chave: "configuracoes", rotulo: "Abrir configurações", grupo: "Sistema" },
];
