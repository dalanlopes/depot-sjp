import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canEditProgramacao } from "@/lib/roles";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "programacao") || !canEditProgramacao(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;

  const programacao = await db
    .selectFrom("programacoes")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();
  if (!programacao) {
    return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
  }

  const concluidas = await db
    .selectFrom("coletas")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("programacao_id", "=", id)
    .where("status", "=", "CONCLUIDO")
    .executeTakeFirst();

  if (Number(concluidas?.total ?? 0) > 0) {
    return NextResponse.json(
      { error: "Essa programação já tem coletas concluídas e não pode ser excluída." },
      { status: 409 }
    );
  }

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("coletas").where("programacao_id", "=", id).execute();
    await trx.deleteFrom("programacoes").where("id", "=", id).execute();
  });

  return NextResponse.json({ ok: true });
}
