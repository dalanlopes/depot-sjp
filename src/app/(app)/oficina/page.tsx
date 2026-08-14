import { requireTab } from "@/lib/guard";
import { canRegisterRepair, canViewFinance, canEditFinance, canEditContainerData } from "@/lib/roles";
import OficinaClient from "./oficina-client";

export const dynamic = "force-dynamic";

export default async function OficinaPage() {
  const session = await requireTab("oficina");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Oficina · Reparos</h1>
      <OficinaClient
        canRegister={canRegisterRepair(session)}
        canFinance={canViewFinance(session)}
        canEditFinance={canEditFinance(session)}
        canEditPadrao={canEditContainerData(session.role)}
      />
    </div>
  );
}
