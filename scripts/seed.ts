import { Pool } from "pg";
import bcrypt from "bcryptjs";

const USERS = [
  { nome: "Admin Depot", email: "admin@depotsjp.local", senha: "admin123", role: "GESTOR" },
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
      `INSERT INTO users (nome, email, senha_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash`,
      [u.nome, u.email, hash, u.role]
    );
    console.log(`Usuário criado/atualizado: ${u.email} (${u.role}) - senha: ${u.senha}`);
  }

  await pool.end();
  console.log("\nIMPORTANTE: troque essas senhas assim que possível em produção.");
  console.log("Usuários adicionais podem ser criados pela tela Usuários (perfil Gestor) dentro do sistema.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
