/**
 * Único arquivo com SQL da vitrine.
 *
 * Nada aqui lança: quem consome é uma section, e vitrine vazia é resultado
 * aceitável — derrubar a home por causa dela não é.
 */

import { getDb } from "../db";
import type { Candidato } from "./vitrine.types";

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
 */
export const catalogoDisponivel = async (): Promise<Candidato[]> => {
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
          GROUP BY p.product_group_id, p.handle, p.title, p.product_type
          ORDER BY p.handle`,
      )
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
