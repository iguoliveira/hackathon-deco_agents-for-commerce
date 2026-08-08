-- Migration 0012 — a vitrine que o agente monta, persistida.
--
-- Uma linha por comprador, não por desejo: quem esperou por três peças recebe
-- UMA vitrine, ancorada no desejo mais recente, com os outros contribuindo
-- candidatos. Três vitrines empilhadas seriam piores de ler e triplicariam o
-- custo de LLM sem triplicar o valor.
--
-- Por que persistir em vez de gerar no render: o agente leva ~33s (Decopilot),
-- e às vezes muito mais — o runner entra em `waiting-capacity` e trava até o
-- timeout. Nada disso pode acontecer dentro de uma request que alguém esteja
-- esperando. A vitrine é gerada no clique em "avise-me" e reescrita pelo cron.
CREATE TABLE IF NOT EXISTS shelves (
  -- O comprador. É a chave: uma vitrine por pessoa, substituída a cada
  -- geração, e não um histórico — ninguém consome vitrine antiga.
  email          TEXT PRIMARY KEY,

  -- O que o agente escreveu.
  title          TEXT NOT NULL,
  -- 0 quando a vitrine veio do SQL: não há julgamento do modelo para medir.
  confidence     REAL NOT NULL DEFAULT 0,

  -- Os itens, em ordem: [{ "handle": "...", "motivo": "..." }].
  --
  -- JSON em TEXT, e não tabela filha, porque isto é lido sempre inteiro e
  -- nunca filtrado em SQL — é um blob opaco do ponto de vista do banco.
  -- Normalizar custaria um JOIN e uma ordenação por posição para não responder
  -- nenhuma pergunta nova. Mesmo critério do `before`/`after` das propostas
  -- descritas em docs/tese-agente-vendas-ia.md.
  --
  -- Só handles: preço, foto e disponibilidade vêm do catálogo na leitura.
  -- Copiá-los para cá criaria uma segunda verdade que envelhece — e esta
  -- envelheceria rápido, porque a vitrine dura 3 dias e o estoque não.
  items          TEXT NOT NULL,

  -- 'agente' | 'sql'. Responde "por que esta vitrine está sem texto?" sem
  -- reabrir log, e é a métrica honesta de quanto o modelo está disponível.
  source         TEXT NOT NULL,
  -- Preenchido quando source = 'sql': a razão exata da queda.
  fallback_reason TEXT,

  -- A variante que ancorou a geração. Guardada para o e-mail poder dizer "o
  -- moletom que você queria" sem recalcular, e para o cron saber se o desejo
  -- que originou a vitrine mudou de estado.
  anchor_variant_id TEXT NOT NULL,

  -- ISO 8601 (UTC), TEXT pelo mesmo motivo de stock_alerts.created_at: um
  -- timestamptz voltaria do driver como Date e o tipo passaria a mentir.
  -- É o que o cron consulta para achar as vitrines vencidas.
  generated_at   TEXT NOT NULL
                 DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

-- O cron pega as mais velhas primeiro, e é isso que o torna auto-recuperável:
-- quem ficou de fora por falta de orçamento hoje é o primeiro amanhã, sem fila
-- nem tabela de controle.
CREATE INDEX IF NOT EXISTS idx_shelves_generated_at ON shelves (generated_at ASC);
