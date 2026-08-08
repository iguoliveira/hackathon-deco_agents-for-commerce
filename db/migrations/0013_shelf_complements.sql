-- Migration 0013 — a segunda vitrine: "combina com".
--
-- A 0012 guardava uma lista só, que misturava substituto e complemento. São
-- duas perguntas diferentes — "no lugar do quê" e "junto com o quê" — e
-- misturá-las produzia uma prateleira onde o boné no meio de quatro camisetas
-- parecia erro de ordenação, não sugestão de look.
--
-- Colunas novas em vez de tabela filha, pelo mesmo motivo da 0012: isto é lido
-- sempre inteiro e nunca filtrado em SQL.
ALTER TABLE shelves ADD COLUMN IF NOT EXISTS title_combina TEXT;

-- Só handles e motivos, como `items`. Preço, foto e disponibilidade continuam
-- vindo do catálogo na leitura.
ALTER TABLE shelves ADD COLUMN IF NOT EXISTS items_combina TEXT;

-- As vitrines geradas antes desta migration ficam com NULL nas duas colunas, e
-- a leitura trata isso como lista vazia: a section de composição simplesmente
-- não aparece para elas até o cron regerar. Preencher com '[]' aqui seria a
-- mesma coisa com mais escrita — e um DEFAULT faria linhas futuras nascerem
-- "vazias de verdade" indistinguíveis de "ainda não geradas".
