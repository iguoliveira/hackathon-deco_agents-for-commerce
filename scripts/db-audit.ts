/**
 * Confere se `db/migrations/` descreve o banco que existe. **Só lê.**
 *
 *   npm run db:audit
 *   npm run db:audit -- --json      para diffar entre ambientes
 *
 * Existe por uma pergunta específica: *"criar um projeto novo do Supabase e
 * rodar `npm run db:migrate` produz o banco que temos hoje?"* — e essa pergunta
 * não se responde lendo os arquivos, porque as duas formas de divergir são
 * invisíveis no `git log`:
 *
 *   1. **Migration aplicada que não está no repositório.** Alguém rodou um
 *      arquivo de uma branch que não foi mergeada. O banco tem a tabela, o
 *      projeto novo não vai ter.
 *   2. **DDL feito à mão.** Um `ALTER TABLE` pelo SQL editor do Supabase não
 *      deixa rastro em lugar nenhum, e o projeto novo nasce sem ele.
 *
 * O script imprime três blocos: o que `schema_migrations` registra contra o que
 * há em disco, o inventário do schema vivo, e os objetos que aparecem no banco
 * sem serem criados por migration nenhuma.
 *
 * **A busca por objeto órfão é textual e por isso conservadora**: ela procura o
 * nome do objeto no texto das migrations. Um `CREATE TABLE` gerado por string
 * concatenada escaparia. Serve para acusar, não para absolver — o que ela
 * encontra é divergência de verdade; o que ela não encontra ainda precisa do
 * replay descrito no fim de docs/auditoria-migrations.md.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./db-url";

// ---------------------------------------------------------------------------
// --comparar: a prova que os outros dois blocos não dão
// ---------------------------------------------------------------------------

interface ColunaJson {
  nome: string;
  tipo: string;
  nulo: string;
  padrao: string | null;
}
interface TabelaJson {
  nome: string;
  colunas: ColunaJson[];
  indices: string[];
}
interface Dump {
  tabelas: TabelaJson[];
  extensoes: string[];
  aplicadas: string[];
}

/**
 * Diffa dois dumps de `--json`. **É aqui que mora a garantia 1:1.**
 *
 * Os blocos 1 e 3 do relatório respondem "há objeto no banco que migration
 * nenhuma cria?" — pergunta útil e insuficiente, porque não vê tipo trocado,
 * `NOT NULL` que virou nulo, default diferente nem índice ausente. Este modo vê.
 *
 * O uso previsto é o que motivou o script: criar o projeto novo do Supabase,
 * rodar `npm run db:migrate` nele, e provar que o resultado é o banco de hoje.
 *
 *   DATABASE_URL=<novo> npx tsx scripts/db-audit.ts --json > novo.json
 *   npx tsx scripts/db-audit.ts --json > atual.json
 *   npx tsx scripts/db-audit.ts --comparar atual.json novo.json
 *
 * **A ordem importa na leitura, não no resultado**: o primeiro é a referência.
 * "só em A" é o que o banco novo vai perder; "só em B" é o que ele ganha de
 * brinde.
 *
 * ## `--comparar` ou `--replay`?
 *
 * Os dois provam equivalência de schema e é fácil rodar o errado, então:
 *
 *   `--replay`    compara as MIGRATIONS contra UM banco. Não precisa de segundo
 *                 banco nem de arquivo: roda tudo num schema temporário ali
 *                 mesmo. É o que responde "as migrations descrevem este banco?".
 *
 *   `--comparar`  compara DOIS bancos que já existem, a partir de dois dumps.
 *                 É o que responde "o projeto novo ficou igual ao antigo?" —
 *                 pergunta que o `--replay` não alcança, porque ele só enxerga
 *                 o banco em que está rodando.
 *
 * Nenhum dos dois substitui o outro. O `--replay` prova a mecânica; o
 * `--comparar` prova o resultado no banco de verdade.
 *
 * Dados ficam de fora de propósito. Um projeto novo nasce com o catálogo que as
 * migrations de seed inserem, e comparar contagem de linhas acusaria diferença
 * em toda tabela que a operação escreveu — pedidos, alertas, looks. O que
 * precisa bater é o **schema**.
 */
const comparar = (arqA: string, arqB: string): number => {
  // Valida a forma antes de usar: um arquivo truncado (redirecionamento
  // interrompido, disco cheio) daria "Cannot read properties of undefined" numa
  // linha lá dentro, e o diagnóstico apontaria para o comparador em vez de para
  // o arquivo.
  const ler = (arq: string): Dump => {
    let d: unknown;
    try {
      d = JSON.parse(readFileSync(arq, "utf8"));
    } catch (erro) {
      console.error(`${arq}: não é JSON válido — ${(erro as Error).message}`);
      process.exit(1);
    }
    const dump = d as Partial<Dump>;
    if (!Array.isArray(dump?.tabelas) || !Array.isArray(dump?.extensoes)) {
      console.error(`${arq}: não parece um dump de --json (faltam "tabelas"/"extensoes").`);
      process.exit(1);
    }
    return dump as Dump;
  };

  const a = ler(arqA);
  const b = ler(arqB);

  const problemas: string[] = [];
  const nomes = (d: Dump) => new Set(d.tabelas.map((t) => t.nome));
  const tA = nomes(a);
  const tB = nomes(b);

  for (const t of [...tA].filter((x) => !tB.has(x)).sort()) {
    problemas.push(`tabela só em A: ${t}`);
  }
  for (const t of [...tB].filter((x) => !tA.has(x)).sort()) {
    problemas.push(`tabela só em B: ${t}`);
  }

  for (const tabela of a.tabelas.filter((t) => tB.has(t.nome))) {
    const outra = b.tabelas.find((t) => t.nome === tabela.nome)!;
    const cA = new Map(tabela.colunas.map((c) => [c.nome, c]));
    const cB = new Map(outra.colunas.map((c) => [c.nome, c]));

    for (const [nome, col] of cA) {
      const par = cB.get(nome);
      if (!par) {
        problemas.push(`coluna só em A: ${tabela.nome}.${nome} (${col.tipo})`);
        continue;
      }
      if (col.tipo !== par.tipo) {
        problemas.push(`tipo difere: ${tabela.nome}.${nome} — A=${col.tipo} B=${par.tipo}`);
      }
      if (col.nulo !== par.nulo) {
        problemas.push(`nulabilidade difere: ${tabela.nome}.${nome} — A=${col.nulo} B=${par.nulo}`);
      }
      // `nextval('x_seq')` carrega o nome da sequência, que é o mesmo entre
      // bancos gerados pelas mesmas migrations — então comparar cru é seguro
      // aqui, e mais honesto que normalizar e esconder diferença real.
      if ((col.padrao ?? "") !== (par.padrao ?? "")) {
        problemas.push(
          `default difere: ${tabela.nome}.${nome}\n      A=${col.padrao}\n      B=${par.padrao}`,
        );
      }
    }
    for (const nome of [...cB.keys()].filter((n) => !cA.has(n))) {
      problemas.push(`coluna só em B: ${tabela.nome}.${nome}`);
    }

    const iA = new Set(tabela.indices);
    const iB = new Set(outra.indices);
    for (const i of [...iA].filter((x) => !iB.has(x))) problemas.push(`índice só em A: ${i}`);
    for (const i of [...iB].filter((x) => !iA.has(x))) problemas.push(`índice só em B: ${i}`);
  }

  const eA = new Set(a.extensoes);
  const eB = new Set(b.extensoes);
  for (const e of [...eA].filter((x) => !eB.has(x))) problemas.push(`extensão só em A: ${e}`);
  for (const e of [...eB].filter((x) => !eA.has(x))) problemas.push(`extensão só em B: ${e}`);

  // O LEDGER. Estava sendo emitido no `--json` e nunca lido aqui — e a omissão
  // mordia o argumento que ela deveria sustentar: manter o número `0015` em vez
  // de renumerar se justifica porque "renumerar deixaria os schemas iguais e os
  // LEDGERS diferentes, a divergência mais chata de rastrear porque não aparece
  // no schema". Um comparador cego para o ledger não conseguia provar isso.
  const lA = new Set(a.aplicadas ?? []);
  const lB = new Set(b.aplicadas ?? []);
  for (const m of [...lA].filter((x) => !lB.has(x))) problemas.push(`migration só em A: ${m}`);
  for (const m of [...lB].filter((x) => !lA.has(x))) problemas.push(`migration só em B: ${m}`);

  console.log(`\n\x1b[1mA = ${arqA}\x1b[0m  (${a.tabelas.length} tabelas)`);
  console.log(`\x1b[1mB = ${arqB}\x1b[0m  (${b.tabelas.length} tabelas)\n`);

  if (problemas.length === 0) {
    console.log("  \x1b[32m✓ os dois schemas são idênticos\x1b[0m");
    console.log("    tabelas, colunas, tipos, nulabilidade, defaults, índices e extensões.\n");
  } else {
    for (const p of problemas) console.log(`  \x1b[31m✗\x1b[0m ${p}`);
    console.log(`\n  \x1b[31m${problemas.length} diferença(s)\x1b[0m\n`);
  }

  return problemas.length;
};

/**
 * Roda as 20 migrations num schema temporário e compara com o `public`.
 * **É a única prova de que um banco novo nasce igual.**
 *
 *   npx tsx scripts/db-audit.ts --replay
 *
 * Os outros modos leem. Este ESCREVE — num schema próprio, `_replay_audit`, que
 * é criado no começo e destruído no fim, inclusive quando algo falha no meio.
 * O `public` não é tocado em momento nenhum.
 *
 * Três coisas tornaram isto seguro de fazer no banco de produção, e todas foram
 * conferidas antes:
 *
 *   1. **Nenhuma migration qualifica schema.** Nada de `public.products` — então
 *      um `search_path` apontando para o schema temporário manda todo
 *      `CREATE TABLE`, `INSERT` e `UPDATE` para lá.
 *   2. **Nada de `random()`, `gen_random_uuid()` nem `uuid_generate`.** O
 *      resultado é determinístico, então divergência é defeito, não sorte.
 *   3. **Índices e constraints moram no schema da tabela**, então os nomes não
 *      colidem com os do `public`.
 *
 * O que ele responde e nenhum outro modo responde: as migrations **executam**?
 * Na ordem? Produzindo as mesmas colunas, os mesmos tipos e as mesmas contagens?
 */
const SCHEMA = "_replay_audit";

const replay = async (sql: postgres.Sql): Promise<number> => {
  const arquivos = readdirSync(join(process.cwd(), "db", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`
[1mreplay de ${arquivos.length} migrations em ${SCHEMA}[0m
`);

  try {
    // O CASCADE emite um NOTICE por objeto derrubado — doze linhas de ruído no
    // fim de um relatório que a pessoa está lendo para achar um ✗.
    await sql.unsafe(`SET client_min_messages TO WARNING`);
    await sql.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await sql.unsafe(`CREATE SCHEMA ${SCHEMA}`);

    for (const f of arquivos) {
      const corpo = readFileSync(join(process.cwd(), "db", "migrations", f), "utf8");
      const inicio = Date.now();
      try {
        // `search_path` com `public` no fim porque o tipo `vector` e as funções
        // das extensões moram lá. As tabelas vêm primeiro, então tudo que a
        // migration cria ou toca resolve no schema temporário.
        await sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL search_path TO ${SCHEMA}, public`);
          await tx.unsafe(corpo);
        });
        console.log(`  [32m✓[0m ${f.padEnd(34)} ${Date.now() - inicio}ms`);
      } catch (erro) {
        console.log(`  [31m✗ ${f}[0m`);
        console.log(`    ${(erro as Error).message}`);
        return 1;
      }
    }

    // --- as contagens do catálogo -----------------------------------------
    console.log(`
[1mcontagens: replay × produção[0m
`);
    const tabelas = ["products", "variants", "product_images", "product_props", "variant_options"];
    let difs = 0;

    for (const t of tabelas) {
      const [a] = await sql.unsafe<{ c: number }[]>(`SELECT count(*)::int AS c FROM ${SCHEMA}.${t}`);
      const [b] = await sql.unsafe<{ c: number }[]>(`SELECT count(*)::int AS c FROM public.${t}`);
      const bate = a!.c === b!.c;
      if (!bate) difs++;
      console.log(
        `  ${bate ? "[32m✓[0m" : "[31m✗[0m"} ${t.padEnd(18)} replay=${String(a!.c).padStart(4)}  produção=${String(b!.c).padStart(4)}`,
      );

      // Contagem diferente sem dizer QUAL linha é um alarme sem endereço. Só
      // `products` tem `handle`, que é o identificador legível — nas outras a
      // diferença é consequência desta, e listá-las seria repetir o mesmo achado
      // quatro vezes com id opaco.
      if (!bate && t === "products") {
        const faltando = await sql.unsafe<{ handle: string; title: string }[]>(
          `SELECT handle, title FROM ${SCHEMA}.products
            WHERE handle NOT IN (SELECT handle FROM public.products) ORDER BY handle`,
        );
        const sobrando = await sql.unsafe<{ handle: string; title: string }[]>(
          `SELECT handle, title FROM public.products
            WHERE handle NOT IN (SELECT handle FROM ${SCHEMA}.products) ORDER BY handle`,
        );
        for (const x of faltando) {
          console.log(`      [31mfalta em produção:[0m ${x.handle}  (${x.title})`);
        }
        for (const x of sobrando) {
          console.log(`      [31msó em produção:[0m   ${x.handle}  (${x.title})`);
        }
      }
    }

    // --- o schema, coluna a coluna ----------------------------------------
    const dump = async (schema: string) => {
      const colunas = await sql.unsafe<
        { tabela: string; coluna: string; tipo: string; nulo: string; padrao: string | null }[]
      >(`SELECT c.table_name AS tabela, c.column_name AS coluna, c.data_type AS tipo,
                c.is_nullable AS nulo, c.column_default AS padrao
           FROM information_schema.columns c
           JOIN information_schema.tables t
             ON t.table_name = c.table_name AND t.table_schema = c.table_schema
          WHERE c.table_schema = '${schema}' AND t.table_type = 'BASE TABLE'
            AND c.table_name <> 'schema_migrations'
          ORDER BY c.table_name, c.column_name`);
      const indices = await sql.unsafe<{ tabela: string; nome: string }[]>(
        `SELECT tablename AS tabela, indexname AS nome FROM pg_indexes
          WHERE schemaname = '${schema}' AND tablename <> 'schema_migrations'
          ORDER BY tablename, indexname`,
      );
      return { colunas, indices };
    };

    const r = await dump(SCHEMA);
    const p = await dump("public");

    console.log(`
[1mschema: replay × produção[0m
`);

    // O default de uma coluna serial carrega o nome do schema
    // (`nextval('_replay_audit.wishlist_items_id_seq')`), então comparar cru
    // acusaria diferença em toda tabela com BIGSERIAL. É artefato da técnica,
    // não do banco — some junto com o schema temporário.
    const chave = (c: (typeof r.colunas)[number]) =>
      `${c.tabela}.${c.coluna} ${c.tipo} nulo=${c.nulo} default=${(c.padrao ?? "").replace(`${SCHEMA}.`, "")}`;
    const cr = new Set(r.colunas.map(chave));
    const cp = new Set(p.colunas.map(chave));
    const ir = new Set(r.indices.map((i) => `${i.tabela}.${i.nome}`));
    const ip = new Set(p.indices.map((i) => `${i.tabela}.${i.nome}`));

    for (const x of [...cp].filter((y) => !cr.has(y))) {
      difs++;
      console.log(`  [31m✗[0m só em produção: ${x}`);
    }
    for (const x of [...cr].filter((y) => !cp.has(y))) {
      difs++;
      console.log(`  [31m✗[0m só no replay:   ${x}`);
    }
    for (const x of [...ip].filter((y) => !ir.has(y))) {
      difs++;
      console.log(`  [31m✗[0m índice só em produção: ${x}`);
    }
    for (const x of [...ir].filter((y) => !ip.has(y))) {
      difs++;
      console.log(`  [31m✗[0m índice só no replay:   ${x}`);
    }

    if (difs === 0) {
      console.log(`  [32m✓ ${cp.size} colunas e ${ip.size} índices, idênticos[0m`);
      console.log(
        `
  [32mUm banco novo nasce igual a este.[0m
` +
          `  As ${arquivos.length} migrations executam na ordem, e o resultado bate em contagem,
` +
          `  coluna, tipo, nulabilidade, default e índice.
`,
      );
    } else {
      console.log(`
  [31m${difs} diferença(s)[0m
`);
    }
    return difs;
  } finally {
    // Incondicional: um replay que falha no meio não pode deixar o schema para
    // trás, ou a próxima execução começa suja e mede outra coisa.
    await sql.unsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    console.log(`  (${SCHEMA} removido)
`);
  }
};

const argComparar = process.argv.indexOf("--comparar");
if (argComparar !== -1) {
  const [x, y] = [process.argv[argComparar + 1], process.argv[argComparar + 2]];
  if (!x || !y) {
    console.error("uso: --comparar <atual.json> <novo.json>");
    process.exit(1);
  }
  process.exit(comparar(x, y) === 0 ? 0 : 1);
}

const DIR = join(process.cwd(), "db", "migrations");
const JSON_MODE = process.argv.includes("--json");

/**
 * `resolveDatabaseUrl` e não `process.env.DATABASE_URL` direto, e isto não é
 * uniformidade por uniformidade.
 *
 * Uma URL malformada faz o driver cair em `localhost` e devolver `ECONNREFUSED`
 * com `message` VAZIA — parece "o banco caiu" e manda a pessoa investigar rede,
 * firewall e Supabase antes de olhar para a própria string. É a regressão que
 * `db-url.ts` foi escrito para impedir.
 *
 * Vale mais aqui do que em `migrate.ts`: aquele roda contra uma URL que já
 * funciona; **este foi feito para ser apontado para uma connection string
 * recém-colada do painel**, que é o único momento em que ela está errada com
 * probabilidade alta.
 *
 * `max: 1` e `onnotice` pelo mesmo motivo do `migrate.ts:36`: o `--replay` faz
 * `SET client_min_messages` de sessão, e num pool de várias conexões o `SET`
 * pega uma e o `DROP SCHEMA … CASCADE` seguinte pode sair por outra — no pooler
 * em modo transação (6543) `SET` de sessão não persiste de jeito nenhum. Com uma
 * conexão só, o `SET` vale; o `onnotice` é o cinto.
 */
const sql = postgres(resolveDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });

const log = (...a: unknown[]) => {
  if (!JSON_MODE) console.log(...a);
};
const titulo = (t: string) => log(`\n\x1b[1m${t}\x1b[0m`);

interface Coluna {
  tabela: string;
  coluna: string;
  tipo: string;
  nulo: string;
  padrao: string | null;
}

const main = async () => {
  if (process.argv.includes("--replay")) return replay(sql);

  // --- 1. o registro contra o disco ---------------------------------------
  const emDisco = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const aplicadas = (
    await sql<{ name: string; applied_at: Date }[]>`
      SELECT name, applied_at FROM schema_migrations ORDER BY name`
  ).map((r) => ({ nome: r.name, em: r.applied_at }));

  const nomesAplicados = new Set(aplicadas.map((a) => a.nome));
  const nomesEmDisco = new Set(emDisco);

  // Aplicada e sumida do repositório: o caso 1 do cabeçalho, e o mais grave —
  // o banco novo não terá o que este tem.
  const fantasmas = aplicadas.filter((a) => !nomesEmDisco.has(a.nome));
  // Em disco e não aplicada: benigno num banco novo, mas significa que ESTE
  // banco está atrás do repositório.
  const pendentes = emDisco.filter((f) => !nomesAplicados.has(f));

  titulo("1. schema_migrations × db/migrations/");
  log(`  ${emDisco.length} arquivo(s) em disco · ${aplicadas.length} registrada(s) no banco`);

  if (fantasmas.length === 0 && pendentes.length === 0) {
    log("  \x1b[32m✓\x1b[0m as duas listas são idênticas");
  }
  for (const f of fantasmas) {
    log(`  \x1b[31m✗ APLICADA MAS AUSENTE DO REPO: ${f.nome}\x1b[0m (em ${f.em.toISOString()})`);
  }
  for (const p of pendentes) {
    log(`  \x1b[33m! pendente neste banco: ${p}\x1b[0m`);
  }

  // --- 2. o inventário do schema vivo -------------------------------------
  const colunas = await sql<Coluna[]>`
    SELECT c.table_name AS tabela, c.column_name AS coluna,
           c.data_type AS tipo, c.is_nullable AS nulo, c.column_default AS padrao
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_name = c.table_name AND t.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     ORDER BY c.table_name, c.ordinal_position`;

  const indices = await sql<{ tabela: string; nome: string; def: string }[]>`
    SELECT tablename AS tabela, indexname AS nome, indexdef AS def
      FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`;

  const extensoes = await sql<{ nome: string }[]>`
    SELECT extname AS nome FROM pg_extension ORDER BY extname`;

  const tabelas = [...new Set(colunas.map((c) => c.tabela))];

  titulo(`2. o schema vivo — ${tabelas.length} tabelas`);
  for (const t of tabelas) {
    const cols = colunas.filter((c) => c.tabela === t);
    const idx = indices.filter((i) => i.tabela === t);
    log(`  ${t.padEnd(20)} ${String(cols.length).padStart(2)} colunas · ${idx.length} índice(s)`);
  }
  log(`  extensões: ${extensoes.map((e) => e.nome).join(", ")}`);

  // --- 3. objetos que nenhuma migration cria ------------------------------
  const textoDasMigrations = emDisco.map((f) => readFileSync(join(DIR, f), "utf8")).join("\n");

  // Escapado: nome vindo do catálogo do Postgres pode conter metacaractere — o
  // próprio `snap-case-for-iphone®` tem hífen — e um deles derrubaria a
  // auditoria com erro de RegExp em vez de acusar o objeto.
  const mencionado = (nome: string): boolean =>
    new RegExp(`\\b${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(textoDasMigrations);

  // `schema_migrations` é criada pelo próprio runner (scripts/migrate.ts), não
  // por um arquivo — listá-la como órfã seria um falso positivo garantido.
  const tabelasOrfas = tabelas.filter((t) => t !== "schema_migrations" && !mencionado(t));

  // **A busca é GLOBAL, e isso é limitação real.** O nome da coluna é procurado
  // no texto concatenado das migrations, sem relação com a tabela dela — então
  // `id`, `created_at` e `email` casam SEMPRE, e um
  // `ALTER TABLE products ADD COLUMN user_id` feito no SQL editor passa aqui em
  // silêncio.
  //
  // Fica assim de propósito. Casar coluna com tabela exigiria parsear SQL, e
  // quem faz isso direito é o Postgres — que é o que o `--replay` usa. **Coluna
  // a mais é achado do `--replay`, não deste bloco.** O que sobra aqui é o caso
  // barato: nome que não aparece em migration nenhuma.
  const colunasOrfas = colunas.filter(
    (c) =>
      c.tabela !== "schema_migrations" &&
      !tabelasOrfas.includes(c.tabela) &&
      !mencionado(c.coluna),
  );

  // Índice criado à mão não aparece em migration nenhuma. Os implícitos de
  // PRIMARY KEY e UNIQUE são criados pelo Postgres, não escritos — acusá-los
  // seria ruído.
  //
  // Filtrado pelo CATÁLOGO (índice preso a uma constraint), e não pelo sufixo do
  // nome: `_pkey`/`_key` é convenção, não regra, e um índice manual batizado
  // `idx_wishlist_user_key` ficava invisível só por causa de como foi chamado.
  const implicitos = new Set(
    (
      await sql<{ nome: string }[]>`
        SELECT i.relname AS nome
          FROM pg_index x
          JOIN pg_class i ON i.oid = x.indexrelid
          JOIN pg_namespace n ON n.oid = i.relnamespace
         WHERE n.nspname = 'public'
           AND EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = x.indexrelid)`
    ).map((r) => r.nome),
  );

  const indicesOrfas = indices.filter(
    (i) =>
      !implicitos.has(i.nome) &&
      i.tabela !== "schema_migrations" &&
      !tabelasOrfas.includes(i.tabela) &&
      !mencionado(i.nome),
  );

  titulo("3. objetos no banco que migration nenhuma menciona");
  if (tabelasOrfas.length + colunasOrfas.length + indicesOrfas.length === 0) {
    log("  \x1b[32m✓\x1b[0m nenhum — todo objeto do schema é nomeado por alguma migration");
  }
  for (const t of tabelasOrfas) log(`  \x1b[31m✗ tabela órfã: ${t}\x1b[0m`);
  for (const c of colunasOrfas) log(`  \x1b[31m✗ coluna órfã: ${c.tabela}.${c.coluna} (${c.tipo})\x1b[0m`);
  for (const i of indicesOrfas) log(`  \x1b[31m✗ índice órfão: ${i.tabela}.${i.nome}\x1b[0m`);

  const problemas =
    fantasmas.length + tabelasOrfas.length + colunasOrfas.length + indicesOrfas.length;

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          emDisco,
          aplicadas: aplicadas.map((a) => a.nome),
          fantasmas: fantasmas.map((f) => f.nome),
          pendentes,
          tabelas: tabelas.map((t) => ({
            nome: t,
            colunas: colunas
              .filter((c) => c.tabela === t)
              .map((c) => ({ nome: c.coluna, tipo: c.tipo, nulo: c.nulo, padrao: c.padrao })),
            indices: indices.filter((i) => i.tabela === t).map((i) => i.def),
          })),
          extensoes: extensoes.map((e) => e.nome),
          orfaos: {
            tabelas: tabelasOrfas,
            colunas: colunasOrfas.map((c) => `${c.tabela}.${c.coluna}`),
            indices: indicesOrfas.map((i) => `${i.tabela}.${i.nome}`),
          },
          problemas,
        },
        null,
        2,
      ),
    );
  } else {
    titulo("VEREDITO");
    log(
      problemas === 0
        ? "  \x1b[32mnenhuma divergência encontrada pelas verificações acima\x1b[0m"
        : `  \x1b[31m${problemas} divergência(s)\x1b[0m`,
    );
    log(
      "\n  Isto NÃO é prova de equivalência 1:1 — as verificações acham objeto a\n" +
        "  mais no banco, não diferença de tipo, default ou constraint. Para a\n" +
        "  garantia completa, ver o replay em docs/auditoria-migrations.md.\n",
    );
  }

  return problemas;
};

// `finally` incondicional, igual ao `db-snapshot.ts`: sem ele uma falha no meio
// deixa a conexão aberta e o processo pendurado, e o despejo de
// `triggerUncaughtException` esconde a linha que interessa.
try {
  const problemas = await main();
  await sql.end();
  process.exit(problemas === 0 ? 0 : 1);
} catch (erro) {
  console.error(`
[db:audit] ${(erro as Error).message || erro}`);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
}
