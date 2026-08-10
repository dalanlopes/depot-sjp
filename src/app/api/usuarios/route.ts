import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, generateSetupToken } from "@/lib/auth";
import { canManageUsers, ALL_TABS, ROLE_LABELS } from "@/lib/roles";

const SETUP_TOKEN_VALIDADE_DIAS = 7;

// Deriva a lista de perfis válidos de ROLE_LABELS (fonte única de verdade em
// src/lib/roles.ts), em vez de repetir os valores aqui — assim um perfil novo
// nunca mais fica esquecido nesta validação.
const ROLE_VALUES = Object.keys(ROLE_LABELS) as [string, ...string[]];

const schema = z.object({
  nome: z.string().min(2),
  email: z.string().email("E-mail inválido."),
  role: z.enum(ROLE_VALUES),
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
    .select([
      "id",
      "nome",
      "email",
      "role",
      "ativo",
      "criado_em",
      "tabs",
      "pode_ver_faturamento",
      "senha_hash",
      "setup_token",
      "setup_token_expira",
    ])
    .orderBy("nome", "asc")
    .execute();

  const usuarios = rows.map(({ senha_hash, setup_token, setup_token_expira, ...u }) => ({
    ...u,
    senhaDefinida: !!senha_hash,
    // Só expõe o código de convite enquanto ele ainda for válido, para o
    // admin poder reenviar/copiar sem precisar gerar outro.
    codigoConvite:
      setup_token && setup_token_expira && new Date(setup_token_expira as unknown as string) > new Date()
        ? setup_token
        : null,
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

  // Usuário é criado sem senha: só define a senha com o código de convite
  // abaixo (evita que qualquer um que descubra o e-mail sequestre a conta
  // antes do dono real fazer o primeiro acesso).
  const setupToken = generateSetupToken();
  const setupTokenExpira = new Date(Date.now() + SETUP_TOKEN_VALIDADE_DIAS * 24 * 60 * 60 * 1000);

  await db
    .insertInto("users")
    .values({
      nome: parsed.data.nome,
      email,
      senha_hash: null,
      role: parsed.data.role as never,
      tabs: parsed.data.tabs.length > 0 ? parsed.data.tabs : null,
      pode_ver_faturamento: parsed.data.podeVerFaturamento,
      setup_token: setupToken,
      setup_token_expira: setupTokenExpira.toISOString(),
    })
    .execute();

  // Se havia uma solicitação de acesso pendente para esse e-mail, remove.
  await db.deleteFrom("solicitacoes_acesso").where("email", "=", email).execute();

  return NextResponse.json({ ok: true, codigoConvite: setupToken }, { status: 201 });
}
