import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { PADRAO_LABELS, STATUS_LABELS, type Padrao, type StatusContainer } from "@/lib/types";
import { formatDateBR, diasEmEstoque } from "@/lib/tz";

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
  const numero = searchParams.get("numero");

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
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("saidas_externas as se").select("se.id").whereRef("se.container_numero", "=", "c.numero")
        )
      )
    )
    .select(["c.numero", "c.armador", "c.padrao", "c.status", "c.tipo", "c.entrada"])
    .orderBy("c.numero");

  if (status) query = query.where("c.status", "=", status as never);
  if (padrao) query = query.where("c.padrao", "=", padrao as never);
  if (armador) query = query.where("c.armador", "=", armador as never);
  if (numero) query = query.where("c.numero", "ilike", `%${numero}%`);

  const containers = await query.limit(5000).execute();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Estoque");
  sheet.columns = [
    { header: "Número", key: "numero", width: 16 },
    { header: "Armador", key: "armador", width: 12 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Padrão", key: "padrao", width: 8 },
    { header: "Descrição Padrão", key: "padraoDesc", width: 22 },
    { header: "Status", key: "status", width: 8 },
    { header: "Descrição Status", key: "statusDesc", width: 28 },
    { header: "Entrada", key: "entrada", width: 14 },
    { header: "Dias em estoque", key: "dias", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const c of containers) {
    sheet.addRow({
      numero: c.numero,
      armador: c.armador,
      tipo: c.tipo ?? "",
      padrao: c.padrao,
      padraoDesc: PADRAO_LABELS[c.padrao as Padrao] ?? "",
      status: c.status,
      statusDesc: STATUS_LABELS[c.status as StatusContainer] ?? "",
      entrada: c.entrada ? formatDateBR(c.entrada as unknown as string) : "",
      dias: diasEmEstoque(c.entrada as unknown as string) ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `estoque${armador ? `-${armador}` : ""}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
