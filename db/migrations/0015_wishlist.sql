-- Wishlist items (um por produto por usuário)
CREATE TABLE IF NOT EXISTS wishlist_items (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,           -- email do Shopify (customerAccessToken subject)
  product_id    TEXT NOT NULL,           -- variant ID (SKU)
  product_group_id TEXT NOT NULL,        -- product group ID (handle pai)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- Índice para listar itens do usuário ordenados por recência
CREATE INDEX IF NOT EXISTS idx_wishlist_user_created
  ON wishlist_items (user_id, created_at DESC);

-- Índice para checar existência rápida
CREATE INDEX IF NOT EXISTS idx_wishlist_user_product
  ON wishlist_items (user_id, product_id);