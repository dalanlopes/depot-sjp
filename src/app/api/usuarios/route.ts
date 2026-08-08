import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email("E-mail inválido."),
  senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
  role: z.enum(["MECANICO", "ANALISTA_PROGRAMACAO", "ANALISTA_FATURAMENTO", "GESTOR"]),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const usuarios = await db
    .selectFrom("users")
    .select(["id", "nome", "email", "role", "ativo", "criado_em"])
    .orderBy("nome", "asc")
    .execute();

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

  const senha_hash = await hashPassword(parsed.data.senha);

  await db
    .insertInto("users")
    .values({
      nome: parsed.data.nome,
      email,
      senha_hash,
      role: parsed.data.role,
    })
    .execute();

  return NextResponse.json({ ok: true }, { status: 201 });
}
