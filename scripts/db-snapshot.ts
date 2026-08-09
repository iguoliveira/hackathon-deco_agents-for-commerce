/**
 * O que as migrations não conseguem carregar: o trabalho do agente.
 *
 *   npm run db:snapshot     lê o banco → db/seeds/snapshot.json  (commitado)
 *   npm run db:restore      snapshot.json → banco                (idempotente)
 *   npm run db:setup        migrate + restore, numa máquina do zero
 *
 * ## Por que isto não é uma migration
 *
 * Foi a primeira ideia, e ela quebra por um motivo específico: **a chave do
 * cache de `looks` embute o mês.** `hashDoContexto` monta `[…sementes, cidade,
 * regiao, pais, mes].join("|")` e roda FNV-1a em cima (`look.actions.ts:74`).
 *
 * Um `INSERT` de SQL puro gravaria os hashes de agosto. Em setembro,
 * `mesAtual()` devolve outra coisa, o hash muda, e os 35 looks viram linhas que
 * ninguém lê — o banco "tem" a demo e a tela não mostra nada. É a pior classe de
 * bug: silenciosa, e com aparência de dado presente.
 *
 * Reproduzir o hash em SQL exigiria FNV-1a em PL/pgSQL **e** os nomes dos meses
 * em português — duas cópias de lógica que já existe em TypeScript, que é
 * exatamente o que `look.hash.ts` foi criado para evitar. Então o snapshot
 * guarda o **contexto** (cidade + país), não o hash, e recalcula na hora de
 * restaurar. Sobrevive à virada do mês.
 *
 * ## O que entra e o que fica de fora
 *
 * Entram os looks de contexto **sem sementes** — os das quatro cidades do
 * seletor, que é a rota da demo. Ficam de fora os de contexto com sementes
 * (histórico de navegação de alguém): o hash deles depende de um conjunto de
 * sementes que nenhum visitante novo vai reproduzir, então restaurá-los seria
 * escrever chave que nunca é lida.
 *
 * Marcador de falha (`origem = 'falha'`) também fica de fora, e por definição:
 * é quarentena, não conteúdo.
 *
 * **`personas` fica de fora inteira**, e a razão é a mesma somada a outra. As
 * três linhas que existem hoje em produção são todas `origem = 'falha'` —
 * quarentena, pelo mesmo critério dos looks. E ainda que houvesse persona boa,
 * ela é **cache derivado**: a chave é `hashDosSinais`, calculada a partir dos
 * próprios sinais e sem identidade (`look.hash.ts`), então um banco novo a
 * regenera na primeira visita de quem tiver aqueles sinais. É a única tabela de
 * runtime cujo conteúdo o próprio sistema reconstrói.
 *
 * (Se um dia isso deixar de valer — persona cara de gerar, provedor caro —, o
 * lugar de mudar é aqui, e a chave nova seria `sinais_hash` verbatim, sem
 * recálculo, porque ela já não depende de mês nem de cidade.)
 *
 * ## Referências que podem não existir no destino
 *
 * Alertas, pedidos e favoritos apontam para `variant_id`. Se o catálogo do banco
 * novo não tiver aquela variante, a linha é **pulada e contada**, nunca inserida
 * quebrada — um pedido apontando para variante inexistente some no `INNER JOIN`
 * de `comprasDe` e vira sinal fantasma, difícil de rastrear depois.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import postgres from "postgres";
import { fnv1a } from "../src/platform/look/look.hash";
import { mesAtual } from "../src/platform/look/look.local";
import { resolveDatabaseUrl } from "./db-url";

const ARQUIVO = join(process.cwd(), "db", "seeds", "snapshot.json");

/**
 * As cidades que o seletor oferece, mais o padrão. É a lista contra a qual um
 * hash sem sementes é reconhecido — e o motivo de o snapshot conseguir
 * identificar o contexto de um look a partir de uma chave que é via única.
 */
const CIDADES: [string, string, string][] = [
  ["São Paulo", "SP", "BR"],
  ["Porto Alegre", "RS", "BR"],
  ["Recife", "PE", "BR"],
  ["Lisboa", "", "PT"],
  ["", "", ""],
];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** O hash de um contexto SEM sementes. É `hashDoContexto` com a lista vazia. */
const hashSemSementes = (c: string, r: string, p: string, mes: string): string =>
  fnv1a([c, r, p, mes].join("|"));

/**
 * Troca e-mail real por pseudônimo estável. **Roda no snapshot, não no restore.**
 *
 * `db/seeds/snapshot.json` é commitado, e **este repositório é público**. As
 * tabelas por pessoa — `shelves`, `stock_alerts`, `orders`, `wishlist_items` —
 * guardam o e-mail de quem usou o site, e dois deles eram Gmail de gente de
 * verdade. Commitar isso publica endereço pessoal num lugar que o GitHub indexa
 * e que não desfaz com um `git rm`: fica no histórico.
 *
 * O pseudônimo é derivado do próprio e-mail, então **a mesma pessoa continua
 * sendo a mesma pessoa** entre as quatro tabelas — uma vitrine continua ligada
 * ao alerta que a gerou.
 *
 * **Impede inversão, não confirmação.** `fnv1a` é de 32 bits e sem salt
 * (`look.hash.ts`): ninguém lê o apelido e recupera o endereço, mas quem já tem
 * um e-mail candidato confere em uma linha se ele está aqui, e o espaço de 32
 * bits é varrível. Para um repositório público com um punhado de usuários de
 * teste isso é aceitável; se algum dia entrar e-mail de cliente, o conserto é um
 * salt fora do repositório, não um hash mais longo.
 *
 * Não custa nada à demo: os 35 looks restaurados são de contexto **sem
 * sementes**, então não dependem de identidade nenhuma. O que é por e-mail só
 * aparece para quem logar com aquele e-mail, e ninguém vai logar com o de outra
 * pessoa.
 *
 * `@demo.local` passa direto: já é fictício, e é o que `look:armarios` semeia.
 */
const mascarar = (email: string): string =>
  email.endsWith("@demo.local") ? email : `pessoa-${fnv1a(email)}@demo.local`;

interface LookSalvo {
  /** Handle, não `product_group_id`: o id pode mudar entre bancos, o handle é o contrato. */
  ancora: string;
  cidade: string;
  regiao: string;
  pais: string;
  titulo: string;
  confianca: number;
  /** JSON cru de `looks.pecas`. Blob opaco aqui, como é no banco. */
  pecas: string;
}

interface Snapshot {
  geradoEm: string;
  /** O mês em que os looks foram compostos. Documental — o hash é recalculado. */
  mesDeOrigem: string;
  looks: LookSalvo[];
  shelves: Record<string, unknown>[];
  stockAlerts: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  orderItems: Record<string, unknown>[];
  wishlist: Record<string, unknown>[];
}

/**
 * `resolveDatabaseUrl` e não `process.env.DATABASE_URL` cru: URL malformada faz
 * o driver cair em `localhost` e devolver `ECONNREFUSED` com `message` vazia,
 * que parece "o banco caiu". Vale mais aqui do que no `migrate.ts` — este roda
 * apontado para uma connection string **recém-colada do painel do Supabase**,
 * que é quando ela está errada com probabilidade alta.
 *
 * `max: 1` porque o restore é uma sequência de escritas curtas e o pooler em
 * modo transação (6543) não gosta de várias conexões ociosas — mesma razão do
 * `migrate.ts:36`.
 */
const sql = postgres(resolveDatabaseUrl(), { prepare: false, max: 1 });

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------

const snapshot = async (): Promise<void> => {
  // Reconhece o contexto de cada hash sem sementes, em qualquer mês — um look
  // composto em julho é tão restaurável quanto um de agosto.
  const conhecidos = new Map<string, { cidade: string; regiao: string; pais: string }>();
  for (const [c, r, p] of CIDADES) {
    for (const m of MESES) {
      conhecidos.set(hashSemSementes(c, r, p, m), { cidade: c, regiao: r, pais: p });
    }
  }

  const linhas = await sql<
    { handle: string; contexto_hash: string; titulo: string; confianca: number; pecas: string }[]
  >`SELECT p.handle, l.contexto_hash, l.titulo, l.confianca, l.pecas
      FROM looks l JOIN products p ON p.product_group_id = l.anchor_id
     WHERE l.origem = 'agente'
     ORDER BY p.handle`;

  const looks: LookSalvo[] = [];
  let comSementes = 0;

  for (const l of linhas) {
    const ctx = conhecidos.get(l.contexto_hash);
    if (!ctx) {
      comSementes++;
      continue;
    }
    looks.push({
      ancora: l.handle,
      ...ctx,
      titulo: l.titulo,
      confianca: l.confianca,
      pecas: l.pecas,
    });
  }

  const snap: Snapshot = {
    geradoEm: new Date().toISOString(),
    mesDeOrigem: mesAtual(),
    looks,
    // `mascarar` em tudo que carrega identidade — ver o comentário dela. `name`
    // sai junto: é o nome que a pessoa digitou no formulário de "avise-me".
    shelves: (await sql`SELECT * FROM shelves ORDER BY email`).map((r) => ({
      ...r,
      email: mascarar(r.email as string),
    })),
    stockAlerts: (
      await sql`SELECT variant_id, email, name, created_at FROM stock_alerts ORDER BY email, variant_id`
    ).map((r) => ({ ...r, email: mascarar(r.email as string), name: "Demo" })),
    orders: (await sql`SELECT * FROM orders ORDER BY id`).map((r) => ({
      ...r,
      email: mascarar(r.email as string),
    })),
    orderItems: await sql`SELECT * FROM order_items ORDER BY order_id, variant_id`,
    wishlist: (
      await sql`SELECT user_id, product_id, product_group_id, created_at FROM wishlist_items ORDER BY user_id, product_id`
    ).map((r) => ({ ...r, user_id: mascarar(r.user_id as string) })),
  };

  mkdirSync(dirname(ARQUIVO), { recursive: true });
  writeFileSync(ARQUIVO, `${JSON.stringify(snap, null, 1)}\n`, "utf8");

  console.log(`\n  gravado em db/seeds/snapshot.json\n`);
  console.log(`  looks         ${String(looks.length).padStart(3)}  (${comSementes} descartado(s): contexto com sementes)`);
  console.log(`  shelves       ${String(snap.shelves.length).padStart(3)}`);
  console.log(`  stock_alerts  ${String(snap.stockAlerts.length).padStart(3)}`);
  console.log(`  orders        ${String(snap.orders.length).padStart(3)}  (${snap.orderItems.length} item(ns))`);
  console.log(`  wishlist      ${String(snap.wishlist.length).padStart(3)}\n`);
};

// ---------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------

const restore = async (): Promise<void> => {
  const snap = JSON.parse(readFileSync(ARQUIVO, "utf8")) as Snapshot;
  const mes = mesAtual();

  // **O restore é para banco NOVO.** O guarda existe por uma consequência direta
  // do mascaramento: os e-mails do snapshot são pseudônimos, então num banco que
  // já tem os originais nada colide — as linhas por pessoa entrariam AO LADO das
  // reais, dobrando vitrines e pedidos em vez de sobrescrevê-los.
  //
  // Só os `looks` sobreviveriam a isso intactos (a chave é âncora + hash, sem
  // identidade), e é justamente o que esconderia o estrago: a demo continuaria
  // certa enquanto a tela de pedidos duplicava.
  const [{ n: looksExistentes }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM looks`;
  const [{ n: shelvesExistentes }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM shelves`;

  if ((looksExistentes > 0 || shelvesExistentes > 0) && !process.argv.includes("--force")) {
    console.error(
      `
  Este banco já tem dados: ${looksExistentes} look(s), ${shelvesExistentes} vitrine(s).

` +
        `  O restore foi feito para um banco NOVO. Aqui ele acrescentaria as linhas
` +
        `  por pessoa sob os e-mails pseudonimizados do snapshot, ao lado das que já
` +
        `  existem — vitrines e pedidos duplicados.

` +
        `  Se é isso mesmo que você quer, repita com --force.
`,
    );
    process.exit(1);
  }

  console.log(`\n  snapshot de ${snap.geradoEm.slice(0, 10)} (composto em ${snap.mesDeOrigem})`);
  console.log(`  restaurando com o mês de HOJE: ${mes}\n`);

  // --- looks ---------------------------------------------------------------
  const ancoras = new Map(
    (
      await sql<{ handle: string; product_group_id: string }[]>`
        SELECT handle, product_group_id FROM products
         WHERE handle = ANY(${snap.looks.map((l) => l.ancora)})`
    ).map((r) => [r.handle, r.product_group_id]),
  );

  let ok = 0;
  let semAncora = 0;

  for (const l of snap.looks) {
    const anchorId = ancoras.get(l.ancora);
    if (!anchorId) {
      semAncora++;
      continue;
    }

    await sql`
      INSERT INTO looks (anchor_id, contexto_hash, titulo, confianca, pecas, origem,
                         motivo_do_fallback, generated_at)
           VALUES (${anchorId}, ${hashSemSementes(l.cidade, l.regiao, l.pais, mes)},
                   ${l.titulo}, ${l.confianca}, ${l.pecas}, 'agente', NULL,
                   to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
      ON CONFLICT (anchor_id, contexto_hash) DO UPDATE
              SET titulo = EXCLUDED.titulo, confianca = EXCLUDED.confianca,
                  pecas = EXCLUDED.pecas, origem = 'agente',
                  motivo_do_fallback = NULL, generated_at = EXCLUDED.generated_at`;
    ok++;
  }
  console.log(`  looks         ${String(ok).padStart(3)} restaurado(s)${semAncora ? `  (${semAncora} sem âncora no catálogo)` : ""}`);

  // --- shelves (chave é o e-mail: sem hash, sem mês) ------------------------
  for (const s of snap.shelves) {
    await sql`INSERT INTO shelves ${sql(s)}
              ON CONFLICT (email) DO UPDATE SET ${sql(s)}`;
  }
  console.log(`  shelves       ${String(snap.shelves.length).padStart(3)}`);

  // --- o que referencia variantes: pula o que o catálogo não tem ------------
  const variantesDe = async (ids: string[]): Promise<Set<string>> =>
    new Set(
      (
        await sql<{ variant_id: string }[]>`
          SELECT variant_id FROM variants WHERE variant_id = ANY(${ids})`
      ).map((r) => r.variant_id),
    );

  const vAlertas = await variantesDe(snap.stockAlerts.map((a) => a.variant_id as string));
  let alertas = 0;
  let alertasPulados = 0;
  for (const a of snap.stockAlerts) {
    if (!vAlertas.has(a.variant_id as string)) {
      alertasPulados++;
      continue;
    }
    // Alvo explícito, e não `ON CONFLICT DO NOTHING` solto: `stock_alerts` tem
    // PK em `id` (que não inserimos) e o único que importa é
    // `idx_stock_alerts_email_variant`. Sem nomear as colunas, o dia em que esse
    // índice sair o INSERT passa a duplicar em silêncio a cada restore; nomeando,
    // ele quebra alto.
    await sql`INSERT INTO stock_alerts ${sql(a)} ON CONFLICT (email, variant_id) DO NOTHING`;
    alertas++;
  }
  console.log(`  stock_alerts  ${String(alertas).padStart(3)}${alertasPulados ? `  (${alertasPulados} pulado(s): variante ausente)` : ""}`);

  const vItens = await variantesDe(snap.orderItems.map((i) => i.variant_id as string));
  const itensBons = snap.orderItems.filter((i) => vItens.has(i.variant_id as string));
  const pedidosComItem = new Set(itensBons.map((i) => i.order_id as string));

  // Pedido sem item vivo não entra: um pedido vazio aparece na tela de pedidos
  // como uma compra que não comprou nada.
  let pedidos = 0;
  for (const o of snap.orders) {
    if (!pedidosComItem.has(o.id as string)) continue;
    await sql`INSERT INTO orders ${sql(o)} ON CONFLICT (id) DO NOTHING`;
    pedidos++;
  }
  for (const i of itensBons) {
    await sql`INSERT INTO order_items ${sql(i)} ON CONFLICT (order_id, variant_id) DO NOTHING`;
  }
  const pulados = snap.orders.length - pedidos;
  console.log(`  orders        ${String(pedidos).padStart(3)}  (${itensBons.length} item(ns))${pulados ? `  ${pulados} sem item vivo` : ""}`);

  const vFav = await variantesDe(snap.wishlist.map((w) => w.product_id as string));
  let favs = 0;
  let favsPulados = 0;
  for (const w of snap.wishlist) {
    if (!vFav.has(w.product_id as string)) {
      favsPulados++;
      continue;
    }
    await sql`INSERT INTO wishlist_items ${sql(w)} ON CONFLICT (user_id, product_id) DO NOTHING`;
    favs++;
  }
  console.log(`  wishlist      ${String(favs).padStart(3)}${favsPulados ? `  (${favsPulados} pulado(s))` : ""}\n`);
};

// ---------------------------------------------------------------------------

const main = async () => {
  try {
    if (process.argv.includes("--restore")) await restore();
    else await snapshot();
  } finally {
    await sql.end();
  }
};

await main();
