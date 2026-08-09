import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canEditFinance } from "@/lib/roles";

const schema = z.object({
  valor: z.number().nonnegative(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "Sem permissão para editar valores financeiros." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }

  await db
    .updateTable("reparos")
    .set({
      valor_faturado: parsed.data.valor.toFixed(2),
      faturado_por: session.userId,
      faturado_em: new Date().toISOString(),
    })
    .where("id", "=", id)
    .execute();

  return NextResponse.json({ ok: true });
}
