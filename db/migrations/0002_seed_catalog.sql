-- Migration 0002 — seed do catálogo.
--
-- Por que o seed é uma migration e não um script à parte: o wrangler registra
-- migrations aplicadas em `d1_migrations`, então isto roda UMA vez por banco.
-- É o que deixa o `predev` seguro — `npm run dev` pode chamar `migrations apply`
-- toda vez sem duplicar linha nem sobrescrever alteração feita à mão depois.
--
-- Os DELETEs no topo são escopados ao produto de demo (não é `DELETE FROM
-- products`), então reaplicar num banco onde alguém já cadastrou outros produtos
-- não apaga o trabalho dessa pessoa. Isso importa porque `npm run db:reset`
-- reaplica todas as migrations do zero.
--
-- Um produto, de propósito: o objetivo é provar a ponta a ponta
-- (SQLite -> loader -> bloco CMS -> ProductShelf -> ProductCard) com o menor dado
-- possível. Para adicionar mais produtos, crie uma 0003 seguindo este padrão.
--
-- Os IDs imitam o formato de gid do Shopify porque o front deriva a URL da PDP do
-- sufixo numérico do variant id (`/products/<handle>-<id>`), igual ao transform do
-- Shopify faz. Manter o formato evita um caso especial no mapper.
--
-- As imagens são assets reais já usados em .deco/blocks/pages-home.json, então
-- passam pelo mesmo proxy (decoims.com) que o resto do site.

DELETE FROM variant_options WHERE variant_id IN (
  SELECT variant_id FROM variants WHERE product_group_id = 'gid://shopify/Product/9000000000001'
);
DELETE FROM variants       WHERE product_group_id = 'gid://shopify/Product/9000000000001';
DELETE FROM product_props  WHERE product_group_id = 'gid://shopify/Product/9000000000001';
DELETE FROM product_images WHERE product_group_id = 'gid://shopify/Product/9000000000001';
DELETE FROM products       WHERE product_group_id = 'gid://shopify/Product/9000000000001';

INSERT INTO products (
  product_group_id, handle, title, description, description_html,
  vendor, product_type, created_at, currency_code, position
) VALUES (
  'gid://shopify/Product/9000000000001',
  'deco-tee-sqlite',
  'Deco Tee (SQLite)',
  'Camiseta de algodão pesado com caimento reto. Este produto vem do banco SQLite local, não do Shopify — é o item de teste da migração de fonte de dados.',
  '<p>Camiseta de algodão pesado com caimento reto.</p><p><strong>Fonte: SQLite local (D1).</strong></p>',
  'Deco',
  'Shirts',
  '2026-08-01T12:00:00Z',
  'USD',
  0
);

-- Galeria do pai -> isVariantOf.image[]
INSERT INTO product_images (product_group_id, url, alt, position) VALUES
  ('gid://shopify/Product/9000000000001',
   'https://decoims.com/demo-storefront/2026/07/dcd77bbd-4969-4186-aaaa-d8bc9e4b84c1-chatgpt-image-jul-27-2026-06_54_44-pm.png',
   'Deco Tee vista frontal', 0),
  ('gid://shopify/Product/9000000000001',
   'https://decoims.com/demo-storefront/2026/07/543e04d2-011d-4cc2-8875-46a1a08bef3d-accessories.png',
   'Deco Tee vista alternativa', 1);

-- Tags e coleções -> isVariantOf.additionalProperty[]
INSERT INTO product_props (product_group_id, name, value, value_reference, position) VALUES
  ('gid://shopify/Product/9000000000001', 'TAG', 'novidade', NULL, 0),
  ('gid://shopify/Product/9000000000001', 'TAG', 'algodão', NULL, 1),
  ('gid://shopify/Product/9000000000001', 'COLLECTION', 'Shirts', 'shirts', 2);

-- Três variantes de tamanho: o suficiente para o ProductCard renderizar os
-- swatches (ele só mostra quando há mais de uma variante). A terceira está
-- esgotada de propósito, para exercitar o estado de indisponível no card.
INSERT INTO variants (
  variant_id, product_group_id, title, barcode, price, compare_at_price,
  available, quantity, image_url, image_alt, position
) VALUES
  ('gid://shopify/ProductVariant/9100000000001', 'gid://shopify/Product/9000000000001',
   'Deco Tee (SQLite) - P', '7890000000001', 79.90, 99.90, 1, 12,
   'https://decoims.com/demo-storefront/2026/07/dcd77bbd-4969-4186-aaaa-d8bc9e4b84c1-chatgpt-image-jul-27-2026-06_54_44-pm.png',
   'Deco Tee tamanho P', 0),
  ('gid://shopify/ProductVariant/9100000000002', 'gid://shopify/Product/9000000000001',
   'Deco Tee (SQLite) - M', '7890000000002', 79.90, 99.90, 1, 8,
   'https://decoims.com/demo-storefront/2026/07/dcd77bbd-4969-4186-aaaa-d8bc9e4b84c1-chatgpt-image-jul-27-2026-06_54_44-pm.png',
   'Deco Tee tamanho M', 1),
  ('gid://shopify/ProductVariant/9100000000003', 'gid://shopify/Product/9000000000001',
   'Deco Tee (SQLite) - G', '7890000000003', 79.90, NULL, 0, 0,
   'https://decoims.com/demo-storefront/2026/07/543e04d2-011d-4cc2-8875-46a1a08bef3d-accessories.png',
   'Deco Tee tamanho G', 2);

INSERT INTO variant_options (variant_id, name, value, position) VALUES
  ('gid://shopify/ProductVariant/9100000000001', 'Size', 'P', 0),
  ('gid://shopify/ProductVariant/9100000000002', 'Size', 'M', 0),
  ('gid://shopify/ProductVariant/9100000000003', 'Size', 'G', 0);
