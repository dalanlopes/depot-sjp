import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { todayBR, addDaysBR, startOfDayBR, endOfDayBR } from "@/lib/tz";

// Relatório de Saída combinado: junta as coletas concluídas via CM (aba
// Coletas) com as Saídas Externas (planilha do terminal) num só relatório,
// já que as duas são "saída real do pátio". A importação de saída externa já
// ignora containers que saíram via CM, então não deve haver duplicidade —
// mas se acontecer (ex.: coleta lançada depois da saída externa já
// importada), cada origem aparece como uma linha separada mesmo assim.
export interface SaidaGeralRow {
  numero: string;
  armador: string | null;
  padrao: string | null;
  tipo: string | null;
  dataSaida: string;
  origem: "CM" | "EXTERNA";
  detalhe: string | null;
}

export async function buscarSaidasGeral(inicio: Date, fim: Date): Promise<SaidaGeralRow[]> {
  const [coletas, externas] = await Promise.all([
    db
      .selectFrom("coletas as co")
      .leftJoin("containers as c", "c.numero", "co.container_numero")
      .select([
        "co.container_numero",
        "c.armador",
        "c.padrao",
        "c.tipo",
        "co.data",
        "co.codigo_cm_veiculo",
      ])
      .where("co.status", "=", "CONCLUIDO")
      .where("co.data", ">=", inicio.toISOString())
      .where("co.data", "<=", fim.toISOString())
      .execute(),
    db
      .selectFrom("saidas_externas as se")
      .leftJoin("containers as c", "c.numero", "se.container_numero")
      .select(["se.container_numero", "c.armador", "c.padrao", "se.tipo", "se.data_saida", "se.exportador"])
      .where("se.data_saida", ">=", inicio.toISOString())
      .where("se.data_saida", "<=", fim.toISOString())
      .execute(),
  ]);

  const rows: SaidaGeralRow[] = [
    ...coletas
      .filter((c) => c.container_numero && c.data)
      .map((c) => ({
        numero: c.container_numero as string,
        armador: c.armador ?? null,
        padrao: c.padrao ?? null,
        tipo: c.tipo ?? null,
        dataSaida: new Date(c.data as unknown as string).toISOString(),
        origem: "CM" as const,
        detalhe: c.codigo_cm_veiculo ? `CM: ${c.codigo_cm_veiculo}` : null,
      })),
    ...externas.map((e) => ({
      numero: e.container_numero,
      armador: e.armador ?? null,
      padrao: e.padrao ?? null,
      tipo: e.tipo ?? null,
      dataSaida: new Date(e.data_saida as unknown as string).toISOString(),
      origem: "EXTERNA" as const,
      detalhe: e.exportador ? `Exportador: ${e.exportador}` : null,
    })),
  ];

  rows.sort((a, b) => (a.dataSaida < b.dataSaida ? 1 : -1));
  return rows;
}

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

  const saidas = (await buscarSaidasGeral(inicio, fim)).slice(0, 1000);

  return NextResponse.json({
    saidas,
    total: saidas.length,
    inicio: inicioYmd,
    fim: fimYmd,
  });
}
