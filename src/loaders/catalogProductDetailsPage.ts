import type { ProductDetailsPage } from "@decocms/apps-commerce/types";
import { getProductDetailsPage } from "~/platform/catalog";

export interface Props {
  /**
   * @title Slug
   * @description Slug da URL da PDP. No bloco vem de `website/functions/requestToParam.ts`.
   */
  slug: string;
}

/**
 * PDP a partir do catálogo SQLite, em vez da Storefront API do Shopify.
 *
 * Substituto direto de `shopify/loaders/ProductDetailsPage.ts`: mesmo
 * `ProductDetailsPage | null`, então encaixa onde aquele loader estava —
 * ver `.deco/blocks/PDP%20Loader.json`.
 */
export default async function catalogProductDetailsPageLoader({
  slug,
}: Props): Promise<ProductDetailsPage | null> {
  return getProductDetailsPage(slug);
}
