import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";
import { ARMADORES, SOLICITANTES, MAX_CONTAINERS_POR_PROGRAMACAO } from "@/lib/types";
import { addDaysBR, todayBR } from "@/lib/tz";

const containerCheioSchema = z.object({
  containerNumero: z.string().trim().min(4),
  cliente: z.string().trim().min(1),
});

const schema = z
  .object({
    dataRetirada: z.string().min(1),
    solicitante: z.string().trim().min(1),
    destino: z.enum(SOLICITANTES as [string, ...string[]]),
    armador: z.enum(ARMADORES as [string, ...string[]]),
    booking: z.string().trim().optional(),
    cmCodigo: z.string().min(1),
    quantidade: z.number().int().min(1).max(MAX_CONTAINERS_POR_PROGRAMACAO).optional(),
    tipoCarga: z.enum(["VAZIO", "CHEIO"]),
    containersCheio: z.array(containerCheioSchema).max(MAX_CONTAINERS_POR_PROGRAMACAO).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipoCarga === "CHEIO") {
      if (!data.containersCheio || data.containersCheio.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Informe ao menos um container (com cliente) para container cheio.",
          path: ["containersCheio"],
        });
      }
    } else if (!data.quantidade) {
      ctx.addIssue({ code: "custom", message: "Informe a quantidade de containers.", path: ["quantidade"] });
    }
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
    .selectFrom("programacoes")
    .selectAll()
    .where("data_retirada", ">=", desde)
    .orderBy("data_retirada", "desc")
    .orderBy("criado_em", "desc")
    .limit(200)
    .execute();

  // node-postgres parses `date` columns into JS Date objects; normalize to a
  // plain YYYY-MM-DD string so the client never has to guess the shape.
  const programacoes = rows.map((p) => ({
    ...p,
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
  const quantidade = data.tipoCarga === "CHEIO" ? data.containersCheio!.length : data.quantidade!;

  await db.transaction().execute(async (trx) => {
    const programacao = await trx
      .insertInto("programacoes")
      .values({
        data_retirada: data.dataRetirada,
        solicitante: data.solicitante,
        destino: data.destino as never,
        armador: data.armador as never,
        booking: data.booking || null,
        cm_codigo: data.cmCodigo,
        quantidade,
        tipo_carga: data.tipoCarga as never,
        cliente: null,
        criado_por_id: session.userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    if (data.tipoCarga === "CHEIO") {
      for (const item of data.containersCheio!) {
        await trx
          .insertInto("coletas")
          .values({
            container_numero: item.containerNumero.trim().toUpperCase(),
            codigo_cm_veiculo: data.cmCodigo,
            programacao_id: programacao.id,
            status: "PENDENTE",
            tipo_carga: "CHEIO" as never,
            cliente: item.cliente,
            criado_por_id: session.userId,
          })
          .execute();
      }
    } else {
      for (let i = 0; i < quantidade; i++) {
        await trx
          .insertInto("coletas")
          .values({
            container_numero: null,
            codigo_cm_veiculo: data.cmCodigo,
            programacao_id: programacao.id,
            status: "PENDENTE",
            tipo_carga: "VAZIO" as never,
            cliente: null,
            criado_por_id: session.userId,
          })
          .execute();
      }
    }
  });

  return NextResponse.json({ ok: true });
}
