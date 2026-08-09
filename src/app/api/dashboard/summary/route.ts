import { NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canViewFinance } from "@/lib/roles";
import { META_DIARIA_REPAROS, META_DIARIA_COLETAS, META_SEMANAL_COLETAS, ARMADORES, type Armador } from "@/lib/types";
import { todayBR, addDaysBR, startOfDayBR, endOfDayBR, mondayOfWeekBR, sundayOfWeekBR } from "@/lib/tz";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const hoje = todayBR();
  const dia30Atras = addDaysBR(hoje, -29);
  const dia7Frente = addDaysBR(hoje, 6);

  const showFinance = canViewFinance(session);

  const segunda = mondayOfWeekBR(hoje);
  const domingo = sundayOfWeekBR(hoje);

  const [reparosRows, estoqueRows, solicitadoRows, concluidoRows, ocorrenciasRows, coletasSemanaRow] = await Promise.all([
    sql<{ day: string; count: string; valor: string }>`
      select to_char(date_trunc('day', data at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as day,
             count(*)::int as count,
             coalesce(sum(valor_faturado), 0) as valor
      from reparos
      where data >= ${startOfDayBR(dia30Atras).toISOString()}
      group by 1
      order by 1
    `.execute(db),
    db
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
      .select(["c.armador", "c.status", "c.padrao", (eb) => eb.fn.count<number>("c.numero").as("count")])
      .groupBy(["c.armador", "c.status", "c.padrao"])
      .execute(),
    sql<{ data_retirada: string; total: string }>`
      select to_char(data_retirada, 'YYYY-MM-DD') as data_retirada,
             coalesce(sum(quantidade), 0) as total
      from programacoes
      where data_retirada >= ${hoje} and data_retirada <= ${dia7Frente}
      group by 1
      order by 1
    `.execute(db),
    sql<{ day: string; count: string }>`
      select to_char(date_trunc('day', data at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD') as day, count(*)::int as count
      from coletas
      where status = 'CONCLUIDO'
        and data >= ${startOfDayBR(hoje).toISOString()}
        and data <= ${endOfDayBR(dia7Frente).toISOString()}
      group by 1
      order by 1
    `.execute(db),
    db
      .selectFrom("ocorrencias as o")
      .leftJoin("users as u", "u.id", "o.criado_por_id")
      .select(["o.id", "o.data", "o.motivo", "u.nome as criado_por"])
      .where("o.data", ">=", startOfDayBR(addDaysBR(hoje, -13)).toISOString())
      .orderBy("o.data", "desc")
      .limit(50)
      .execute(),
    sql<{ total: string }>`
      select count(*)::int as total
      from coletas
      where status = 'CONCLUIDO'
        and data >= ${startOfDayBR(segunda).toISOString()}
        and data <= ${endOfDayBR(domingo).toISOString()}
    `.execute(db),
  ]);

  const reparosByDay = new Map(reparosRows.rows.map((r) => [r.day, r]));
  const reparosSeries30d: { data: string; quantidade: number; valor?: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const key = addDaysBR(dia30Atras, i);
    const row = reparosByDay.get(key);
    reparosSeries30d.push({
      data: key,
      quantidade: row ? Number(row.count) : 0,
      valor: showFinance ? (row ? Number(row.valor) : 0) : undefined,
    });
  }
  const reparosSeries7d = reparosSeries30d.slice(-7);

  let alimentoOk = 0;
  let cargaGeralOk = 0;
  let avariadas = 0;
  const alimentoOkPorArmador = new Map<Armador, number>(ARMADORES.map((a) => [a, 0]));
  for (const row of estoqueRows) {
    const count = Number(row.count);
    if (row.status === "OK" && row.padrao === "AL") {
      alimentoOk += count;
      alimentoOkPorArmador.set(row.armador, (alimentoOkPorArmador.get(row.armador) ?? 0) + count);
    } else if (row.status === "OK" && row.padrao === "CG") cargaGeralOk += count;
    else if (row.status === "AR" || row.status === "AE" || row.status === "RE") avariadas += count;
  }
  const estoquePorArmador = ARMADORES.map((armador) => ({
    armador,
    alimentoOk: alimentoOkPorArmador.get(armador) ?? 0,
  })).filter((a) => a.alimentoOk > 0);

  const coletadosSemana = Number(coletasSemanaRow.rows[0]?.total ?? 0);
  const faltamSemana = Math.max(META_SEMANAL_COLETAS - coletadosSemana, 0);

  const solicitadoByDay = new Map(solicitadoRows.rows.map((r) => [r.data_retirada, Number(r.total ?? 0)]));
  const concluidoByDay = new Map(concluidoRows.rows.map((r) => [r.day, Number(r.count)]));
  const programacaoSeries7d: {
    data: string;
    solicitado: number;
    concluido: number;
    pendente: number;
    meta: number;
  }[] = [];
  for (let i = 0; i < 7; i++) {
    const key = addDaysBR(hoje, i);
    const weekday = startOfDayBR(key).getUTCDay();
    const solicitado = solicitadoByDay.get(key) ?? 0;
    const concluido = concluidoByDay.get(key) ?? 0;
    programacaoSeries7d.push({
      data: key,
      solicitado,
      concluido,
      pendente: Math.max(solicitado - concluido, 0),
      meta: weekday >= 1 && weekday <= 5 ? META_DIARIA_REPAROS : 0,
    });
  }

  return NextResponse.json({
    reparosSeries7d,
    reparosSeries30d,
    metaDiariaReparos: META_DIARIA_REPAROS,
    showFinance,
    estoque: { alimentoOk, avariadas, cargaGeralOk, porArmador: estoquePorArmador },
    programacaoSeries7d,
    metaDiariaColetas: META_DIARIA_COLETAS,
    metaSemanalColetas: META_SEMANAL_COLETAS,
    coletadosSemana,
    faltamSemana,
    ocorrenciasRecentes: ocorrenciasRows,
  });
}
