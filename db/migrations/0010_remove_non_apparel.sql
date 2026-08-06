-- Migration 0010 — tira do catálogo o que não é roupa nem acessório.
--
-- Reverte a maior parte da 0007. Aquela migration trouxe de volta 10 itens de
-- lifestyle argumentando que dariam a dimensão "combina com" que faltava. O
-- argumento não se sustentou por dois motivos:
--
--   1. Esta é uma loja de roupa. "Você queria um moletom, leve uma caneca" é
--      uma recomendação estranha, não um complemento.
--
--   2. Os dados desmentiram o argumento. Com as tags da 0008 no lugar,
--      `findSimilarAvailable` para o Eco Raglan Hoodie devolveu Hoodie,
--      Women's Sweatshirt, Winter Hat, Bomber Jacket, Dad Hat e Dev Mode Tee —
--      nenhum item de lifestyle entrou no top 8. Eles ocupavam espaço no
--      catálogo sem nunca serem recomendados.
--
-- O que fica de "não-vestuário": bolsas, chapéus e a capa de celular. Todos
-- são acessórios de uso pessoal, vendidos na seção de acessórios de qualquer
-- loja de roupa — diferente de caneca, caderno e almofada.
--
-- Nota sobre stock_alerts: não há FOREIGN KEY (ver 0005), então um desejo
-- registrado para uma destas variantes não é apagado aqui — vira linha órfã,
-- que o INNER JOIN de `findWaitedItems` esconde. É o comportamento desenhado:
-- o histórico de demanda sobrevive a mudanças de catálogo.
--
-- As tabelas filhas têm ON DELETE CASCADE (ver 0001), então apagar o produto
-- leva imagens, props, variantes e opções junto.

DELETE FROM products
WHERE handle IN (
  -- Papelaria
  'the-syntax-scribbler-notebook',   -- The Syntax Scribbler Notebook
  'pixel-perfection-pen',            -- Pixel Perfection Pen
  'notebook',                        -- Notebook
  -- Bebidas
  'mug',                             -- Mug
  'bottle',                          -- Bottle
  'stainless-steel-water-bottle',    -- Stainless Steel Water Bottle
  'insulated-tumbler-with-a-straw',  -- Insulated Tumbler with a Straw
  -- Casa e brinquedo
  'pillow',                          -- Pillow
  'capy-coding-companion'            -- Capy Coding Companion (pelúcia)
);
