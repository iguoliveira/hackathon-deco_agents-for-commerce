/**
 * Ações do domínio catálogo. É o que loaders e sections consomem — a camada
 * acima nunca fala com D1 nem vê linha de SQL.
 */

import type { Product, ProductDetailsPage, ProductListingPage } from "@decocms/apps-commerce/types";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import {
  findCatalogRecordByHandle,
  findCatalogRecords,
  findCatalogRecordsByVariantIds,
  findCollectionHandles,
  findOptionNames,
  searchCatalog,
} from "./catalog.d1";
import { recordToProduct, recordToProductPage } from "./catalog.mapper";
import { parseSort, toProductListingPage } from "./catalog.plp";

/**
 * O `Product` carrega URLs absolutas, então precisa da origin da requisição.
 * Mesmo fallback que src/loaders/productByHandle.ts:27-28 usa quando roda fora
 * de um contexto de request (build, preview do editor).
 */
const currentOrigin = (): string => {
  const request = RequestContext.current?.request;
  return request ? new URL(request.url).origin : "https://localhost";
};

const PAGE_URL_HEADER = "x-deco-page-url";

/**
 * URL real da página sendo renderizada.
 *
 * `RequestContext.request.url` **não** serve sozinho: no caminho de resolve do
 * CMS ele pode ser a URL do `_serverFn/...`, não a que o usuário vê — e aí
 * `?q=`, `?sort=` e os filtros somem, sem erro nenhum, devolvendo o catálogo
 * inteiro como se ninguém tivesse filtrado. Mesma precedência que
 * `resolvePageUrl` em src/setup.ts:105-121 usa para o loader do Shopify, pelo
 * mesmo motivo.
 */
const resolvePageUrl = (pageUrlProp?: string): URL => {
  try {
    const header = RequestContext.request.headers.get(PAGE_URL_HEADER);
    if (header) return new URL(header, "http://localhost");
  } catch {
    // RequestContext pode não existir em chamadas isoladas.
  }

  if (pageUrlProp) return new URL(pageUrlProp, "http://localhost");

  try {
    return new URL(RequestContext.request.url);
  } catch {
    return new URL("https://localhost/s");
  }
};

export interface ListProductsOptions {
  /** Quantos produtos retornar. */
  limit?: number;
  /** Handle da coleção, ex.: "shirts". */
  collection?: string;
  /** Busca livre no título. */
  query?: string;
}

/** Lista produtos do catálogo SQLite já no formato que as sections esperam. */
export const listProducts = async ({
  limit = 12,
  collection,
  query,
}: ListProductsOptions = {}): Promise<Product[]> => {
  const records = await findCatalogRecords({ limit, collection, query });
  const origin = currentOrigin();

  // Um produto sem nenhuma variante não tem preço nem URL de PDP; o mapper
  // devolve null e ele sai da lista em vez de renderizar um card quebrado.
  return records
    .map((record) => recordToProduct(record, origin))
    .filter((product): product is Product => product !== null);
};

/**
 * Resolve o slug da PDP (`/products/:slug`) numa `ProductDetailsPage`.
 *
 * O slug é `<handle>` ou `<handle>-<id numérico da variante>`, convenção herdada
 * do transform do Shopify.
 *
 * Diferença deliberada em relação ao loader do Shopify
 * (ProductDetailsPage.ts:19-21): ele sempre trata o último segmento numérico
 * como id de variante, o que quebra handles que legitimamente terminam em
 * número — `high-top-canvas-shoes-1` (Women's Slides) resolveria para
 * `high-top-canvas-shoes` (High Top Canvas Shoes), o produto errado, sem erro
 * nenhum. Aqui o slug inteiro é tentado como handle primeiro; só se não existir
 * é que o sufixo numérico é interpretado como variante.
 */
/**
 * Chaves de querystring que a página usa para si.
 *
 * Guarda contra colisão: se um dia existir uma opção de variante chamada
 * `sort`, o significado de página continua ganhando.
 */
const RESERVED_PARAMS = new Set(["q", "page", "sort", "collection", "startCursor", "endCursor"]);

export interface ListingPageOptions {
  /** Coleção fixa da página (landing pages), sobrepõe o `?collection=`. */
  collection?: string;
  /** Busca fixa da página, para landing pages sem coleção própria (ex.: "kids"). */
  query?: string;
  /** Produtos por página. */
  perPage?: number;
  /** URL da página, injetada pelo framework como `__pageUrl`. Ver resolvePageUrl. */
  pageUrl?: string;
}

/**
 * Monta a `ProductListingPage` a partir da URL da requisição — busca `/s`,
 * página de categoria e landing pages usam este mesmo caminho.
 *
 * Os filtros vêm da própria querystring: `collection` é tratado à parte porque
 * a página pode fixá-lo, e o resto vira opção de variante (`Size=M&Color=Black`),
 * do mesmo jeito que o `url` de cada FilterToggleValue é construído.
 *
 * Só entram chaves que são de fato nome de opção no catálogo. Interpretar todo
 * parâmetro desconhecido como filtro parece inofensivo e não é: um link de
 * campanha (`?utm_source=google`, `gclid`, `fbclid`) viraria um filtro por uma
 * opção inexistente, e a PLP voltaria vazia — sem erro, sem log, só zero
 * resultados para quem chegou pelo anúncio.
 */
export const getProductListingPage = async ({
  collection,
  query,
  perPage = 12,
  pageUrl,
}: ListingPageOptions = {}): Promise<ProductListingPage | null> => {
  const url = resolvePageUrl(pageUrl);
  const optionNames = await findOptionNames();

  const options: Record<string, string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    if (RESERVED_PARAMS.has(key) || !optionNames.has(key)) continue;
    options[key] = url.searchParams.getAll(key);
  }

  // `?page=` é 1-BASED: `page=1` é a primeira página, e a primeira página
  // também é a ausência do parâmetro.
  //
  // Antes era 0-based aqui e 1-based nos blocos (`startingPage: 1`), e o número
  // ia direto como multiplicador do OFFSET. O resultado eram dois bugs de uma
  // vez: "página 1" mostrava a segunda, e clicar na última pedia um OFFSET além
  // do total — a página vinha vazia em vez de não existir.
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);

  // A coleção pode vir do CAMINHO — `/shirts`, `/accessories`. É o que faz as
  // abas do menu pré-selecionarem o filtro.
  //
  // Sem isto, a Category Page (`/*`) chamava este loader sem coleção nenhuma e
  // toda aba mostrava o catálogo inteiro: o bloco `PLP Loader` é compartilhado
  // por todas elas e não tem como declarar uma coleção por rota.
  //
  // Só vale se o segmento for MESMO uma coleção (ver findCollectionHandles) —
  // caso contrário `/s`, `/login` ou `/wishlist` virariam filtro por coleção
  // inexistente e a listagem voltaria vazia, sem erro e sem log.
  const primeiroSegmento = url.pathname.split("/").filter(Boolean)[0];
  const colecaoDoCaminho =
    primeiroSegmento && (await findCollectionHandles()).has(primeiroSegmento)
      ? primeiroSegmento
      : undefined;

  const busca = {
    // `?q=` do usuário ganha da query fixa da página: buscar dentro de /kids
    // deve buscar, não continuar preso ao recorte da landing.
    term: url.searchParams.get("q") ?? query ?? undefined,
    collection: collection ?? url.searchParams.get("collection") ?? colecaoDoCaminho,
    options,
    sort: parseSort(url.searchParams.get("sort")),
    perPage,
  };

  // searchCatalog conta a partir de 0 (é OFFSET de SQL).
  let result = await searchCatalog({ ...busca, page: page - 1 });
  let paginaFinal = page;

  // Página além da última devolve zero linhas — uma listagem vazia com filtros
  // e contagem preenchidos, que parece "nada encontrado" e não é. A navegação
  // nunca linka para lá, mas URL digitada, link antigo e robô chegam. Grampeia
  // na última que existe.
  //
  // A segunda consulta só acontece nesse caso: no caminho normal, `page` já é
  // válida e nada extra roda.
  const ultimaPagina = Math.max(1, Math.ceil(result.total / perPage));
  if (page > ultimaPagina && result.total > 0) {
    paginaFinal = ultimaPagina;
    result = await searchCatalog({ ...busca, page: ultimaPagina - 1 });
  }

  return toProductListingPage(result, url, { page: paginaFinal, perPage });
};

/**
 * Um produto pelo handle, como lista de um item — encaixa direto em qualquer
 * prop tipada `Product[] | null`. Mesmo contrato de
 * `site/loaders/productByHandle.ts`, que fala com o Shopify.
 */
export const getProductByHandle = async (handle: string): Promise<Product[] | null> => {
  if (!handle) return null;

  const record = await findCatalogRecordByHandle(handle);
  if (!record) return null;

  const product = recordToProduct(record, currentOrigin());
  return product ? [product] : null;
};

export const getProductDetailsPage = async (slug: string): Promise<ProductDetailsPage | null> => {
  if (!slug) return null;
  const origin = currentOrigin();

  const exact = await findCatalogRecordByHandle(slug);
  if (exact) return recordToProductPage(exact, origin);

  const match = slug.match(/^(.*)-(\d+)$/);
  if (!match) return null;

  const [, handle, numericId] = match;
  const record = await findCatalogRecordByHandle(handle);
  if (!record) return null;

  // O banco guarda o gid completo; o slug carrega só o sufixo numérico.
  const variant = record.variants.find((v) => v.variant_id.endsWith(`/${numericId}`));
  return recordToProductPage(record, origin, variant?.variant_id);
};

/**
 * Busca produtos específicos para a wishlist — apenas os variant IDs informados.
 * Usada exclusivamente pelo loader da página de wishlist.
 */
export const getWishlistProducts = async (variantIds: string[]): Promise<Product[]> => {
  const records = await findCatalogRecordsByVariantIds(variantIds);
  const origin = currentOrigin();

  // A wishlist guarda o ID da variante. Um mesmo produto pode aparecer com
  // variantes diferentes, portanto a ordem e a seleção vêm da wishlist, não
  // da ordem do catálogo nem da primeira variante do produto.
  const recordByVariantId = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    for (const variant of record.variants) {
      recordByVariantId.set(variant.variant_id, record);
    }
  }

  return variantIds
    .map((variantId) => {
      const record = recordByVariantId.get(variantId);
      return record ? recordToProduct(record, origin, variantId) : null;
    })
    .filter((product): product is Product => product !== null);
};
