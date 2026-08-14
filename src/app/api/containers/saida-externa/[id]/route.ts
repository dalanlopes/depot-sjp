import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canImportData } from "@/lib/roles";

// Exclui um lançamento de saída externa feito por engano (ex.: linha errada
// na planilha). O container volta a contar como disponível em estoque.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canImportData(session)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const existe = await db
    .selectFrom("saidas_externas")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();
  if (!existe) {
    return NextResponse.json({ error: "Saída não encontrada." }, { status: 404 });
  }

  await db.deleteFrom("saidas_externas").where("id", "=", id).execute();
  return NextResponse.json({ ok: true });
}
