/**
 * Acesso ao SQLite (D1). Único arquivo do projeto que fala SQL de catálogo.
 *
 * O binding `CATALOG_DB` é declarado em wrangler.jsonc e tipado à mão em
 * src/types/cloudflare-bindings.d.ts. Localmente o banco vive em
 * `.wrangler/state/v3/d1/` — é um arquivo .sqlite comum, abrível em qualquer
 * cliente.
 */

import { env } from "cloudflare:workers";
import type {
  CatalogRecord,
  ProductImageRow,
  ProductPropRow,
  ProductRow,
  VariantOptionRow,
  VariantRow,
} from "./catalog.types";

/** `?, ?, ?` para um `IN (...)` — D1 não aceita array como parâmetro único. */
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

const getDb = () => {
  const db = env.CATALOG_DB;
  if (!db) {
    console.error("[catalog] binding CATALOG_DB ausente — confira d1_databases no wrangler.jsonc");
    return null;
  }
  return db;
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
    // LIKE simples: o catálogo é pequeno e isto não é o agente de busca, é só
    // o filtro que as abas da vitrine usavam no loader do Shopify.
    where.push("p.title LIKE ?");
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
    where.push("(p.title LIKE ? OR p.description LIKE ?)");
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
  "price:asc": "(SELECT MIN(price) FROM variants v WHERE v.product_group_id = p.product_group_id) ASC",
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

  const [pageRows, countRows, collectionRows, optionRows] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT p.* FROM products p${clause} ORDER BY ${ORDER_BY[sort]} LIMIT ? OFFSET ?`)
      .bind(...params, perPage, page * perPage),
    db.prepare(`SELECT COUNT(*) AS total FROM products p${clause}`).bind(...params),
    // Facetas calculadas sobre o MESMO conjunto filtrado dos produtos. Valores
    // com contagem 0 nunca aparecem — é o que impede oferecer um filtro que
    // levaria a zero resultados.
    db
      .prepare(
        `SELECT pp.value_reference AS value, pp.value AS label, COUNT(DISTINCT p.product_group_id) AS quantity
         FROM products p
         JOIN product_props pp ON pp.product_group_id = p.product_group_id AND pp.name = 'COLLECTION'
         ${clause.replace(/^ WHERE/, "WHERE")}
         GROUP BY pp.value_reference HAVING quantity > 0 ORDER BY quantity DESC`,
      )
      .bind(...params),
    db
      .prepare(
        `SELECT vo.name AS key, vo.value AS label, COUNT(DISTINCT p.product_group_id) AS quantity
         FROM products p
         JOIN variants v ON v.product_group_id = p.product_group_id
         JOIN variant_options vo ON vo.variant_id = v.variant_id
         ${clause.replace(/^ WHERE/, "WHERE")}
         GROUP BY vo.name, vo.value HAVING quantity > 0 ORDER BY vo.name ASC, vo.position ASC`,
      )
      .bind(...params),
  ]);

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
