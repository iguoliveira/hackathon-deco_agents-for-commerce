-- Migration 0018 — a cor sai do título e vira atributo
--
-- A cor estava codificada no fim do título ("Heavyweight Boxy Tee - Black"),
-- e isso é duas coisas erradas ao mesmo tempo: apresentação carregando dado, e
-- dado só recuperável por parsing de string. O título é o que a loja mostra na
-- vitrine e na PDP, e "- Black" não deveria estar lá.
--
-- Depois desta migration:
--
--   title = 'Heavyweight Boxy Tee'
--   color = 'Black'
--
-- Nada se perde: a coluna guarda exatamente o que saiu do título, então a
-- operação é reversível com um UPDATE de concatenação.
--
-- ---------------------------------------------------------------------------
-- Numeração
-- ---------------------------------------------------------------------------
--
-- 0018 e não 0015, que é o próximo número livre olhando só o repositório. O
-- banco compartilhado tem `0015_fix_duplicate_images`, `0015_wishlist` (duas
-- com o mesmo número), `0016_sync_variant_images` e `0017_orders_with_items`
-- aplicadas — nenhuma delas versionada em branch alguma. 0018 é o próximo
-- livre de fato.
--
-- ---------------------------------------------------------------------------
-- O que foi conferido antes de escrever
-- ---------------------------------------------------------------------------
--
--   135 produtos no total
--   104 com ' - ' no título  -> ganham `color`
--    31 sem                  -> ficam com `color` NULL, e isso é correto:
--                               ausência de cor conhecida é diferente de cor
--                               vazia, e o agente precisa saber a diferença
--     0 com mais de um ' - ' -> nenhum caso ambíguo de parsing
--
-- O separador é ' - ' COM espaços dos dois lados, e isso não é detalhe: há
-- produtos chamados "T-shirt" e "Off White" cujo hífen não separa cor nenhuma.
-- Um `split` por '-' cru quebraria os dois.

-- ---------------------------------------------------------------------------
-- 1. A coluna
-- ---------------------------------------------------------------------------
--
-- Sem NOT NULL e sem default: NULL significa "não sabemos a cor desta peça", e
-- é um estado legítimo em 31 dos 135 produtos. Um default '' transformaria
-- desconhecido em vazio e apagaria a distinção.
--
-- TEXT livre, sem CHECK e sem enum. Um CHECK com a lista de cores travaria o
-- catálogo em moda e é exatamente o que a §1 de
-- personal-shopping-agent-mudancas.md proíbe — a mesma razão de não existir
-- tabela de estação. O vocabulário de cor é dado, não esquema.
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;

-- ---------------------------------------------------------------------------
-- 2. Extrair — ANTES de truncar o título
-- ---------------------------------------------------------------------------
--
-- A ordem entre este passo e o próximo é a coisa mais importante do arquivo:
-- invertida, o título já teria perdido a cor e a coluna ficaria toda NULL, sem
-- erro nenhum e sem volta.
--
-- `color IS NULL` no WHERE torna a reexecução segura: se esta migration rodar
-- de novo depois de um seed novo, ela só preenche o que ainda não tem cor, e
-- não sobrescreve o que alguém tenha corrigido à mão.
UPDATE products
   SET color = trim(split_part(title, ' - ', 2))
 WHERE title LIKE '%- %'
   AND color IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Limpar o título
-- ---------------------------------------------------------------------------
--
-- Só mexe em linhas que já têm `color` preenchida — o que garante que nenhum
-- título perde o sufixo sem que ele tenha sido guardado antes.
UPDATE products
   SET title = trim(split_part(title, ' - ', 1))
 WHERE title LIKE '%- %'
   AND color IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Índice
-- ---------------------------------------------------------------------------
--
-- Parcial, ignorando NULL: 31 dos 135 produtos não têm cor, e eles nunca são
-- alvo de busca por cor. Um índice cheio guardaria essas linhas à toa.
CREATE INDEX IF NOT EXISTS idx_products_color ON products (color) WHERE color IS NOT NULL;

-- ---------------------------------------------------------------------------
-- O que esta migration NÃO faz
-- ---------------------------------------------------------------------------
--
-- Não toca em `variant_options`, que tem 230 linhas com name='Color' cobrindo
-- 21 produtos. Aquilo modela cor POR VARIANTE (a mesma peça em duas cores);
-- esta coluna modela cor POR PRODUTO, que é como este catálogo de fato está
-- montado — cada cor é um produto separado, com handle próprio.
--
-- As duas podem coexistir sem conflito enquanto ninguém tentar derivar uma da
-- outra. Unificá-las é decisão de modelagem de catálogo e não cabe a uma
-- migration de agente.
