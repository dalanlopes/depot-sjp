import { NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canViewFinance } from "@/lib/roles";
import { todayBR, addDaysBR, startOfDayBR, endOfDayBR, startOfMonthBR } from "@/lib/tz";
import { META_DIARIA_REPAROS } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "oficina")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const hoje = todayBR();
  const seteDiasAtras = addDaysBR(hoje, -6);

  const diarioRows = await sql<{ day: string; count: string }>`
    select to_char(date_trunc('day', data at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as day,
           count(*)::int as count
    from reparos
    where data >= ${startOfDayBR(seteDiasAtras).toISOString()}
      and data <= ${endOfDayBR(hoje).toISOString()}
    group by 1
  `.execute(db);

  const byDay = new Map(diarioRows.rows.map((r) => [r.day, Number(r.count)]));
  const series7d: { data: string; quantidade: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const key = addDaysBR(seteDiasAtras, i);
    series7d.push({ data: key, quantidade: byDay.get(key) ?? 0 });
  }

  // Faturamento é sempre mensal: soma tudo desde o dia 1 do mês corrente
  // (hora de Brasília) até agora, não só o dia de hoje.
  const inicioMes = startOfMonthBR(hoje);
  const mesRow = await sql<{ total: string; valor: string }>`
    select count(*)::int as total,
           coalesce(sum(valor_faturado) filter (where not por_conta_depot), 0) as valor
    from reparos
    where data >= ${startOfDayBR(inicioMes).toISOString()}
      and data <= ${endOfDayBR(hoje).toISOString()}
  `.execute(db);

  const showFinance = canViewFinance(session);

  return NextResponse.json({
    series7d,
    metaDiaria: META_DIARIA_REPAROS,
    reparosNoMes: Number(mesRow.rows[0]?.total ?? 0),
    valorEstimadoMes: showFinance ? Number(mesRow.rows[0]?.valor ?? 0) : undefined,
  });
}
