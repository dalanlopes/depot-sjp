import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canImportData } from "@/lib/roles";

// Registro manual de uma única saída externa, para quando não há planilha
// (ex: uma unidade avulsa que saiu fora do relatório do terminal). Mesma
// regra da importação: se o container já tem coleta CONCLUIDO via CM, não
// deixa registrar de novo aqui, pra não contar a mesma saída duas vezes.
const schema = z.object({
  numero: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .transform((v) => v.toUpperCase()),
  dataSaida: z.string().min(1), // YYYY-MM-DD
  tipo: z.string().trim().max(20).optional(),
  booking: z.string().trim().max(40).optional(),
  exportador: z.string().trim().max(120).optional(),
  navio: z.string().trim().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canImportData(session.role)) {
    return NextResponse.json({ error: "Sem permissão para registrar saídas." }, { status: 403 });
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

  const jaColetado = await db
    .selectFrom("coletas")
    .select("id")
    .where("status", "=", "CONCLUIDO")
    .where("container_numero", "=", data.numero)
    .executeTakeFirst();
  if (jaColetado) {
    return NextResponse.json(
      { error: `O container ${data.numero} já saiu via CM (aba Coletas) — não é preciso registrar de novo aqui.` },
      { status: 409 }
    );
  }

  const existente = await db
    .selectFrom("saidas_externas")
    .select("id")
    .where("container_numero", "=", data.numero)
    .executeTakeFirst();
  if (existente) {
    return NextResponse.json(
      { error: `Já existe um registro de saída pra esse container. Exclua o antigo antes de cadastrar de novo.` },
      { status: 409 }
    );
  }

  const dataSaidaIso = new Date(`${data.dataSaida}T12:00:00-03:00`).toISOString();

  await db
    .insertInto("saidas_externas")
    .values({
      container_numero: data.numero,
      tipo: data.tipo || null,
      data_saida: dataSaidaIso,
      booking: data.booking || null,
      exportador: data.exportador || null,
      navio: data.navio || null,
      criado_por_id: session.userId,
    })
    .execute();

  return NextResponse.json({ ok: true, numero: data.numero });
}
