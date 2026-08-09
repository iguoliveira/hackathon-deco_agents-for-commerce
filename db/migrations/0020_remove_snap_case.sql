-- Migration 0020 — tira a capa de iPhone do catálogo, e registra a decisão que
-- só existia como um DELETE feito à mão em produção.
--
-- ---------------------------------------------------------------------------
-- POR QUE ESTA MIGRATION EXISTE
-- ---------------------------------------------------------------------------
--
-- Ela não conserta um bug das migrations. Ela **encerra uma contradição** entre
-- o que elas dizem e o que o banco de produção é.
--
-- O replay de `npx tsx scripts/db-audit.ts --replay` — que roda as 20 migrations
-- num schema limpo e compara com produção — devolveu isto:
--
--   products         replay=136   produção=135
--     falta em produção: snap-case-for-iphone®  (Snap Case for iPhone®)
--   variants         replay=701   produção=700
--   product_images   replay=231   produção=228
--   product_props    replay=833   produção=829
--   variant_options  replay=893   produção=892
--
-- As quatro últimas são as linhas dessa mesma peça. **Era a única divergência
-- de dado entre um banco criado do zero e o que temos** — o schema batia inteiro.
--
-- A cadeia de migrations decide pela capa quatro vezes, e o líquido é MANTÊ-LA:
--
--   0004_apparel_only            "capinha de iPhone SAI"          apaga
--   0007_restore_lifestyle       traz de volta                    insere
--   0008_enrich_catalog          product_type = 'Phone Case'      enriquece
--   0010_remove_non_apparel      "o que fica de não-vestuário:
--                                 bolsas, chapéus e a capa de
--                                 celular"                        mantém
--
-- Em algum momento depois da 0010 alguém apagou a capa direto no banco, sem
-- migration, sem commit e sem nota em doc nenhum. Produção seguiu com 135
-- produtos e o repositório continuou descrevendo 136.
--
-- **A decisão foi confirmada: produção está certa.** Esta migration escreve isso
-- onde deveria ter sido escrito, e o comentário da 0010 fica superado neste
-- ponto — não o edite lá, porque uma migration aplicada não deve mudar de texto;
-- é aqui que a versão vigente mora.
--
-- ---------------------------------------------------------------------------
-- O EFEITO EM CADA AMBIENTE
-- ---------------------------------------------------------------------------
--
--   produção      no-op. As linhas já não existem; os DELETEs não casam nada.
--   banco novo    remove a capa que a 0007 tinha reinserido.
--
-- Ou seja: ela não muda o banco de hoje, ela faz o de amanhã nascer igual a ele.
--
-- A ordem é filha → pai, como na 0004 e na 0010: não há FOREIGN KEY entre as
-- tabelas do catálogo (regra da 0005 — as migrations de seed apagam e reinserem,
-- e um CASCADE ligado a isso seria armadilha), então nada limpa as dependentes
-- sozinho.
--
-- Escopado por `product_group_id` literal, nunca por `product_type = 'Phone
-- Case'`: um DELETE por tipo apagaria qualquer capa que entre no catálogo depois,
-- e o que se decidiu foi sobre ESTA peça.

-- gid://shopify/Product/8028449734833 — Snap Case for iPhone®
DELETE FROM variant_options
 WHERE variant_id IN (
   SELECT variant_id FROM variants
    WHERE product_group_id = 'gid://shopify/Product/8028449734833'
 );

DELETE FROM variants       WHERE product_group_id = 'gid://shopify/Product/8028449734833';
DELETE FROM product_props  WHERE product_group_id = 'gid://shopify/Product/8028449734833';
DELETE FROM product_images WHERE product_group_id = 'gid://shopify/Product/8028449734833';
DELETE FROM products       WHERE product_group_id = 'gid://shopify/Product/8028449734833';

-- Nota sobre stock_alerts, orders e wishlist_items: não há FOREIGN KEY para
-- variants (0005, 0014, 0017), então um "avise-me" ou um pedido dessa variante
-- sobreviveria a este DELETE como linha órfã. É o comportamento desejado — o
-- histórico não some porque o catálogo mudou —, e quem descarta linha morta é o
-- INNER JOIN da leitura (`comprasDe`, `findWaitedItems`).
--
-- Conferido no banco antes de escrever: nenhuma das três referencia esta
-- variante, então aqui não há nem órfã a criar.
