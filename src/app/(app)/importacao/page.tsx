import { requireTab } from "@/lib/guard";
import ImportacaoClient from "./importacao-client";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  await requireTab("importacao");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Importação de Dados</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Envie uma planilha (CSV/XLSX) para atualizar cadastros e registrar entradas em massa.
        Colunas esperadas: <code>Container</code>, <code>Tipo</code>, <code>Armador</code>, <code>Entrada</code>, <code>Status</code>, <code>Estimativa</code>, <code>Carga</code>.
      </p>
      <ImportacaoClient />
    </div>
  );
}
