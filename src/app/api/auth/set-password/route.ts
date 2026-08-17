import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { resolveTabs } from "@/lib/roles";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email("E-mail inválido."),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  codigo: z.string().min(1, "Informe o código de convite enviado pelo administrador."),
});

// Usado no primeiro acesso (ou após um reset de senha pelo admin). Só define
// a senha se a conta ainda não tiver uma (senha_hash nulo) E o código de
// convite enviado bater com o gerado pelo admin ao criar/resetar o usuário
// (e ainda não tiver expirado). Isso evita que qualquer pessoa que descubra
// um e-mail cadastrado consiga sequestrar a conta antes do dono definir a
// própria senha.
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
  const codigo = parsed.data.codigo.trim().toUpperCase();

  const ip = clientIp(req);
  const okIp = await checkRateLimit(`set-password:ip:${ip}`, { max: 15, janelaSegundos: 15 * 60 });
  const okEmail = await checkRateLimit(`set-password:email:${email}`, { max: 8, janelaSegundos: 15 * 60 });
  if (!okIp || !okEmail) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429 }
    );
  }

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

  const tokenValido =
    !!user.setup_token &&
    user.setup_token === codigo &&
    !!user.setup_token_expira &&
    new Date(user.setup_token_expira as unknown as string).getTime() > Date.now();

  if (!tokenValido) {
    return NextResponse.json(
      { error: "Código de convite inválido ou expirado. Peça para o administrador gerar um novo em Usuários." },
      { status: 401 }
    );
  }

  const senha_hash = await hashPassword(parsed.data.senha);
  await db
    .updateTable("users")
    .set({
      senha_hash,
      setup_token: null,
      setup_token_expira: null,
    })
    .where("id", "=", user.id)
    .execute();

  await setSessionCookie({
    userId: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    tabs: resolveTabs(user.role, user.tabs),
    podeVerFaturamento: user.pode_ver_faturamento,
    podeEditarStatus: user.pode_editar_status,
    sessionVersion: user.session_version,
  });

  return NextResponse.json({ ok: true });
}
