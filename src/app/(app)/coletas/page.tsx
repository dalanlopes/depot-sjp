import { requireTab } from "@/lib/guard";
import ColetasClient from "./coletas-client";

export const dynamic = "force-dynamic";

export default async function ColetasPage() {
  await requireTab("coletas");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Coletas</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Registre a saída do container (código CM e data) e acompanhe o relatório de saídas.
      </p>
      <ColetasClient />
    </div>
  );
}
