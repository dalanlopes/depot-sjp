import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./auth";
import { canAccessTab, defaultTabFor, type Tab } from "./roles";

const TAB_HREF: Record<Tab, string> = {
  dashboard: "/dashboard",
  estoque: "/estoque",
  oficina: "/oficina",
  ocorrencias: "/ocorrencias",
  programacao: "/programacao",
  coletas: "/coletas",
  relatorios: "/relatorios",
  importacao: "/importacao",
  usuarios: "/usuarios",
};

export async function requireTab(tab: Tab): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessTab(session, tab)) {
    redirect(TAB_HREF[defaultTabFor(session)]);
  }
  return session;
}
