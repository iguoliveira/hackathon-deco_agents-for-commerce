-- Migration 0022 — a vitrine guarda quantos sinais a compuseram.
--
-- A section mostra "Recomendado pelo agente a partir de N sinais seus", e esse N
-- é a única coisa na tela que prova que o histórico da pessoa entrou na decisão.
--
-- Ele estava errado. Quando a chave virou `chaveDoDia(email)`, o caminho de
-- leitura deixou de chamar `colherSementes` — não precisa mais dele para achar a
-- linha — e a contagem passou a sair de `pecas.length`, que é quantos PRODUTOS a
-- vitrine tem. A carla, com 7 sinais, aparecia como "5 sinais seus".
--
-- Recontar na leitura custaria as quatro consultas de `colherSementes` em toda
-- exibição da home, para preencher um rótulo. E seria a contagem de AGORA, não a
-- de quando a vitrine foi composta — que é a que o texto afirma.
--
-- A contagem é fato sobre a geração, então mora junto com ela.

ALTER TABLE vitrines ADD COLUMN IF NOT EXISTS sinais INTEGER NOT NULL DEFAULT 0;

-- `DEFAULT 0` e não NULL: as linhas geradas antes desta migration não sabem o
-- número, e zero é o que a section já trata — `sementes > 0` decide se a linha de
-- procedência aparece. Uma vitrine velha perde a frase em vez de mentir nela, e
-- some sozinha quando o dia virar.
