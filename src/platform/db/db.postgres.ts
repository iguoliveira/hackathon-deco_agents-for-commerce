/**
 * Conexão com o Postgres (Supabase) exposta com a MESMA superfície do D1.
 *
 * O catálogo e os alertas foram escritos contra a API do D1
 * (`prepare().bind().first()/.all()/.run()` e `batch()`). Trocar o banco por
 * baixo dela custa ~200 linhas aqui; reescrever `catalog.d1.ts` (328 linhas) e
 * `alerts.d1.ts` (230) custaria os dois arquivos inteiros e abriria espaço para
 * erro em cada query. Então a casca imita o D1 e as queries seguem como estavam.
 *
 * A tradução de `?` para `$1..$n` acontece aqui (ver `toPositional`), que é o
 * que dispensa mexer nas dezenas de placeholders espalhados pelas queries.
 *
 * O que esta casca NÃO tenta imitar do D1: `meta` (duração, rows_read),
 * `first(coluna)` e `raw()`. Nada no projeto usa.
 */

import postgres from "postgres";

/** Formato de retorno do D1 para `.all()` e para cada item de `.batch()`. */
export interface D1LikeResult<T> {
  results: T[];
  success: boolean;
}

/**
 * O mínimo que um statement precisa para rodar. Tipado pelo que usamos em vez
 * de por `postgres.Sql` porque dentro de `batch()` o que chega é um
 * `TransactionSql`, que não é atribuível a `Sql` — e só `.unsafe()` interessa
 * aos dois.
 */
type Queryable = Pick<postgres.Sql, "unsafe">;

// ---------------------------------------------------------------------------
// Conexão
// ---------------------------------------------------------------------------

let client: postgres.Sql | null = null;
let warned = false;

/**
 * Cliente único por isolate, criado na primeira query.
 *
 * `prepare: false` é obrigatório com o pooler em modo transação do Supabase (a
 * porta 6543, que é a que se usa em serverless): nesse modo a conexão não é
 * fixa entre statements, então prepared statements do lado do servidor não
 * sobrevivem — e o driver falha com "prepared statement already exists".
 *
 * `max: 1` porque cada instância serverless é efêmera e concorrente com dezenas
 * de outras: o limite que importa é o do pooler, não o daqui. Abrir um pool por
 * instância é como se esgota o banco.
 */
/** Um aviso por isolate: aqui roda dentro de request, e logar por query
 *  transformaria um erro de configuração numa enxurrada de log. */
const warnOnce = (message: string): null => {
  if (!warned) {
    console.error(`[db] ${message}`);
    warned = true;
  }
  return null;
};

const getClient = (): postgres.Sql | null => {
  if (client) return client;
  if (warned) return null;

  const url = process.env.DATABASE_URL;
  if (!url) return warnOnce("DATABASE_URL ausente — nenhuma query vai rodar");

  try {
    client = postgres(url, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  } catch (error) {
    // O driver valida a URL no construtor e LANÇA. Sem este catch, uma
    // DATABASE_URL malformada não degrada para catálogo vazio: ela estoura
    // dentro de cada loader e derruba a página inteira — foi o que aconteceu
    // em produção com o esquema `postgresql:` faltando, onde o erro visível
    // era um "Invalid URL" solto, sem dizer qual URL nem de onde vinha.
    //
    // A mensagem não inclui a URL: ela contém a senha do banco.
    const detail = error instanceof Error ? error.message : String(error);
    return warnOnce(
      `DATABASE_URL inválida (${detail}). Confira se ela começa com "postgresql://" ` +
        "e tem usuário, senha, host e porta. O site vai renderizar com catálogo vazio.",
    );
  }

  return client;
};

// ---------------------------------------------------------------------------
// Tradução de placeholders
// ---------------------------------------------------------------------------

/**
 * `SELECT ... WHERE a = ? AND b IN (?, ?)` → `... a = $1 AND b IN ($2, $3)`.
 *
 * O scanner pula o conteúdo de literais entre aspas simples. Hoje nenhuma query
 * do projeto tem `?` dentro de string — mas uma busca por "?" digitada pelo
 * usuário nunca chega aqui como literal (vai como parâmetro), e o dia em que
 * alguém escrever `LIKE '%?%'` na mão, um replace ingênuo geraria SQL inválido
 * de um jeito difícil de enxergar. O custo de fazer certo são cinco linhas.
 */
export const toPositional = (sql: string): string => {
  let out = "";
  let index = 0;
  let inString = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (char === "'") {
      // '' dentro de um literal é uma aspa escapada, não o fim dele.
      if (inString && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inString = !inString;
      out += char;
      continue;
    }

    if (char === "?" && !inString) {
      out += `$${++index}`;
      continue;
    }

    out += char;
  }

  return out;
};

// ---------------------------------------------------------------------------
// Statement — a casca com a cara do D1
// ---------------------------------------------------------------------------

class PgStatement {
  constructor(
    private readonly query: string,
    private readonly params: unknown[] = [],
  ) {}

  /** Devolve um novo statement em vez de mutar: `batch()` recebe vários e eles não podem se atropelar. */
  bind(...params: unknown[]): PgStatement {
    return new PgStatement(this.query, params);
  }

  /** Uso interno de `batch()` e dos métodos abaixo. */
  async exec<T>(sql: Queryable): Promise<T[]> {
    const rows = await sql.unsafe(toPositional(this.query), this.params as never[]);
    return rows as unknown as T[];
  }

  async first<T>(): Promise<T | null> {
    const sql = getClient();
    if (!sql) return null;
    const rows = await this.exec<T>(sql);
    return rows[0] ?? null;
  }

  async all<T>(): Promise<D1LikeResult<T>> {
    const sql = getClient();
    if (!sql) return { results: [], success: false };
    return { results: await this.exec<T>(sql), success: true };
  }

  async run(): Promise<{ success: boolean }> {
    const sql = getClient();
    if (!sql) return { success: false };
    await this.exec(sql);
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

class PgDatabase {
  prepare(query: string): PgStatement {
    return new PgStatement(query);
  }

  /**
   * Roda os statements numa transação, como o D1 faz.
   *
   * Não é só estética: as facetas em `catalog.d1.ts` batem produtos, contagem e
   * agregações que precisam enxergar o mesmo estado — em conexões separadas,
   * uma escrita concorrente faria a contagem discordar da página.
   */
  async batch<T>(statements: PgStatement[]): Promise<D1LikeResult<T>[]> {
    const sql = getClient();
    if (!sql) return statements.map(() => ({ results: [], success: false }));

    return sql.begin(async (tx) => {
      const out: D1LikeResult<T>[] = [];
      for (const statement of statements) {
        out.push({ results: await statement.exec<T>(tx), success: true });
      }
      return out;
    }) as Promise<D1LikeResult<T>[]>;
  }
}

const database = new PgDatabase();

/**
 * O banco, ou `null` quando não há `DATABASE_URL`.
 *
 * Devolver `null` em vez de lançar preserva o contrato que `catalog.d1.ts` e
 * `alerts.d1.ts` já assumiam com o binding do D1: cada leitura decide seu
 * próprio fallback (lista vazia, `false`), e a vitrine renderiza vazia em vez
 * de estourar 500 na cara do visitante.
 */
export const getDb = (): PgDatabase | null => (getClient() ? database : null);

export type { PgDatabase, PgStatement };
