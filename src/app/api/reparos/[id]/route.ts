import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canEditFinance } from "@/lib/roles";

const schema = z.object({
  porContaDepot: z.boolean(),
});

// Marca/desmarca um reparo como "por conta do Depot" (feito, mas não cobrado
// do armador). Ao marcar, limpa qualquer valor já lançado.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await db
    .updateTable("reparos")
    .set(
      parsed.data.porContaDepot
        ? { por_conta_depot: true, valor_faturado: null, faturado_por: null, faturado_em: null }
        : { por_conta_depot: false }
    )
    .where("id", "=", id)
    .execute();

  return NextResponse.json({ ok: true });
}

// Exclui um reparo registrado por engano.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  await db.deleteFrom("reparos").where("id", "=", id).execute();

  return NextResponse.json({ ok: true });
}
