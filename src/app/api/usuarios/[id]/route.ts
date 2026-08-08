import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";

const schema = z.object({
  ativo: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await db
    .updateTable("users")
    .set({ ativo: parsed.data.ativo })
    .where("id", "=", id)
    .execute();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "Você não pode remover seu próprio usuário." }, { status: 400 });
  }

  try {
    await db.deleteFrom("users").where("id", "=", id).execute();
  } catch {
    return NextResponse.json(
      {
        error:
          "Esse usuário já tem registros no sistema (reparos, coletas, etc) e não pode ser excluído. Use Desativar.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
