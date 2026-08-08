import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { ARMADORES, type Armador } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session.role, "estoque") && !canAccessTab(session.role, "dashboard")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const rows = await db
    .selectFrom("containers as c")
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("coletas as co")
            .select("co.id")
            .whereRef("co.container_numero", "=", "c.numero")
            .where("co.status", "=", "CONCLUIDO")
        )
      )
    )
    .select(["c.armador", "c.status", "c.padrao", (eb) => eb.fn.count<number>("c.numero").as("count")])
    .groupBy(["c.armador", "c.status", "c.padrao"])
    .execute();

  const byArmador = new Map<Armador, { total: number; alimentoOk: number; cargaGeralOk: number; avariadas: number; aguardandoVistoria: number }>();
  for (const a of ARMADORES) {
    byArmador.set(a, { total: 0, alimentoOk: 0, cargaGeralOk: 0, avariadas: 0, aguardandoVistoria: 0 });
  }

  for (const row of rows) {
    const entry = byArmador.get(row.armador);
    if (!entry) continue;
    const count = Number(row.count);
    entry.total += count;
    if (row.status === "OK" && row.padrao === "AL") entry.alimentoOk += count;
    else if (row.status === "OK" && row.padrao === "CG") entry.cargaGeralOk += count;
    else if (row.status === "AR" || row.status === "AE" || row.status === "RE") entry.avariadas += count;
    else if (row.status === "WS") entry.aguardandoVistoria += count;
  }

  const armadores = ARMADORES.map((armador) => ({ armador, ...byArmador.get(armador)! })).filter((a) => a.total > 0);

  return NextResponse.json({ armadores });
}
