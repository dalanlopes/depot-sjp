import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canEditProgramacao } from "@/lib/roles";

const patchSchema = z.object({
  removerQuantidade: z.number().int().min(1),
});

// Remove N vagas ainda pendentes (sem container/CM preenchidos) de uma
// programação, reduzindo a quantidade solicitada — para quando o pedido
// original é reduzido e sobram vagas que não vão mais ser usadas. Nunca mexe
// nas coletas já concluídas. Se remover tudo que resta e não há nada
// concluído, apaga a programação inteira.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "programacao") || !canEditProgramacao(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe uma quantidade válida." }, { status: 400 });
  }

  const programacao = await db
    .selectFrom("programacoes")
    .select(["id", "quantidade"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!programacao) {
    return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
  }

  const pendentesRow = await db
    .selectFrom("coletas")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("programacao_id", "=", id)
    .where("status", "=", "PENDENTE")
    .executeTakeFirst();
  const pendentes = Number(pendentesRow?.total ?? 0);

  const n = parsed.data.removerQuantidade;
  if (n > pendentes) {
    return NextResponse.json(
      { error: `Só é possível remover até ${pendentes} vaga(s) — o restante já foi coletado.` },
      { status: 409 }
    );
  }

  const novaQuantidade = programacao.quantidade - n;

  await db.transaction().execute(async (trx) => {
    // Apaga N vagas pendentes quaisquer (ainda não têm container/CM, então
    // são intercambiáveis) usando uma subquery, já que DELETE não aceita
    // LIMIT diretamente no Postgres.
    await trx
      .deleteFrom("coletas")
      .where("id", "in", (eb) =>
        eb
          .selectFrom("coletas")
          .select("id")
          .where("programacao_id", "=", id)
          .where("status", "=", "PENDENTE")
          .limit(n)
      )
      .execute();

    if (novaQuantidade <= 0) {
      await trx.deleteFrom("programacoes").where("id", "=", id).execute();
    } else {
      await trx.updateTable("programacoes").set({ quantidade: novaQuantidade }).where("id", "=", id).execute();
    }
  });

  return NextResponse.json({ ok: true, quantidade: Math.max(novaQuantidade, 0) });
}

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
