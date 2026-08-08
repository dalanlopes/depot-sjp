import { requireTab } from "@/lib/guard";
import OcorrenciasClient from "./ocorrencias-client";

export const dynamic = "force-dynamic";

export default async function OcorrenciasPage() {
  await requireTab("ocorrencias");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Ocorrências</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Registre o motivo quando a meta diária de 35 reparos não for atingida.
      </p>
      <OcorrenciasClient />
    </div>
  );
}
