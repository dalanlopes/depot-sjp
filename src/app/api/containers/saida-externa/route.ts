import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { todayBR, addDaysBR, startOfDayBR, endOfDayBR } from "@/lib/tz";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "coletas") && !canAccessTab(session, "dashboard")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const inicioParam = searchParams.get("inicio");
  const fimParam = searchParams.get("fim");

  const fimYmd = fimParam ?? todayBR();
  const inicioYmd = inicioParam ?? addDaysBR(fimYmd, -29);
  const fim = endOfDayBR(fimYmd);
  const inicio = startOfDayBR(inicioYmd);

  const saidas = await db
    .selectFrom("saidas_externas as se")
    .leftJoin("containers as c", "c.numero", "se.container_numero")
    .select([
      "se.id",
      "se.container_numero",
      "c.armador",
      "c.padrao",
      "se.tipo",
      "se.data_saida",
      "se.booking",
      "se.exportador",
      "se.navio",
      "se.vg",
    ])
    .where("se.data_saida", ">=", inicio.toISOString())
    .where("se.data_saida", "<=", fim.toISOString())
    .orderBy("se.data_saida", "desc")
    .limit(1000)
    .execute();

  return NextResponse.json({
    saidas,
    total: saidas.length,
    inicio: inicioYmd,
    fim: fimYmd,
  });
}
