-- Migration 0005 — sinal de desejo: o que o comprador quis e não pôde levar.
--
-- Uma linha por (email, variante) que alguém pediu "avise-me quando voltar".
-- Apesar do nome herdado do botão, o consumidor desta tabela não é um envio de
-- e-mail: é o agente que monta uma shelf com produtos DISPONÍVEIS parecidos com
-- o que a pessoa esperou. A tabela é a entrada desse agente.
--
-- Guardamos só `variant_id` porque ele já identifica item + tamanho + cor: as
-- características ("tamanho, tipo e etc") saem por JOIN em variant_options,
-- products e product_props na hora da leitura. Denormalizar aqui criaria uma
-- segunda verdade que envelhece sozinha quando o catálogo muda.
--
-- Sem FOREIGN KEY para `variants` de propósito. As migrations de seed apagam e
-- reinserem as linhas do catálogo (ver 0003/0004), e um ON DELETE CASCADE
-- destruiria o histórico de demanda justamente no `db:reset`. O sinal de que
-- alguém queria um produto continua valendo mesmo que aquela variante saia do
-- catálogo — e é a leitura, não o banco, que decide o que ainda faz sentido
-- mostrar.
CREATE TABLE IF NOT EXISTS stock_alerts (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Referencia variants(variant_id) semanticamente, sem constraint (ver acima).
  variant_id TEXT NOT NULL,
  -- Identidade do comprador. O login do site ainda passa pelo Shopify, então o
  -- e-mail do formulário é a única chave que funciona também deslogado — que é
  -- o caso da maioria de quem clica nesse botão.
  email      TEXT NOT NULL,
  name       TEXT,
  -- ISO 8601 (UTC). Ordena a shelf: o desejo mais recente pesa mais.
  --
  -- TEXT e não `timestamptz` de propósito. `WaitedItem.waitedAt` é `string`, e
  -- um timestamptz voltaria do driver como `Date` — o tipo passaria a mentir e
  -- todo consumidor precisaria converter. Como o formato é ISO 8601 com Z, o
  -- ORDER BY lexicográfico do índice abaixo já ordena cronologicamente.
  created_at TEXT NOT NULL
             DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

-- Clicar duas vezes no mesmo tamanho é o mesmo desejo, não dois. O UNIQUE deixa
-- o INSERT ser idempotente via ON CONFLICT, em vez de exigir um SELECT antes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_alerts_email_variant
  ON stock_alerts(email, variant_id);

-- A leitura do agente é sempre "o que este comprador esperou", mais recente primeiro.
CREATE INDEX IF NOT EXISTS idx_stock_alerts_email
  ON stock_alerts(email, created_at DESC);
