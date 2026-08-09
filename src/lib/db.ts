import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { Database } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __depotDb: Kysely<Database> | undefined;
}

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Defina a connection string do Postgres (Supabase) nas variáveis de ambiente."
    );
  }
  const schema = process.env.DB_SCHEMA?.trim();

  const pool = new Pool({
    connectionString,
    // Valida o certificado do Postgres (Supabase) em vez de aceitar
    // qualquer um: evita interceptação da conexão com o banco.
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: true },
    max: 5,
  });

  if (schema && schema !== "public") {
    pool.on("connect", (client) => {
      client.query(`set search_path to "${schema}", public`).catch(() => {});
    });
  }

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}

export const db = globalThis.__depotDb ?? createDb();
if (process.env.NODE_ENV !== "production") {
  globalThis.__depotDb = db;
}
