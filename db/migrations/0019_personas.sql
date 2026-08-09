-- Migration 0019 — o retrato do guarda-roupa que o modelo sintetiza a partir
-- dos sinais de uma pessoa.
--
-- Substitui a tabela de pesos `FORCA = { purchased: 4, waited: 3, ... }`, que
-- nunca foi medida e respondia a uma pergunta de TRUNCAMENTO (quais sinais cabem
-- nas seis vagas do prompt) e não de recomendação. Ver
-- docs/persona-do-guarda-roupa.md.

-- ---------------------------------------------------------------------------
-- `personas` — cache da síntese
-- ---------------------------------------------------------------------------
--
-- A diferença que justifica a tabela existir separada de `looks`: um look é por
-- (peça aberta × quem olha); uma persona é por PESSOA e serve para todas as PDPs
-- que ela abrir. Hoje as sementes são reprocessadas e reenviadas ao modelo a
-- cada peça; aqui a síntese roda uma vez por conjunto de sinais.
CREATE TABLE IF NOT EXISTS personas (
  -- Hash dos sinais, SEM IDENTIDADE — e isso é decisão, não economia.
  --
  -- Duas pessoas com o mesmo guarda-roupa compartilham a persona, o que é
  -- inócuo (ela é derivada só daqueles sinais: não há nada de uma que a outra já
  -- não tenha) e faz o cache esquentar mais rápido. Quando um sinal muda, o hash
  -- muda e a persona é rederivada — mesma mecânica de `looks.contexto_hash`.
  --
  -- Opaco de propósito: quem o calcula é look.d1.ts, e o formato pode mudar sem
  -- migration porque uma chave que não casa mais é um cache miss, que é o
  -- caminho seguro.
  sinais_hash  TEXT PRIMARY KEY,

  -- Os eixos, em ordem:
  --   [{ "eixo": "cor dominante", "valor": "escuros", "evidencia": ["..."] }]
  --
  -- JSON em TEXT pelo mesmo critério de `looks.pecas` e `shelves.items`: é lido
  -- sempre inteiro e nunca filtrado em SQL.
  --
  -- `eixo` é TEXTO LIVRE, nomeado pelo modelo a partir DESTE catálogo — não é
  -- enumerado aqui nem no TypeScript, mesma regra que manteve `ocasiao` livre.
  -- Um CHECK com 'cor'/'caimento' travaria a loja em moda para sempre; num
  -- catálogo de vinho a mesma coluna recebe 'corpo' e 'acidez'.
  --
  -- `evidencia` são os títulos das peças que sustentam o eixo, e é o que separa
  -- descrição de opinião. Guardá-la junto é o que torna a persona auditável
  -- depois — sem ela, um motivo estranho na tela não teria rastro.
  eixos        TEXT NOT NULL,

  -- Quanto o modelo acredita no retrato. Abaixo do piso não há persona, e o look
  -- compõe sem ela.
  confianca    REAL NOT NULL DEFAULT 0,

  -- 'agente' | 'falha'. A leitura ignora tudo que não seja 'agente', o que é o
  -- que torna seguro gravar o marcador de quarentena NESTA MESMA tabela — um
  -- terceiro estado nunca chega a quem consome.
  origem       TEXT NOT NULL,
  -- Preenchido quando origem = 'falha': a razão exata da queda.
  motivo       TEXT,

  -- ISO 8601 (UTC) em TEXT, mesma razão de `looks.generated_at`: um timestamptz
  -- voltaria do driver como Date e o tipo passaria a mentir. Largura fixa também
  -- é o que deixa a quarentena comparar como string.
  generated_at TEXT NOT NULL
               DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

-- A quarentena é a lição da #20, e ela custou uma indisponibilidade para ser
-- aprendida: falha que não deixa rastro vira laço, porque a visita seguinte não
-- sabe que a anterior já tentou e cada pageview dispara uma chamada nova. Sem
-- esta linha, uma síntese que não converge repete o mesmo laço — e a montante de
-- TODAS as peças, não de uma.
--
-- Aqui o marcador cabe na chave primária normal (o hash de uma lista vazia de
-- sinais é um hash como outro qualquer), então não há chave reservada a
-- inventar: `origem` sozinha faz o trabalho.

-- Sem FOREIGN KEY para products: mesma razão de `looks`. As migrations de seed
-- apagam e reinserem o catálogo, e a evidência aqui é TÍTULO, não id — ela
-- descreve o que foi observado no momento da síntese, e continua sendo o rastro
-- correto mesmo que a peça mude de nome depois.

-- A varredura por idade: o refresh futuro pega as mais velhas primeiro e para
-- quando o orçamento acaba. Mesmo índice, mesmo motivo que em `looks`.
CREATE INDEX IF NOT EXISTS idx_personas_generated_at ON personas (generated_at ASC);
