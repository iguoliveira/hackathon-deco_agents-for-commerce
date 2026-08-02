-- Migration 0001 — schema do catálogo.
--
-- Aplicada por `wrangler d1 migrations apply CATALOG_DB --local`, que registra o
-- que já rodou numa tabela `d1_migrations`. Não edite esta migration depois de
-- ela ter rodado na máquina de alguém: crie uma 0003 com o ALTER. Reescrever uma
-- migration já aplicada não a reaplica — só faz os bancos divergirem.
--
-- O schema é relacional, mas o formato de saída não é: o front consome o tipo
-- `Product` de @decocms/apps-commerce/types, que é schema.org aninhado. O mapper
-- em src/platform/catalog/catalog.mapper.ts remonta essas tabelas exatamente na
-- forma que `toProduct` do Shopify produz
-- (node_modules/@decocms/apps-shopify/src/utils/transform.ts:162-337), para que
-- nenhuma section/componente saiba que a fonte mudou.
--
-- Mapa tabela -> campo do Product:
--   products         -> isVariantOf (ProductGroup) + brand + description
--   product_images   -> isVariantOf.image[]
--   product_props    -> isVariantOf.additionalProperty[]  (TAG / COLLECTION)
--   variants         -> cada Product de isVariantOf.hasVariant[] + offers
--   variant_options  -> additionalProperty[] da variante (selectedOptions)

-- O "produto pai". Vira `isVariantOf` (ProductGroup) no Product final.
CREATE TABLE IF NOT EXISTS products (
  product_group_id TEXT PRIMARY KEY,
  handle           TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  description_html TEXT,
  vendor           TEXT NOT NULL DEFAULT '',
  product_type     TEXT NOT NULL DEFAULT '',
  -- ISO 8601. Vira `releaseDate`.
  created_at       TEXT,
  -- ISO 4217. Vira `offers.priceCurrency`.
  currency_code    TEXT NOT NULL DEFAULT 'USD',
  -- Ordem na vitrine. É o que um agente de merchandising reordenaria.
  position         INTEGER NOT NULL DEFAULT 0
);

-- Galeria do produto pai -> isVariantOf.image[]
CREATE TABLE IF NOT EXISTS product_images (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_group_id TEXT NOT NULL REFERENCES products(product_group_id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  alt              TEXT NOT NULL DEFAULT '',
  position         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_images_group ON product_images(product_group_id, position);

-- Tags e coleções -> isVariantOf.additionalProperty[]
-- `name` segue a convenção do transform do Shopify: 'TAG' ou 'COLLECTION'.
CREATE TABLE IF NOT EXISTS product_props (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_group_id TEXT NOT NULL REFERENCES products(product_group_id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  value            TEXT NOT NULL,
  -- Para COLLECTION, o handle da coleção (vira `valueReference`).
  value_reference  TEXT,
  position         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_props_group ON product_props(product_group_id, position);

-- Cada variante é, por si só, um Product completo dentro de hasVariant[].
CREATE TABLE IF NOT EXISTS variants (
  variant_id       TEXT PRIMARY KEY,
  product_group_id TEXT NOT NULL REFERENCES products(product_group_id) ON DELETE CASCADE,
  -- Vira `name` do Product da variante (o transform usa sku.title, não o título do pai).
  title            TEXT NOT NULL,
  -- Vira `gtin`.
  barcode          TEXT,
  price            REAL NOT NULL,
  -- Preço "de". NULL = sem desconto; o card usa isso para calcular o % off.
  compare_at_price REAL,
  available        INTEGER NOT NULL DEFAULT 1,
  quantity         INTEGER NOT NULL DEFAULT 0,
  image_url        TEXT,
  image_alt        TEXT NOT NULL DEFAULT '',
  position         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_group ON variants(product_group_id, position);

-- selectedOptions do Shopify (Size=M, Color=Black) -> additionalProperty[] da variante.
-- É daqui que ProductCard tira os swatches (useVariantPossibilities).
CREATE TABLE IF NOT EXISTS variant_options (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id TEXT NOT NULL REFERENCES variants(variant_id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  value      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variant_options_variant ON variant_options(variant_id, position);
