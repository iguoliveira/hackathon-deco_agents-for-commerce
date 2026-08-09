/**
 * Semeia guarda-roupas de demonstração. **Idempotente**, e só toca em
 * `@demo.local`.
 *
 *   npm run look:armarios            semeia (reescreve os que já existem)
 *   npm run look:armarios -- --limpar   apaga e sai
 *   npm run look:armarios -- --listar   mostra o que existe hoje
 *
 * ## Por que isto precisou existir
 *
 * A persona substitui uma tabela de pesos que truncava os sinais em seis. Medir
 * se isso melhora exige alguém **com mais de seis sinais** — e o banco tinha, no
 * melhor caso, um comprador com UMA peça. Rodar o `look:eval` contra aquilo
 * compararia o caminho sem persona com o caminho sem persona.
 *
 * ## Duas fontes, não quatro
 *
 * Favoritos e vistos são **cookie de primeira parte** neste branch, então não há
 * como semeá-los pelo banco — a leitura de `wishlist_items` está na #24 e ainda
 * não chegou aqui. O armário semeado é `orders` ∪ `stock_alerts`, que já dá 5 a
 * 7 sinais por pessoa. Quando a #24 entrar, dá para acrescentar favoritos e o
 * armário fica mais rico sem mudar nada aqui.
 *
 * ## O quarto armário é o que mais importa
 *
 * `disperso` é **controle**, não enchimento: uma pilha de peças sem relação
 * nenhuma entre si. Se o modelo devolver um retrato confiante para ela, a
 * premissa inteira da feature caiu — "ficar no fato observado" só significa algo
 * se existir um caso em que o fato observado não diz nada, e o modelo souber
 * dizer isso. O esperado é `confianca < 0.5` e nenhuma persona.
 *
 * ## O que NÃO é
 *
 * Não é migration. Dado de demonstração que a gente vai reescrever enquanto
 * ajusta o prompt não pertence ao histórico de schema — e `schema_migrations`
 * torna migration algo que roda uma vez só, que é o oposto do que se quer aqui.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env: o erro de DATABASE_URL que vem a seguir é o útil.
}

import postgres from "postgres";

const DOMINIO = "@demo.local";

interface Armario {
  email: string;
  /** O que a pessoa vestiria se olhássemos o armário dela. Vira o `--listar`. */
  descricao: string;
  /** O que o retrato DEVERIA dizer. Não é validado em código — é o gabarito do olho. */
  esperado: string;
  comprou: string[];
  esperando: string[];
}

/**
 * Os handles são do catálogo de 127 peças disponíveis, escolhidos pelas TAGS e
 * não pelo nome: é das tags que sai `combinaComOGuardaRoupa`, e um armário
 * montado por título bonito não teria coerência nenhuma para o modelo enxergar.
 */
const ARMARIOS: Armario[] = [
  {
    email: `ana.escura${DOMINIO}`,
    descricao: "preto, estruturado, tudo de sobrepor",
    esperado: "cor dominante = preto · camada = sobreposição · caimento = estruturado",
    comprou: [
      "tailored-blazer", // black, classic, layering
      "wide-leg-trousers", // black, minimalist, layering
      "pleated-chino", // black, classic, cotton, layering
      "leather-belt-bag", // black, minimalist
      "long-sleeve-daily-tee", // black, basic, layering
    ],
    esperando: [
      "striped-breton-tee", // black, classic, layering
      "heavyweight-boxy-tee", // black, oversized  ← a única tensão: solto num armário estruturado
    ],
  },
  {
    email: `bruno.solto${DOMINIO}`,
    descricao: "streetwear, tudo largo, muito branco",
    esperado: "caimento = solto/oversized · uso = streetwear · cor = branco",
    comprou: [
      "oversized-hoodie", // oversized, streetwear, white
      "baggy-carpenter-jeans", // denim, streetwear, indigo
      "canvas-high-tops", // canvas, streetwear, white
      "five-panel-cap", // streetwear, white
      "oversize-t-shirt", // oversized, basic
    ],
    esperando: [
      "cargo-jogger-pants", // olive, streetwear, carry
      "boxy-cropped-sweatshirt", // cropped, streetwear
    ],
  },
  {
    email: `carla.tecnica${DOMINIO}`,
    descricao: "técnico, outdoor, camadas de inverno",
    esperado: "material = técnico · uso = outdoor · camada = inverno",
    comprou: [
      "puffer-jacket", // olive, technical, outdoor, winter, layering
      "heavy-fleece-hoodie", // grey, technical, outdoor, winter
      "trail-sneakers", // outdoor, red, technical
      "cargo-pants", // dark green, carry, streetwear
      "laptop-commuter-backpack", // carry, travel, grey
    ],
    esperando: [
      "sherpa-lined-hoodie", // technical, outdoor, white, winter
      "wool-overcoat", // navy, classic, winter, layering
    ],
  },
  {
    /**
     * O CONTROLE. Nenhuma tag se repete de propósito: infantil, praia, festa,
     * trilha e uma piada de programador. Não há armário aqui — há cinco compras.
     */
    email: `diego.disperso${DOMINIO}`,
    descricao: "nada a ver com nada — o controle",
    esperado: "NENHUMA persona. confiança < 0.5, e o look compõe pelas sementes",
    comprou: [
      "flowing-maxi-dress", // red, summer, women
      "trail-sneakers", // outdoor, technical
      "code-wizard-hat", // graphic, code-culture
      "kids-hoodie", // kids
      "sublimation-flip-flops", // summer
    ],
    esperando: ["wool-overcoat"],
  },
];

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

/**
 * O `variant_id` de um handle. **Prefere a disponível**, porque o agente monta o
 * pool só com o que dá para comprar agora — semear uma variante esgotada
 * produziria uma semente que o `INNER JOIN` de `comprasDe` descarta, e o armário
 * chegaria menor do que o script diz que criou.
 */
const variantesDe = async (handles: string[]): Promise<Map<string, { id: string; titulo: string; preco: number }>> => {
  const linhas = await sql<{ handle: string; variant_id: string; title: string; price: number }[]>`
    SELECT DISTINCT ON (p.handle) p.handle, v.variant_id, p.title, v.price
      FROM products p
      JOIN variants v ON v.product_group_id = p.product_group_id
     WHERE p.handle = ANY(${handles})
     ORDER BY p.handle, v.available DESC, v.variant_id ASC`;

  return new Map(linhas.map((l) => [l.handle, { id: l.variant_id, titulo: l.title, preco: l.price }]));
};

/** Datas decrescentes a partir de hoje: a compra mais antiga fica no fim. */
const diasAtras = (n: number): string =>
  new Date(Date.now() - n * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");

const limpar = async (): Promise<void> => {
  // `order_items` cai por CASCADE; `stock_alerts` não tem FK e sai à mão.
  const pedidos = await sql`DELETE FROM orders WHERE email LIKE ${`%${DOMINIO}`} RETURNING id`;
  const alertas = await sql`DELETE FROM stock_alerts WHERE email LIKE ${`%${DOMINIO}`} RETURNING id`;
  console.log(`removidos: ${pedidos.length} pedido(s), ${alertas.length} alerta(s)`);
};

const listar = async (): Promise<void> => {
  const linhas = await sql<{ email: string; comprou: number; esperando: number }[]>`
    SELECT e.email,
           (SELECT count(DISTINCT oi.variant_id)::int FROM orders o
              JOIN order_items oi ON oi.order_id = o.id
             WHERE o.email = e.email AND o.status <> 'cancelled') AS comprou,
           (SELECT count(*)::int FROM stock_alerts s WHERE s.email = e.email) AS esperando
      FROM (SELECT DISTINCT email FROM orders WHERE email LIKE ${`%${DOMINIO}`}
            UNION SELECT DISTINCT email FROM stock_alerts WHERE email LIKE ${`%${DOMINIO}`}) e
     ORDER BY e.email`;

  if (linhas.length === 0) {
    console.log("nenhum armário semeado. rode `npm run look:armarios`.");
    return;
  }

  for (const l of linhas) {
    const def = ARMARIOS.find((a) => a.email === l.email);
    const total = l.comprou + l.esperando;
    console.log(`\n  ${l.email}  —  ${total} sinal(is)  (${l.comprou} compras, ${l.esperando} avise-me)`);
    if (def) {
      console.log(`    ${def.descricao}`);
      console.log(`    esperado: ${def.esperado}`);
    }
  }
  console.log(
    `\nusar assim:\n  npm run look:dryrun -- heavyweight-boxy-tee --email ${ARMARIOS[0]!.email} --so-persona`,
  );
};

const semear = async (): Promise<void> => {
  await limpar();

  const todos = [...new Set(ARMARIOS.flatMap((a) => [...a.comprou, ...a.esperando]))];
  const variantes = await variantesDe(todos);

  const ausentes = todos.filter((h) => !variantes.has(h));
  if (ausentes.length > 0) {
    // Falha alto em vez de semear pela metade: um armário com 3 das 7 peças
    // ainda RODA, e produziria uma medição silenciosamente pior.
    console.error(`\nhandles que não existem no catálogo:\n  ${ausentes.join("\n  ")}`);
    console.error("\nnada foi semeado. corrija a lista em scripts/look-armarios.ts.");
    process.exit(1);
  }

  let dia = 90;

  for (const armario of ARMARIOS) {
    // Um pedido por peça, e não um pedido com N itens: cada compra tem a SUA
    // data, e é a data que `consolidar` usa para ordenar as sementes. Um pedido
    // só daria a todas o mesmo instante e apagaria a cronologia do armário.
    for (const handle of armario.comprou) {
      const v = variantes.get(handle)!;
      const id = `demo-${armario.email.split("@")[0]}-${handle}`;
      const em = diasAtras((dia -= 3));

      await sql`INSERT INTO orders (id, email, status, total, created_at)
                     VALUES (${id}, ${armario.email}, 'paid', ${v.preco}, ${em})
                ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at`;

      await sql`INSERT INTO order_items (order_id, variant_id, quantity, unit_price, title_snapshot)
                     VALUES (${id}, ${v.id}, 1, ${v.preco}, ${v.titulo})
                ON CONFLICT (order_id, variant_id) DO NOTHING`;
    }

    for (const handle of armario.esperando) {
      const v = variantes.get(handle)!;
      await sql`INSERT INTO stock_alerts (variant_id, email, name, created_at)
                     VALUES (${v.id}, ${armario.email}, 'Demo', ${diasAtras((dia -= 2))})
                ON CONFLICT DO NOTHING`;
    }

    const total = armario.comprou.length + armario.esperando.length;
    console.log(`  ${armario.email.padEnd(30)} ${total} sinais — ${armario.descricao}`);
  }
};

const main = async (): Promise<void> => {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definida.");
    process.exit(1);
  }

  try {
    if (process.argv.includes("--limpar")) {
      await limpar();
    } else if (process.argv.includes("--listar")) {
      await listar();
    } else {
      await semear();
      await listar();
    }
  } finally {
    await sql.end();
  }
};

await main();
