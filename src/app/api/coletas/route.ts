import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canAccessTab, canRegisterCollection } from "@/lib/roles";
import { todayBR, addDaysBR, startOfDayBR, endOfDayBR } from "@/lib/tz";

const schema = z.object({
  containerNumero: z.string().min(4),
  codigoCmVeiculo: z.string().min(1),
  data: z.string().optional(), // data de saída (YYYY-MM-DD); se ausente, usa agora
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canAccessTab(session, "coletas")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;

  if (searchParams.get("tipo") === "pendentes") {
    const pendentesRaw = await db
      .selectFrom("coletas as co")
      .innerJoin("programacoes as p", "p.id", "co.programacao_id")
      .select([
        "co.id",
        "p.id as programacao_id",
        "p.data_retirada",
        "p.solicitante",
        "p.destino",
        "p.armador",
        "p.quantidade as programacao_quantidade",
      ])
      .where("co.status", "=", "PENDENTE")
      .orderBy("p.data_retirada", "asc")
      .limit(500)
      .execute();

    // node-postgres parses `date` columns into JS Date objects; normalize to
    // a plain YYYY-MM-DD string so the client never has to guess the shape.
    const normalizados = pendentesRaw.map((p) => ({
      ...p,
      data_retirada:
        (p.data_retirada as unknown) instanceof Date
          ? (p.data_retirada as unknown as Date).toISOString().slice(0, 10)
          : String(p.data_retirada).slice(0, 10),
    }));

    return NextResponse.json({ pendentes: normalizados });
  }

  const inicioParam = searchParams.get("inicio");
  const fimParam = searchParams.get("fim");

  const fimYmd = fimParam ?? todayBR();
  const inicioYmd = inicioParam ?? addDaysBR(fimYmd, -29);
  const fim = endOfDayBR(fimYmd);
  const inicio = startOfDayBR(inicioYmd);

  const coletas = await db
    .selectFrom("coletas as co")
    .leftJoin("containers as c", "c.numero", "co.container_numero")
    .select([
      "co.id",
      "co.container_numero",
      "c.armador",
      "c.padrao",
      "co.codigo_cm_veiculo",
      "co.data",
      "co.tipo_carga",
      "co.cliente",
    ])
    .where("co.status", "=", "CONCLUIDO")
    .where("co.data", ">=", inicio.toISOString())
    .where("co.data", "<=", fim.toISOString())
    .orderBy("co.data", "desc")
    .limit(1000)
    .execute();

  return NextResponse.json({
    coletas,
    total: coletas.length,
    inicio: inicioYmd,
    fim: fimYmd,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canRegisterCollection(session)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Preencha o código CM e o número do container." }, { status: 400 });
  }

  const numero = parsed.data.containerNumero.trim().toUpperCase();

  const container = await db
    .selectFrom("containers")
    .selectAll()
    .where("numero", "=", numero)
    .executeTakeFirst();

  if (!container) {
    return NextResponse.json({ error: "Container não encontrado." }, { status: 404 });
  }
  if (container.status !== "OK") {
    return NextResponse.json(
      { error: `Container não está disponível (status atual: ${container.status}).` },
      { status: 409 }
    );
  }

  const existing = await db
    .selectFrom("coletas")
    .select("id")
    .where("container_numero", "=", numero)
    .where("status", "=", "CONCLUIDO")
    .executeTakeFirst();
  if (existing) {
    return NextResponse.json({ error: "Este container já foi coletado." }, { status: 409 });
  }

  let dataSaida = new Date().toISOString();
  if (parsed.data.data) {
    const d = new Date(`${parsed.data.data}T12:00:00-03:00`);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Data de saída inválida." }, { status: 400 });
    }
    dataSaida = d.toISOString();
  }

  await db
    .insertInto("coletas")
    .values({
      container_numero: numero,
      codigo_cm_veiculo: parsed.data.codigoCmVeiculo,
      status: "CONCLUIDO",
      data: dataSaida,
      criado_por_id: session.userId,
    })
    .execute();

  return NextResponse.json({ ok: true });
}
