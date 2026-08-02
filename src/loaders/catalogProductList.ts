import type { Product } from "@decocms/apps-commerce/types";
import { listProducts } from "~/platform/catalog";

export interface Props {
  /**
   * @title Quantidade
   * @description Quantos produtos trazer do catálogo SQLite.
   */
  count?: number;
  /**
   * @title Coleção
   * @description Handle da coleção, ex.: "shirts", "accessories", "hoodies-sweatshirts". Vazio traz de todas.
   */
  collection?: string;
  /**
   * @title Busca
   * @description Filtro livre no título do produto. Vazio ignora.
   */
  query?: string;
}

/**
 * Vitrine a partir do catálogo SQLite (D1), em vez da Storefront API do Shopify.
 *
 * Substituto direto de `shopify/loaders/ProductList.ts`: devolve o mesmo
 * `Product[] | null`, então encaixa em qualquer prop que já aceitava aquele
 * loader — ProductShelf, ProductShelfTabbed, ProductSlider.
 */
export default async function catalogProductListLoader({
  count = 12,
  collection,
  query,
}: Props = {}): Promise<Product[] | null> {
  const products = await listProducts({ limit: count, collection, query });
  return products.length > 0 ? products : null;
}
