import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { startOfDayBR, endOfDayBR, addDaysBR, todayBR, formatDateBR } from "@/lib/tz";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "ocorrencias") && !canAccessTab(session, "dashboard")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const inicioParam = searchParams.get("inicio");
  const fimParam = searchParams.get("fim");
  const dias = Number(searchParams.get("dias") ?? "3650");
  const desde = addDaysBR(todayBR(), -Math.abs(dias));

  let query = db
    .selectFrom("ocorrencias as o")
    .leftJoin("users as u", "u.id", "o.criado_por_id")
    .select(["o.data", "o.motivo", "u.nome as criado_por"])
    .orderBy("o.data", "desc")
    .limit(5000);

  if (inicioParam && /^\d{4}-\d{2}-\d{2}$/.test(inicioParam)) {
    query = query.where("o.data", ">=", startOfDayBR(inicioParam).toISOString());
  } else {
    query = query.where("o.data", ">=", startOfDayBR(desde).toISOString());
  }
  if (fimParam && /^\d{4}-\d{2}-\d{2}$/.test(fimParam)) {
    query = query.where("o.data", "<=", endOfDayBR(fimParam).toISOString());
  }

  const rows = await query.execute();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Ocorrências");
  sheet.columns = [
    { header: "Data", key: "data", width: 14 },
    { header: "Motivo", key: "motivo", width: 60 },
    { header: "Registrado por", key: "criado_por", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const o of rows) {
    sheet.addRow({
      data: formatDateBR(o.data as unknown as string),
      motivo: o.motivo,
      criado_por: o.criado_por ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `ocorrencias-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
