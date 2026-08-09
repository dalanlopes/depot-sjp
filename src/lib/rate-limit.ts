import { sql } from "kysely";
import { db } from "./db";
import type { NextRequest } from "next/server";

// Limitador simples baseado no banco (sem depender de infraestrutura extra
// tipo Redis). Cada chamada soma 1 na tentativa da "chave" dentro da janela
// atual; se a janela expirou, reinicia o contador. Retorna false quando o
// limite foi estourado (chamador deve responder 429).
export async function checkRateLimit(
  chave: string,
  opts: { max: number; janelaSegundos: number }
): Promise<boolean> {
  const agora = new Date();

  const row = await db
    .selectFrom("rate_limits")
    .select(["tentativas", "janela_inicio"])
    .where("chave", "=", chave)
    .executeTakeFirst();

  if (!row) {
    await db
      .insertInto("rate_limits")
      .values({ chave, tentativas: 1, janela_inicio: agora.toISOString() })
      .onConflict((oc) =>
        oc.column("chave").doUpdateSet({ tentativas: 1, janela_inicio: agora.toISOString() })
      )
      .execute();
    return true;
  }

  const janelaInicio = new Date(row.janela_inicio as unknown as string);
  const decorridoMs = agora.getTime() - janelaInicio.getTime();

  if (decorridoMs > opts.janelaSegundos * 1000) {
    // Janela expirou: reinicia.
    await db
      .updateTable("rate_limits")
      .set({ tentativas: 1, janela_inicio: agora.toISOString() })
      .where("chave", "=", chave)
      .execute();
    return true;
  }

  if (row.tentativas >= opts.max) {
    return false;
  }

  await db
    .updateTable("rate_limits")
    .set({ tentativas: sql`tentativas + 1` })
    .where("chave", "=", chave)
    .execute();
  return true;
}

// IP do cliente a partir dos headers padrão que a Vercel/Next preenchem
// atrás de proxy. Sem "req.ip" nativo nas Route Handlers do App Router.
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
