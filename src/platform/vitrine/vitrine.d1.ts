/**
 * Único arquivo com SQL da vitrine.
 *
 * Nada aqui lança: quem consome é uma section, e vitrine vazia é resultado
 * aceitável — derrubar a home por causa dela não é.
 */

import { getDb } from "../db";
import type { Candidato, PecaRecomendada, Vitrine } from "./vitrine.types";

interface ProdutoRow {
  handle: string;
  title: string;
  product_type: string | null;
  preco: number | null;
  tags: string[] | null;
  opcoes: string[] | null;
}

/**
 * O catálogo inteiro que dá para comprar hoje. **Sem âncora, sem filtro.**
 *
 * É a diferença estrutural entre este domínio e o `look`. Lá o pool sai de
 * `findComplementsAvailable(variantId)` — peças relacionadas à que está aberta —
 * e `look.candidates.ts:4` chama isso de "a decisão que define esta feature",
 * argumentando que um agente com a loja inteira produziria algo "plausível e
 * genérico".
 *
 * Aquele argumento valia **para compor uma roupa**. Para recomendar produtos ele
 * se inverte: filtrar o catálogo antes do modelo é o código decidindo o que a
 * pessoa pode ver, com um critério mais pobre que o do agente — a mesma classe
 * de decisão que a #26 tirou daqui quando matou a tabela de pesos.
 *
 * **E a medição autoriza.** São 127 produtos disponíveis; sem `description` o
 * catálogo inteiro custa ~4.7k tokens contra ~1.5k dos 18 candidatos de hoje.
 * Cabe, e roda em background, sem ninguém esperando.
 *
 * Quando não couber mais, a saída **não** é filtrar por regra: é entregar o
 * catálogo em duas etapas (o modelo pede o que quer ver) ou paginar por tipo.
 * Fica escrito para não ser reinventado sob pressão. Ver
 * docs/vitrine-sem-ancora.md §3.
 *
 * `MIN(v.price)`: um produto tem várias variantes e o preço que interessa ao
 * modelo é o de entrada. `available = 1` no JOIN, e não no WHERE, para que um
 * produto sem nenhuma variante disponível simplesmente não apareça — ele não é
 * recomendável hoje.
 *
 * **A exclusão do que a pessoa já comprou acontece AQUI, no SQL, e não em cima
 * do resultado.** As sementes identificam a peça por `product_group_id`; o
 * `Candidato` só carrega `handle`, porque id nenhum pode vazar para o prompt
 * (um id ali é convite para o modelo devolver um). Filtrar depois exigiria uma
 * das duas coisas erradas: pôr o id no tipo, ou casar handle com gid — que não
 * casa, e falharia em silêncio deixando peças compradas na vitrine.
 *
 * O banco é o único lugar onde as duas identidades convivem sem que nenhuma
 * precise sair dele.
 */
export const catalogoDisponivel = async (
  jaComprados: readonly string[] = [],
): Promise<Candidato[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT p.handle, p.title, p.product_type,
                MIN(v.price)::int AS preco,
                COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                           WHERE pp.product_group_id = p.product_group_id
                             AND pp.name = 'TAG'), '{}') AS tags,
                COALESCE(ARRAY_AGG(DISTINCT vo.name || ': ' || vo.value)
                           FILTER (WHERE vo.value IS NOT NULL), '{}') AS opcoes
           FROM products p
           JOIN variants v
             ON v.product_group_id = p.product_group_id AND v.available = 1
           LEFT JOIN variant_options vo ON vo.variant_id = v.variant_id
          WHERE p.product_group_id <> ALL(?)
          GROUP BY p.product_group_id, p.handle, p.title, p.product_type
          ORDER BY p.handle`,
      )
      .bind([...jaComprados])
      .all<ProdutoRow>();

    return results.map((linha) => ({
      handle: linha.handle,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      preco: linha.preco ?? 0,
      tags: linha.tags ?? [],
      opcoesDisponiveis: linha.opcoes ?? [],
    }));
  } catch (erro) {
    console.error("[vitrine] catalogoDisponivel falhou", erro);
    return [];
  }
};

// ---------------------------------------------------------------------------
// A vitrine gravada
// ---------------------------------------------------------------------------

interface VitrineRow {
  titulo: string;
  confianca: number;
  pecas: string;
  sinais: number;
  origem: string;
}

/**
 * A vitrine daquele conjunto de sinais, ou `null`.
 *
 * **Linha com `origem <> 'agente'` é tratada como inexistente**, exatamente como
 * em `lerLook` e `lerPersona`. É o que torna seguro o marcador de falha morar
 * nesta mesma tabela: quem consome nunca vê um terceiro estado, só vitrine ou
 * nada.
 */
export const lerVitrine = async (sinaisHash: string): Promise<Vitrine | null> => {
  const db = getDb();
  if (!db) return null;

  try {
    const linha = await db
      .prepare(`SELECT titulo, confianca, pecas, sinais, origem FROM vitrines WHERE sinais_hash = ?`)
      .bind(sinaisHash)
      .first<VitrineRow>();

    if (!linha || linha.origem !== "agente") return null;

    const pecas = JSON.parse(linha.pecas) as PecaRecomendada[];
    if (!Array.isArray(pecas) || pecas.length === 0) return null;

    return { titulo: linha.titulo, confianca: linha.confianca, pecas, sinais: linha.sinais ?? 0 };
  } catch (erro) {
    console.error("[vitrine] lerVitrine falhou", erro);
    return null;
  }
};

/**
 * Grava a vitrine daquele conjunto de sinais, substituindo a anterior.
 *
 * `UPSERT` porque o cron é reexecutável por natureza: rodar duas vezes reescreve,
 * nunca duplica nem falha por chave.
 */
export const gravarVitrine = async (sinaisHash: string, vitrine: Vitrine): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO vitrines (sinais_hash, titulo, confianca, pecas, sinais, origem, motivo, generated_at)
              VALUES (?, ?, ?, ?, ?, 'agente', NULL,
                      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (sinais_hash) DO UPDATE
                 SET titulo = EXCLUDED.titulo,
                     confianca = EXCLUDED.confianca,
                     pecas = EXCLUDED.pecas,
                     sinais = EXCLUDED.sinais,
                     origem = EXCLUDED.origem,
                     motivo = EXCLUDED.motivo,
                     generated_at = EXCLUDED.generated_at`,
      )
      .bind(sinaisHash, vitrine.titulo, vitrine.confianca, JSON.stringify(vitrine.pecas), vitrine.sinais)
      .run();

    return true;
  } catch (erro) {
    console.error("[vitrine] gravarVitrine falhou", erro);
    return false;
  }
};

/**
 * Registra que ESTES SINAIS foram tentados e não deram.
 *
 * A quarentena da #20, num contexto em que ela importa mais: o consumidor é um
 * **cron**, e sem marcador um conjunto de sinais que nunca converge consome uma
 * chamada de 60s a cada execução, para sempre — sem ninguém olhando, que é o
 * pior lugar para um laço morar.
 *
 * O `WHERE vitrines.origem <> 'agente'` impede que uma falha APAGUE uma vitrine
 * boa já gravada. Mesmo cinto de `gravarFalha` e `gravarFalhaDaPersona`.
 */
export const gravarFalhaDaVitrine = async (
  sinaisHash: string,
  motivo: string,
): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO vitrines (sinais_hash, titulo, confianca, pecas, sinais, origem, motivo, generated_at)
              VALUES (?, '', 0, '[]', 0, 'falha', ?,
                      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (sinais_hash) DO UPDATE
                 SET origem = 'falha',
                     motivo = EXCLUDED.motivo,
                     generated_at = EXCLUDED.generated_at
               WHERE vitrines.origem <> 'agente'`,
      )
      .bind(sinaisHash, motivo.slice(0, 200))
      .run();

    return true;
  } catch (erro) {
    console.error("[vitrine] gravarFalhaDaVitrine falhou", erro);
    return false;
  }
};

/**
 * Se estes sinais já falharam nos últimos `minutos`.
 *
 * Comparação de string, correta porque `generated_at` é ISO 8601 UTC de largura
 * fixa. Erro devolve `false`: na dúvida, tenta — um banco intermitente não deve
 * desligar a feature.
 */
export const vitrineFalhouRecentemente = async (
  sinaisHash: string,
  minutos: number,
): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    const linha = await db
      .prepare(
        `SELECT 1 AS existe
           FROM vitrines
          WHERE sinais_hash = ? AND origem = 'falha'
            AND generated_at > to_char((now() - make_interval(mins => ?)) AT TIME ZONE 'UTC',
                                       'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      )
      .bind(sinaisHash, minutos)
      .first<{ existe: number }>();

    return !!linha;
  } catch (erro) {
    console.error("[vitrine] vitrineFalhouRecentemente falhou", erro);
    return false;
  }
};
