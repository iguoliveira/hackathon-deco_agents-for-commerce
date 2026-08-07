import type { ProductListingPage } from "@decocms/apps-commerce/types";
import { BreadcrumbJsonLd, PLPJsonLd } from "@decocms/blocks/hooks";
import { mapProductToAnalyticsItem } from "@decocms/apps-commerce/utils/productToAnalyticsItem";
import { useId } from "react";
import { useOffer } from "@decocms/apps-commerce/sdk/useOffer";
import { useRouterState } from "@tanstack/react-router";
import { useSendEvent } from "../../sdk/useSendEvent";
import { type SectionProps } from "~/types/deco";
import Breadcrumb from "../ui/Breadcrumb";
import Filters from "./Filters";
import SearchFilterDrawer from "./SearchFilterDrawer";
import SearchPagination, { rebasePaginationHrefs } from "./SearchPagination";
import SearchResultGrid from "./SearchResultGrid";
import SearchResultGridSkeleton from "./SearchResultGridSkeleton";
import SearchSortBar from "./SearchSortBar";

export interface Layout {
  // A opção `pagination` ("show-more" | "pagination") foi removida: a listagem
  // é sempre numerada. O "show more" só empilhava itens e não permitia saltar
  // para o fim de uma listagem longa — com 26 camisetas em 3 páginas isso já
  // incomodava. Deixar o campo no CMS sem efeito seria pior que não ter.
  /**
   * @title Pré-carregar página do produto
   * @description Quando ativado, a página do produto começa a carregar assim
   * que o usuário passa o mouse sobre o card, deixando a navegação mais rápida.
   * Pode aumentar o consumo de dados em listas muito grandes.
   * @default true
   */
  enablePrefetch?: boolean;
}

export interface Props {
  /** @title Integration */
  page: ProductListingPage | null;
  /** @title Layout */
  layout?: Layout;
  /**
   * @title Primeira página
   * @description Número que a primeira página tem na URL. O catálogo é
   * 1-based (`?page=2` é a segunda), então mudar isto só faz sentido se o
   * loader mudar junto.
   * @default 1
   */
  startingPage?: 0 | 1;
}

function NotFound() {
  return (
    <div className="flex w-full items-center justify-center py-28">
      <span className="text-display font-medium text-ink">No results found</span>
    </div>
  );
}

function Result({
  page,
  layout,
  // 1 e não 0: `?page=` do catálogo é 1-based, e os blocos já declaravam
  // `startingPage: 1`. O default antigo (0) era a outra metade do off-by-one —
  // um bloco que não declarasse a prop mostraria "2" na primeira página.
  startingPage = 1,
  url,
}: SectionProps<typeof loader> & { page: ProductListingPage }) {
  const filterDrawerId = useId();

  // Use the live URL for filter/sort/pagination link rebasing. The section
  // loader's `url` is the SSR URL — on client navigation the page re-renders
  // with the new route loader's data, and this hook drives client-side links.
  const href = useRouterState({ select: (s) => s.location.href }) || url;

  // Show a grid-only skeleton while the route is transitioning to a new URL
  // (filter/sort/pagination click). Filters/breadcrumb/sort stay mounted.
  const isRouteLoading = useRouterState({ select: (s) => s.isLoading });

  const { products, filters, breadcrumb, pageInfo, sortOptions } = page;
  const perPage = pageInfo?.recordPerPage || products.length;
  const zeroIndexedOffsetPage = pageInfo.currentPage - startingPage;
  const offset = zeroIndexedOffsetPage * perPage;
  const { prev, next } = rebasePaginationHrefs(pageInfo.previousPage, pageInfo.nextPage, href);

  // Quantas páginas o total de itens produz — é o que permite numerar em vez
  // de só oferecer "próxima".
  const totalRecords = pageInfo.records ?? products.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / (perPage || 1)));

  // Destino de uma página qualquer, preservando os filtros/ordenação da URL
  // atual. `search` é obrigatório: `to` carrega só o caminho, e o `page` vive
  // na query — passar apenas `to` navegaria para a própria página.
  const pageTarget = (page: number) => {
    const atual = new URL(href, "http://localhost");
    const search = Object.fromEntries(atual.searchParams);
    // A tela e a URL usam a mesma numeração (1-based). A primeira página omite
    // o parâmetro, para `?page=1` e a URL limpa não virarem duas URLs iguais.
    if (page <= 1) delete search.page;
    else search.page = String(page);
    return { to: atual.pathname, search };
  };

  const viewItemListEvent = useSendEvent({
    on: "view",
    event: {
      name: "view_item_list",
      params: {
        item_list_name: breadcrumb.itemListElement?.at(-1)?.name,
        item_list_id: breadcrumb.itemListElement?.at(-1)?.item,
        items: products?.map((product, index) =>
          mapProductToAnalyticsItem({
            ...useOffer(product.offers),
            index: offset + index,
            product,
            breadcrumbList: breadcrumb,
          }),
        ),
      },
    },
  });

  return (
    <div {...viewItemListEvent} className="w-full">
      <div className="container flex w-full flex-col gap-5 px-3 py-4 sm:gap-8 sm:py-6">
        {/* SEO: schema.org JSON-LD, server-rendered inline (crawlers read it anywhere in the document) */}
        <PLPJsonLd page={page} />
        {breadcrumb && <BreadcrumbJsonLd breadcrumb={breadcrumb} />}
        <Breadcrumb itemListElement={breadcrumb?.itemListElement} />

        <SearchFilterDrawer id={filterDrawerId} filters={filters} baseUrl={href} />

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-[220px_1fr]">
          <aside className="hidden flex-col gap-6 place-self-start sm:flex">
            <span className="text-sm font-medium text-ink-soft">Filters</span>
            <Filters filters={filters} baseUrl={href} />
          </aside>

          <div className="flex flex-col gap-6">
            <SearchSortBar
              recordPerPage={pageInfo.recordPerPage ?? products.length}
              totalRecords={pageInfo.records ?? products.length}
              sortOptions={sortOptions}
              url={href}
              filterDrawerId={filterDrawerId}
            />

            {isRouteLoading ? (
              <SearchResultGridSkeleton count={Math.min(perPage, 12) || 8} />
            ) : (
              <SearchResultGrid
                products={products}
                offset={offset}
                prefetch={layout?.enablePrefetch === false ? false : "intent"}
              />
            )}

            <div className="grid place-items-center pt-2 sm:pt-8">
              {/* Sempre numerada. O "show more" saiu: ele só empilhava itens e
                  não deixava saltar para o fim de uma listagem longa. */}
              <SearchPagination
                currentPage={zeroIndexedOffsetPage + 1}
                totalPages={totalPages}
                pageTarget={pageTarget}
                prev={prev}
                next={next}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const loader = (props: Props, req: Request) => ({
  ...props,
  url: req.url,
});

export default function SearchResult({ page, ...props }: SectionProps<typeof loader>) {
  if (!page) return <NotFound />;
  return <Result {...props} page={page} />;
}
