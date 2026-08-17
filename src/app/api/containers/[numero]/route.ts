import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canEditContainerData } from "@/lib/roles";
import { PADROES, STATUS_CONTAINER } from "@/lib/types";

const schema = z
  .object({
    padrao: z.enum(PADROES as [string, ...string[]]).optional(),
    status: z.enum(STATUS_CONTAINER as [string, ...string[]]).optional(),
  })
  .refine((v) => v.padrao !== undefined || v.status !== undefined, {
    message: "Informe padrão e/ou status.",
  });

// Corrige o padrão (Alimento/Carga Geral/Aguardando Vistoria) e/ou o status
// (WS/AR/AE/RE/OK) de um container já cadastrado. Usado, por exemplo, quando
// um container sai da oficina e muda de classificação — a mudança reflete
// direto no Estoque, que sempre lê o valor atual da tabela containers.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canEditContainerData(session)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { numero } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const container = await db
    .selectFrom("containers")
    .select(["numero"])
    .where("numero", "=", numero.toUpperCase())
    .executeTakeFirst();

  if (!container) {
    return NextResponse.json({ error: "Container não encontrado." }, { status: 404 });
  }

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (parsed.data.padrao) patch.padrao = parsed.data.padrao;
  if (parsed.data.status) patch.status = parsed.data.status;

  await db
    .updateTable("containers")
    .set(patch as never)
    .where("numero", "=", numero.toUpperCase())
    .execute();

  return NextResponse.json({ ok: true });
}
