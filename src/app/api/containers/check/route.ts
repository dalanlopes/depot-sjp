import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab } from "@/lib/roles";

// Checagem rápida de um único container contra o estoque, usada pela Oficina
// (Mecânico não tem acesso à aba Estoque, então não pode usar /api/containers).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "oficina") && !canAccessTab(session, "estoque")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const numero = req.nextUrl.searchParams.get("numero")?.trim().toUpperCase();
  if (!numero) {
    return NextResponse.json({ error: "Informe o número do container." }, { status: 400 });
  }

  const container = await db
    .selectFrom("containers")
    .select(["numero", "armador", "padrao", "status"])
    .where("numero", "=", numero)
    .executeTakeFirst();

  if (!container) {
    return NextResponse.json({ existe: false });
  }

  return NextResponse.json({ existe: true, container });
}
