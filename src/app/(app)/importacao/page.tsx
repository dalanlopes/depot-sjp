import { requireTab } from "@/lib/guard";
import ImportacaoClient from "./importacao-client";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  await requireTab("importacao");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Importação de Dados</h1>
      <ImportacaoClient />
    </div>
  );
}
