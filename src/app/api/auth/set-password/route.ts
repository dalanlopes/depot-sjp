import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { resolveTabs } from "@/lib/roles";

const schema = z.object({
  email: z.string().email("E-mail inválido."),
  senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

// Usado no primeiro acesso (ou após um reset de senha pelo admin): o usuário
// só pode definir a senha por aqui se ainda não tiver uma (senha_hash nulo).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", email)
    .where("ativo", "=", true)
    .executeTakeFirst();

  if (!user) {
    return NextResponse.json({ error: "E-mail não autorizado." }, { status: 404 });
  }
  if (user.senha_hash) {
    return NextResponse.json(
      { error: "Esse usuário já tem senha. Faça login normalmente." },
      { status: 409 }
    );
  }

  const senha_hash = await hashPassword(parsed.data.senha);
  await db.updateTable("users").set({ senha_hash }).where("id", "=", user.id).execute();

  await setSessionCookie({
    userId: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    tabs: resolveTabs(user.role, user.tabs),
    podeVerFaturamento: user.pode_ver_faturamento,
  });

  return NextResponse.json({ ok: true });
}
