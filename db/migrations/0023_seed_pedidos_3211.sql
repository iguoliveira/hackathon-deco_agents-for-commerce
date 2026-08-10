-- Migration 0023 — os pedidos de `3211@gmail.com`, a conta que virou o caso de
-- teste da vitrine.
--
-- ---------------------------------------------------------------------------
-- POR QUE ESTA MIGRATION EXISTE
-- ---------------------------------------------------------------------------
--
-- Estas seis compras foram feitas **pela interface**, clicando, em 2026-08-10
-- entre 01:22 e 01:30. Elas existem em produção e em lugar nenhum das
-- migrations — um `npm run db:reset` as apagaria, e com elas o único caso de
-- teste que a gente tinha da vitrine funcionando.
--
-- O motivo é concreto: a `VitrineRecomendada` passa por um portão — sem persona
-- confiável não há vitrine — e persona precisa de sinais. As quatro personas
-- semeadas (`ana.escura`, `bruno.solto`, `carla.tecnica`, `diego.disperso`) têm
-- cinco pedidos cada, mas ninguém consegue **logar** como elas: são e-mails de
-- seed, sem conta de autenticação. `3211@gmail.com` é uma conta real, com
-- senha, que dá para abrir no navegador — e é por isso que ela virou o caminho
-- de conferir a feature na tela.
--
-- Sem esta migration, esse caminho depende de alguém lembrar de comprar seis
-- itens à mão depois de todo reset.
--
-- ---------------------------------------------------------------------------
-- O QUE ELA SEMEIA, E O QUE ISSO SIGNIFICA PARA O AGENTE
-- ---------------------------------------------------------------------------
--
-- Cinco pedidos, seis itens, com tipos deliberadamente variados — camiseta,
-- moletom, bolsa, dois chapéus e uma jaqueta. Não é uma pessoa de nicho: é
-- alguém com guarda-roupa espalhado, que é justamente o caso em que a persona
-- tem trabalho de verdade a fazer.
--
-- Um deles (`Rain Jacket` + `Winter Hat`) é um pedido de DOIS itens. Vale manter
-- assim: desde a `0017` o pedido tem vários itens, e um seed em que todo pedido
-- tem um item só nunca exercitaria o `JOIN` com `order_items`.
--
-- ---------------------------------------------------------------------------
-- AS DECISÕES DE ESCRITA
-- ---------------------------------------------------------------------------
--
-- **Ids e timestamps preservados como estão em produção.** Gerar novos faria a
-- migration divergir do banco que ela documenta, e o `db-audit --replay` — que
-- roda as migrations num schema limpo e compara com produção — passaria a
-- acusar diferença para sempre. Ids literais mantêm as duas versões idênticas.
--
-- **`ON CONFLICT DO NOTHING`**, não `DO UPDATE`. Se a linha já existe, ela é a
-- verdade: pode ter sido cancelada, ou ter mudado de status. Uma migration de
-- seed que sobrescreve estado de produção destrói informação que ela não tem
-- como recuperar.
--
-- **Sem FOREIGN KEY para `variants`**, seguindo a regra da `0005` e da `0014`:
-- as migrations de seed apagam e reinserem o catálogo, e um cascade destruiria
-- histórico de compra a cada `db:reset`. Quem descarta linha morta é a leitura,
-- pelo JOIN — `comprasDe` usa `INNER JOIN` de propósito.
--
-- **Três das seis variantes são `gid://shopify/...` e uma é
-- `gid://catalog/...`.** Não é inconsistência a corrigir: o catálogo tem as duas
-- origens, e a compra registra o que a pessoa comprou. Normalizar aqui inventaria
-- um dado que nunca existiu.

-- ---------------------------------------------------------------------------
-- Os pedidos
-- ---------------------------------------------------------------------------

INSERT INTO orders (id, email, status, total, created_at) VALUES
  ('ord_msmjr4dr_3ii2az', '3211@gmail.com', 'paid', 100, '2026-08-10T01:22:29Z'),
  ('ord_msmk0ytw_q23j85', '3211@gmail.com', 'paid',  44, '2026-08-10T01:30:08Z'),
  ('ord_msmk15q4_2hr93b', '3211@gmail.com', 'paid',  99, '2026-08-10T01:30:17Z'),
  ('ord_msmk1nmd_bxxwxw', '3211@gmail.com', 'paid', 100, '2026-08-10T01:30:41Z'),
  ('ord_msmk1y6l_c43rb5', '3211@gmail.com', 'paid', 129, '2026-08-10T01:30:54Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Os itens
-- ---------------------------------------------------------------------------
--
-- `title_snapshot` é o título congelado no momento da compra, e vai literal: ele
-- registra o que foi transacionado, não o que o catálogo diz hoje. Se o produto
-- for renomeado, o pedido continua contando a verdade da época.

INSERT INTO order_items (order_id, variant_id, quantity, unit_price, title_snapshot) VALUES
  ('ord_msmjr4dr_3ii2az', 'gid://shopify/ProductVariant/44073351545009', 1, 100,
   'The Future of Web Dev Sweatshirt (Default Title)'),
  ('ord_msmk0ytw_q23j85', 'gid://shopify/ProductVariant/44073362063537', 1,  44,
   'Ctrl+Shift+Tote Bag (Default Title)'),
  ('ord_msmk15q4_2hr93b', 'gid://shopify/ProductVariant/44073366290609', 1,  99,
   'Code Wizard Hat (Default Title)'),
  ('ord_msmk1nmd_bxxwxw', 'gid://shopify/ProductVariant/44358659965105', 1,  35,
   'Winter Hat (White)'),
  ('ord_msmk1nmd_bxxwxw', 'gid://shopify/ProductVariant/44377712853169', 1,  65,
   'Rain Jacket (White / XS)'),
  ('ord_msmk1y6l_c43rb5', 'gid://catalog/Variant/900300',                1, 129,
   'Night Shift Graphic Tee (XS)')
ON CONFLICT DO NOTHING;
