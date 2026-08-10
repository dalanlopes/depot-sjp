import type { Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  MECANICO: "Mecânico",
  ANALISTA_PROGRAMACAO: "Analista de Programação/Matriz/Filial",
  ANALISTA_FATURAMENTO: "Analista de Faturamento",
  GESTOR: "Gestor",
  VISUALIZADOR: "Visualizador (somente leitura)",
};

export type Tab =
  | "dashboard"
  | "estoque"
  | "oficina"
  | "ocorrencias"
  | "programacao"
  | "coletas"
  | "importacao"
  | "usuarios";

export const ALL_TABS: Tab[] = [
  "dashboard",
  "estoque",
  "oficina",
  "ocorrencias",
  "programacao",
  "coletas",
  "importacao",
  "usuarios",
];

export const TAB_LABELS: Record<Tab, { label: string; icon: string }> = {
  dashboard: { label: "Indicadores", icon: "📊" },
  estoque: { label: "Estoque", icon: "📦" },
  oficina: { label: "Oficina", icon: "🔧" },
  ocorrencias: { label: "Ocorrências", icon: "⚠️" },
  programacao: { label: "Programação", icon: "🗓️" },
  coletas: { label: "Coletas", icon: "🚚" },
  importacao: { label: "Importação", icon: "⬆️" },
  usuarios: { label: "Usuários", icon: "👤" },
};

// Abas padrão por perfil. Usado como sugestão ao criar usuário e como
// fallback para usuários antigos que ainda não têm "tabs" definido.
export const TAB_ACCESS: Record<Role, Tab[]> = {
  MECANICO: ["oficina", "ocorrencias"],
  ANALISTA_PROGRAMACAO: ["programacao", "estoque"],
  ANALISTA_FATURAMENTO: ["oficina"],
  GESTOR: [
    "dashboard",
    "estoque",
    "oficina",
    "ocorrencias",
    "programacao",
    "coletas",
    "importacao",
    "usuarios",
  ],
  VISUALIZADOR: [
    "dashboard",
    "estoque",
    "oficina",
    "ocorrencias",
    "programacao",
    "coletas",
  ],
};

interface SessionLike {
  role: Role;
  tabs?: Tab[] | null;
  podeVerFaturamento?: boolean;
}

// Resolve as abas efetivas do usuário: usa a lista salva no cadastro dele;
// se ele não tiver nenhuma definida, cai no padrão do perfil (compatibilidade
// com usuários antigos).
export function resolveTabs(role: Role, tabs?: string[] | null): Tab[] {
  if (tabs && tabs.length > 0) {
    return tabs.filter((t): t is Tab => (ALL_TABS as string[]).includes(t));
  }
  return TAB_ACCESS[role];
}

export function canAccessTab(session: SessionLike, tab: Tab): boolean {
  const tabs = session.tabs && session.tabs.length > 0 ? session.tabs : TAB_ACCESS[session.role];
  return tabs.includes(tab);
}

// Só Gestor e Analista de Faturamento veem/editam valores financeiros por
// padrão do perfil. Qualquer outro usuário pode receber essa permissão extra
// individualmente (pode_ver_faturamento) para ver (não editar) o faturamento
// da Oficina.
export function canViewFinance(session: SessionLike): boolean {
  return (
    session.role === "GESTOR" ||
    session.role === "ANALISTA_FATURAMENTO" ||
    !!session.podeVerFaturamento
  );
}

export function canEditFinance(session: SessionLike): boolean {
  return session.role === "GESTOR" || session.role === "ANALISTA_FATURAMENTO";
}

export function canRegisterRepair(role: Role): boolean {
  return role === "MECANICO" || role === "GESTOR";
}

export function canImportData(role: Role): boolean {
  return role === "GESTOR";
}

export function canRegisterCollection(role: Role): boolean {
  return role === "GESTOR";
}

export function defaultTabFor(session: SessionLike): Tab {
  const tabs = session.tabs && session.tabs.length > 0 ? session.tabs : TAB_ACCESS[session.role];
  return tabs[0];
}

export function canManageUsers(role: Role): boolean {
  return role === "GESTOR";
}

export function canDeleteOcorrencia(role: Role): boolean {
  return role === "GESTOR";
}

// Corrigir o padrão (AL/CG/OU) de um container já cadastrado, direto no
// popout de reparados da Oficina. Liberado para quem também lança os valores
// de faturamento (Gestor e Analista de Faturamento).
export function canEditContainerData(role: Role): boolean {
  return role === "GESTOR" || role === "ANALISTA_FATURAMENTO";
}

// Perfil Visualizador tem acesso somente leitura: nunca pode criar, editar
// ou excluir nada, mesmo que a aba esteja liberada para ele.
export function isViewOnly(role: Role): boolean {
  return role === "VISUALIZADOR";
}

export function canRegisterOcorrencia(role: Role): boolean {
  return !isViewOnly(role);
}

export function canEditProgramacao(role: Role): boolean {
  return !isViewOnly(role);
}
