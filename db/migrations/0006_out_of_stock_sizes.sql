-- Migration 0006 — esgota tamanhos específicos, para o sinal de desejo existir.
--
-- Sem isto a feature não tem como ser exercitada: no catálogo importado, as
-- únicas variantes com `available = 0` são de produtos de variante única
-- ("Default Title"), enquanto TODO produto com Size/Color está 100% em estoque.
-- Ou seja, ninguém consegue clicar em "avise-me quando voltar" para um tamanho
-- — e é exatamente o par (item, tamanho) que o agente da shelf consome.
--
-- Os alvos foram escolhidos para deixar substituto disponível nos dois eixos
-- que o agente pode usar:
--   1. o MESMO produto em outro tamanho (S/L/XL continuam em estoque);
--   2. OUTRO produto da mesma coleção (hoodies-sweatshirts / shirts têm irmãos).
-- Esgotar um produto inteiro não serviria: não sobraria nada para recomendar.
--
-- O UPDATE é declarativo (por handle + valor da opção) em vez de listar
-- variant_id: assim continua legível e sobrevive a um reseed que reordene as
-- variantes. É idempotente, e roda depois dos seeds (0003/0004), então
-- `db:reset` reaplica na ordem certa.
--
-- `quantity = 0` acompanha `available = 0` para as duas colunas não divergirem —
-- o mapper lê `available`, mas um estoque "esgotado com 100 unidades" é uma
-- armadilha para a próxima pessoa que consultar o banco.

-- Eco Raglan Hoodie: tamanho M esgotado nas 3 cores (S, L, XL seguem disponíveis).
UPDATE variants
SET available = 0, quantity = 0
WHERE variant_id IN (
  SELECT v.variant_id
  FROM variants v
  JOIN products p ON p.product_group_id = v.product_group_id
  JOIN variant_options vo ON vo.variant_id = v.variant_id
  WHERE p.handle = 'eco-raglan-hoodie'
    AND vo.name = 'Size'
    AND vo.value = 'M'
);

-- Retro Code Tee: tamanho L esgotado (XS, S, M, XL seguem disponíveis).
UPDATE variants
SET available = 0, quantity = 0
WHERE variant_id IN (
  SELECT v.variant_id
  FROM variants v
  JOIN products p ON p.product_group_id = v.product_group_id
  JOIN variant_options vo ON vo.variant_id = v.variant_id
  WHERE p.handle = 'retro-code-tee'
    AND vo.name = 'Size'
    AND vo.value = 'L'
);
