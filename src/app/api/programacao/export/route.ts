import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { addDaysBR, todayBR, formatDateBR } from "@/lib/tz";
import { SOLICITANTE_LABELS, type SolicitanteTipo } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "programacao")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const inicioParam = searchParams.get("inicio");
  const fimParam = searchParams.get("fim");
  const dias = Number(searchParams.get("dias") ?? "3650");
  const desde = addDaysBR(todayBR(), -Math.abs(dias));

  let query = db
    .selectFrom("programacoes as p")
    .leftJoin("coletas as co", "co.programacao_id", "p.id")
    .select([
      "p.data_retirada",
      "p.solicitante",
      "p.destino",
      "p.armador",
      "p.quantidade",
      (eb) => eb.fn.count<number>("co.id").filterWhere("co.status", "=", "CONCLUIDO").as("realizada"),
    ])
    .groupBy(["p.id"])
    .orderBy("p.data_retirada", "desc")
    .limit(5000);

  if (inicioParam && /^\d{4}-\d{2}-\d{2}$/.test(inicioParam)) {
    query = query.where("p.data_retirada", ">=", inicioParam);
  } else {
    query = query.where("p.data_retirada", ">=", desde);
  }
  if (fimParam && /^\d{4}-\d{2}-\d{2}$/.test(fimParam)) {
    query = query.where("p.data_retirada", "<=", fimParam);
  }

  const rows = await query.execute();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Programação");
  sheet.columns = [
    { header: "Data da Retirada", key: "data", width: 16 },
    { header: "Solicitante", key: "solicitante", width: 20 },
    { header: "Destino", key: "destino", width: 12 },
    { header: "Armador", key: "armador", width: 12 },
    { header: "Quantidade Solicitada", key: "quantidade", width: 18 },
    { header: "Realizada", key: "realizada", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const p of rows) {
    const dataRetirada =
      (p.data_retirada as unknown) instanceof Date
        ? (p.data_retirada as unknown as Date).toISOString().slice(0, 10)
        : String(p.data_retirada).slice(0, 10);
    sheet.addRow({
      data: formatDateBR(`${dataRetirada}T12:00:00-03:00`),
      solicitante: p.solicitante,
      destino: SOLICITANTE_LABELS[p.destino as SolicitanteTipo] ?? p.destino,
      armador: p.armador,
      quantidade: p.quantidade,
      realizada: Number(p.realizada),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `programacao-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
