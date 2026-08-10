import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canDeleteOcorrencia, canRegisterOcorrencia } from "@/lib/roles";
import { startOfDayBR, endOfDayBR, addDaysBR, todayBR } from "@/lib/tz";

const schema = z.object({
  data: z.string().min(1),
  motivo: z.string().min(3),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "ocorrencias") && !canAccessTab(session, "dashboard")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const inicioParam = searchParams.get("inicio");
  const fimParam = searchParams.get("fim");
  const dias = Number(searchParams.get("dias") ?? "14");
  const desde = addDaysBR(todayBR(), -Math.abs(dias));

  let query = db
    .selectFrom("ocorrencias as o")
    .leftJoin("users as u", "u.id", "o.criado_por_id")
    .select(["o.id", "o.data", "o.motivo", "u.nome as criado_por"])
    .orderBy("o.data", "desc")
    .limit(500);

  // Relatórios podem pedir um período explícito (inicio/fim) em vez de "dias".
  if (inicioParam && /^\d{4}-\d{2}-\d{2}$/.test(inicioParam)) {
    query = query.where("o.data", ">=", startOfDayBR(inicioParam).toISOString());
  } else {
    query = query.where("o.data", ">=", startOfDayBR(desde).toISOString());
  }
  if (fimParam && /^\d{4}-\d{2}-\d{2}$/.test(fimParam)) {
    query = query.where("o.data", "<=", endOfDayBR(fimParam).toISOString());
  }

  const ocorrencias = await query.execute();

  return NextResponse.json({ ocorrencias, podeExcluir: canDeleteOcorrencia(session.role) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "ocorrencias") || !canRegisterOcorrencia(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Preencha data e motivo." }, { status: 400 });
  }

  await db
    .insertInto("ocorrencias")
    .values({
      data: startOfDayBR(parsed.data.data).toISOString(),
      motivo: parsed.data.motivo,
      criado_por_id: session.userId,
    })
    .execute();

  return NextResponse.json({ ok: true });
}
