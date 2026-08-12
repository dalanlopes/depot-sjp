import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { formatDateTimeBR, todayBR, addDaysBR, startOfDayBR, endOfDayBR } from "@/lib/tz";
import { buscarSaidasGeral } from "../route";

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

  const saidas = (await buscarSaidasGeral(inicio, fim)).slice(0, 5000);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Saídas");
  sheet.columns = [
    { header: "Número", key: "numero", width: 16 },
    { header: "Armador", key: "armador", width: 12 },
    { header: "Padrão", key: "padrao", width: 8 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Data Saída", key: "dataSaida", width: 18 },
    { header: "Origem", key: "origem", width: 10 },
    { header: "Detalhe", key: "detalhe", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const s of saidas) {
    sheet.addRow({
      numero: s.numero,
      armador: s.armador ?? "",
      padrao: s.padrao ?? "",
      tipo: s.tipo ?? "",
      dataSaida: formatDateTimeBR(s.dataSaida),
      origem: s.origem === "CM" ? "CM (Coletas)" : "Externa (planilha)",
      detalhe: s.detalhe ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `saidas-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
