import { requireTab } from "@/lib/guard";
import { canEditContainerData } from "@/lib/roles";
import EstoqueClient from "./estoque-client";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const session = await requireTab("estoque");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Estoque</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Listagem em tempo real conectada à Tabela Mestre de containers.
      </p>
      <EstoqueClient canEdit={canEditContainerData(session.role)} />
    </div>
  );
}
