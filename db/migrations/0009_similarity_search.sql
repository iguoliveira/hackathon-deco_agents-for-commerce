-- Migration 0009 — infraestrutura de similaridade para o agente da vitrine.
--
-- Duas camadas, de propósito, porque resolvem coisas diferentes:
--
--   1. FULL-TEXT (tsvector) — funciona HOJE, sem dependência externa. Cobre o
--      que a estrutura não captura: "waterproof", "capybara", "oversized" e
--      qualquer palavra que só existe na prosa da descrição.
--
--   2. EMBEDDINGS (pgvector) — a coluna e a extensão ficam prontas, mas vazias.
--      Popular exige um provedor externo (a Anthropic não serve embeddings;
--      OpenAI, Voyage ou o gte-small do próprio Supabase servem). Deixar o
--      schema pronto é o que permite ligar isso depois sem nova migration.
--
-- A ordem é essa por um motivo: com product_type, tags e coleção preenchidos
-- em 41/41 dos produtos (ver 0008), a maior parte de "combina com" já sai de
-- SQL comum — e sai EXPLICÁVEL ("mesmo tipo", "3 tags em comum"). Embeddings
-- devolvem um número que ninguém sabe justificar. Vale medir a vitrine com a
-- camada 1 antes de decidir se a 2 é necessária.

-- ---------------------------------------------------------------------------
-- Camada 1 — full-text sobre título + descrição
-- ---------------------------------------------------------------------------

-- 'english' porque o catálogo está em inglês: é o que faz stemming ligar
-- "hoodies" a "hoodie" e descartar stopwords. Um dicionário errado aqui
-- degrada em silêncio — a busca continua funcionando, só pior.
CREATE INDEX IF NOT EXISTS idx_products_fts
  ON products
  USING GIN (to_tsvector('english', title || ' ' || description));

-- ---------------------------------------------------------------------------
-- Camada 2 — embeddings (schema pronto, dados pendentes)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS vector;

-- 1536 dimensões = text-embedding-3-small da OpenAI, o mais barato que serve.
-- Trocar de provedor exige mudar esta dimensão, então a escolha não é neutra.
-- NULL enquanto ninguém popular; as consultas de similaridade tratam isso.
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Índice ivfflat exige dados para treinar as listas e falha em tabela vazia.
-- Fica comentado: crie DEPOIS de popular os embeddings.
--
--   CREATE INDEX idx_products_embedding ON products
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
--
-- Com 41 produtos, aliás, varredura sequencial é mais rápida que índice — só
-- vale criar quando o catálogo crescer uma ordem de grandeza.
