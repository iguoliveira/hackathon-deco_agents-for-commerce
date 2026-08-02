/**
 * Montagem da `ProductListingPage` — busca, categoria e landing pages.
 *
 * O que importa aqui não é a lista de produtos: é `filters`. Cada valor carrega
 * label, `quantity` e uma URL pronta, e é isso que `src/components/search/
 * Filters.tsx:96-135` renderiza. Também é o "espaço de ação" do agente de busca
 * (`FilterCandidate` na spec): o modelo escolhe de valores que a loader
 * devolveu, em vez de inventar querystring. Por isso valor com `quantity: 0`
 * nunca é oferecido — a query já os descarta.
 */

import type {
  BreadcrumbList,
  Filter,
  FilterToggleValue,
  ProductListingPage,
  SortOption,
} from "@decocms/apps-commerce/types";
import type { FacetValue, SearchCatalogResult } from "./catalog.d1";
import { recordToProduct } from "./catalog.mapper";

/** Mesmos valores que `src/components/search/Sort.tsx:36-40` sabe rotular. */
export const SORT_OPTIONS: SortOption[] = [
  { value: "relevance:desc", label: "Relevance" },
  { value: "price:asc", label: "Lowest price" },
  { value: "price:desc", label: "Highest price" },
];

/** `relevance:desc` (querystring) -> `relevance` (interno). */
export const parseSort = (raw: string | null): "relevance" | "price:asc" | "price:desc" => {
  if (raw === "price:asc" || raw === "price:desc") return raw;
  return "relevance";
};

/**
 * URL com um valor de filtro alternado (liga se desligado, desliga se ligado).
 * Mesma mecânica de `filtersURL` do transform do Shopify: a página é sempre
 * zerada, senão alternar um filtro te deixa numa página que não existe mais.
 */
const toggleUrl = (url: URL, key: string, value: string): string => {
  const next = new URL(url.href);
  const params = next.searchParams;
  params.delete("page");

  const current = params.getAll(key);
  params.delete(key);
  for (const existing of current) {
    if (existing !== value) params.append(key, existing);
  }
  if (!current.includes(value)) params.append(key, value);

  next.search = params.toString();
  return next.toString();
};

const toFilterValue = (url: URL, facet: FacetValue, selected: string[]): FilterToggleValue => ({
  quantity: facet.quantity,
  label: facet.label,
  value: facet.value,
  selected: selected.includes(facet.value),
  url: toggleUrl(url, facet.key, facet.value),
});

const groupFacets = (facets: FacetValue[]): Map<string, FacetValue[]> => {
  const map = new Map<string, FacetValue[]>();
  for (const facet of facets) {
    const bucket = map.get(facet.key);
    if (bucket) bucket.push(facet);
    else map.set(facet.key, [facet]);
  }
  return map;
};

const buildFilters = (result: SearchCatalogResult, url: URL): Filter[] => {
  const filters: Filter[] = [];

  if (result.collectionFacets.length > 0) {
    const selected = url.searchParams.getAll("collection");
    filters.push({
      "@type": "FilterToggle",
      key: "collection",
      label: "Categoria",
      quantity: result.collectionFacets.length,
      values: result.collectionFacets.map((facet) => toFilterValue(url, facet, selected)),
    });
  }

  for (const [key, facets] of groupFacets(result.optionFacets)) {
    const selected = url.searchParams.getAll(key);
    filters.push({
      "@type": "FilterToggle",
      key,
      label: key,
      quantity: facets.length,
      values: facets.map((facet) =>
        toFilterValue(url, { ...facet, value: facet.label }, selected),
      ),
    });
  }

  return filters;
};

const pageUrl = (url: URL, page: number): string | undefined => {
  if (page < 0) return undefined;
  const next = new URL(url.href);
  next.searchParams.set("page", String(page));
  return next.toString();
};

const buildBreadcrumb = (url: URL, term: string | null): BreadcrumbList => {
  const label = term ? `Busca: ${term}` : "Produtos";
  return {
    "@type": "BreadcrumbList",
    numberOfItems: 1,
    itemListElement: [
      { "@type": "ListItem", name: label, position: 1, item: url.pathname },
    ],
  };
};

export const toProductListingPage = (
  result: SearchCatalogResult,
  url: URL,
  { page, perPage }: { page: number; perPage: number },
): ProductListingPage => {
  const term = url.searchParams.get("q");
  const lastPage = Math.max(0, Math.ceil(result.total / perPage) - 1);

  return {
    "@type": "ProductListingPage",
    breadcrumb: buildBreadcrumb(url, term),
    filters: buildFilters(result, url),
    products: result.records
      .map((record) => recordToProduct(record, url.origin))
      .filter((product): product is NonNullable<typeof product> => product !== null),
    pageInfo: {
      currentPage: page,
      nextPage: page < lastPage ? pageUrl(url, page + 1) : undefined,
      previousPage: page > 0 ? pageUrl(url, page - 1) : undefined,
      records: result.total,
      recordPerPage: perPage,
    },
    sortOptions: SORT_OPTIONS,
    seo: {
      title: term ? `Busca: ${term}` : "Produtos",
      description: term ? `Resultados para "${term}"` : "Nossa seleção de produtos",
      canonical: `${url.origin}${url.pathname}`,
    },
  };
};
