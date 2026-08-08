import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL não configurada.");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  const sql = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  console.log("Aplicando schema...");
  await pool.query(sql);
  console.log("Schema aplicado com sucesso.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
