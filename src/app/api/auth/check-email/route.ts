import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().email("E-mail inválido."),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  const user = await db
    .selectFrom("users")
    .select(["id", "ativo", "senha_hash"])
    .where("email", "=", email)
    .executeTakeFirst();

  if (!user) {
    // E-mail não cadastrado: registra uma solicitação para o admin autorizar.
    await db
      .insertInto("solicitacoes_acesso")
      .values({ email })
      .onConflict((oc) => oc.column("email").doNothing())
      .execute();
    return NextResponse.json({ status: "requested" });
  }

  if (!user.ativo) {
    return NextResponse.json({ status: "inactive" });
  }

  if (!user.senha_hash) {
    return NextResponse.json({ status: "first_access" });
  }

  return NextResponse.json({ status: "has_password" });
}
