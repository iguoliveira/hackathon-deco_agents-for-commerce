/**
 * Linhas cruas do SQLite (D1), uma interface por tabela de db/migrations/0001_catalog.sql.
 *
 * Estes tipos param aqui: nada fora de `platform/catalog` deve conhecê-los. O
 * resto do site consome `Product` de @decocms/apps-commerce/types, produzido
 * pelo mapper. É essa fronteira que permite trocar SQLite por outra fonte sem
 * tocar em nenhuma section.
 */

export interface ProductRow {
  product_group_id: string;
  handle: string;
  title: string;
  description: string;
  description_html: string | null;
  vendor: string;
  product_type: string;
  created_at: string | null;
  currency_code: string;
  position: number;
  /**
   * Cor do produto, atributo desde a 0018. `null` quando o catálogo não a
   * conhece — 31 dos 135 produtos —, e isso é diferente de string vazia:
   * "não sabemos" não é "sem cor".
   *
   * Antes da 0018 isto vivia no fim do título ("… - Black") e era recuperado
   * por parsing. Não vive mais: o título é o que a loja mostra.
   */
  color: string | null;
}

export interface ProductImageRow {
  product_group_id: string;
  url: string;
  alt: string;
  position: number;
}

export interface ProductPropRow {
  product_group_id: string;
  name: string;
  value: string;
  value_reference: string | null;
  position: number;
}

export interface VariantRow {
  variant_id: string;
  product_group_id: string;
  title: string;
  barcode: string | null;
  price: number;
  compare_at_price: number | null;
  /** SQLite não tem boolean: 0 | 1. */
  available: number;
  quantity: number;
  image_url: string | null;
  image_alt: string;
  position: number;
}

export interface VariantOptionRow {
  variant_id: string;
  name: string;
  value: string;
  position: number;
}

/** Um produto e todas as suas linhas filhas, agrupadas antes de virar `Product`. */
export interface CatalogRecord {
  product: ProductRow;
  images: ProductImageRow[];
  props: ProductPropRow[];
  variants: VariantRow[];
  optionsByVariant: Map<string, VariantOptionRow[]>;
}
