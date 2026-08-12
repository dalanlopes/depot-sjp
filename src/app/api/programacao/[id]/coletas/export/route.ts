import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { formatDateBR, formatDateTimeBR } from "@/lib/tz";

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

  const programacao = await db
    .selectFrom("programacoes")
    .select(["id", "data_retirada", "solicitante", "armador"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!programacao) {
    return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
  }

  const coletas = await db
    .selectFrom("coletas as co")
    .leftJoin("containers as c", "c.numero", "co.container_numero")
    .select([
      "co.container_numero",
      "c.padrao",
      "co.codigo_cm_veiculo",
      "co.status",
      "co.data",
    ])
    .where("co.programacao_id", "=", id)
    .where("co.status", "=", "CONCLUIDO")
    .orderBy("co.data", "desc")
    .execute();

  const dataRetirada =
    (programacao.data_retirada as unknown) instanceof Date
      ? (programacao.data_retirada as unknown as Date).toISOString().slice(0, 10)
      : String(programacao.data_retirada).slice(0, 10);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Containers Liberados");
  sheet.columns = [
    { header: "Container", key: "numero", width: 16 },
    { header: "Padrão", key: "padrao", width: 8 },
    { header: "Código CM", key: "cm", width: 14 },
    { header: "Data da Liberação", key: "data", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const c of coletas) {
    sheet.addRow({
      numero: c.container_numero ?? "",
      padrao: c.padrao ?? "",
      cm: c.codigo_cm_veiculo ?? "",
      data: c.data ? formatDateTimeBR(c.data as unknown as string) : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `liberados-${programacao.solicitante.replace(/[^a-zA-Z0-9]+/g, "-")}-${formatDateBR(
    `${dataRetirada}T12:00:00-03:00`
  ).replace(/\//g, "-")}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
