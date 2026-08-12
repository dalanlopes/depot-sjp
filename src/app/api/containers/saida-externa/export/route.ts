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

  const saidas = await db
    .selectFrom("saidas_externas as se")
    .leftJoin("containers as c", "c.numero", "se.container_numero")
    .select([
      "se.container_numero",
      "c.armador",
      "c.padrao",
      "se.tipo",
      "se.entrada",
      "se.data_saida",
      "se.tara",
      "se.mgw",
      "se.booking",
      "se.dias_planilha",
      "se.car",
      "se.exportador",
      "se.navio",
      "se.vg",
      "se.lacre_exp",
      "se.lacre_p",
      "se.lacre_v",
    ])
    .where("se.data_saida", ">=", inicio.toISOString())
    .where("se.data_saida", "<=", fim.toISOString())
    .orderBy("se.data_saida", "desc")
    .limit(5000)
    .execute();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Saídas Externas");
  sheet.columns = [
    { header: "Número", key: "numero", width: 16 },
    { header: "Armador", key: "armador", width: 12 },
    { header: "Padrão", key: "padrao", width: 8 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Entrada", key: "entrada", width: 16 },
    { header: "Data Saída", key: "dataSaida", width: 16 },
    { header: "Tara", key: "tara", width: 10 },
    { header: "MGW", key: "mgw", width: 10 },
    { header: "Booking", key: "booking", width: 16 },
    { header: "Dias (planilha)", key: "dias", width: 14 },
    { header: "Car", key: "car", width: 10 },
    { header: "Exportador", key: "exportador", width: 22 },
    { header: "Navio", key: "navio", width: 18 },
    { header: "Vg", key: "vg", width: 8 },
    { header: "Lacre Exp.", key: "lacreExp", width: 14 },
    { header: "Lacre P.", key: "lacreP", width: 14 },
    { header: "Lacre V.", key: "lacreV", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const s of saidas) {
    sheet.addRow({
      numero: s.container_numero,
      armador: s.armador ?? "",
      padrao: s.padrao ?? "",
      tipo: s.tipo ?? "",
      entrada: s.entrada ? formatDateTimeBR(s.entrada as unknown as string) : "",
      dataSaida: formatDateTimeBR(s.data_saida as unknown as string),
      tara: s.tara ? Number(s.tara) : "",
      mgw: s.mgw ? Number(s.mgw) : "",
      booking: s.booking ?? "",
      dias: s.dias_planilha ?? "",
      car: s.car ?? "",
      exportador: s.exportador ?? "",
      navio: s.navio ?? "",
      vg: s.vg ?? "",
      lacreExp: s.lacre_exp ?? "",
      lacreP: s.lacre_p ?? "",
      lacreV: s.lacre_v ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `saidas-externas-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
