import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canViewFinance } from "@/lib/roles";
import { startOfDayBR, endOfDayBR, todayBR, formatDateTimeBR } from "@/lib/tz";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "oficina")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const inicioParam = searchParams.get("inicio");
  const fimParam = searchParams.get("fim");
  const dia = todayBR();
  const inicio =
    inicioParam && /^\d{4}-\d{2}-\d{2}$/.test(inicioParam) ? startOfDayBR(inicioParam) : startOfDayBR(dia);
  const fim = fimParam && /^\d{4}-\d{2}-\d{2}$/.test(fimParam) ? endOfDayBR(fimParam) : endOfDayBR(dia);

  const rows = await db
    .selectFrom("reparos as r")
    .innerJoin("containers as c", "c.numero", "r.container_numero")
    .select([
      "r.data",
      "r.container_numero",
      "c.armador",
      "c.padrao",
      "r.dm",
      "r.por_conta_depot",
      "r.valor_faturado",
    ])
    .where("r.data", ">=", inicio.toISOString())
    .where("r.data", "<=", fim.toISOString())
    .orderBy("r.data", "desc")
    .limit(5000)
    .execute();

  const showFinance = canViewFinance(session);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Oficina");
  const columns = [
    { header: "Data do Reparo", key: "data", width: 18 },
    { header: "Container", key: "numero", width: 16 },
    { header: "Armador", key: "armador", width: 12 },
    { header: "Padrão", key: "padrao", width: 8 },
    { header: "DM", key: "dm", width: 8 },
  ];
  if (showFinance) {
    columns.push(
      { header: "Por conta do Depot", key: "depot", width: 18 },
      { header: "Valor Faturado", key: "valor", width: 16 }
    );
  }
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({
      data: formatDateTimeBR(r.data as unknown as string),
      numero: r.container_numero,
      armador: r.armador,
      padrao: r.padrao,
      dm: r.dm ?? "",
      ...(showFinance
        ? {
            depot: r.por_conta_depot ? "Sim" : "Não",
            valor: r.por_conta_depot ? "" : r.valor_faturado ? Number(r.valor_faturado) : "",
          }
        : {}),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `oficina-reparos-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
