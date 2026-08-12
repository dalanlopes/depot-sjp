import { requireTab } from "@/lib/guard";
import { canRegisterCollection, canImportData } from "@/lib/roles";
import ColetasClient from "./coletas-client";

export const dynamic = "force-dynamic";

export default async function ColetasPage() {
  const session = await requireTab("coletas");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Coletas</h1>
      <ColetasClient
        podeConfirmar={canRegisterCollection(session.role)}
        podeExcluirSaidaExterna={canImportData(session.role)}
      />
    </div>
  );
}
