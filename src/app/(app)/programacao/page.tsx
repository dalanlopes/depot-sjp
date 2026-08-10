import { requireTab } from "@/lib/guard";
import { canEditProgramacao } from "@/lib/roles";
import ProgramacaoClient from "./programacao-client";

export const dynamic = "force-dynamic";

export default async function ProgramacaoPage() {
  const session = await requireTab("programacao");
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Programação de Retirada</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Registre a demanda de retirada de containers por dia e armador.
      </p>
      <ProgramacaoClient podeEditar={canEditProgramacao(session.role)} />
    </div>
  );
}
