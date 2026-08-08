import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canRegisterCollection } from "@/lib/roles";

const schema = z.object({
  containerNumero: z.string().min(4).optional(),
  data: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canRegisterCollection(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const pendente = await db
    .selectFrom("coletas")
    .selectAll()
    .where("id", "=", id)
    .where("status", "=", "PENDENTE")
    .executeTakeFirst();

  if (!pendente) {
    return NextResponse.json({ error: "Coleta pendente não encontrada." }, { status: 404 });
  }

  let numero = pendente.container_numero;

  if (pendente.tipo_carga === "VAZIO") {
    const informado = parsed.data.containerNumero?.trim().toUpperCase();
    if (!informado) {
      return NextResponse.json({ error: "Informe a numeração do container." }, { status: 400 });
    }
    const container = await db
      .selectFrom("containers")
      .selectAll()
      .where("numero", "=", informado)
      .executeTakeFirst();
    if (!container) {
      return NextResponse.json({ error: "Container não encontrado no estoque." }, { status: 404 });
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
      .where("container_numero", "=", informado)
      .where("status", "=", "CONCLUIDO")
      .executeTakeFirst();
    if (jaColetado) {
      return NextResponse.json({ error: "Este container já foi coletado." }, { status: 409 });
    }
    numero = informado;
  }

  let dataSaida = new Date().toISOString();
  if (parsed.data.data) {
    const d = new Date(`${parsed.data.data}T12:00:00`);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Data de saída inválida." }, { status: 400 });
    }
    dataSaida = d.toISOString();
  }

  await db
    .updateTable("coletas")
    .set({ container_numero: numero, status: "CONCLUIDO", data: dataSaida })
    .where("id", "=", id)
    .execute();

  return NextResponse.json({ ok: true });
}
