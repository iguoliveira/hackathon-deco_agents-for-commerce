-- Migration 0004 — mantém apenas vestuário e acessórios de corpo.
--
-- Remove 27 dos 58 produtos, deixando 31: saem stickers, pelúcias,
-- papelaria e utilidades de casa; ficam roupas, calçados, chapéus e bolsas.
--
-- Por que a lista é explícita e não um filtro por coleção: `product_type` está
-- vazio em 55 dos 58 produtos, e as coleções não separam o que precisamos. 12
-- produtos não têm coleção nenhuma — incluindo as camisetas infantis e os
-- calçados, que FICAM — e "Accessories" contém a capinha de iPhone, que SAI.
-- Um predicado que acertasse todos esses casos seria mais frágil, e bem menos
-- auditável, do que a lista abaixo.
--
-- Três decisões de fronteira, explicitadas para poderem ser contestadas:
--   - bolsas e mochilas FICAM — acessórios de moda, carregados no corpo, e a
--     própria loja as classifica em "Accessories";
--   - calçados FICAM (tênis, slides, chinelos) — vestuário;
--   - capinha de iPhone SAI — está em "Accessories", mas é acessório de
--     aparelho, não de corpo.
--
-- Os DELETEs de filhos são explícitos em vez de confiar no ON DELETE CASCADE:
-- o cascade depende de `PRAGMA foreign_keys`, que varia por conexão. Assim o
-- resultado independe disso. (TEMP TABLE, que deixaria isto mais legível, é
-- bloqueada pelo D1 com SQLITE_AUTH.)
--
-- Esta migration conserta o PASSADO: bancos que já receberam o catálogo
-- completo pela 0003. Para o futuro, a mesma exclusão vive em
-- `scripts/catalog-denylist.ts`, que o gerador aplica ANTES de emitir SQL — logo
-- um `npm run catalog:generate` não traz estes produtos de volta. As duas coisas
-- precisam existir; o porquê do critério está documentado na denylist.
--
-- Produtos removidos (27):
--    7947981127857  Code Deco Sticker
--    7948021399729  Cookie Capy Monster
--    7948021825713  D-Lightful Deco Sticker
--    7948024381617  Deco Delights Sticker Pack
--    7948024742065  Developer Community Sticker
--    7948026118321  Deco.cx Sticker
--    7948026314929  Deco Inside Sticker
--    7948026544305  Deco Rainbow Sticker
--    7948026740913  Developers Developers Developers Sticker
--    7948027297969  Get Site Done Sticker
--    7948027461809  Give Me a br Sticker
--    7948027658417  Div Centering Master Sticker
--    7948027920561  I'd Rather Be Coding Sticker
--    7948028215473  It's Not a Bug, It's a Feature Sticker
--    7948028412081  It Works Sticker
--    7948028706993  CWV Champion Sticker
--    7948029034673  Tech Stack Warrior Sticker
--    7948043649201  The Syntax Scribbler Notebook
--    7948061180081  Pixel Perfection Pen
--    7948063244465  Capy Coding Companion
--    8028449734833  Snap Case for iPhone®
--    8028469428401  Insulated Tumbler with a Straw
--    8028471361713  Stainless Steel Water Bottle
--    8058167787697  Mug
--    8062721458353  Bottle
--    8062743281841  Notebook
--    8062864588977  Pillow

DELETE FROM variant_options WHERE variant_id IN (
  SELECT variant_id FROM variants WHERE product_group_id IN ('gid://shopify/Product/7947981127857', 'gid://shopify/Product/7948021399729', 'gid://shopify/Product/7948021825713', 'gid://shopify/Product/7948024381617', 'gid://shopify/Product/7948024742065', 'gid://shopify/Product/7948026118321', 'gid://shopify/Product/7948026314929', 'gid://shopify/Product/7948026544305', 'gid://shopify/Product/7948026740913', 'gid://shopify/Product/7948027297969', 'gid://shopify/Product/7948027461809', 'gid://shopify/Product/7948027658417', 'gid://shopify/Product/7948027920561', 'gid://shopify/Product/7948028215473', 'gid://shopify/Product/7948028412081', 'gid://shopify/Product/7948028706993', 'gid://shopify/Product/7948029034673', 'gid://shopify/Product/7948043649201', 'gid://shopify/Product/7948061180081', 'gid://shopify/Product/7948063244465', 'gid://shopify/Product/8028449734833', 'gid://shopify/Product/8028469428401', 'gid://shopify/Product/8028471361713', 'gid://shopify/Product/8058167787697', 'gid://shopify/Product/8062721458353', 'gid://shopify/Product/8062743281841', 'gid://shopify/Product/8062864588977')
);

DELETE FROM variants WHERE product_group_id IN ('gid://shopify/Product/7947981127857', 'gid://shopify/Product/7948021399729', 'gid://shopify/Product/7948021825713', 'gid://shopify/Product/7948024381617', 'gid://shopify/Product/7948024742065', 'gid://shopify/Product/7948026118321', 'gid://shopify/Product/7948026314929', 'gid://shopify/Product/7948026544305', 'gid://shopify/Product/7948026740913', 'gid://shopify/Product/7948027297969', 'gid://shopify/Product/7948027461809', 'gid://shopify/Product/7948027658417', 'gid://shopify/Product/7948027920561', 'gid://shopify/Product/7948028215473', 'gid://shopify/Product/7948028412081', 'gid://shopify/Product/7948028706993', 'gid://shopify/Product/7948029034673', 'gid://shopify/Product/7948043649201', 'gid://shopify/Product/7948061180081', 'gid://shopify/Product/7948063244465', 'gid://shopify/Product/8028449734833', 'gid://shopify/Product/8028469428401', 'gid://shopify/Product/8028471361713', 'gid://shopify/Product/8058167787697', 'gid://shopify/Product/8062721458353', 'gid://shopify/Product/8062743281841', 'gid://shopify/Product/8062864588977');

DELETE FROM product_props WHERE product_group_id IN ('gid://shopify/Product/7947981127857', 'gid://shopify/Product/7948021399729', 'gid://shopify/Product/7948021825713', 'gid://shopify/Product/7948024381617', 'gid://shopify/Product/7948024742065', 'gid://shopify/Product/7948026118321', 'gid://shopify/Product/7948026314929', 'gid://shopify/Product/7948026544305', 'gid://shopify/Product/7948026740913', 'gid://shopify/Product/7948027297969', 'gid://shopify/Product/7948027461809', 'gid://shopify/Product/7948027658417', 'gid://shopify/Product/7948027920561', 'gid://shopify/Product/7948028215473', 'gid://shopify/Product/7948028412081', 'gid://shopify/Product/7948028706993', 'gid://shopify/Product/7948029034673', 'gid://shopify/Product/7948043649201', 'gid://shopify/Product/7948061180081', 'gid://shopify/Product/7948063244465', 'gid://shopify/Product/8028449734833', 'gid://shopify/Product/8028469428401', 'gid://shopify/Product/8028471361713', 'gid://shopify/Product/8058167787697', 'gid://shopify/Product/8062721458353', 'gid://shopify/Product/8062743281841', 'gid://shopify/Product/8062864588977');

DELETE FROM product_images WHERE product_group_id IN ('gid://shopify/Product/7947981127857', 'gid://shopify/Product/7948021399729', 'gid://shopify/Product/7948021825713', 'gid://shopify/Product/7948024381617', 'gid://shopify/Product/7948024742065', 'gid://shopify/Product/7948026118321', 'gid://shopify/Product/7948026314929', 'gid://shopify/Product/7948026544305', 'gid://shopify/Product/7948026740913', 'gid://shopify/Product/7948027297969', 'gid://shopify/Product/7948027461809', 'gid://shopify/Product/7948027658417', 'gid://shopify/Product/7948027920561', 'gid://shopify/Product/7948028215473', 'gid://shopify/Product/7948028412081', 'gid://shopify/Product/7948028706993', 'gid://shopify/Product/7948029034673', 'gid://shopify/Product/7948043649201', 'gid://shopify/Product/7948061180081', 'gid://shopify/Product/7948063244465', 'gid://shopify/Product/8028449734833', 'gid://shopify/Product/8028469428401', 'gid://shopify/Product/8028471361713', 'gid://shopify/Product/8058167787697', 'gid://shopify/Product/8062721458353', 'gid://shopify/Product/8062743281841', 'gid://shopify/Product/8062864588977');

DELETE FROM products WHERE product_group_id IN ('gid://shopify/Product/7947981127857', 'gid://shopify/Product/7948021399729', 'gid://shopify/Product/7948021825713', 'gid://shopify/Product/7948024381617', 'gid://shopify/Product/7948024742065', 'gid://shopify/Product/7948026118321', 'gid://shopify/Product/7948026314929', 'gid://shopify/Product/7948026544305', 'gid://shopify/Product/7948026740913', 'gid://shopify/Product/7948027297969', 'gid://shopify/Product/7948027461809', 'gid://shopify/Product/7948027658417', 'gid://shopify/Product/7948027920561', 'gid://shopify/Product/7948028215473', 'gid://shopify/Product/7948028412081', 'gid://shopify/Product/7948028706993', 'gid://shopify/Product/7948029034673', 'gid://shopify/Product/7948043649201', 'gid://shopify/Product/7948061180081', 'gid://shopify/Product/7948063244465', 'gid://shopify/Product/8028449734833', 'gid://shopify/Product/8028469428401', 'gid://shopify/Product/8028471361713', 'gid://shopify/Product/8058167787697', 'gid://shopify/Product/8062721458353', 'gid://shopify/Product/8062743281841', 'gid://shopify/Product/8062864588977');
