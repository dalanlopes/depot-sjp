import { requireTab } from "@/lib/guard";
import { canEditContainerData } from "@/lib/roles";
import EstoqueClient from "./estoque-client";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const session = await requireTab("estoque");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Estoque</h1>
      <EstoqueClient canEdit={canEditContainerData(session.role)} />
    </div>
  );
}
