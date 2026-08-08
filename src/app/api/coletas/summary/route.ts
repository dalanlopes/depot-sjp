import { NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { todayBR, mondayOfWeekBR, sundayOfWeekBR, startOfDayBR, endOfDayBR } from "@/lib/tz";
import { META_SEMANAL_COLETAS } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session.role, "coletas")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const hoje = todayBR();

  const resumo = await sql<{ do_dia: string; concluidas: string }>`
    select
      count(*) filter (
        where p.data_retirada = ${hoje}
           or (co.programacao_id is null and (co.data at time zone 'America/Sao_Paulo')::date = ${hoje}::date)
      ) as do_dia,
      count(*) filter (
        where co.status = 'CONCLUIDO' and (
          p.data_retirada = ${hoje}
          or (co.programacao_id is null and (co.data at time zone 'America/Sao_Paulo')::date = ${hoje}::date)
        )
      ) as concluidas
    from coletas co
    left join programacoes p on p.id = co.programacao_id
  `.execute(db);

  const disponivel = await db
    .selectFrom("containers as c")
    .where("c.status", "=", "OK")
    .where("c.padrao", "=", "AL")
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
    .select((eb) => eb.fn.count<number>("c.numero").as("count"))
    .executeTakeFirst();

  // Meta semanal: 35/dia em dias uteis (seg-sex) = 175/semana. Sabado e domingo
  // contam como coleta extra/reposicao, entao a contagem sempre olha a semana
  // inteira (segunda a domingo) contra a mesma meta de 175.
  const segunda = mondayOfWeekBR(hoje);
  const domingo = sundayOfWeekBR(hoje);
  const semanaRow = await sql<{ total: string }>`
    select count(*)::int as total
    from coletas
    where status = 'CONCLUIDO'
      and data >= ${startOfDayBR(segunda).toISOString()}
      and data <= ${endOfDayBR(domingo).toISOString()}
  `.execute(db);

  const coletadosSemana = Number(semanaRow.rows[0]?.total ?? 0);

  const row = resumo.rows[0];

  return NextResponse.json({
    coletasDoDia: Number(row?.do_dia ?? 0),
    concluidasHoje: Number(row?.concluidas ?? 0),
    estoqueDisponivel: Number(disponivel?.count ?? 0),
    metaSemanal: META_SEMANAL_COLETAS,
    coletadosSemana,
    faltamSemana: Math.max(META_SEMANAL_COLETAS - coletadosSemana, 0),
  });
}
