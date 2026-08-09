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
  color: string | null;
}

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
        `SELECT DISTINCT p.product_group_id, p.title, p.product_type, p.color
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
      cor: linha.color,
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
        `SELECT p.product_group_id, p.handle, p.title, p.product_type, p.color
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
        cor: linha.color,
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
 */
export const comprasDe = async (email: string): Promise<Semente[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT DISTINCT ON (p.product_group_id)
                p.product_group_id, p.title, p.product_type, p.color, o.created_at
           FROM orders o
           JOIN variants v ON v.variant_id = o.variant_id
           JOIN products p ON p.product_group_id = v.product_group_id
          WHERE o.email = ?
          ORDER BY p.product_group_id, o.created_at DESC`,
      )
      .bind(email)
      .all<CompraRow>();

    return results.map((linha) => ({
      productGroupId: linha.product_group_id,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      cor: linha.color,
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
  color: string | null;
  description: string | null;
  tags: string[] | null;
}

/**
 * A peça aberta, com o que o agente precisa para compor em volta dela.
 *
 * Devolve o `variant_id` de uma variante qualquer junto porque os dois pools
 * (`findSimilarAvailable`, `findComplementsAvailable`) recebem variante, não
 * produto — eles nasceram servindo o sinal de "avise-me", que é por variante.
 */
export const acharAncora = async (
  handle: string,
): Promise<{ ancora: Ancora; variantId: string } | null> => {
  const db = getDb();
  if (!db) return null;

  try {
    const linha = await db
      .prepare(
        `SELECT p.product_group_id, p.handle, p.title, p.product_type, p.color, p.description,
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
        cor: linha.color,
        // 240 caracteres: o bastante para o modelo entender a peça que ancora o
        // look, longe do bastante para a descrição (média de 866) competir com
        // os candidatos pelo espaço do prompt.
        descricao: (linha.description ?? "").slice(0, 240),
        tags: linha.tags ?? [],
      },
    };
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
  motivo_do_fallback: string | null;
}

export const lerLook = async (anchorId: string, contextoHash: string): Promise<Look | null> => {
  const db = getDb();
  if (!db) return null;

  try {
    const linha = await db
      .prepare(
        `SELECT titulo, confianca, pecas, origem, motivo_do_fallback
           FROM looks WHERE anchor_id = ? AND contexto_hash = ?`,
      )
      .bind(anchorId, contextoHash)
      .first<LookRow>();

    if (!linha) return null;

    const pecas = JSON.parse(linha.pecas) as PecaDoLook[];
    if (!Array.isArray(pecas)) return null;

    return {
      titulo: linha.titulo,
      confianca: linha.confianca,
      pecas,
      origem: linha.origem === "agente" ? "agente" : "sql",
      motivoDoFallback: linha.motivo_do_fallback ?? undefined,
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
 * Grava inclusive o look do SQL. Ele não é só modo de falha — é estado
 * intermediário válido, que a próxima passada substitui por um do agente. Não
 * gravar deixaria a PDP recalculando os pools a cada render sempre que o
 * provedor estivesse saturado. Mesma decisão de `gravarVitrine`.
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
              VALUES (?, ?, ?, ?, ?, ?, ?,
                      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (anchor_id, contexto_hash) DO UPDATE
                 SET titulo = EXCLUDED.titulo,
                     confianca = EXCLUDED.confianca,
                     pecas = EXCLUDED.pecas,
                     origem = EXCLUDED.origem,
                     motivo_do_fallback = EXCLUDED.motivo_do_fallback,
                     generated_at = EXCLUDED.generated_at`,
      )
      .bind(
        anchorId,
        contextoHash,
        look.titulo,
        look.confianca,
        JSON.stringify(look.pecas),
        look.origem,
        look.motivoDoFallback ?? null,
      )
      .run();

    return true;
  } catch (erro) {
    console.error("[look] gravarLook falhou", erro);
    return false;
  }
};
