/**
 * Ações do domínio catálogo. É o que loaders e sections consomem — a camada
 * acima nunca fala com D1 nem vê linha de SQL.
 */

import type { Product } from "@decocms/apps-commerce/types";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { findCatalogRecords } from "./catalog.d1";
import { recordToProduct } from "./catalog.mapper";

/**
 * O `Product` carrega URLs absolutas, então precisa da origin da requisição.
 * Mesmo fallback que src/loaders/productByHandle.ts:27-28 usa quando roda fora
 * de um contexto de request (build, preview do editor).
 */
const currentOrigin = (): string => {
  const request = RequestContext.current?.request;
  return request ? new URL(request.url).origin : "https://localhost";
};

export interface ListProductsOptions {
  /** Quantos produtos retornar. */
  limit?: number;
}

/** Lista produtos do catálogo SQLite já no formato que as sections esperam. */
export const listProducts = async ({ limit = 12 }: ListProductsOptions = {}): Promise<Product[]> => {
  const records = await findCatalogRecords(limit);
  const origin = currentOrigin();

  // Um produto sem nenhuma variante não tem preço nem URL de PDP; o mapper
  // devolve null e ele sai da lista em vez de renderizar um card quebrado.
  return records
    .map((record) => recordToProduct(record, origin))
    .filter((product): product is Product => product !== null);
};
