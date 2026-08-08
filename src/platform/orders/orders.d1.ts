/**
 * Único arquivo com SQL de `orders` e `order_items`.
 *
 * Nada aqui lança: quem consome é uma tela e uma ação de botão, e derrubar a
 * página por causa de um pedido não é resposta. A criação devolve `null` em vez
 * de estourar, e quem chama decide o que dizer.
 */

import { getDb } from "../db";
import type { ItemDoPedido, Pedido, StatusDoPedido } from "./orders.types";

interface PedidoRow {
  id: string;
  status: string;
  total: number;
  created_at: string;
}

interface ItemRow {
  order_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  title_snapshot: string;
  product_handle: string | null;
  image_url: string | null;
  image_alt: string | null;
}

const comoStatus = (valor: string): StatusDoPedido =>
  valor === "cancelled" ? "cancelled" : "paid";

/**
 * Cria o pedido e seus itens **numa transação**.
 *
 * Transacional porque um pedido sem itens é pior que pedido nenhum: apareceria
 * na tela como uma compra vazia de R$ 0, e ninguém saberia dizer se foi bug ou
 * se a pessoa comprou nada. Ou os dois INSERTs valem, ou nenhum vale.
 *
 * Os itens chegam **já resolvidos e com preço**, e isso não é detalhe de
 * assinatura: o preço tem de ser lido do catálogo no mesmo instante em que o
 * pedido é criado, não vir do cliente. Aceitar `unit_price` do navegador
 * deixaria qualquer pessoa comprar por R$ 1.
 */
export const criarPedido = async (
  email: string,
  itens: Array<{ variantId: string; quantidade: number; precoUnitario: number; titulo: string }>,
): Promise<string | null> => {
  const db = getDb();
  if (!db || itens.length === 0) return null;

  const id = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const total = itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0);

  try {
    await db.batch([
      db
        .prepare(`INSERT INTO orders (id, email, status, total) VALUES (?, ?, 'paid', ?)`)
        .bind(id, email, total),
      ...itens.map((item) =>
        db
          .prepare(
            `INSERT INTO order_items (order_id, variant_id, quantity, unit_price, title_snapshot)
                  VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(id, item.variantId, item.quantidade, item.precoUnitario, item.titulo),
      ),
    ]);

    return id;
  } catch (erro) {
    console.error("[orders] criarPedido falhou", erro);
    return null;
  }
};

/**
 * Os pedidos de alguém, do mais recente para o mais antigo.
 *
 * `LEFT JOIN` com o catálogo para a foto: o pedido é histórico e não pode
 * depender de o produto ainda existir. Um recibo que some porque a peça saiu de
 * linha é um recibo quebrado.
 */
export const pedidosDe = async (email: string, limite = 20): Promise<Pedido[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    const { results: pedidos } = await db
      .prepare(
        `SELECT id, status, total, created_at
           FROM orders WHERE email = ?
          ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(email, limite)
      .all<PedidoRow>();

    if (pedidos.length === 0) return [];

    const ids = pedidos.map((p) => p.id);
    const { results: itens } = await db
      .prepare(
        `SELECT oi.order_id, oi.variant_id, oi.quantity, oi.unit_price, oi.title_snapshot,
                p.handle AS product_handle, v.image_url, v.image_alt
           FROM order_items oi
           LEFT JOIN variants v ON v.variant_id = oi.variant_id
           LEFT JOIN products p ON p.product_group_id = v.product_group_id
          WHERE oi.order_id IN (${ids.map(() => "?").join(", ")})`,
      )
      .bind(...ids)
      .all<ItemRow>();

    const porPedido = new Map<string, ItemDoPedido[]>();
    for (const linha of itens) {
      const item: ItemDoPedido = {
        variantId: linha.variant_id,
        productHandle: linha.product_handle,
        titulo: linha.title_snapshot,
        quantidade: linha.quantity,
        precoUnitario: linha.unit_price,
        imagem: linha.image_url
          ? { url: linha.image_url, alt: linha.image_alt ?? linha.title_snapshot }
          : undefined,
      };
      porPedido.set(linha.order_id, [...(porPedido.get(linha.order_id) ?? []), item]);
    }

    return pedidos.map((p) => ({
      id: p.id,
      status: comoStatus(p.status),
      total: p.total,
      criadoEm: p.created_at,
      itens: porPedido.get(p.id) ?? [],
    }));
  } catch (erro) {
    console.error("[orders] pedidosDe falhou", erro);
    return [];
  }
};
