/**
 * Tipos do domínio de "sinal de desejo" (db/migrations/0005_create_stock_alerts.sql).
 *
 * Mesma fronteira de `platform/catalog`: `StockAlertRow` é linha crua e não
 * atravessa este diretório. Quem consome de fora recebe `WaitedItem`, que já é
 * o desejo resolvido contra o catálogo — é esse o formato que o agente da shelf
 * lê.
 */

/** Linha crua da tabela `stock_alerts`. */
export interface StockAlertRow {
  id: number;
  variant_id: string;
  email: string;
  name: string | null;
  created_at: string;
}

/**
 * Um desejo já cruzado com o catálogo: o que a pessoa esperou, com as
 * características que o agente usa para achar substitutos disponíveis.
 */
export interface WaitedItem {
  variantId: string;
  productGroupId: string;
  /** Handle do produto pai — monta a URL da PDP. */
  handle: string;
  /** Título do produto pai ("Eco Raglan Hoodie"), não o da variante ("M"). */
  title: string;
  /** `products.product_type` — o "tipo" pelo qual o agente busca similares. */
  productType: string;
  vendor: string;
  price: number;
  /** Estado ATUAL da variante esperada. `true` = já voltou ao estoque. */
  available: boolean;
  /** Opções da variante esperada: `{ Size: "M", Color: "Black" }`. */
  options: Record<string, string>;
  /** Handles das coleções do produto pai. */
  collections: string[];
  /** Tags do produto pai. */
  tags: string[];
  /** ISO 8601 (UTC) de quando o desejo foi registrado. */
  waitedAt: string;
}
