import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageUsers, ALL_TABS } from "@/lib/roles";

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email("E-mail inválido."),
  role: z.enum(["MECANICO", "ANALISTA_PROGRAMACAO", "ANALISTA_FATURAMENTO", "GESTOR"]),
  tabs: z.array(z.enum(ALL_TABS as [string, ...string[]])).default([]),
  podeVerFaturamento: z.boolean().default(false),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const rows = await db
    .selectFrom("users")
    .select(["id", "nome", "email", "role", "ativo", "criado_em", "tabs", "pode_ver_faturamento", "senha_hash"])
    .orderBy("nome", "asc")
    .execute();

  const usuarios = rows.map(({ senha_hash, ...u }) => ({
    ...u,
    senhaDefinida: !!senha_hash,
  }));

  return NextResponse.json({ usuarios });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existing = await db
    .selectFrom("users")
    .select(["id"])
    .where("email", "=", email)
    .executeTakeFirst();
  if (existing) {
    return NextResponse.json({ error: "Já existe um usuário com esse e-mail." }, { status: 409 });
  }

  // Usuário é criado sem senha: ele mesmo cria a senha no primeiro acesso.
  await db
    .insertInto("users")
    .values({
      nome: parsed.data.nome,
      email,
      senha_hash: null,
      role: parsed.data.role,
      tabs: parsed.data.tabs.length > 0 ? parsed.data.tabs : null,
      pode_ver_faturamento: parsed.data.podeVerFaturamento,
    })
    .execute();

  // Se havia uma solicitação de acesso pendente para esse e-mail, remove.
  await db.deleteFrom("solicitacoes_acesso").where("email", "=", email).execute();

  return NextResponse.json({ ok: true }, { status: 201 });
}
