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

// Exclui um reparo registrado por engano. Se for o reparo mais recente do
// container, restaura o status anterior (evita que o container continue
// marcado como "OK"/disponível no estoque depois que o reparo é apagado).
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

  const reparo = await db
    .selectFrom("reparos")
    .select(["id", "container_numero", "data", "status_anterior"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!reparo) {
    return NextResponse.json({ error: "Reparo não encontrado." }, { status: 404 });
  }

  await db.transaction().execute(async (trx) => {
    const maisRecente = await trx
      .selectFrom("reparos")
      .select(["id"])
      .where("container_numero", "=", reparo.container_numero)
      .orderBy("data", "desc")
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirst();

    await trx.deleteFrom("reparos").where("id", "=", id).execute();

    if (maisRecente?.id === reparo.id && reparo.status_anterior) {
      await trx
        .updateTable("containers")
        .set({ status: reparo.status_anterior, atualizado_em: new Date().toISOString() })
        .where("numero", "=", reparo.container_numero)
        .execute();
    }
  });

  return NextResponse.json({ ok: true });
}
