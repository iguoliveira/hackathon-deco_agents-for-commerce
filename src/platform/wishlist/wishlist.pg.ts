import { getDb } from "../db";
import type { WishlistItem } from "./wishlist.types";

/**
 * Lê wishlist do usuário autenticado (ordenada por recência).
 */
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .prepare(
      `SELECT product_id, product_group_id, created_at
       FROM wishlist_items
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<{ product_id: string; product_group_id: string; created_at: string }>();

  return rows.results.map((r) => ({
    productId: r.product_id,
    productGroupId: r.product_group_id,
    addedAt: r.created_at,
  }));
}

/**
 * Adiciona item à wishlist (idempotente: UNIQUE constraint evita duplicata).
 */
export async function addWishlistItem(
  userId: string,
  productId: string,
  productGroupId: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO wishlist_items (user_id, product_id, product_group_id)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, product_id) DO NOTHING`,
    )
    .bind(userId, productId, productGroupId)
    .run();
}

/**
 * Remove item da wishlist.
 */
export async function removeWishlistItem(userId: string, productId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .prepare(
      `DELETE FROM wishlist_items
       WHERE user_id = ? AND product_id = ?`,
    )
    .bind(userId, productId)
    .run();
}

/**
 * Toggle item na wishlist (atômico no banco).
 * Retorna true se adicionado, false se removido.
 */
export async function toggleWishlistItem(
  userId: string,
  productId: string,
  productGroupId: string,
): Promise<{ added: boolean }> {
  const db = getDb();
  if (!db) return { added: false };

  // DELETE e INSERT precisam ser condicionais. O batch anterior sempre
  // executava os dois statements: removia o item e o recriava em seguida.
  // O CTE executa uma única operação atômica: se removeu, não insere; se não
  // havia item, insere. O RETURNING também funciona tanto no Postgres quanto
  // na camada D1-like usada pelo projeto.
  const result = await db
    .prepare(
      `WITH removed AS (
         DELETE FROM wishlist_items
         WHERE user_id = ? AND product_id = ?
         RETURNING product_id
       ), added AS (
         INSERT INTO wishlist_items (user_id, product_id, product_group_id)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM removed)
         ON CONFLICT (user_id, product_id) DO NOTHING
         RETURNING product_id
       )
       SELECT EXISTS (SELECT 1 FROM added) AS added`,
    )
    .bind(userId, productId, userId, productId, productGroupId)
    .first<{ added: boolean }>();

  return { added: result?.added ?? false };
}

/**
 * Merge: move itens do cookie para o banco no login (idempotente).
 * Busca product_group_id no catálogo para cada variant ID.
 */
export async function mergeCookieWishlist(
  userId: string,
  cookieProductIds: string[],
): Promise<void> {
  if (cookieProductIds.length === 0) return;

  const db = getDb();
  if (!db) return;

  // Busca product_group_id dos produtos no catálogo
  const placeholders = cookieProductIds.map(() => "?").join(",");
  const catalogRows = await db
    .prepare(
      `SELECT v.variant_id, p.product_group_id
       FROM variants v
       JOIN products p ON p.product_group_id = v.product_group_id
       WHERE v.variant_id IN (${placeholders})`,
    )
    .bind(...cookieProductIds)
    .all<{ variant_id: string; product_group_id: string }>();

  const groupIdByVariant = new Map(
    catalogRows.results.map((r) => [r.variant_id, r.product_group_id]),
  );

  for (const productId of cookieProductIds) {
    const productGroupId = groupIdByVariant.get(productId);
    if (!productGroupId) continue; // produto não existe mais no catálogo

    await db
      .prepare(
        `INSERT INTO wishlist_items (user_id, product_id, product_group_id)
         VALUES (?, ?, ?)
         ON CONFLICT (user_id, product_id) DO NOTHING`,
      )
      .bind(userId, productId, productGroupId)
      .run();
  }
}
