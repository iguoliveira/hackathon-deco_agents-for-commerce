/**
 * Acesso ao SQLite (D1). Único arquivo do projeto que fala SQL de catálogo.
 *
 * O binding `CATALOG_DB` é declarado em wrangler.jsonc e tipado em
 * worker-configuration.d.ts (regenerar com `npm run types` após mexer no
 * wrangler.jsonc). Localmente o banco vive em `.wrangler/state/v3/d1/` — é um
 * arquivo .sqlite comum, abrível em qualquer cliente.
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

/**
 * Lê `limit` produtos com todas as linhas filhas.
 *
 * São 5 queries (uma por tabela) em vez de um JOIN gigante: o JOIN
 * multiplicaria imagens x props x variantes x opções e obrigaria a
 * de-duplicar tudo em memória. Com o catálogo pequeno de uma demo, cinco
 * roundtrips locais custam menos que essa complexidade — e o `batch` manda
 * as quatro consultas de filhos de uma vez só.
 */
export const findCatalogRecords = async (limit: number): Promise<CatalogRecord[]> => {
  const db = env.CATALOG_DB;

  if (!db) {
    console.error("[catalog] binding CATALOG_DB ausente — confira d1_databases no wrangler.jsonc");
    return [];
  }

  const { results: products } = await db
    .prepare("SELECT * FROM products ORDER BY position ASC, handle ASC LIMIT ?")
    .bind(limit)
    .all<ProductRow>();

  if (products.length === 0) return [];

  const ids = products.map((product) => product.product_group_id);
  const slots = placeholders(ids.length);

  const [images, props, variants] = await db.batch<
    ProductImageRow | ProductPropRow | VariantRow
  >([
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

  // Sem variantes não há o que buscar em variant_options, e um `IN ()` vazio
  // é erro de sintaxe no SQLite.
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
