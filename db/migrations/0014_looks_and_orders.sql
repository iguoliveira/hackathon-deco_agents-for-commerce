-- Migration 0014 — o look que o agente compõe em volta de uma peça, e a compra
-- que dá credibilidade à composição.
--
-- 0012 e 0013 estão ocupadas por `shelves` e `shelf_complements`. Documentos
-- antigos em docs/ numeram estas mesmas tabelas como 0012/0013/0014 — estão
-- superados; ver docs/agente-de-combinacoes.md §5.

-- ---------------------------------------------------------------------------
-- `looks` — cache do agente de composição
-- ---------------------------------------------------------------------------
--
-- Diferença essencial para `shelves`: aquela é UMA vitrine por comprador,
-- ancorada num desejo. Esta é um look por (peça aberta × quem está olhando) —
-- a mesma camisa preta compõe uma roupa diferente para quem favoritou moletons
-- em Porto Alegre e para quem comprou vestido em Recife.
--
-- É por isso que a chave é composta, e é isso que prova personalização no
-- pitch: não é o número de produtos que muda, é a composição e o motivo.
CREATE TABLE IF NOT EXISTS looks (
  -- A peça aberta. `product_group_id` e não handle: handle é apresentação e
  -- pode ser reescrito numa migration de catálogo sem que nada avise.
  anchor_id     TEXT NOT NULL,

  -- Hash de (sementes ∪ local ∪ mês). Opaco de propósito — quem o calcula é
  -- look.d1.ts, e o formato pode mudar sem migration porque uma chave que não
  -- casa mais é simplesmente um cache miss, que é o caminho seguro.
  --
  -- O mês entra porque o agente raciocina sobre clima a partir de cidade + mês
  -- (o código não sabe o que é inverno — ver o doc §4). Um look de agosto em
  -- Porto Alegre não serve em dezembro, e sem o mês na chave ele serviria.
  contexto_hash TEXT NOT NULL,

  -- O que o agente escreveu.
  titulo        TEXT NOT NULL,
  -- 0 quando o look veio do SQL: não há julgamento do modelo para medir.
  confianca     REAL NOT NULL DEFAULT 0,

  -- As peças, em ordem:
  --   [{ "handle": "...", "motivo": "...", "ocasiao": "...", "position": 0 }]
  --
  -- JSON em TEXT pelo mesmo critério de `shelves.items`: é lido sempre inteiro
  -- e nunca filtrado em SQL. Normalizar custaria tabela e JOIN para não
  -- responder pergunta nova.
  --
  -- `ocasiao` é TEXTO LIVRE, escrito pelo modelo a partir DESTE catálogo. Não
  -- é enumerado aqui nem no TypeScript, e essa é a regra que mantém o sistema
  -- genérico: um CHECK com 'inverno'/'verao' travaria a loja em moda para
  -- sempre. Ver docs/personal-shopping-agent-mudancas.md §1.
  pecas         TEXT NOT NULL,

  -- 'agente' | 'sql'. Responde "por que este look está sem texto?" sem reabrir
  -- log, e é a métrica honesta de quanto o modelo esteve disponível.
  origem        TEXT NOT NULL,
  -- Preenchido quando origem = 'sql': a razão exata da queda.
  motivo_do_fallback TEXT,

  -- ISO 8601 (UTC) em TEXT, mesma razão de stock_alerts.created_at: um
  -- timestamptz voltaria do driver como Date e o tipo passaria a mentir.
  generated_at  TEXT NOT NULL
                DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),

  PRIMARY KEY (anchor_id, contexto_hash)
);

-- Sem FOREIGN KEY para products, e aqui a razão é diferente da de stock_alerts.
-- Lá é histórico que o db:reset não pode destruir; aqui é cache, cuja perda é
-- barata. O que as duas compartilham é o problema: as migrations de seed apagam
-- e reinserem o catálogo, e um ON DELETE CASCADE ligado a isso é uma armadilha.
-- Quem descarta linha morta é a leitura, pelo JOIN com variants.
--
-- (Isto é o OPOSTO do que docs/personal-shopping-agent-proposta.md §4 decide
-- para `product_affinity`, e os dois estão certos: aquela tabela era derivada
-- do catálogo e devia cair junto. Esta não é.)

-- O pré-aquecimento do roteiro da demo varre por idade, e o refresh futuro
-- também: pega os mais velhos primeiro e para quando o orçamento acaba.
CREATE INDEX IF NOT EXISTS idx_looks_generated_at ON looks (generated_at ASC);

-- ---------------------------------------------------------------------------
-- `orders` — a quarta semente
-- ---------------------------------------------------------------------------
--
-- Não existe checkout neste repositório e esta tabela é SEMEADA para as
-- personas da demo. Isso vai dito no slide: fingir pipeline de compra é o tipo
-- de coisa que um jurado de e-commerce reconhece na hora, e a honestidade sobre
-- métrica já é regra do time (docs/tese-admin-agentes.md §11).
--
-- Ela existe porque compra é o sinal que dá credibilidade à composição — "você
-- comprou a calça, faltam as peças de cima" — e sem ela a narrativa perde o
-- melhor exemplo.
CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,
  -- Mesma identidade de stock_alerts: e-mail da sessão ou do formulário.
  email      TEXT NOT NULL,
  -- Só a variante. Tipo, tags e coleção saem por JOIN na leitura — copiá-los
  -- para cá criaria uma segunda verdade que envelhece no próximo seed.
  variant_id TEXT NOT NULL,
  created_at TEXT NOT NULL
             DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

-- Sem FOREIGN KEY para variants: regra da 0005. As migrations de seed apagam e
-- reinserem o catálogo, e um cascade destruiria o histórico de compra a cada
-- db:reset.
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders (email, created_at DESC);
