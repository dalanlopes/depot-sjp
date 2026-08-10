import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canImportData } from "@/lib/roles";
import { ARMADORES, PADROES, STATUS_CONTAINER } from "@/lib/types";

// Cadastro manual de um único container no estoque, para quando não há
// planilha (ex: uma unidade avulsa que chegou fora do relatório do terminal).
const schema = z.object({
  numero: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .transform((v) => v.toUpperCase()),
  armador: z.enum(ARMADORES as [string, ...string[]]),
  padrao: z.enum(PADROES as [string, ...string[]]),
  status: z.enum(STATUS_CONTAINER as [string, ...string[]]).default("WS"),
  tipo: z.string().trim().max(20).optional(),
  entrada: z.string().optional(), // YYYY-MM-DD
  valorEstimado: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canImportData(session.role)) {
    return NextResponse.json({ error: "Sem permissão para cadastrar containers." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Preencha os campos corretamente." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const existente = await db
    .selectFrom("containers")
    .select("numero")
    .where("numero", "=", data.numero)
    .executeTakeFirst();
  if (existente) {
    return NextResponse.json(
      { error: `O container ${data.numero} já está cadastrado no estoque.` },
      { status: 409 }
    );
  }

  const entradaIso = data.entrada
    ? new Date(`${data.entrada}T12:00:00-03:00`).toISOString()
    : new Date().toISOString();

  await db
    .insertInto("containers")
    .values({
      numero: data.numero,
      armador: data.armador as never,
      padrao: data.padrao as never,
      status: data.status as never,
      entrada: entradaIso,
      tipo: data.tipo || null,
      valor_estimado: data.valorEstimado != null ? String(data.valorEstimado) : null,
    })
    .execute();

  return NextResponse.json({ ok: true, numero: data.numero });
}
