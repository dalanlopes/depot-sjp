import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { defaultTabFor } from "@/lib/roles";

const TAB_HREF: Record<string, string> = {
  dashboard: "/dashboard",
  estoque: "/estoque",
  oficina: "/oficina",
  ocorrencias: "/ocorrencias",
  programacao: "/programacao",
  coletas: "/coletas",
  importacao: "/importacao",
};

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  const tab = defaultTabFor(session);
  redirect(TAB_HREF[tab]);
}
