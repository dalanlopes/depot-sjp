import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { formatDateTimeBR } from "@/lib/tz";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "coletas")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const inicioParam = searchParams.get("inicio");
  const fimParam = searchParams.get("fim");

  const fim = fimParam ? new Date(`${fimParam}T23:59:59.999`) : new Date();
  const inicio = inicioParam
    ? new Date(`${inicioParam}T00:00:00`)
    : new Date(fim.getTime() - 29 * 24 * 60 * 60 * 1000);

  const rows = await db
    .selectFrom("coletas as co")
    .leftJoin("containers as c", "c.numero", "co.container_numero")
    .select(["co.container_numero", "c.armador", "c.padrao", "co.codigo_cm_veiculo", "co.data"])
    .where("co.status", "=", "CONCLUIDO")
    .where("co.data", ">=", inicio.toISOString())
    .where("co.data", "<=", fim.toISOString())
    .orderBy("co.data", "desc")
    .limit(5000)
    .execute();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Coletas");
  sheet.columns = [
    { header: "Número", key: "numero", width: 16 },
    { header: "Armador", key: "armador", width: 12 },
    { header: "Padrão", key: "padrao", width: 8 },
    { header: "Código CM", key: "cm", width: 14 },
    { header: "Data da Saída", key: "data", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const c of rows) {
    sheet.addRow({
      numero: c.container_numero ?? "",
      armador: c.armador ?? "",
      padrao: c.padrao ?? "",
      cm: c.codigo_cm_veiculo,
      data: c.data ? formatDateTimeBR(c.data as unknown as string) : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `coletas-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
