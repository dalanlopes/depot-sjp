import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canRegisterRepair, canViewFinance } from "@/lib/roles";
import { todayBR, startOfDayBR, endOfDayBR } from "@/lib/tz";
import { META_DIARIA_REPAROS } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "oficina")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const hoje = todayBR();
  const inicio = startOfDayBR(hoje);
  const fim = endOfDayBR(hoje);

  const rows = await db
    .selectFrom("reparos as r")
    .innerJoin("containers as c", "c.numero", "r.container_numero")
    .select([
      "r.id",
      "r.data",
      "r.container_numero",
      "c.armador",
      "c.padrao",
      "r.valor_faturado",
      "r.faturado_em",
    ])
    .where("r.data", ">=", inicio.toISOString())
    .where("r.data", "<=", fim.toISOString())
    .orderBy("r.data", "desc")
    .execute();

  const showFinance = canViewFinance(session);
  const reparos = rows.map((r) => ({
    ...r,
    valor_faturado: showFinance ? r.valor_faturado : undefined,
  }));

  const valorEstimado = showFinance
    ? rows.reduce((acc, r) => acc + Number(r.valor_faturado ?? 0), 0)
    : undefined;

  return NextResponse.json({
    reparos,
    meta: META_DIARIA_REPAROS,
    total: rows.length,
    faltamParaMeta: Math.max(META_DIARIA_REPAROS - rows.length, 0),
    valorEstimado,
    showFinance,
  });
}

const schema = z.object({
  numeros: z.array(z.string().min(4).max(20)).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canRegisterRepair(session.role)) {
    return NextResponse.json({ error: "Sem permissão para registrar reparos." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe ao menos um número de container." }, { status: 400 });
  }

  const numeros = [...new Set(parsed.data.numeros.map((n) => n.trim().toUpperCase()))];
  const created: string[] = [];
  const failed: { numero: string; motivo: string }[] = [];

  for (const numero of numeros) {
    const container = await db
      .selectFrom("containers")
      .selectAll()
      .where("numero", "=", numero)
      .executeTakeFirst();

    if (!container) {
      failed.push({ numero, motivo: "Container não cadastrado no estoque." });
      continue;
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("reparos")
        .values({ container_numero: numero })
        .execute();

      await trx
        .updateTable("containers")
        .set({ status: "OK", atualizado_em: new Date().toISOString() })
        .where("numero", "=", numero)
        .execute();
    });

    created.push(numero);
  }

  return NextResponse.json({ created, failed });
}
