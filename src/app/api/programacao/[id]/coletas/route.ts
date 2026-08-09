import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canRegisterCollection } from "@/lib/roles";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "programacao") && !canAccessTab(session, "coletas")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;

  const coletas = await db
    .selectFrom("coletas as co")
    .leftJoin("containers as c", "c.numero", "co.container_numero")
    .select([
      "co.id",
      "co.container_numero",
      "co.codigo_cm_veiculo",
      "co.status",
      "co.data",
      "c.padrao",
    ])
    .where("co.programacao_id", "=", id)
    .orderBy("co.status", "asc")
    .orderBy("co.data", "desc")
    .execute();

  return NextResponse.json({ coletas });
}

// Adiciona um container extra à mesma programação/CM além das vagas já
// geradas automaticamente (ex.: 2º container no mesmo veículo/CM).
const schema = z.object({
  containerNumero: z.string().min(4, "Informe a numeração do container."),
  codigoCmVeiculo: z.string().min(1, "Informe o código do CM."),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canRegisterCollection(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const programacao = await db
    .selectFrom("programacoes")
    .select(["id", "armador"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!programacao) {
    return NextResponse.json({ error: "Programação não encontrada." }, { status: 404 });
  }

  const numero = parsed.data.containerNumero.trim().toUpperCase();

  const container = await db
    .selectFrom("containers")
    .selectAll()
    .where("numero", "=", numero)
    .executeTakeFirst();
  if (!container) {
    return NextResponse.json({ error: "Container não encontrado no estoque." }, { status: 404 });
  }
  if (programacao.armador !== container.armador) {
    return NextResponse.json(
      {
        error: `Esse container é do armador ${container.armador}, mas a programação é do armador ${programacao.armador}. Use um container do mesmo armador.`,
      },
      { status: 409 }
    );
  }
  if (container.status !== "OK") {
    return NextResponse.json(
      { error: `Container não está disponível (status atual: ${container.status}).` },
      { status: 409 }
    );
  }
  const jaColetado = await db
    .selectFrom("coletas")
    .select("id")
    .where("container_numero", "=", numero)
    .where("status", "=", "CONCLUIDO")
    .executeTakeFirst();
  if (jaColetado) {
    return NextResponse.json({ error: "Este container já foi coletado." }, { status: 409 });
  }

  await db
    .insertInto("coletas")
    .values({
      container_numero: numero,
      codigo_cm_veiculo: parsed.data.codigoCmVeiculo.trim(),
      status: "CONCLUIDO",
      data: new Date().toISOString(),
      programacao_id: id,
      criado_por_id: session.userId,
    })
    .execute();

  return NextResponse.json({ ok: true });
}
