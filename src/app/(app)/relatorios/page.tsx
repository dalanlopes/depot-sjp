import { requireTab } from "@/lib/guard";
import { canAccessTab } from "@/lib/roles";
import RelatoriosClient from "./relatorios-client";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const session = await requireTab("relatorios");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Relatórios</h1>
      <RelatoriosClient
        acesso={{
          estoque: canAccessTab(session, "estoque"),
          oficina: canAccessTab(session, "oficina"),
          ocorrencias: canAccessTab(session, "ocorrencias"),
          programacao: canAccessTab(session, "programacao"),
          coletas: canAccessTab(session, "coletas"),
          entradas: canAccessTab(session, "estoque") || canAccessTab(session, "coletas"),
          saidasGeral: canAccessTab(session, "coletas"),
          saidasExternas: canAccessTab(session, "coletas"),
        }}
      />
    </div>
  );
}
