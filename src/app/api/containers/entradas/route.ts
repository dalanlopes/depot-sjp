import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { todayBR, addDaysBR, startOfDayBR, endOfDayBR } from "@/lib/tz";

// Relatório de Entradas: containers pela data de entrada (coluna
// containers.entrada), alimentada pela planilha de Entrada da Importação.
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

  const entradas = await db
    .selectFrom("containers as c")
    .select(["c.numero", "c.armador", "c.padrao", "c.status", "c.tipo", "c.entrada"])
    .where("c.entrada", ">=", inicio.toISOString())
    .where("c.entrada", "<=", fim.toISOString())
    .orderBy("c.entrada", "desc")
    .limit(1000)
    .execute();

  return NextResponse.json({
    entradas,
    total: entradas.length,
    inicio: inicioYmd,
    fim: fimYmd,
  });
}
