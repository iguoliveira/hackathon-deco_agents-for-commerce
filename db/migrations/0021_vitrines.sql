-- Migration 0021 — a vitrine que o agente recomenda para uma pessoa, sem âncora.
--
-- Ver docs/vitrine-sem-ancora.md. A diferença para `looks` é a chave, e ela
-- resume a feature: aquela é por (peça aberta × quem olha); esta é só por
-- **quem olha**. Não há peça aberta — o agente roda por cron, e um job das 3h
-- não tem PDP.

CREATE TABLE IF NOT EXISTS vitrines (
  -- O hash dos sinais da pessoa, SEM IDENTIDADE. Mesma chave de `personas`, e
  -- isso é de propósito: as duas se invalidam juntas. Quando um sinal muda, o
  -- hash muda, e nunca existe vitrine composta a partir de um retrato velho.
  --
  -- Opaco: quem o calcula é `look.hash.ts`, e o formato pode mudar sem migration
  -- porque chave que não casa mais é cache miss, que é o caminho seguro.
  sinais_hash  TEXT PRIMARY KEY,

  titulo       TEXT NOT NULL,
  confianca    REAL NOT NULL DEFAULT 0,

  -- As peças, em ordem: [{ "handle": "...", "motivo": "...", "position": 0 }]
  --
  -- JSON em TEXT pelo mesmo critério de `looks.pecas` e `personas.eixos`: é lido
  -- sempre inteiro e nunca filtrado em SQL.
  --
  -- **Sem `ocasiao`**, ao contrário de `looks.pecas`. A vitrine é lista única:
  -- agrupar por tema fazia sentido quando as peças eram partes de uma roupa, e
  -- aqui não são. Ver o §5 do doc.
  pecas        TEXT NOT NULL,

  -- 'agente' | 'falha'. A leitura ignora tudo que não seja 'agente', que é o que
  -- torna seguro o marcador de quarentena morar nesta mesma tabela — quem
  -- consome nunca vê um terceiro estado.
  origem       TEXT NOT NULL,
  motivo       TEXT,

  -- ISO 8601 (UTC) em TEXT, mesma razão de `looks` e `personas`: um timestamptz
  -- voltaria do driver como Date e o tipo passaria a mentir. Largura fixa também
  -- é o que deixa a quarentena comparar como string.
  generated_at TEXT NOT NULL
               DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

-- A quarentena, de novo, e é a lição da #20 — que custou uma indisponibilidade.
-- Falha que não deixa rastro vira laço: a próxima passada do cron não sabe que a
-- anterior já tentou, e um conjunto de sinais que nunca converge consome uma
-- chamada de 60s a cada execução, para sempre.
--
-- Sem chave reservada a inventar: o marcador ocupa a própria chave dos sinais, e
-- `origem` sozinha o distingue. (O `HASH_DA_FALHA` de `looks` existe porque lá a
-- chave é composta.)

-- Sem FOREIGN KEY para `products`: mesma razão de `looks` e `personas`. As
-- migrations de seed apagam e reinserem o catálogo, e um CASCADE ligado a isso
-- seria armadilha. Quem descarta peça morta é o JOIN da leitura.

-- O cron varre por idade: pega as mais velhas primeiro e para quando o orçamento
-- acaba. Mesmo índice, mesmo motivo que em `looks` e `personas`.
CREATE INDEX IF NOT EXISTS idx_vitrines_generated_at ON vitrines (generated_at ASC);
