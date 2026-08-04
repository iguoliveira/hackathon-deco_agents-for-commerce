/**
 * Aplica db/migrations/*.sql no Postgres, em ordem, uma única vez cada.
 *
 *   npm run db:migrate            # aplica o que falta
 *   npm run db:migrate -- --list  # só mostra o que já rodou e o que falta
 *
 * Substitui o `wrangler d1 migrations apply`, que sumiu junto com o D1. Mantém
 * a mesma propriedade que deixava o `predev` seguro: uma tabela de controle
 * (`schema_migrations`) registra o que já rodou, então rodar duas vezes é no-op.
 *
 * Cada arquivo é enviado INTEIRO em um `unsafe()`, sem separar por `;`. Isso é
 * deliberado: 0003 tem 244 KB de INSERTs com descrições de produto, e qualquer
 * split ingênuo por ponto-e-vírgula quebraria na primeira descrição que
 * contivesse um. O Postgres aceita múltiplos statements numa tacada só.
 *
 * Tudo dentro de uma transação por arquivo: se a 0003 falhar no meio, ela não
 * fica metade aplicada e sem registro — ou entra inteira, ou não entra.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { redact, resolveDatabaseUrl } from "./db-url";

const MIGRATIONS_DIR = "db/migrations";

const main = async () => {
  const url = resolveDatabaseUrl();

  // `max: 1` porque migration é sequencial por natureza, e o pooler em modo
  // transação não garante a mesma conexão entre statements de conexões
  // diferentes — o que quebraria a transação por arquivo.
  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const applied = new Set(
      (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // `--reset` exige confirmação explícita, ao contrário do db:reset antigo.
    // Lá ele apagava um arquivo .sqlite na máquina de quem rodou; aqui o alvo é
    // um banco remoto que pode ser o mesmo do resto do time — e leva junto o
    // `stock_alerts`, que é histórico de demanda e não se regenera com seed.
    if (process.argv.includes("--reset")) {
      if (!process.argv.includes("--confirm")) {
        console.error(
          "--reset APAGA todas as tabelas do banco apontado por DATABASE_URL,\n" +
            "incluindo stock_alerts (o histórico de desejos, que o seed não recria).\n\n" +
            `Alvo: ${redact(url)}\n\n` +
            "Se é isso mesmo: npm run db:reset -- --confirm",
        );
        process.exit(1);
      }

      await sql.unsafe(`
        DROP TABLE IF EXISTS variant_options, product_props, product_images,
                             variants, products, stock_alerts, schema_migrations CASCADE
      `);
      // schema_migrations cai junto no DROP acima — sem recriar, o INSERT de
      // controle no fim de cada migration falharia.
      await sql`
        CREATE TABLE schema_migrations (
          name       TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      console.log("tabelas derrubadas; reaplicando do zero.\n");
      applied.clear();
    }

    if (process.argv.includes("--list")) {
      for (const file of files) {
        console.log(`${applied.has(file) ? "  aplicada" : "  PENDENTE"}  ${file}`);
      }
      return;
    }

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log("Nada a aplicar — banco em dia.");
      return;
    }

    for (const file of pending) {
      const contents = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`aplicando ${file} ... `);

      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
      });

      console.log("ok");
    }

    console.log(`\n${pending.length} migration(s) aplicada(s).`);
  } finally {
    await sql.end();
  }
};

/**
 * Erro de conexão do driver costuma vir com `message` VAZIA e o motivo real em
 * `code`/`errno`/`cause` — imprimir só a message deixa a falha indistinguível
 * de "não aconteceu nada".
 */
const report = (error: unknown): void => {
  console.error("\nfalhou:");

  if (!(error instanceof Error)) {
    console.error(error);
    return;
  }

  console.error("  message:", error.message || "(vazia)");
  for (const key of [
    "code",
    "errno",
    "syscall",
    "address",
    "port",
    "severity",
    "detail",
    "hint",
    "position",
    "where",
    "routine",
  ]) {
    const value = (error as unknown as Record<string, unknown>)[key];
    if (value !== undefined) console.error(`  ${key}:`, value);
  }
  if (error.cause) console.error("  cause:", error.cause);
  if (error.stack) console.error("\n", error.stack);
};

main().catch((error) => {
  report(error);
  process.exit(1);
});
