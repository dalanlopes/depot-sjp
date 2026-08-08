import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

const schema = z.object({
  usuario: z.string().min(1),
  senha: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { usuario, senha } = parsed.data;
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("usuario", "=", usuario)
    .where("ativo", "=", true)
    .executeTakeFirst();

  if (!user) {
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  const valid = await verifyPassword(senha, user.senha_hash);
  if (!valid) {
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  await setSessionCookie({
    userId: user.id,
    nome: user.nome,
    usuario: user.usuario,
    role: user.role,
  });

  return NextResponse.json({ ok: true });
}
