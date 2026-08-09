import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { resolveTabs } from "@/lib/roles";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email("E-mail inválido."),
  senha: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { email, senha } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  const ip = clientIp(req);
  const okIp = await checkRateLimit(`login:ip:${ip}`, { max: 20, janelaSegundos: 15 * 60 });
  const okEmail = await checkRateLimit(`login:email:${emailNorm}`, { max: 8, janelaSegundos: 15 * 60 });
  if (!okIp || !okEmail) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429 }
    );
  }

  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", emailNorm)
    .where("ativo", "=", true)
    .executeTakeFirst();

  if (!user || !user.senha_hash) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const valid = await verifyPassword(senha, user.senha_hash);
  if (!valid) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  await setSessionCookie({
    userId: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    tabs: resolveTabs(user.role, user.tabs),
    podeVerFaturamento: user.pode_ver_faturamento,
    sessionVersion: user.session_version,
  });

  return NextResponse.json({ ok: true });
}
