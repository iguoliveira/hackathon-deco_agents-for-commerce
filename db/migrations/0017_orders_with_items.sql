-- Migration 0017 — o pedido vira pedido: itens, quantidade, preço pago e status.
--
-- A `orders` da 0014 nasceu como tabela de SEMENTE, não de pedido: uma linha
-- por variante comprada, com `id, email, variant_id, created_at` e mais nada.
-- Servia para o agente saber o que a pessoa tem. Não serve para mostrar um
-- pedido na tela, porque não sabe **quanto** foi pago nem **quantos** itens
-- foram numa compra só.
--
-- Sem preço gravado, um pedido antigo passa a mentir assim que o catálogo muda
-- de preço — e neste repositório o catálogo muda: 47 fotos e 9 cores mudaram
-- numa única tarde.
--
-- ---------------------------------------------------------------------------
-- A REGRA QUE DIVIDE O QUE FICA AQUI E O QUE FICA POR JOIN
-- ---------------------------------------------------------------------------
--
--   O que foi TRANSACIONADO vira snapshot.  (preço, quantidade, título)
--   O que DESCREVE o produto vira referência. (tipo, tags, coleção, foto)
--
-- Não é preferência de modelagem, é consequência observada. Se este pedido
-- tivesse copiado `cor: 'Tan'` no momento da compra, o agente hoje escreveria
-- "combina com a bolsa tan que você comprou" enquanto o site mostra uma bolsa
-- preta — a cor mudou na 0015. O comentário da 0014 já avisava: copiar atributo
-- descritivo "criaria uma segunda verdade que envelhece no próximo seed".
--
-- O inverso quebra igual: sem `unit_price` congelado, o recibo não sabe quanto
-- a pessoa pagou. Um pedido que não sabe o valor pago não é um pedido.
--
-- Por isso o agente lê `order_items.variant_id` e faz JOIN com o catálogo vivo
-- (ver `comprasDe` em look.d1.ts), enquanto a tela de pedidos lê só estas duas
-- tabelas e nunca toca em `products`.

-- ---------------------------------------------------------------------------
-- `orders` ganha o que faltava
-- ---------------------------------------------------------------------------

-- 'paid' | 'cancelled'. Não há pagamento de verdade neste storefront e isso vai
-- dito no slide (docs/tese-admin-agentes.md §11 já obriga a honestidade sobre
-- métrica). O campo existe porque uma tela de pedidos sem status não parece uma
-- tela de pedidos, e porque cancelar é o único estado que muda algo para o
-- agente: pedido cancelado não é sinal de posse.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid';

-- Em reais inteiros, como o resto do catálogo (`variants.price` vai de 69 a
-- 899, sem centavos). Guardado somado em vez de calculado na leitura: o total
-- é o que a pessoa pagou, e recalcular a partir dos itens devolveria o preço
-- de hoje.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total INTEGER NOT NULL DEFAULT 0;

-- `variant_id` sai de `orders`: ele descreve um ITEM, não um pedido, e mantê-lo
-- aqui obrigaria uma linha de pedido por variante — que é o que impedia
-- representar uma compra com três peças.
--
-- Seguro porque a tabela está vazia (0 linhas, verificado antes de escrever).
-- Se não estivesse, este passo teria de copiar para `order_items` antes.
ALTER TABLE orders DROP COLUMN IF EXISTS variant_id;

-- ---------------------------------------------------------------------------
-- `order_items` — uma linha por variante comprada
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- A ponte para o catálogo vivo. É por aqui que o agente chega em tipo, tags
  -- e coleção — sempre os de agora.
  --
  -- Sem FOREIGN KEY para `variants`, e a razão é a mesma da 0005 e da 0014: as
  -- migrations de seed apagam e reinserem o catálogo, e um ON DELETE CASCADE
  -- ligado a isso destruiria o histórico de compra a cada `db:reset`. Quem
  -- descarta linha órfã é o INNER JOIN da leitura.
  variant_id TEXT NOT NULL,

  quantity   INTEGER NOT NULL DEFAULT 1,

  -- Congelados no momento da compra. `title_snapshot` guarda o nome COM a cor
  -- ("Leather Belt Bag - Tan") porque é o que a pessoa viu ao comprar, e o
  -- título no catálogo pode mudar depois — de novo, mudou.
  unit_price     INTEGER NOT NULL,
  title_snapshot TEXT NOT NULL,

  -- Uma variante aparece uma vez por pedido; comprar duas do mesmo tamanho é
  -- `quantity = 2`, não duas linhas.
  PRIMARY KEY (order_id, variant_id)
);

-- A tela lista os pedidos de alguém, do mais recente para o mais antigo.
CREATE INDEX IF NOT EXISTS idx_orders_email_recente ON orders (email, created_at DESC);

-- O agente parte da variante para achar quem comprou o quê.
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items (variant_id);
