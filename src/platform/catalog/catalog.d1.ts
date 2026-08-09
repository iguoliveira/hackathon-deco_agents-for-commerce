/**
 * Acesso ao Postgres (Supabase). Único arquivo do projeto que fala SQL de catálogo.
 *
 * As queries continuam escritas na API do D1 — `platform/db` expõe o Postgres
 * com essa mesma superfície e traduz `?` para `$1..$n`. O nome do arquivo é
 * herdado da época do D1 e ficou: renomeá-lo trocaria o import em vários
 * lugares sem mudar nada do que o arquivo faz.
 */

import { getDb } from "../db";
import type {
  CatalogRecord,
  ProductImageRow,
  ProductPropRow,
  ProductRow,
  VariantOptionRow,
  VariantRow,
} from "./catalog.types";

/** `?, ?, ?` para um `IN (...)` — cada valor vai como parâmetro próprio. */
const placeholders = (count: number) => new Array(count).fill("?").join(", ");

const groupBy = <T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> => {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const bucket = map.get(key(row));
    if (bucket) bucket.push(row);
    else map.set(key(row), [row]);
  }
  return map;
};

/**
 * Carrega imagens, props, variantes e opções para um conjunto de produtos já
 * lido, e monta os `CatalogRecord`.
 *
 * São 4 queries em vez de um JOIN gigante: o JOIN multiplicaria imagens x props
 * x variantes x opções e obrigaria a de-duplicar tudo em memória. O `batch`
 * manda três delas numa tacada só.
 */
const withChildren = async (
  db: NonNullable<ReturnType<typeof getDb>>,
  products: ProductRow[],
): Promise<CatalogRecord[]> => {
  if (products.length === 0) return [];

  const ids = products.map((product) => product.product_group_id);
  const slots = placeholders(ids.length);

  const [images, props, variants] = await db.batch<ProductImageRow | ProductPropRow | VariantRow>([
    db
      .prepare(
        `SELECT * FROM product_images WHERE product_group_id IN (${slots}) ORDER BY position ASC`,
      )
      .bind(...ids),
    db
      .prepare(
        `SELECT * FROM product_props WHERE product_group_id IN (${slots}) ORDER BY position ASC`,
      )
      .bind(...ids),
    db
      .prepare(`SELECT * FROM variants WHERE product_group_id IN (${slots}) ORDER BY position ASC`)
      .bind(...ids),
  ]);

  const variantRows = variants.results as VariantRow[];
  const variantIds = variantRows.map((variant) => variant.variant_id);

  // Sem variantes não há o que buscar, e um `IN ()` vazio é erro de sintaxe.
  const optionRows = variantIds.length
    ? (
        await db
          .prepare(
            `SELECT * FROM variant_options WHERE variant_id IN (${placeholders(
              variantIds.length,
            )}) ORDER BY position ASC`,
          )
          .bind(...variantIds)
          .all<VariantOptionRow>()
      ).results
    : [];

  const imagesByProduct = groupBy(images.results as ProductImageRow[], (r) => r.product_group_id);
  const propsByProduct = groupBy(props.results as ProductPropRow[], (r) => r.product_group_id);
  const variantsByProduct = groupBy(variantRows, (r) => r.product_group_id);
  const optionsByVariant = groupBy(optionRows, (r) => r.variant_id);

  return products.map((product) => ({
    product,
    images: imagesByProduct.get(product.product_group_id) ?? [],
    props: propsByProduct.get(product.product_group_id) ?? [],
    variants: variantsByProduct.get(product.product_group_id) ?? [],
    optionsByVariant,
  }));
};

export interface FindCatalogRecordsOptions {
  limit: number;
  /** Handle da coleção (`product_props.value_reference`), ex.: "shirts". */
  collection?: string;
  /** Busca livre, casada contra o título. */
  query?: string;
}

/** Lê produtos na ordem da vitrine, opcionalmente filtrados, com as linhas filhas. */
export const findCatalogRecords = async ({
  limit,
  collection,
  query,
}: FindCatalogRecordsOptions): Promise<CatalogRecord[]> => {
  const db = getDb();
  if (!db) return [];

  const where: string[] = [];
  const params: unknown[] = [];

  if (collection) {
    where.push(
      `EXISTS (SELECT 1 FROM product_props pp
               WHERE pp.product_group_id = p.product_group_id
                 AND pp.name = 'COLLECTION'
                 AND pp.value_reference = ?)`,
    );
    params.push(collection);
  }

  if (query) {
    // ILIKE, não LIKE: no SQLite o LIKE era case-insensitive de graça, no
    // Postgres não é. Trocado junto com o banco — mantido LIKE, "Hoodie" e
    // "hoodie" passariam a dar resultados diferentes, sem erro nenhum.
    // Busca simples: o catálogo é pequeno e isto não é o agente de busca, é só
    // o filtro que as abas da vitrine usavam no loader do Shopify.
    where.push("p.title ILIKE ?");
    params.push(`%${query}%`);
  }

  const sql =
    "SELECT p.* FROM products p" +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY p.position ASC, p.handle ASC LIMIT ?";

  const { results } = await db
    .prepare(sql)
    .bind(...params, limit)
    .all<ProductRow>();

  return withChildren(db, results);
};

export interface SearchCatalogOptions {
  /** Busca livre no título/descrição. */
  term?: string;
  /** Handle da coleção selecionada. */
  collection?: string;
  /** Opções de variante selecionadas: `{ Size: ["M"], Color: ["Black"] }`. */
  options?: Record<string, string[]>;
  sort?: "relevance" | "price:asc" | "price:desc";
  page?: number;
  perPage?: number;
}

export interface FacetValue {
  key: string;
  label: string;
  value: string;
  quantity: number;
}

export interface SearchCatalogResult {
  records: CatalogRecord[];
  total: number;
  collectionFacets: FacetValue[];
  optionFacets: FacetValue[];
}

/**
 * Monta o WHERE compartilhado por produtos, contagem e facetas.
 *
 * As opções de variante viram um EXISTS por nome de opção — `Size=M AND
 * Color=Black` precisa casar o mesmo produto, não a mesma linha, então não dá
 * para colapsar tudo num IN só.
 */
const buildFilter = ({ term, collection, options }: SearchCatalogOptions) => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (term) {
    // ILIKE pelo mesmo motivo do filtro acima — ver findCatalogRecords.
    where.push("(p.title ILIKE ? OR p.description ILIKE ?)");
    params.push(`%${term}%`, `%${term}%`);
  }

  if (collection) {
    where.push(
      `EXISTS (SELECT 1 FROM product_props pp
               WHERE pp.product_group_id = p.product_group_id
                 AND pp.name = 'COLLECTION' AND pp.value_reference = ?)`,
    );
    params.push(collection);
  }

  for (const [name, values] of Object.entries(options ?? {})) {
    if (values.length === 0) continue;
    where.push(
      `EXISTS (SELECT 1 FROM variants v
                 JOIN variant_options vo ON vo.variant_id = v.variant_id
               WHERE v.product_group_id = p.product_group_id
                 AND vo.name = ? AND vo.value IN (${placeholders(values.length)}))`,
    );
    params.push(name, ...values);
  }

  return { clause: where.length ? ` WHERE ${where.join(" AND ")}` : "", params };
};

const ORDER_BY: Record<NonNullable<SearchCatalogOptions["sort"]>, string> = {
  relevance: "p.position ASC, p.handle ASC",
  // O preço vive na variante; ordena pelo menor preço do produto.
  "price:asc":
    "(SELECT MIN(price) FROM variants v WHERE v.product_group_id = p.product_group_id) ASC",
  "price:desc":
    "(SELECT MIN(price) FROM variants v WHERE v.product_group_id = p.product_group_id) DESC",
};

/** Busca paginada com facetas — a base da PLP. */
export const searchCatalog = async (
  opts: SearchCatalogOptions = {},
): Promise<SearchCatalogResult> => {
  const empty: SearchCatalogResult = {
    records: [],
    total: 0,
    collectionFacets: [],
    optionFacets: [],
  };

  const db = getDb();
  if (!db) return empty;

  const { sort = "relevance", page = 0, perPage = 12 } = opts;
  const { clause, params } = buildFilter(opts);

  const [pageRows, countRows, collectionRows, optionRows] = await db.batch<Record<string, unknown>>(
    [
      db
        .prepare(`SELECT p.* FROM products p${clause} ORDER BY ${ORDER_BY[sort]} LIMIT ? OFFSET ?`)
        .bind(...params, perPage, page * perPage),
      db.prepare(`SELECT COUNT(*) AS total FROM products p${clause}`).bind(...params),
      // Facetas calculadas sobre o MESMO conjunto filtrado dos produtos. Valores
      // com contagem 0 nunca aparecem — é o que impede oferecer um filtro que
      // levaria a zero resultados.
      //
      // Três detalhes aqui são exigência do Postgres que o SQLite perdoava, e
      // os três quebram em runtime, não no build:
      //
      //   1. `HAVING` não enxerga alias da lista de SELECT — é avaliado antes
      //      dela. O agregado precisa ser repetido por extenso. Era o
      //      `column "quantity" does not exist` que derrubava a PLP.
      //   2. Toda coluna não agregada tem que estar no GROUP BY. `label` e
      //      `position` viraram MIN(): o SQLite escolhia um valor qualquer do
      //      grupo, o Postgres recusa a query inteira.
      //   3. `ORDER BY`, ao contrário do HAVING, ACEITA alias de saída — por
      //      isso `ORDER BY quantity DESC` fica como está.
      db
        .prepare(
          `SELECT pp.value_reference AS value, MIN(pp.value) AS label,
                  COUNT(DISTINCT p.product_group_id) AS quantity
         FROM products p
         JOIN product_props pp ON pp.product_group_id = p.product_group_id AND pp.name = 'COLLECTION'
         ${clause.replace(/^ WHERE/, "WHERE")}
         GROUP BY pp.value_reference
         HAVING COUNT(DISTINCT p.product_group_id) > 0
         ORDER BY quantity DESC`,
        )
        .bind(...params),
      db
        .prepare(
          `SELECT vo.name AS key, vo.value AS label,
                  COUNT(DISTINCT p.product_group_id) AS quantity
         FROM products p
         JOIN variants v ON v.product_group_id = p.product_group_id
         JOIN variant_options vo ON vo.variant_id = v.variant_id
         ${clause.replace(/^ WHERE/, "WHERE")}
         GROUP BY vo.name, vo.value
         HAVING COUNT(DISTINCT p.product_group_id) > 0
         ORDER BY vo.name ASC, MIN(vo.position) ASC`,
        )
        .bind(...params),
    ],
  );

  return {
    records: await withChildren(db, pageRows.results as unknown as ProductRow[]),
    total: Number((countRows.results[0] as { total?: number })?.total ?? 0),
    collectionFacets: (collectionRows.results as unknown as FacetValue[]).map((row) => ({
      ...row,
      key: "collection",
    })),
    optionFacets: optionRows.results as unknown as FacetValue[],
  };
};

/**
 * Nomes de opção de variante que existem no catálogo — `Size`, `Color`, …
 *
 * É a whitelist que separa filtro de faceta de qualquer outro parâmetro da
 * querystring. Sem ela, `?utm_source=google` vira um filtro por uma opção que
 * não existe e a listagem volta vazia (ver `getProductListingPage`).
 *
 * Cacheado por isolate: o conjunto só muda quando uma migration nova entra, e
 * aí o processo reinicia de qualquer forma.
 */
let optionNames: Set<string> | null = null;

export const findOptionNames = async (): Promise<Set<string>> => {
  if (optionNames) return optionNames;

  const db = getDb();
  // Sem banco, nenhum filtro de opção é aplicado — degrada para a listagem sem
  // facetas, que é melhor do que zerar o resultado.
  if (!db) return new Set();

  const { results } = await db
    .prepare("SELECT DISTINCT name FROM variant_options")
    .all<{ name: string }>();

  optionNames = new Set(results.map((row) => row.name));
  return optionNames;
};

/**
 * Handles de coleção que existem no catálogo — `shirts`, `accessories`, …
 *
 * É a whitelist que permite tratar `/shirts` como filtro de coleção sem tratar
 * `/s`, `/login` ou `/products/x` do mesmo jeito. Sem ela, qualquer caminho
 * viraria um filtro por coleção inexistente e a listagem voltaria vazia.
 *
 * Cacheado por isolate, como `findOptionNames`: o conjunto só muda quando uma
 * migration nova entra, e aí o processo reinicia de qualquer forma.
 */
let collectionHandles: Set<string> | null = null;

export const findCollectionHandles = async (): Promise<Set<string>> => {
  if (collectionHandles) return collectionHandles;

  const db = getDb();
  if (!db) return new Set();

  const { results } = await db
    .prepare(
      "SELECT DISTINCT value_reference FROM product_props WHERE name = 'COLLECTION' AND value_reference IS NOT NULL",
    )
    .all<{ value_reference: string }>();

  collectionHandles = new Set(results.map((row) => row.value_reference));
  return collectionHandles;
};

/** Lê um produto pelo handle. `null` quando não existe. */
export const findCatalogRecordByHandle = async (handle: string): Promise<CatalogRecord | null> => {
  const db = getDb();
  if (!db) return null;

  const product = await db
    .prepare("SELECT * FROM products WHERE handle = ?")
    .bind(handle)
    .first<ProductRow>();

  if (!product) return null;

  const [record] = await withChildren(db, [product]);
  return record ?? null;
};

/**
 * Lê vários produtos por handle, **só os que ainda têm variante disponível**,
 * preservando a ordem pedida.
 *
 * É o que reidrata uma vitrine persistida. Os dois comportamentos acima são o
 * ponto:
 *
 * - **Filtrar por disponibilidade aqui, e não na geração**, porque a vitrine
 *   fica gravada por dias enquanto o estoque muda. Uma vitrine cuja premissa é
 *   "não te mostro o que você não pode comprar" recomendando item esgotado é o
 *   pior resultado possível desta feature — e seria invisível em teste, porque
 *   a página continuaria respondendo 200.
 * - **Preservar a ordem pedida**, porque a ordem é decisão do agente. O
 *   `ORDER BY p.position` das outras consultas jogaria fora exatamente o
 *   julgamento que se pagou para obter.
 */
export const findAvailableCatalogRecordsByHandles = async (
  handles: string[],
): Promise<CatalogRecord[]> => {
  const db = getDb();
  if (!db || handles.length === 0) return [];

  const marcadores = handles.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT p.* FROM products p
        WHERE p.handle IN (${marcadores})
          AND EXISTS (SELECT 1 FROM variants v
                       WHERE v.product_group_id = p.product_group_id AND v.available = 1)`,
    )
    .bind(...handles)
    .all<ProductRow>();

  const registros = await withChildren(db, results);
  const porHandle = new Map(registros.map((r) => [r.product.handle, r]));

  return handles
    .map((handle) => porHandle.get(handle))
    .filter((registro): registro is CatalogRecord => !!registro);
};

/** Um candidato a entrar na vitrine, com o PORQUÊ separado da nota. */
export interface SimilarCandidate {
  record: CatalogRecord;
  /** Nota combinada — só para ordenar. Os campos abaixo é que explicam. */
  score: number;
  /** Mesmo `product_type`: é uma alternativa ao que a pessoa queria. */
  sameType: boolean;
  /** Mesma coleção: mesmo território da loja. */
  sameCollection: boolean;
  /** Tags em comum — o eixo mais forte de "combina com". */
  sharedTags: string[];
}

/**
 * Produtos DISPONÍVEIS parecidos com a variante que o comprador esperou.
 *
 * É a consulta que alimenta o agente da vitrine. Devolve os componentes da
 * nota, não só a nota: o agente precisa saber SE é alternativa (mesmo tipo) ou
 * complemento (tipo diferente, tags em comum) para montar uma vitrine que faça
 * sentido — e para justificar a escolha em texto, que um número sozinho não
 * permite.
 *
 * Pesos: tag em comum vale 3, mesmo tipo 4, mesma coleção 2. Mesmo tipo pesa
 * mais que uma tag isolada porque "outro moletom" quase sempre serve quando o
 * que a pessoa queria acabou; tags acumulam e por isso passam o tipo quando são
 * várias.
 *
 * Só entram produtos com ao menos uma variante disponível — recomendar o que
 * também está esgotado é repetir o problema que trouxe a pessoa até aqui.
 *
 * Full-text sobre título+descrição ainda NÃO entra: com `product_type` e tags
 * preenchidos em 41/41 (ver 0008), a estrutura já ordena bem, e um sinal
 * textual em cima disso é difícil de justificar. O índice existe (0009) para
 * quando isso for medido e provado necessário.
 */
/**
 * Peças DISPONÍVEIS de **outro tipo** que combinam com a desejada — a matéria
 * da vitrine "combina com": calça para a camiseta, tênis para a calça.
 *
 * Precisa ser uma consulta separada e não um filtro sobre `findSimilarAvailable`
 * porque aquela soma +4 para mesmo tipo: o topo dela é sempre alternativa, e
 * sobrariam poucos complementos, todos no fim da lista. Medido no catálogo
 * real — de 16 candidatos, 12 eram camiseta.
 *
 * Aqui o mesmo tipo é **excluído** e a nota é só tag em comum (o eixo de
 * estilo) mais coleção. Exigir ao menos um dos dois evita o efeito "combina com
 * tudo": sem isso a consulta devolveria o catálogo inteiro ordenado por acaso.
 *
 * A diversidade de tipo NÃO é resolvida aqui. Um `DISTINCT ON (product_type)`
 * escolheria o melhor de cada tipo antes de saber quantos tipos entram, e
 * descartaria o segundo melhor tênis mesmo quando ele é melhor que a melhor
 * bolsa. Quem equilibra é `shelf.candidates.ts`, que enxerga a lista inteira.
 */
export const findComplementsAvailable = async (
  variantId: string,
  limit = 12,
): Promise<SimilarCandidate[]> => {
  const db = getDb();
  if (!db) return [];

  const { results: rows } = await db
    .prepare(
      `WITH alvo AS (
         SELECT p.product_group_id, p.product_type,
                (SELECT pp.value_reference FROM product_props pp
                  WHERE pp.product_group_id = p.product_group_id
                    AND pp.name = 'COLLECTION' LIMIT 1) AS colecao,
                COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                  WHERE pp.product_group_id = p.product_group_id
                    AND pp.name = 'TAG'), '{}') AS tags
           FROM products p
           JOIN variants v ON v.product_group_id = p.product_group_id
          WHERE v.variant_id = ?
       )
       SELECT p.*,
              FALSE AS same_type,
              EXISTS (SELECT 1 FROM product_props pp
                       WHERE pp.product_group_id = p.product_group_id
                         AND pp.name = 'COLLECTION'
                         AND pp.value_reference = alvo.colecao)          AS same_collection,
              COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                         WHERE pp.product_group_id = p.product_group_id
                           AND pp.name = 'TAG'
                           AND pp.value = ANY(alvo.tags)), '{}')          AS shared_tags
         FROM products p, alvo
        WHERE p.product_group_id <> alvo.product_group_id
          -- O oposto de findSimilarAvailable: aqui mesmo tipo é o que sai.
          AND (p.product_type <> alvo.product_type OR p.product_type = '')
          AND EXISTS (SELECT 1 FROM variants v
                       WHERE v.product_group_id = p.product_group_id AND v.available = 1)
          -- Alguma afinidade real, senão "combina" vira sorteio.
          AND (EXISTS (SELECT 1 FROM product_props pp
                        WHERE pp.product_group_id = p.product_group_id
                          AND pp.name = 'TAG' AND pp.value = ANY(alvo.tags))
               OR EXISTS (SELECT 1 FROM product_props pp
                           WHERE pp.product_group_id = p.product_group_id
                             AND pp.name = 'COLLECTION'
                             AND pp.value_reference = alvo.colecao))
        ORDER BY
          COALESCE((SELECT COUNT(*) FROM product_props pp
                     WHERE pp.product_group_id = p.product_group_id
                       AND pp.name = 'TAG' AND pp.value = ANY(alvo.tags)), 0) * 3
          + CASE WHEN EXISTS (SELECT 1 FROM product_props pp
                               WHERE pp.product_group_id = p.product_group_id
                                 AND pp.name = 'COLLECTION'
                                 AND pp.value_reference = alvo.colecao) THEN 2 ELSE 0 END
          DESC, p.position ASC
        LIMIT ?`,
    )
    .bind(variantId, limit)
    .all<ProductRow & { same_type: boolean; same_collection: boolean; shared_tags: string[] }>();

  if (rows.length === 0) return [];

  const records = await withChildren(
    db,
    rows.map(({ same_type: _t, same_collection: _c, shared_tags: _s, ...produto }) => produto),
  );

  return records.map((record, indice) => {
    const linha = rows[indice];
    const sharedTags = linha.shared_tags ?? [];
    // Sem o +4 de mesmo tipo: aqui ele nunca se aplica, e somá-lo faria a nota
    // desta lista parecer comparável à da outra sem ser.
    return {
      record,
      sameType: false,
      sameCollection: !!linha.same_collection,
      sharedTags,
      score: sharedTags.length * 3 + (linha.same_collection ? 2 : 0),
    };
  });
};

export const findSimilarAvailable = async (
  variantId: string,
  limit = 12,
): Promise<SimilarCandidate[]> => {
  const db = getDb();
  if (!db) return [];

  const { results: rows } = await db
    .prepare(
      `WITH alvo AS (
         SELECT p.product_group_id, p.product_type,
                (SELECT pp.value_reference FROM product_props pp
                  WHERE pp.product_group_id = p.product_group_id
                    AND pp.name = 'COLLECTION' LIMIT 1) AS colecao,
                COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                  WHERE pp.product_group_id = p.product_group_id
                    AND pp.name = 'TAG'), '{}') AS tags
           FROM products p
           JOIN variants v ON v.product_group_id = p.product_group_id
          WHERE v.variant_id = ?
       )
       SELECT p.*,
              (p.product_type = alvo.product_type AND p.product_type <> '') AS same_type,
              EXISTS (SELECT 1 FROM product_props pp
                       WHERE pp.product_group_id = p.product_group_id
                         AND pp.name = 'COLLECTION'
                         AND pp.value_reference = alvo.colecao)          AS same_collection,
              COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                         WHERE pp.product_group_id = p.product_group_id
                           AND pp.name = 'TAG'
                           AND pp.value = ANY(alvo.tags)), '{}')          AS shared_tags
         FROM products p, alvo
        WHERE p.product_group_id <> alvo.product_group_id
          -- Ao menos uma variante comprável agora.
          AND EXISTS (SELECT 1 FROM variants v
                       WHERE v.product_group_id = p.product_group_id AND v.available = 1)
        ORDER BY
          COALESCE((SELECT COUNT(*) FROM product_props pp
                     WHERE pp.product_group_id = p.product_group_id
                       AND pp.name = 'TAG' AND pp.value = ANY(alvo.tags)), 0) * 3
          + CASE WHEN p.product_type = alvo.product_type AND p.product_type <> '' THEN 4 ELSE 0 END
          + CASE WHEN EXISTS (SELECT 1 FROM product_props pp
                               WHERE pp.product_group_id = p.product_group_id
                                 AND pp.name = 'COLLECTION'
                                 AND pp.value_reference = alvo.colecao) THEN 2 ELSE 0 END
          DESC, p.position ASC
        LIMIT ?`,
    )
    .bind(variantId, limit)
    .all<ProductRow & { same_type: boolean; same_collection: boolean; shared_tags: string[] }>();

  if (rows.length === 0) return [];

  const records = await withChildren(
    db,
    rows.map(({ same_type: _t, same_collection: _c, shared_tags: _s, ...produto }) => produto),
  );

  return records.map((record, i) => {
    const row = rows[i];
    const sharedTags = row.shared_tags ?? [];
    return {
      record,
      sameType: !!row.same_type,
      sameCollection: !!row.same_collection,
      sharedTags,
      score: sharedTags.length * 3 + (row.same_type ? 4 : 0) + (row.same_collection ? 2 : 0),
    };
  });
};

/** Uma linha de carrinho já resolvida contra o catálogo. */
export interface CartLineRecord {
  variantId: string;
  productHandle: string;
  productTitle: string;
  /** O rótulo da variante — o tamanho, ou a cor quando não há tamanho. */
  variantTitle: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  imageAlt: string;
  available: boolean;
  currencyCode: string;
}

/**
 * Resolve variantes de carrinho pelo id, com o produto junto.
 *
 * O carrinho guarda **só** `variant_id` e quantidade (num cookie); tudo o que
 * aparece na sacola sai daqui, a cada leitura. É o que faz o preço e a foto na
 * sacola serem os de agora, e não os de quando o item foi adicionado — troquei
 * 47 fotos e 9 cores numa tarde, e um carrinho com snapshot teria ficado
 * mostrando o catálogo de ontem.
 *
 * **Não filtra por disponibilidade**, e isso é deliberado: um item que esgotou
 * depois de entrar no carrinho precisa APARECER, marcado como indisponível,
 * para a pessoa entender por que não consegue finalizar. Sumir em silêncio é o
 * comportamento que faz alguém achar que o site comeu o pedido. Quem decide o
 * que fazer com `available` é quem monta a tela.
 *
 * Preserva a ordem pedida — a ordem do cookie é a ordem em que a pessoa
 * adicionou, e é a que ela espera ver.
 */
export const findCartLines = async (variantIds: string[]): Promise<CartLineRecord[]> => {
  const db = getDb();
  if (!db || variantIds.length === 0) return [];

  const { results } = await db
    .prepare(
      `SELECT v.variant_id, v.title AS variant_title, v.price, v.compare_at_price,
              v.available, v.image_url, v.image_alt,
              p.handle AS product_handle, p.title AS product_title, p.currency_code
         FROM variants v
         JOIN products p ON p.product_group_id = v.product_group_id
        WHERE v.variant_id IN (${placeholders(variantIds.length)})`,
    )
    .bind(...variantIds)
    .all<{
      variant_id: string;
      variant_title: string;
      price: number;
      compare_at_price: number | null;
      available: number;
      image_url: string | null;
      image_alt: string;
      product_handle: string;
      product_title: string;
      currency_code: string;
    }>();

  const porId = new Map(
    results.map((row) => [
      row.variant_id,
      {
        variantId: row.variant_id,
        productHandle: row.product_handle,
        productTitle: row.product_title,
        variantTitle: row.variant_title,
        price: row.price,
        compareAtPrice: row.compare_at_price,
        imageUrl: row.image_url,
        imageAlt: row.image_alt,
        available: row.available === 1,
        currencyCode: row.currency_code,
      },
    ]),
  );

  return variantIds
    .map((id) => porId.get(id))
    .filter((linha): linha is CartLineRecord => !!linha);
};
