/**
 * Roda SQL avulso contra o Postgres e imprime o resultado em tabela.
 *
 *   npm run db:query -- "SELECT email, variant_id FROM stock_alerts"
 *   npm run db:query -- --file db/queries/waited-items.sql
 *   npm run db:alerts
 *
 * Substitui o `wrangler d1 execute --command/--file`. Existe para inspeção
 * manual — é o que responde "o clique gravou mesmo?" sem abrir o painel do
 * Supabase.
 *
 * A opção `--file` não é conveniência: no PowerShell, `||` (concatenação do
 * SQL) é operador de shell e corrompe a query quando passada como argumento.
 * Consultas com `||` precisam vir de arquivo — foi por isso que
 * db/queries/waited-items.sql nasceu.
 */

import { readFileSync } from "node:fs";
import postgres from "postgres";

const loadEnv = () => {
  if (process.env.DATABASE_URL) return;
  try {
    process.loadEnvFile(".env");
  } catch {
    // Sem .env: o erro útil é o de DATABASE_URL abaixo.
  }
};

const main = async () => {
  loadEnv();

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definida (veja o .env).");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const fileFlag = args.indexOf("--file");
  const query =
    fileFlag !== -1 ? readFileSync(args[fileFlag + 1], "utf8") : args.filter(Boolean).join(" ");

  if (!query.trim()) {
    console.error('Passe o SQL: npm run db:query -- "SELECT 1"  (ou --file caminho.sql)');
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    const rows = await sql.unsafe(query);
    if (rows.length === 0) {
      console.log("(sem linhas)");
      return;
    }
    console.table(rows);
    console.log(`${rows.length} linha(s).`);
  } finally {
    await sql.end();
  }
};

main().catch((error) => {
  console.error("falhou:", error instanceof Error ? error.message : error);
  process.exit(1);
});
