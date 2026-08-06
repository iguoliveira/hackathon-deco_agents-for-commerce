-- Migration 0008 — dá ao catálogo os eixos que o agente da vitrine precisa.
--
-- O problema não era falta de informação: as descrições têm média de 866
-- caracteres e já dizem público, material, estilo e motivo. O problema é que
-- estavam só em prosa — apenas 3 de 41 produtos tinham `product_type`, e um
-- agente teria de ler 866 caracteres para descobrir que "Retro Code Tee" é uma
-- camiseta.
--
-- Esta migration promove a campo o que a descrição já dizia:
--
--   product_type  o "o quê" (T-Shirt, Hoodie, Backpack, Mug...)
--   TAG           público, estilo, material, motivo, ocasião
--   COLLECTION    corrigida onde estava errada ou ausente
--
-- Por que TAG e não colunas novas: `product_props` já existe, já é lida pelo
-- mapper (vira `additionalProperty`) e por `findWaitedItems` — o agente
-- enxerga as tags sem nenhuma mudança de schema ou de código.
--
-- O vocabulário é pequeno e repetido de propósito. Tag que aparece em um
-- produto só não serve de eixo de similaridade: 'cotton' em 14 produtos vale
-- mais que 14 tags distintas e únicas.
--
-- Idempotente: os DELETE antes de cada INSERT deixam reaplicar sem duplicar.

-- ---------------------------------------------------------------------------
-- product_type
-- ---------------------------------------------------------------------------

UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'deco-tee';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'dev-mode-tee';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'oversize-t-shirt';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'retro-code-tee';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 't-shirt';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'woman-t-shirt';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'kids-t-shirt';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'kids-t-shirt-long-sleeve';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'kids-t-shirt-with-illustration';
UPDATE products SET product_type = 'T-Shirt' WHERE handle = 'kids-long-sleeve-t-shirt-capybara';
UPDATE products SET product_type = 'Hoodie' WHERE handle = 'eco-raglan-hoodie';
UPDATE products SET product_type = 'Sweatshirt' WHERE handle = 'hoodie';
UPDATE products SET product_type = 'Sweatshirt' WHERE handle = 'the-future-of-web-dev-sweatshirt';
UPDATE products SET product_type = 'Sweatshirt' WHERE handle = 'woman-sweatshirt';
UPDATE products SET product_type = 'Sweatshirt' WHERE handle = 'premium-sweatshirt-cotton-heritage';
UPDATE products SET product_type = 'Bomber Jacket' WHERE handle = 'all-over-print-bomber-jacket';
UPDATE products SET product_type = 'Rain Jacket' WHERE handle = 'rain-jacket';
UPDATE products SET product_type = 'Sweatpants' WHERE handle = 'deco-sweatpants';
UPDATE products SET product_type = 'Sneakers' WHERE handle = 'high-top-canvas-shoes';
UPDATE products SET product_type = 'Slides' WHERE handle = 'high-top-canvas-shoes-1';
UPDATE products SET product_type = 'Flip Flops' WHERE handle = 'sublimation-flip-flops';
UPDATE products SET product_type = 'Hat' WHERE handle = 'code-wizard-hat';
UPDATE products SET product_type = 'Cap' WHERE handle = 'dad-hat';
UPDATE products SET product_type = 'Cap' WHERE handle = 'deco-cap';
UPDATE products SET product_type = 'Bucket Hat' WHERE handle = 'organic-bucket-hat';
UPDATE products SET product_type = 'Beanie' WHERE handle = 'winter-hat';
UPDATE products SET product_type = 'Tote Bag' WHERE handle = 'all-over-print-tote-bag';
UPDATE products SET product_type = 'Tote Bag' WHERE handle = 'ctrl-shift-tote-bag';
UPDATE products SET product_type = 'Tote Bag' WHERE handle = 'eco-tote-bag-econscious';
UPDATE products SET product_type = 'Backpack' WHERE handle = 'code-commando-backpack';
UPDATE products SET product_type = 'Backpack' WHERE handle = 'minimalist-backpack';
UPDATE products SET product_type = 'Mug' WHERE handle = 'mug';
UPDATE products SET product_type = 'Water Bottle' WHERE handle = 'bottle';
UPDATE products SET product_type = 'Water Bottle' WHERE handle = 'stainless-steel-water-bottle';
UPDATE products SET product_type = 'Tumbler' WHERE handle = 'insulated-tumbler-with-a-straw';
UPDATE products SET product_type = 'Notebook' WHERE handle = 'notebook';
UPDATE products SET product_type = 'Notebook' WHERE handle = 'the-syntax-scribbler-notebook';
UPDATE products SET product_type = 'Pen' WHERE handle = 'pixel-perfection-pen';
UPDATE products SET product_type = 'Pillow' WHERE handle = 'pillow';
UPDATE products SET product_type = 'Phone Case' WHERE handle = 'snap-case-for-iphone®';
UPDATE products SET product_type = 'Plush Toy' WHERE handle = 'capy-coding-companion';

-- ---------------------------------------------------------------------------
-- Coleções corrigidas
--
-- 'stickers' era herança do Shopify em 4 dos produtos restaurados pela 0007, e
-- aquele item saiu do menu em 20f912a. Calçados e infantil ganham coleção
-- própria: estavam sem nenhuma, invisíveis para qualquer filtro por categoria.
-- ---------------------------------------------------------------------------

DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'mug');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'mug';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'notebook');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'notebook';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'pillow');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'pillow';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'stainless-steel-water-bottle');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'stainless-steel-water-bottle';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'bottle');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'bottle';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'insulated-tumbler-with-a-straw');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'insulated-tumbler-with-a-straw';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'the-syntax-scribbler-notebook');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'the-syntax-scribbler-notebook';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'pixel-perfection-pen');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'pixel-perfection-pen';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'capy-coding-companion');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Accessories', 'accessories', 0 FROM products WHERE handle = 'capy-coding-companion';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'high-top-canvas-shoes');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Shoes', 'shoes', 0 FROM products WHERE handle = 'high-top-canvas-shoes';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'high-top-canvas-shoes-1');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Shoes', 'shoes', 0 FROM products WHERE handle = 'high-top-canvas-shoes-1';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'sublimation-flip-flops');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Shoes', 'shoes', 0 FROM products WHERE handle = 'sublimation-flip-flops';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'kids-t-shirt');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Kids', 'kids', 0 FROM products WHERE handle = 'kids-t-shirt';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'kids-t-shirt-long-sleeve');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Kids', 'kids', 0 FROM products WHERE handle = 'kids-t-shirt-long-sleeve';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'kids-t-shirt-with-illustration');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Kids', 'kids', 0 FROM products WHERE handle = 'kids-t-shirt-with-illustration';
DELETE FROM product_props WHERE name = 'COLLECTION' AND product_group_id = (SELECT product_group_id FROM products WHERE handle = 'kids-long-sleeve-t-shirt-capybara');
INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'COLLECTION', 'Kids', 'kids', 0 FROM products WHERE handle = 'kids-long-sleeve-t-shirt-capybara';

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

-- Limpa as tags derivadas antes de reinserir, para a migration ser reaplicável.
DELETE FROM product_props WHERE name = 'TAG';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('cotton', 2),
    ('deco-logo', 3),
    ('oversized', 4),
    ('everyday', 5)
  ) AS v(tag, pos)
  WHERE handle = 'deco-tee';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('minimalist', 1),
    ('cotton', 2),
    ('code-culture', 3),
    ('everyday', 4)
  ) AS v(tag, pos)
  WHERE handle = 'dev-mode-tee';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('men', 0),
    ('basic', 1),
    ('cotton', 2),
    ('oversized', 3),
    ('everyday', 4)
  ) AS v(tag, pos)
  WHERE handle = 'oversize-t-shirt';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('vintage', 1),
    ('cotton', 2),
    ('code-culture', 3),
    ('everyday', 4)
  ) AS v(tag, pos)
  WHERE handle = 'retro-code-tee';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('women', 0),
    ('basic', 1),
    ('cotton', 2),
    ('everyday', 3)
  ) AS v(tag, pos)
  WHERE handle = 't-shirt';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('women', 0),
    ('basic', 1),
    ('lightweight', 2),
    ('everyday', 3)
  ) AS v(tag, pos)
  WHERE handle = 'woman-t-shirt';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('kids', 0),
    ('basic', 1),
    ('cotton', 2),
    ('everyday', 3)
  ) AS v(tag, pos)
  WHERE handle = 'kids-t-shirt';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('kids', 0),
    ('basic', 1),
    ('cotton', 2),
    ('long-sleeve', 3),
    ('everyday', 4)
  ) AS v(tag, pos)
  WHERE handle = 'kids-t-shirt-long-sleeve';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('kids', 0),
    ('graphic', 1),
    ('cotton', 2),
    ('capybara', 3),
    ('everyday', 4)
  ) AS v(tag, pos)
  WHERE handle = 'kids-t-shirt-with-illustration';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('kids', 0),
    ('graphic', 1),
    ('cotton', 2),
    ('capybara', 3),
    ('long-sleeve', 4),
    ('everyday', 5)
  ) AS v(tag, pos)
  WHERE handle = 'kids-long-sleeve-t-shirt-capybara';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('basic', 1),
    ('cotton', 2),
    ('layering', 3),
    ('winter', 4)
  ) AS v(tag, pos)
  WHERE handle = 'eco-raglan-hoodie';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('men', 0),
    ('basic', 1),
    ('cotton', 2),
    ('layering', 3),
    ('winter', 4)
  ) AS v(tag, pos)
  WHERE handle = 'hoodie';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('cotton', 2),
    ('code-culture', 3),
    ('winter', 4)
  ) AS v(tag, pos)
  WHERE handle = 'the-future-of-web-dev-sweatshirt';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('women', 0),
    ('basic', 1),
    ('cotton', 2),
    ('layering', 3),
    ('winter', 4)
  ) AS v(tag, pos)
  WHERE handle = 'woman-sweatshirt';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('men', 0),
    ('classic', 1),
    ('cotton', 2),
    ('layering', 3),
    ('winter', 4)
  ) AS v(tag, pos)
  WHERE handle = 'premium-sweatshirt-cotton-heritage';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('layering', 2),
    ('winter', 3)
  ) AS v(tag, pos)
  WHERE handle = 'all-over-print-bomber-jacket';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('men', 0),
    ('technical', 1),
    ('waterproof', 2),
    ('layering', 3),
    ('outdoor', 4)
  ) AS v(tag, pos)
  WHERE handle = 'rain-jacket';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('cotton', 2),
    ('deco-logo', 3),
    ('everyday', 4)
  ) AS v(tag, pos)
  WHERE handle = 'deco-sweatpants';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('canvas', 1),
    ('everyday', 2)
  ) AS v(tag, pos)
  WHERE handle = 'high-top-canvas-shoes';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('women', 0),
    ('summer', 1),
    ('everyday', 2)
  ) AS v(tag, pos)
  WHERE handle = 'high-top-canvas-shoes-1';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('summer', 1),
    ('outdoor', 2)
  ) AS v(tag, pos)
  WHERE handle = 'sublimation-flip-flops';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('code-culture', 2),
    ('everyday', 3)
  ) AS v(tag, pos)
  WHERE handle = 'code-wizard-hat';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('basic', 1),
    ('cotton', 2),
    ('everyday', 3)
  ) AS v(tag, pos)
  WHERE handle = 'dad-hat';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('deco-logo', 2),
    ('everyday', 3)
  ) AS v(tag, pos)
  WHERE handle = 'deco-cap';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('organic-cotton', 1),
    ('summer', 2),
    ('outdoor', 3)
  ) AS v(tag, pos)
  WHERE handle = 'organic-bucket-hat';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('basic', 1),
    ('cotton', 2),
    ('winter', 3)
  ) AS v(tag, pos)
  WHERE handle = 'winter-hat';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('cotton', 2),
    ('everyday', 3),
    ('carry', 4)
  ) AS v(tag, pos)
  WHERE handle = 'all-over-print-tote-bag';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('code-culture', 2),
    ('everyday', 3),
    ('carry', 4)
  ) AS v(tag, pos)
  WHERE handle = 'ctrl-shift-tote-bag';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('organic-cotton', 1),
    ('everyday', 2),
    ('carry', 3)
  ) AS v(tag, pos)
  WHERE handle = 'eco-tote-bag-econscious';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('graphic', 1),
    ('code-culture', 2),
    ('travel', 3),
    ('carry', 4)
  ) AS v(tag, pos)
  WHERE handle = 'code-commando-backpack';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('unisex', 0),
    ('minimalist', 1),
    ('travel', 2),
    ('carry', 3)
  ) AS v(tag, pos)
  WHERE handle = 'minimalist-backpack';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('metal', 0),
    ('desk', 1),
    ('coffee', 2)
  ) AS v(tag, pos)
  WHERE handle = 'mug';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('metal', 0),
    ('outdoor', 1),
    ('desk', 2)
  ) AS v(tag, pos)
  WHERE handle = 'bottle';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('stainless-steel', 0),
    ('outdoor', 1),
    ('desk', 2)
  ) AS v(tag, pos)
  WHERE handle = 'stainless-steel-water-bottle';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('stainless-steel', 0),
    ('desk', 1),
    ('coffee', 2)
  ) AS v(tag, pos)
  WHERE handle = 'insulated-tumbler-with-a-straw';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('desk', 0),
    ('stationery', 1)
  ) AS v(tag, pos)
  WHERE handle = 'notebook';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('graphic', 0),
    ('code-culture', 1),
    ('desk', 2),
    ('stationery', 3)
  ) AS v(tag, pos)
  WHERE handle = 'the-syntax-scribbler-notebook';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('minimalist', 0),
    ('code-culture', 1),
    ('desk', 2),
    ('stationery', 3)
  ) AS v(tag, pos)
  WHERE handle = 'pixel-perfection-pen';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('cotton', 0),
    ('home', 1)
  ) AS v(tag, pos)
  WHERE handle = 'pillow';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('minimalist', 0),
    ('carry', 1),
    ('everyday', 2)
  ) AS v(tag, pos)
  WHERE handle = 'snap-case-for-iphone®';

INSERT INTO product_props (product_group_id, name, value, value_reference, position)
  SELECT product_group_id, 'TAG', v.tag, NULL, v.pos
  FROM products, (VALUES
    ('graphic', 0),
    ('capybara', 1),
    ('desk', 2),
    ('home', 3)
  ) AS v(tag, pos)
  WHERE handle = 'capy-coding-companion';

