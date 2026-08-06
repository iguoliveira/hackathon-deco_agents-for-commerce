-- Os desejos registrados, já cruzados com o catálogo.
--
-- É a mesma leitura que `findWaitedItems` (src/platform/alerts/alerts.d1.ts)
-- faz em código — mantida aqui para inspeção manual, porque a query é longa e
-- cheia de `||`, que o PowerShell interpreta como operador quando ela vai
-- inline em `--command`. Rode com `npm run db:alerts`.
--
-- `tipo` e `tags` vêm vazios em boa parte do catálogo importado: nem todo
-- produto trouxe `product_type`/tags do Shopify. Quem for usar isto como eixo
-- de similaridade precisa cair para `colecoes` quando estiver nulo.
SELECT
  a.email,
  a.name                                              AS nome,
  p.title                                             AS produto,
  p.handle,
  p.product_type                                      AS tipo,
  p.vendor                                            AS marca,
  v.price                                             AS preco,
  v.available                                         AS disponivel_agora,
  -- STRING_AGG e não GROUP_CONCAT: aquele era do SQLite. No Postgres o
  -- separador é obrigatório, inclusive nas duas agregações de baixo, onde o
  -- SQLite o deixava implícito.
  (SELECT STRING_AGG(vo.name || '=' || vo.value, ' | ' ORDER BY vo.position)
     FROM variant_options vo
    WHERE vo.variant_id = v.variant_id)               AS opcoes,
  (SELECT STRING_AGG(pp.value_reference, ', ')
     FROM product_props pp
    WHERE pp.product_group_id = p.product_group_id
      AND pp.name = 'COLLECTION')                     AS colecoes,
  (SELECT STRING_AGG(pp.value, ', ')
     FROM product_props pp
    WHERE pp.product_group_id = p.product_group_id
      AND pp.name = 'TAG')                            AS tags,
  a.created_at                                        AS quando
FROM stock_alerts a
-- INNER JOIN: um desejo por variante que saiu do catálogo não tem substituto a
-- oferecer, então some da leitura em vez de virar linha meio preenchida.
JOIN variants v ON v.variant_id = a.variant_id
JOIN products p ON p.product_group_id = v.product_group_id
ORDER BY a.created_at DESC;
