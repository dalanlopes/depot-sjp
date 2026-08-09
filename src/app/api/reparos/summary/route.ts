import { NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { todayBR, addDaysBR, startOfDayBR, endOfDayBR, startOfMonthBR } from "@/lib/tz";
import { META_DIARIA_REPAROS, DM_OPCOES } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "oficina")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const hoje = todayBR();
  const seteDiasAtras = addDaysBR(hoje, -6);
  const inicioMes = startOfMonthBR(hoje);

  const [diarioRows, dmMesRows] = await Promise.all([
    sql<{ day: string; count: string }>`
      select to_char(date_trunc('day', data at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as day,
             count(*)::int as count
      from reparos
      where data >= ${startOfDayBR(seteDiasAtras).toISOString()}
        and data <= ${endOfDayBR(hoje).toISOString()}
      group by 1
    `.execute(db),
    sql<{ dm: string; count: string }>`
      select dm, count(*)::int as count
      from reparos
      where dm is not null
        and data >= ${startOfDayBR(inicioMes).toISOString()}
        and data <= ${endOfDayBR(hoje).toISOString()}
      group by 1
    `.execute(db),
  ]);

  const byDay = new Map(diarioRows.rows.map((r) => [r.day, Number(r.count)]));
  const series7d: { data: string; quantidade: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const key = addDaysBR(seteDiasAtras, i);
    series7d.push({ data: key, quantidade: byDay.get(key) ?? 0 });
  }

  const dmMesMap = new Map(dmMesRows.rows.map((r) => [r.dm, Number(r.count)]));
  const dmMes = Object.fromEntries(DM_OPCOES.map((dm) => [dm, dmMesMap.get(dm) ?? 0]));

  return NextResponse.json({
    series7d,
    metaDiaria: META_DIARIA_REPAROS,
    dmMes,
    mesReferencia: inicioMes.slice(0, 7),
  });
}
