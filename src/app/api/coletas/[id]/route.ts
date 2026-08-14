import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canRegisterCollection } from "@/lib/roles";
import { todayBR } from "@/lib/tz";

// Normaliza um valor de data vindo do Postgres (pode chegar como Date ou
// como string, dependendo do driver) para YYYY-MM-DD.
function toYmd(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

const schema = z.object({
  containerNumero: z.string().min(4, "Informe a numeração do container."),
  codigoCmVeiculo: z.string().min(1, "Informe o código do CM."),
  data: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canRegisterCollection(session)) {
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

  const pendente = await db
    .selectFrom("coletas")
    .selectAll()
    .where("id", "=", id)
    .where("status", "=", "PENDENTE")
    .executeTakeFirst();

  if (!pendente) {
    return NextResponse.json({ error: "Coleta pendente não encontrada." }, { status: 404 });
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
  let dataRetirada: string | null = null;
  if (pendente.programacao_id) {
    const programacao = await db
      .selectFrom("programacoes")
      .select(["armador", "data_retirada"])
      .where("id", "=", pendente.programacao_id)
      .executeTakeFirst();
    if (programacao && programacao.armador !== container.armador) {
      return NextResponse.json(
        {
          error: `Esse container é do armador ${container.armador}, mas a programação é do armador ${programacao.armador}. Use um container do mesmo armador.`,
        },
        { status: 409 }
      );
    }
    if (programacao) dataRetirada = toYmd(programacao.data_retirada);
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

  // Sem data informada explicitamente: usa a data solicitada na Programação
  // (não o momento em que o analista confirma no sistema), pra não contar a
  // coleta no dia errado quando ela é registrada depois (ex.: de madrugada,
  // ou no dia seguinte ao da retirada combinada).
  let dataSaida = new Date(`${dataRetirada ?? todayBR()}T12:00:00-03:00`).toISOString();
  if (parsed.data.data) {
    const d = new Date(`${parsed.data.data}T12:00:00-03:00`);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Data de saída inválida." }, { status: 400 });
    }
    dataSaida = d.toISOString();
  }

  await db
    .updateTable("coletas")
    .set({
      container_numero: numero,
      codigo_cm_veiculo: parsed.data.codigoCmVeiculo.trim(),
      status: "CONCLUIDO",
      data: dataSaida,
    })
    .where("id", "=", id)
    .execute();

  return NextResponse.json({ ok: true });
}

// Exclui uma coleta já concluída (ex.: registrada por engano). Se ela veio de
// uma Programação, a vaga volta a ficar pendente para o analista refazer;
// se for avulsa, o registro é removido de vez.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canRegisterCollection(session)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;

  const coleta = await db
    .selectFrom("coletas")
    .select(["id", "programacao_id"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!coleta) {
    return NextResponse.json({ error: "Coleta não encontrada." }, { status: 404 });
  }

  if (coleta.programacao_id) {
    await db
      .updateTable("coletas")
      .set({
        container_numero: null,
        codigo_cm_veiculo: null,
        status: "PENDENTE",
        data: null,
      })
      .where("id", "=", id)
      .execute();
  } else {
    await db.deleteFrom("coletas").where("id", "=", id).execute();
  }

  return NextResponse.json({ ok: true });
}
