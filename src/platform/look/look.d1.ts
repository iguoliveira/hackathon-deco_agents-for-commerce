/**
 * Único arquivo com SQL de `looks`, `orders` e da resolução de sementes.
 *
 * Nada aqui lança: quem consome é uma section, e look vazio é resultado
 * aceitável — derrubar a PDP por causa dele não é.
 */

import { getDb } from "../db";
import type { Ancora, Look, PecaDoLook, Semente, SeedKind } from "./look.types";

// ---------------------------------------------------------------------------
// Sementes
// ---------------------------------------------------------------------------

interface SementeRow {
  product_group_id: string;
  title: string;
  product_type: string;
  tags: string[] | null;
}

/**
 * As tags do produto, no mesmo formato que `acharAncora` já usa.
 *
 * Repetido como fragmento em vez de virar JOIN porque as três consultas de
 * semente partem de tabelas diferentes (variante, handle, pedido) e só
 * compartilham o `product_group_id` no fim.
 */
const TAGS_DO_PRODUTO = `COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                                    WHERE pp.product_group_id = p.product_group_id
                                      AND pp.name = 'TAG'), '{}') AS tags`;

/**
 * Resolve variantes em produtos. É como favoritos e compras viram semente: os
 * dois guardam `variant_id` (o cookie `deco_wishlist` guarda o `productID`, que
 * é o `variant_id` — ver `catalog.mapper.ts:95`), e o agente raciocina sobre
 * produto.
 */
export const sementesPorVariante = async (
  variantIds: string[],
  kind: SeedKind,
  em: string,
): Promise<Semente[]> => {
  const db = getDb();
  if (!db || variantIds.length === 0) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT DISTINCT p.product_group_id, p.title, p.product_type, ${TAGS_DO_PRODUTO}
           FROM products p
           JOIN variants v ON v.product_group_id = p.product_group_id
          WHERE v.variant_id = ANY(?)`,
      )
      .bind(variantIds)
      .all<SementeRow>();

    return results.map((linha) => ({
      productGroupId: linha.product_group_id,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      tags: linha.tags ?? [],
      kind,
      em,
    }));
  } catch (erro) {
    console.error("[look] sementesPorVariante falhou", erro);
    return [];
  }
};

/** Idem para os vistos, que o cookie guarda por handle (é o que a URL tem). */
export const sementesPorHandle = async (
  handles: string[],
  kind: SeedKind,
  em: string,
): Promise<Semente[]> => {
  const db = getDb();
  if (!db || handles.length === 0) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT p.product_group_id, p.handle, p.title, p.product_type, ${TAGS_DO_PRODUTO}
           FROM products p
          WHERE p.handle = ANY(?)`,
      )
      .bind(handles)
      .all<SementeRow & { handle: string }>();

    // A ordem do cookie é a ordem de recência e o SQL não a preserva. Reordenar
    // aqui é o que faz a peça vista há um minuto pesar mais que a de meia hora
    // atrás no desempate — e sem isto o `slice` das sementes cortaria por acaso.
    const posicaoNoCookie = new Map(handles.map((handle, i) => [handle, i]));

    return results
      .map((linha) => ({
        productGroupId: linha.product_group_id,
        titulo: linha.title,
        tipo: linha.product_type ?? "",
        tags: linha.tags ?? [],
        kind,
        em,
        _pos: posicaoNoCookie.get(linha.handle) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a._pos - b._pos)
      .map(({ _pos: _, ...semente }) => semente);
  } catch (erro) {
    console.error("[look] sementesPorHandle falhou", erro);
    return [];
  }
};

interface CompraRow extends SementeRow {
  created_at: string;
}

/**
 * O que a pessoa comprou.
 *
 * `INNER JOIN` com o catálogo, não `LEFT`: uma compra cuja variante saiu do
 * catálogo não tem o que informar ao agente — não há tipo, não há tag, não há
 * do que compor em volta. Mesma escolha que `findWaitedItems` já faz.
 *
 * Parte de `order_items` e não de `orders` desde a 0017: o pedido passou a ter
 * vários itens, e a variante desceu para a linha do item. O JOIN com o catálogo
 * **vivo** é de propósito — o agente precisa do tipo e das tags de agora, não
 * dos de quando a compra aconteceu. O que ficou congelado no pedido é só o que
 * foi transacionado (preço e título), e nada disso entra aqui.
 *
 * Pedido cancelado não conta: o sinal é POSSE, e quem cancelou não tem a peça.
 */
export const comprasDe = async (email: string): Promise<Semente[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT DISTINCT ON (p.product_group_id)
                p.product_group_id, p.title, p.product_type, o.created_at, ${TAGS_DO_PRODUTO}
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           JOIN variants v ON v.variant_id = oi.variant_id
           JOIN products p ON p.product_group_id = v.product_group_id
          WHERE o.email = ? AND o.status <> 'cancelled'
          ORDER BY p.product_group_id, o.created_at DESC`,
      )
      .bind(email)
      .all<CompraRow>();

    return results.map((linha) => ({
      productGroupId: linha.product_group_id,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      tags: linha.tags ?? [],
      kind: "purchased" as const,
      em: linha.created_at,
    }));
  } catch (erro) {
    console.error("[look] comprasDe falhou", erro);
    return [];
  }
};

// ---------------------------------------------------------------------------
// A âncora
// ---------------------------------------------------------------------------

interface AncoraRow {
  product_group_id: string;
  handle: string;
  title: string;
  product_type: string;
  description: string | null;
  tags: string[] | null;
}

/** Uma tentativa de casar o handle exato. `null` quando não existe. */
const buscarAncora = async (
  handle: string,
): Promise<{ ancora: Ancora; variantId: string } | null> => {
  const db = getDb();
  if (!db) return null;

  const linha = await db
    .prepare(
      `SELECT p.product_group_id, p.handle, p.title, p.product_type, p.description,
              COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                         WHERE pp.product_group_id = p.product_group_id
                           AND pp.name = 'TAG'), '{}') AS tags,
              (SELECT v.variant_id FROM variants v
                WHERE v.product_group_id = p.product_group_id
                ORDER BY v.available DESC, v.variant_id ASC LIMIT 1) AS variant_id
         FROM products p
        WHERE p.handle = ?`,
    )
    .bind(handle)
    .first<AncoraRow & { variant_id: string | null }>();

  if (!linha?.variant_id) return null;

  return {
    variantId: linha.variant_id,
    ancora: {
      productGroupId: linha.product_group_id,
      handle: linha.handle,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      // 240 caracteres: o bastante para o modelo entender a peça que ancora o
      // look, longe do bastante para a descrição (média de 866) competir com
      // os candidatos pelo espaço do prompt.
      descricao: (linha.description ?? "").slice(0, 240),
      tags: linha.tags ?? [],
    },
  };
};

/**
 * A peça aberta, com o que o agente precisa para compor em volta dela.
 *
 * Devolve o `variant_id` de uma variante qualquer junto porque os dois pools
 * (`findSimilarAvailable`, `findComplementsAvailable`) recebem variante, não
 * produto — eles nasceram servindo o sinal de "avise-me", que é por variante.
 *
 * **Recebe o SLUG da PDP, não o handle**, e a diferença não é cosmética: todo
 * link do site sai de `catalog.mapper.ts:productPath`, que anexa o id numérico
 * da variante (`/products/vintage-wash-tee-black-45123456`). Casar só handle
 * exato faria a section sumir em todo clique vindo de PLP, prateleira ou do
 * próprio look — sem erro, com a página em 200.
 *
 * A precedência é a mesma de `getProductDetailsPage` e existe pelo mesmo
 * motivo: **o slug inteiro é tentado como handle primeiro**. Handles legítimos
 * terminam em número (`high-top-canvas-shoes-1` é o Women's Slides, não uma
 * variante do High Top), e inverter a ordem resolveria para o produto errado
 * sem erro nenhum.
 */
export const acharAncora = async (
  slug: string,
): Promise<{ ancora: Ancora; variantId: string } | null> => {
  if (!slug) return null;

  try {
    const exato = await buscarAncora(slug);
    if (exato) return exato;

    const comVariante = slug.match(/^(.*)-(\d+)$/);
    if (!comVariante?.[1]) return null;

    return await buscarAncora(comVariante[1]);
  } catch (erro) {
    console.error("[look] acharAncora falhou", erro);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Cache de looks
// ---------------------------------------------------------------------------

interface LookRow {
  titulo: string;
  confianca: number;
  pecas: string;
  origem: string;
}

/**
 * O look gravado daquele par, ou `null`.
 *
 * **Linha com `origem <> 'agente'` é tratada como inexistente.** As colunas
 * `origem` e `motivo_do_fallback` continuam na tabela porque a `0014` já foi
 * aplicada e apagá-las custaria uma migration para não comprar nada — mas nada
 * escreve `'sql'` desde que o fallback caiu. O filtro existe para as linhas
 * antigas: servir uma delas hoje poria na tela um look sem motivo nenhum, que é
 * exatamente o que se decidiu não mostrar. Sendo ignoradas, elas são
 * regeneradas na primeira visita e somem sozinhas.
 */
export const lerLook = async (anchorId: string, contextoHash: string): Promise<Look | null> => {
  const db = getDb();
  if (!db) return null;

  try {
    const linha = await db
      .prepare(
        `SELECT titulo, confianca, pecas, origem
           FROM looks WHERE anchor_id = ? AND contexto_hash = ?`,
      )
      .bind(anchorId, contextoHash)
      .first<LookRow>();

    if (!linha || linha.origem !== "agente") return null;

    const pecas = JSON.parse(linha.pecas) as PecaDoLook[];
    if (!Array.isArray(pecas)) return null;

    return {
      titulo: linha.titulo,
      confianca: linha.confianca,
      pecas,
    };
  } catch (erro) {
    console.error("[look] lerLook falhou", erro);
    return null;
  }
};

/**
 * Grava o look, substituindo o anterior daquele par.
 *
 * O `UPSERT` é o que torna o pré-aquecimento e um refresh futuro idempotentes:
 * rodar duas vezes reescreve, nunca duplica nem falha por chave.
 *
 * **Só chega aqui look do agente** — `gerarLook` retorna antes quando a
 * composição falha. Daí `origem` ser literal: a coluna sobrevive para as linhas
 * antigas e para o `lerLook` poder ignorá-las, não porque haja o que decidir.
 */
export const gravarLook = async (
  anchorId: string,
  contextoHash: string,
  look: Look,
): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO looks (anchor_id, contexto_hash, titulo, confianca, pecas, origem,
                            motivo_do_fallback, generated_at)
              VALUES (?, ?, ?, ?, ?, 'agente', NULL,
                      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (anchor_id, contexto_hash) DO UPDATE
                 SET titulo = EXCLUDED.titulo,
                     confianca = EXCLUDED.confianca,
                     pecas = EXCLUDED.pecas,
                     origem = EXCLUDED.origem,
                     motivo_do_fallback = EXCLUDED.motivo_do_fallback,
                     generated_at = EXCLUDED.generated_at`,
      )
      .bind(anchorId, contextoHash, look.titulo, look.confianca, JSON.stringify(look.pecas))
      .run();

    return true;
  } catch (erro) {
    console.error("[look] gravarLook falhou", erro);
    return false;
  }
};
