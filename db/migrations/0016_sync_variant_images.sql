-- Migration 0016 — sincroniza a imagem das variantes com a do produto.
--
-- Conserta o que a 0015 deixou passar: 7 variantes em 4 produtos ficaram com a
-- foto antiga, e o efeito era o pior possível — a foto repetida VOLTAVA no card
-- da PLP para quem escolhesse os tamanhos M ou L, enquanto a PDP mostrava a
-- foto nova. Repetição intermitente, dependente do tamanho selecionado.
--
-- POR QUE A 0015 ERROU: ela atualizava `variants` com uma lista de
-- `variant_id`, e essa lista foi extraída por regex da 0011 regerada. O regex
-- perdia uma linha por bloco de INSERT (445 capturadas de 453), e as perdidas
-- eram silenciosas — nenhum erro, só menos linhas no VALUES.
--
-- A lição está no formato desta migration, não num comentário: a chave certa
-- nunca foi `variant_id`. Todas as variantes de um produto usam a MESMA foto
-- (ver `url(foto, 600)` no gerador), então a atualização é por produto, e o
-- valor sai de `product_images` em vez de uma lista literal. Sem lista, não há
-- lista incompleta.
--
-- Idempotente e auto-corretiva: só toca em linha que está divergente, e pode
-- rodar quantas vezes for. Se uma correção futura de imagem esquecer as
-- variantes de novo, reaplicar esta resolve.

UPDATE variants AS v
   SET image_url = regexp_replace(pi.url, 'w=900', 'w=600'),
       image_alt = pi.alt
  FROM product_images AS pi
 WHERE pi.product_group_id = v.product_group_id
   -- position 0 é a foto principal. Produtos vindos do seed antigo têm galeria
   -- com várias imagens, e sem este filtro o JOIN multiplicaria a variante por
   -- cada foto da galeria — 1049 linhas "divergentes" onde só há 7.
   AND pi.position = 0
   -- A largura é a única diferença legítima entre as duas URLs (900 na galeria,
   -- 600 na variante), então a comparação ignora a query string inteira.
   AND regexp_replace(v.image_url, '\?.*$', '') <> regexp_replace(pi.url, '\?.*$', '');
