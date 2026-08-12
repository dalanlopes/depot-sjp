import { requireTab } from "@/lib/guard";
import ImportacaoClient from "./importacao-client";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  await requireTab("importacao");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Importação de Dados</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Envie planilhas para atualizar o estoque em massa: entradas (cadastro/atualização de containers) ou
        saídas (baixa do estoque a partir do sistema do terminal).
      </p>
      <ImportacaoClient />
    </div>
  );
}
