import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { formatDateTimeBR, todayBR, addDaysBR, startOfDayBR, endOfDayBR } from "@/lib/tz";

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
    .limit(5000)
    .execute();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Entradas");
  sheet.columns = [
    { header: "Número", key: "numero", width: 16 },
    { header: "Armador", key: "armador", width: 12 },
    { header: "Padrão", key: "padrao", width: 8 },
    { header: "Status", key: "status", width: 10 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Entrada", key: "entrada", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const e of entradas) {
    sheet.addRow({
      numero: e.numero,
      armador: e.armador,
      padrao: e.padrao,
      status: e.status,
      tipo: e.tipo ?? "",
      entrada: e.entrada ? formatDateTimeBR(e.entrada as unknown as string) : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `entradas-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
