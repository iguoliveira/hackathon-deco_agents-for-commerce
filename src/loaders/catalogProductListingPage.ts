import type { ProductListingPage } from "@decocms/apps-commerce/types";
import { getProductListingPage } from "~/platform/catalog";

export interface Props {
  /**
   * @title Coleção fixa
   * @description Handle da coleção desta página (ex.: "shirts"). Deixe vazio na busca — aí vem de `?collection=`.
   */
  collection?: string;
  /**
   * @title Busca fixa
   * @description Recorte da página quando não há coleção própria (ex.: "kids"). O `?q=` do usuário tem prioridade.
   */
  query?: string;
  /**
   * @title Produtos por página
   */
  count?: number;
  /**
   * URL real da página, injetada pelo framework. Sem ela os filtros da
   * querystring podem sumir — ver `resolvePageUrl` em catalog.actions.ts.
   * @ignore
   */
  __pageUrl?: string;
}

/**
 * PLP a partir do catálogo SQLite: busca `/s`, categoria e landing pages.
 *
 * Substituto de `shopify/loaders/ProductListingPage.ts`. Diferente daquele, não
 * precisa do wrapper de URL que o `setup.ts` mantém — lê a URL da requisição
 * via RequestContext, dentro da própria action.
 */
export default async function catalogProductListingPageLoader({
  collection,
  query,
  count = 12,
  __pageUrl,
}: Props = {}): Promise<ProductListingPage | null> {
  return getProductListingPage({ collection, query, perPage: count, pageUrl: __pageUrl });
}
