import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canRegisterRepair, canViewFinance } from "@/lib/roles";
import { todayBR, startOfDayBR, endOfDayBR } from "@/lib/tz";
import { META_DIARIA_REPAROS, DM_OPCOES } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "oficina")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const dataParam = searchParams.get("data");
  const dia = dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) ? dataParam : todayBR();
  const inicio = startOfDayBR(dia);
  const fim = endOfDayBR(dia);

  const rows = await db
    .selectFrom("reparos as r")
    .innerJoin("containers as c", "c.numero", "r.container_numero")
    .select([
      "r.id",
      "r.data",
      "r.container_numero",
      "r.dm",
      "r.por_conta_depot",
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
    ? rows.reduce((acc, r) => (r.por_conta_depot ? acc : acc + Number(r.valor_faturado ?? 0)), 0)
    : undefined;

  return NextResponse.json({
    data: dia,
    reparos,
    meta: META_DIARIA_REPAROS,
    total: rows.length,
    faltamParaMeta: Math.max(META_DIARIA_REPAROS - rows.length, 0),
    valorEstimado,
    showFinance,
  });
}

const schema = z.object({
  itens: z
    .array(
      z.object({
        numero: z.string().min(4).max(20),
        dm: z.enum(DM_OPCOES as [string, ...string[]]).optional(),
        porContaDepot: z.boolean().optional(),
      })
    )
    .min(1),
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

  const seen = new Set<string>();
  const itens = parsed.data.itens
    .map((i) => ({
      numero: i.numero.trim().toUpperCase(),
      dm: i.dm as (typeof DM_OPCOES)[number] | undefined,
      porContaDepot: i.porContaDepot ?? false,
    }))
    .filter((i) => (seen.has(i.numero) ? false : (seen.add(i.numero), true)));

  const created: string[] = [];
  const failed: { numero: string; motivo: string }[] = [];

  for (const item of itens) {
    const container = await db
      .selectFrom("containers")
      .selectAll()
      .where("numero", "=", item.numero)
      .executeTakeFirst();

    if (!container) {
      failed.push({ numero: item.numero, motivo: "Container não cadastrado no estoque." });
      continue;
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("reparos")
        .values({
          container_numero: item.numero,
          dm: item.dm ?? null,
          por_conta_depot: item.porContaDepot,
        })
        .execute();

      await trx
        .updateTable("containers")
        .set({ status: "OK", atualizado_em: new Date().toISOString() })
        .where("numero", "=", item.numero)
        .execute();
    });

    created.push(item.numero);
  }

  return NextResponse.json({ created, failed });
}
