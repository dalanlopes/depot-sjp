import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { ARMADORES, SOLICITANTES } from "@/lib/types";
import { addDaysBR, todayBR } from "@/lib/tz";

const schema = z.object({
  dataRetirada: z.string().min(1),
  solicitante: z.string().trim().min(1),
  destino: z.enum(SOLICITANTES as [string, ...string[]]),
  armador: z.enum(ARMADORES as [string, ...string[]]),
  quantidade: z.number().int().min(1),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "programacao")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const dias = Number(searchParams.get("dias") ?? "14");
  const desde = addDaysBR(todayBR(), -Math.abs(dias));

  const rows = await db
    .selectFrom("programacoes as p")
    .leftJoin("coletas as co", "co.programacao_id", "p.id")
    .select([
      "p.id",
      "p.data_retirada",
      "p.solicitante",
      "p.destino",
      "p.armador",
      "p.quantidade",
      "p.criado_em",
      (eb) => eb.fn.count<number>("co.id").filterWhere("co.status", "=", "CONCLUIDO").as("realizada"),
    ])
    .where("p.data_retirada", ">=", desde)
    .groupBy(["p.id"])
    .orderBy("p.data_retirada", "desc")
    .orderBy("p.criado_em", "desc")
    .limit(200)
    .execute();

  // node-postgres parses `date` columns into JS Date objects; normalize to a
  // plain YYYY-MM-DD string so the client never has to guess the shape.
  const programacoes = rows.map((p) => ({
    ...p,
    realizada: Number(p.realizada),
    data_retirada:
      (p.data_retirada as unknown) instanceof Date
        ? (p.data_retirada as unknown as Date).toISOString().slice(0, 10)
        : String(p.data_retirada).slice(0, 10),
  }));

  return NextResponse.json({ programacoes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "programacao")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Preencha todos os campos corretamente." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    await db.transaction().execute(async (trx) => {
      const programacao = await trx
        .insertInto("programacoes")
        .values({
          data_retirada: data.dataRetirada,
          solicitante: data.solicitante,
          destino: data.destino as never,
          armador: data.armador as never,
          booking: null,
          cm_codigo: null,
          quantidade: data.quantidade,
          tipo_carga: "VAZIO" as never,
          cliente: null,
          criado_por_id: session.userId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Cria uma "vaga" pendente para cada unidade solicitada. O container e o
      // CM de cada uma são preenchidos depois, na aba Coletas.
      for (let i = 0; i < data.quantidade; i++) {
        await trx
          .insertInto("coletas")
          .values({
            container_numero: null,
            codigo_cm_veiculo: null,
            programacao_id: programacao.id,
            status: "PENDENTE",
            tipo_carga: "VAZIO" as never,
            cliente: null,
            criado_por_id: session.userId,
          })
          .execute();
      }
    });
  } catch (err) {
    console.error("Erro ao registrar programação:", err);
    return NextResponse.json(
      { error: "Não foi possível registrar a programação. Tente novamente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
