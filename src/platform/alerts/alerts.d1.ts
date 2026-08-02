/**
 * Acesso ao SQLite (D1) para o sinal de desejo. Único arquivo que fala SQL de
 * `stock_alerts`.
 *
 * Compartilha o binding `CATALOG_DB` com `platform/catalog` de propósito: a
 * leitura útil é justamente o JOIN entre o desejo e o catálogo, e bancos
 * separados obrigariam a fazer esse cruzamento em memória.
 */

import { env } from "cloudflare:workers";
import type { WaitedItem } from "./alerts.types";

const placeholders = (count: number) => new Array(count).fill("?").join(", ");

const getDb = () => {
  const db = env.CATALOG_DB;
  if (!db) {
    console.error("[alerts] binding CATALOG_DB ausente — confira d1_databases no wrangler.jsonc");
    return null;
  }
  return db;
};

export interface CreateStockAlertInput {
  /** `variant_id` — já identifica item + tamanho + cor. */
  variantId: string;
  email: string;
  name?: string;
}

/**
 * Registra o desejo. Idempotente: reclicar no mesmo tamanho não duplica nem
 * falha, só atualiza o nome (o índice UNIQUE de 0005 é quem garante isso).
 *
 * Retorna `false` quando o banco não está disponível, para o chamador poder
 * distinguir "não gravou" de "gravou" — sem lançar, porque este caminho roda
 * dentro de um clique do usuário.
 */
export const createStockAlert = async ({
  variantId,
  email,
  name,
}: CreateStockAlertInput): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO stock_alerts (variant_id, email, name)
         VALUES (?, ?, ?)
         ON CONFLICT(email, variant_id) DO UPDATE SET name = excluded.name`,
      )
      .bind(variantId, email, name ?? null)
      .run();
    return true;
  } catch (error) {
    console.error("[alerts] falha ao gravar stock_alert:", error);
    return false;
  }
};

interface WaitedRow {
  variant_id: string;
  product_group_id: string;
  handle: string;
  title: string;
  product_type: string;
  vendor: string;
  price: number;
  available: number;
  created_at: string;
}

/**
 * Os desejos de um comprador, já resolvidos contra o catálogo — a entrada do
 * agente que monta a shelf.
 *
 * INNER JOIN com `variants` de propósito: um desejo por uma variante que saiu
 * do catálogo não tem substituto a oferecer, então some da leitura em vez de
 * virar um item meio preenchido. É a contrapartida de não haver FK (ver 0005).
 *
 * `available` vem junto porque o agente precisa saber o que já voltou: para
 * esses, o melhor "produto que combina" é o próprio item esperado.
 */
export const findWaitedItems = async (email: string, limit = 20): Promise<WaitedItem[]> => {
  const db = getDb();
  if (!db) return [];

  const { results: rows } = await db
    .prepare(
      `SELECT v.variant_id, v.product_group_id, v.price, v.available,
              p.handle, p.title, p.product_type, p.vendor,
              a.created_at
       FROM stock_alerts a
       JOIN variants v ON v.variant_id = a.variant_id
       JOIN products p ON p.product_group_id = v.product_group_id
       WHERE a.email = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .bind(email, limit)
    .all<WaitedRow>();

  if (rows.length === 0) return [];

  const variantIds = rows.map((row) => row.variant_id);
  const groupIds = [...new Set(rows.map((row) => row.product_group_id))];

  // Duas queries em vez de somar os JOINs à principal: opções x props
  // multiplicariam as linhas e obrigariam a de-duplicar em memória — mesmo
  // motivo do `withChildren` em catalog.d1.ts.
  const [options, props] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT variant_id, name, value FROM variant_options
         WHERE variant_id IN (${placeholders(variantIds.length)}) ORDER BY position ASC`,
      )
      .bind(...variantIds),
    db
      .prepare(
        `SELECT product_group_id, name, value, value_reference FROM product_props
         WHERE product_group_id IN (${placeholders(groupIds.length)}) ORDER BY position ASC`,
      )
      .bind(...groupIds),
  ]);

  const optionsByVariant = new Map<string, Record<string, string>>();
  for (const row of options.results as Array<{ variant_id: string; name: string; value: string }>) {
    const bucket = optionsByVariant.get(row.variant_id) ?? {};
    bucket[row.name] = row.value;
    optionsByVariant.set(row.variant_id, bucket);
  }

  const propsByGroup = new Map<string, { collections: string[]; tags: string[] }>();
  for (const row of props.results as Array<{
    product_group_id: string;
    name: string;
    value: string;
    value_reference: string | null;
  }>) {
    const bucket = propsByGroup.get(row.product_group_id) ?? { collections: [], tags: [] };
    // 'TAG' / 'COLLECTION' é a convenção herdada do transform do Shopify,
    // preservada pelo seed do catálogo.
    if (row.name === "COLLECTION") bucket.collections.push(row.value_reference ?? row.value);
    else if (row.name === "TAG") bucket.tags.push(row.value);
    propsByGroup.set(row.product_group_id, bucket);
  }

  return rows.map((row) => {
    const groupProps = propsByGroup.get(row.product_group_id);
    return {
      variantId: row.variant_id,
      productGroupId: row.product_group_id,
      handle: row.handle,
      title: row.title,
      productType: row.product_type,
      vendor: row.vendor,
      price: row.price,
      available: row.available === 1,
      options: optionsByVariant.get(row.variant_id) ?? {},
      collections: groupProps?.collections ?? [],
      tags: groupProps?.tags ?? [],
      waitedAt: row.created_at,
    };
  });
};
