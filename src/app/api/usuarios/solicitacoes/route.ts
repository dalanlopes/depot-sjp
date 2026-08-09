import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const solicitacoes = await db
    .selectFrom("solicitacoes_acesso")
    .selectAll()
    .orderBy("criado_em", "asc")
    .execute();

  return NextResponse.json({ solicitacoes });
}
