import type { Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  MECANICO: "Mecânico",
  ANALISTA_PROGRAMACAO: "Analista de Programação/Matriz/Filial",
  ANALISTA_FATURAMENTO: "Analista de Faturamento",
  GESTOR: "Gestor",
};

export type Tab =
  | "dashboard"
  | "estoque"
  | "oficina"
  | "ocorrencias"
  | "programacao"
  | "coletas"
  | "importacao";

// Abas visíveis por perfil.
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
  ],
};

export function canAccessTab(role: Role, tab: Tab): boolean {
  return TAB_ACCESS[role].includes(tab);
}

// Só Gestor e Analista de Faturamento podem ver/editar valores financeiros.
export function canViewFinance(role: Role): boolean {
  return role === "GESTOR" || role === "ANALISTA_FATURAMENTO";
}

export function canEditFinance(role: Role): boolean {
  return role === "GESTOR" || role === "ANALISTA_FATURAMENTO";
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

export function defaultTabFor(role: Role): Tab {
  return TAB_ACCESS[role][0];
}
