import { NextRequest, NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "estoque") && !canAccessTab(session, "dashboard")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const padrao = searchParams.get("padrao");
  const armador = searchParams.get("armador");

  let query = db
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
    .select((eb) => [
      "c.numero",
      "c.armador",
      "c.padrao",
      "c.status",
      "c.tipo",
      "c.entrada",
      "c.valor_estimado",
      "c.atualizado_em",
      eb
        .selectFrom("reparos as r")
        .select("r.valor_faturado")
        .whereRef("r.container_numero", "=", "c.numero")
        .orderBy("r.data", "desc")
        .limit(1)
        .as("valor_reparo"),
      eb
        .selectFrom("reparos as r")
        .select("r.faturado_em")
        .whereRef("r.container_numero", "=", "c.numero")
        .orderBy("r.data", "desc")
        .limit(1)
        .as("faturado_em"),
    ])
    .orderBy("c.numero");

  if (status) query = query.where("c.status", "=", status as never);
  if (padrao) query = query.where("c.padrao", "=", padrao as never);
  if (armador) query = query.where("c.armador", "=", armador as never);

  const containers = await query.limit(1000).execute();
  return NextResponse.json({ containers });
}
