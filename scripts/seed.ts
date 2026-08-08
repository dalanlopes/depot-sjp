import { Pool } from "pg";
import bcrypt from "bcryptjs";

const USERS = [
  { nome: "Gestor Depot", usuario: "gestor", senha: "gestor123", role: "GESTOR" },
  { nome: "Mecânico Oficina", usuario: "mecanico", senha: "mecanico123", role: "MECANICO" },
  { nome: "Analista Programação", usuario: "programacao", senha: "prog123", role: "ANALISTA_PROGRAMACAO" },
  { nome: "Analista Faturamento", usuario: "faturamento", senha: "fatur123", role: "ANALISTA_FATURAMENTO" },
];

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

  for (const u of USERS) {
    const hash = await bcrypt.hash(u.senha, 10);
    await pool.query(
      `INSERT INTO users (nome, usuario, senha_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario) DO UPDATE SET senha_hash = EXCLUDED.senha_hash`,
      [u.nome, u.usuario, hash, u.role]
    );
    console.log(`Usuário criado/atualizado: ${u.usuario} (${u.role}) - senha: ${u.senha}`);
  }

  await pool.end();
  console.log("\nIMPORTANTE: troque essas senhas assim que possível em produção.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
