/**
 * Gera uma migration SQL com o catálogo da loja Shopify.
 *
 *   npm run catalog:generate            # cria a próxima migration em db/migrations/
 *   npm run catalog:generate -- --out db/migrations/0004_x.sql
 *   npm run catalog:generate -- --dry-run
 *
 * Lê as credenciais de `.deco/blocks/deco-shopify.json` — as mesmas que o app
 * Shopify usa em runtime —, pagina a Storefront API e escreve INSERTs nas cinco
 * tabelas do catálogo. É o caminho para refazer o seed quando o catálogo da loja
 * mudar, sem ninguém editar 240 KB de SQL à mão.
 *
 * Por padrão escreve na PRÓXIMA numeração livre, nunca por cima de uma migration
 * existente: reescrever uma migration já aplicada não a reaplica, só faz os
 * bancos divergirem.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "db/migrations";
const API_VERSION = "2025-04";
const PAGE_SIZE = 10;
/** Teto da Storefront API por página de variantes. */
const VARIANTS_PAGE = 250;
/** Linhas por INSERT — mantém cada statement num tamanho razoável. */
const CHUNK = 40;

// ---------------------------------------------------------------------------
// Tipos da resposta da Storefront API (só o que consumimos)
// ---------------------------------------------------------------------------

interface Money {
  amount: string;
  currencyCode?: string;
}
interface ShopifyImage {
  url: string;
  altText: string | null;
}
interface ShopifyVariant {
  id: string;
  title: string;
  barcode: string | null;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: Money;
  compareAtPrice: Money | null;
  image: ShopifyImage | null;
  selectedOptions: Array<{ name: string; value: string }>;
}
interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string | null;
  createdAt: string;
  tags: string[];
  vendor: string;
  productType: string;
  images: { nodes: ShopifyImage[] };
  collections: { nodes: Array<{ handle: string; title: string }> };
  variants: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ShopifyVariant[] };
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const VARIANT_FIELDS = `
  id title barcode availableForSale quantityAvailable
  price { amount currencyCode }
  compareAtPrice { amount }
  image { url altText }
  selectedOptions { name value }
`;

const CATALOG_QUERY = `
query Catalog($cursor: String, $variants: Int!) {
  products(first: ${PAGE_SIZE}, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title description descriptionHtml createdAt tags vendor productType
      images(first: 10) { nodes { url altText } }
      collections(first: 5) { nodes { handle title } }
      variants(first: $variants) {
        pageInfo { hasNextPage endCursor }
        nodes { ${VARIANT_FIELDS} }
      }
    }
  }
}`;

/** Usada só quando um produto tem mais variantes do que couberam na página. */
const VARIANTS_QUERY = `
query MoreVariants($handle: String!, $cursor: String) {
  product(handle: $handle) {
    variants(first: ${VARIANTS_PAGE}, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { ${VARIANT_FIELDS} }
    }
  }
}`;

// ---------------------------------------------------------------------------
// Credenciais
// ---------------------------------------------------------------------------

const readShopifyConfig = () => {
  const raw = readFileSync(".deco/blocks/deco-shopify.json", "utf-8");
  const block = JSON.parse(raw) as { storeName?: string; storefrontAccessToken?: string };

  if (!block.storeName || !block.storefrontAccessToken) {
    throw new Error(
      ".deco/blocks/deco-shopify.json sem storeName/storefrontAccessToken — " +
        "o app Shopify precisa estar configurado para gerar o catálogo.",
    );
  }
  return {
    endpoint: `https://${block.storeName}.myshopify.com/api/${API_VERSION}/graphql.json`,
    token: block.storefrontAccessToken,
    storeName: block.storeName,
  };
};

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

const createClient = (endpoint: string, token: string) => {
  return async <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Storefront API HTTP ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as { data?: T; errors?: unknown };
    if (payload.errors) {
      throw new Error(`Storefront API: ${JSON.stringify(payload.errors).slice(0, 500)}`);
    }
    if (!payload.data) throw new Error("Storefront API devolveu resposta sem `data`.");
    return payload.data;
  };
};

const fetchCatalog = async (call: ReturnType<typeof createClient>) => {
  const products: ShopifyProduct[] = [];
  let cursor: string | null = null;

  for (let page = 1; ; page++) {
    const data = await call<{
      products: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ShopifyProduct[] };
    }>(CATALOG_QUERY, { cursor, variants: 25 });

    products.push(...data.products.nodes);
    process.stdout.write(`  página ${page}: +${data.products.nodes.length}\n`);

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  // Produtos com mais de 25 variantes: completa a lista em vez de truncar em
  // silêncio. Truncar aqui produziria um catálogo plausível e errado — o pior
  // tipo de bug de dado, porque nada falha.
  for (const product of products) {
    let info = product.variants.pageInfo;
    while (info.hasNextPage) {
      const data = await call<{
        product: { variants: { pageInfo: typeof info; nodes: ShopifyVariant[] } };
      }>(VARIANTS_QUERY, { handle: product.handle, cursor: info.endCursor });

      product.variants.nodes.push(...data.product.variants.nodes);
      info = data.product.variants.pageInfo;
      process.stdout.write(
        `  ${product.handle}: +${data.product.variants.nodes.length} variantes extras\n`,
      );
    }
  }

  return products;
};

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

/** Literal SQL. Aspas simples viram duplas; null/vazio vira NULL. */
const q = (value: string | null | undefined): string =>
  value == null || value === "" ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;

/** Igual a `q`, mas string vazia continua sendo string vazia (colunas NOT NULL). */
const qs = (value: string | null | undefined): string =>
  `'${String(value ?? "").replace(/'/g, "''")}'`;

const emit = (table: string, columns: string[], rows: string[][]): string => {
  if (rows.length === 0) return "";
  let sql = "";
  for (let i = 0; i < rows.length; i += CHUNK) {
    const block = rows.slice(i, i + CHUNK);
    sql += `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n`;
    sql += block.map((row) => `  (${row.join(", ")})`).join(",\n");
    sql += ";\n\n";
  }
  return sql;
};

const buildSql = (products: ShopifyProduct[], storeName: string): string => {
  const productRows: string[][] = [];
  const imageRows: string[][] = [];
  const propRows: string[][] = [];
  const variantRows: string[][] = [];
  const optionRows: string[][] = [];

  products.forEach((product, position) => {
    const id = product.id;
    const currency = product.variants.nodes[0]?.price.currencyCode ?? "USD";

    productRows.push([
      qs(id), qs(product.handle), qs(product.title), qs(product.description),
      q(product.descriptionHtml), qs(product.vendor), qs(product.productType),
      q(product.createdAt), qs(currency), String(position),
    ]);

    product.images.nodes.forEach((image, i) => {
      imageRows.push([qs(id), qs(image.url), qs(image.altText ?? ""), String(i)]);
    });

    let propPosition = 0;
    for (const tag of product.tags) {
      propRows.push([qs(id), qs("TAG"), qs(tag), "NULL", String(propPosition++)]);
    }
    for (const collection of product.collections.nodes) {
      propRows.push([
        qs(id), qs("COLLECTION"), qs(collection.title), qs(collection.handle),
        String(propPosition++),
      ]);
    }

    product.variants.nodes.forEach((variant, i) => {
      variantRows.push([
        qs(variant.id), qs(id), qs(variant.title), q(variant.barcode),
        String(Number(variant.price.amount)),
        variant.compareAtPrice ? String(Number(variant.compareAtPrice.amount)) : "NULL",
        variant.availableForSale ? "1" : "0",
        String(variant.quantityAvailable ?? 0),
        q(variant.image?.url), qs(variant.image?.altText ?? ""), String(i),
      ]);

      variant.selectedOptions.forEach((option, j) => {
        optionRows.push([qs(variant.id), qs(option.name), qs(option.value), String(j)]);
      });
    });
  });

  // Idempotência por PREDICADO, não por lista de ids: apaga só o que esta
  // migration governa (linhas de origem Shopify). Um produto cadastrado à mão
  // com id de outro formato sobrevive a um `npm run db:reset`.
  const owned = "product_group_id LIKE 'gid://shopify/%'";

  const header = `-- Catálogo completo da loja.
--
-- GERADO por scripts/generate-catalog-migration.ts — não edite à mão.
-- Para atualizar: \`npm run catalog:generate\`, que cria a PRÓXIMA migration.
-- Nunca reescreva uma migration já aplicada; ela não roda de novo, só faz os
-- bancos divergirem.
--
-- Fonte: Shopify Storefront API da loja \`${storeName}\` (a mesma que o app
-- Shopify consulta em runtime). São os produtos REAIS da loja — ids, handles,
-- preços e URLs de imagem de verdade —, então a vitrine fica idêntica à que o
-- Shopify serviria.
--
-- ${productRows.length} produtos, ${variantRows.length} variantes, ${imageRows.length} imagens, ${propRows.length} tags/coleções, ${optionRows.length} opções.

DELETE FROM variant_options WHERE variant_id IN (
  SELECT variant_id FROM variants WHERE ${owned}
);
DELETE FROM variants       WHERE ${owned};
DELETE FROM product_props  WHERE ${owned};
DELETE FROM product_images WHERE ${owned};
DELETE FROM products       WHERE ${owned};

`;

  return (
    header +
    `-- ${productRows.length} produtos\n` +
    emit("products", [
      "product_group_id", "handle", "title", "description", "description_html",
      "vendor", "product_type", "created_at", "currency_code", "position",
    ], productRows) +
    `-- ${imageRows.length} imagens -> isVariantOf.image[]\n` +
    emit("product_images", ["product_group_id", "url", "alt", "position"], imageRows) +
    `-- ${propRows.length} tags/coleções -> isVariantOf.additionalProperty[]\n` +
    emit("product_props",
      ["product_group_id", "name", "value", "value_reference", "position"], propRows) +
    `-- ${variantRows.length} variantes -> hasVariant[] + offers\n` +
    emit("variants", [
      "variant_id", "product_group_id", "title", "barcode", "price",
      "compare_at_price", "available", "quantity", "image_url", "image_alt", "position",
    ], variantRows) +
    `-- ${optionRows.length} opções -> additionalProperty[] da variante\n` +
    emit("variant_options", ["variant_id", "name", "value", "position"], optionRows)
  );
};

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

const nextMigrationPath = (): string => {
  const numbers = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => Number.parseInt(name.slice(0, 4), 10))
    .filter((n) => !Number.isNaN(n));

  const next = String(Math.max(0, ...numbers) + 1).padStart(4, "0");
  return join(MIGRATIONS_DIR, `${next}_seed_full_catalog.sql`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const outFlag = args.indexOf("--out");
  const outPath = outFlag !== -1 ? args[outFlag + 1] : nextMigrationPath();

  const { endpoint, token, storeName } = readShopifyConfig();
  console.log(`Lendo catálogo de ${storeName}.myshopify.com…`);

  const products = await fetchCatalog(createClient(endpoint, token));
  const sql = buildSql(products, storeName);

  const variants = products.reduce((sum, p) => sum + p.variants.nodes.length, 0);
  console.log(`\n${products.length} produtos, ${variants} variantes`);

  if (dryRun) {
    console.log(`--dry-run: nada escrito (seriam ${(sql.length / 1024).toFixed(0)} KB)`);
    return;
  }

  writeFileSync(outPath, sql, "utf-8");
  console.log(`→ ${outPath} (${(sql.length / 1024).toFixed(0)} KB)`);
  console.log("\nAplicar com: npm run db:migrate");
};

main().catch((error) => {
  console.error(`\nFalhou: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
