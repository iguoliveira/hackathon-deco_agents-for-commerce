import type { Product } from "@decocms/apps-commerce/types";
import { getProductByHandle } from "~/platform/catalog";

export interface Props {
  /**
   * @title Product handle
   * @description Handle/slug do produto (ex.: "deco-tee") — fixa um produto exato em vez de depender de busca.
   */
  handle: string;
}

/**
 * Um produto do catálogo SQLite, como lista de um item.
 *
 * Substituto direto de `site/loaders/productByHandle.ts` (que fala com o
 * Shopify): mesmo `Product[] | null`, então cai em qualquer prop que já aceitava
 * aquele loader — os slides do Hero, por exemplo.
 */
export default async function catalogProductByHandleLoader({
  handle,
}: Props): Promise<Product[] | null> {
  return getProductByHandle(handle);
}
