import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "programacao") && !canAccessTab(session, "coletas")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;

  const coletas = await db
    .selectFrom("coletas as co")
    .leftJoin("containers as c", "c.numero", "co.container_numero")
    .select([
      "co.id",
      "co.container_numero",
      "co.codigo_cm_veiculo",
      "co.status",
      "co.data",
      "c.padrao",
    ])
    .where("co.programacao_id", "=", id)
    .orderBy("co.status", "asc")
    .orderBy("co.data", "desc")
    .execute();

  return NextResponse.json({ coletas });
}
