/**
 * Site setup — orchestrator that wires framework, apps, and sections.
 *
 * App-installed loaders + actions are wired via
 * `autoconfigApps(blocks, APP_REGISTRY)` — adding a new app is a one-line entry
 * in the local `APP_REGISTRY` array below (each `@decocms/apps-<vendor>` ships
 * its own `./registry` entry; the old aggregate `@decocms/apps/registry` is
 * gone in the 7.x split).
 *
 * Section-specific prop enrichment lives in `setup/section-loaders.ts`.
 * Section metadata (eager, sync, layout, cache, LoadingFallback) is declared
 * in each section file and auto-extracted by generate-sections.ts.
 */

import "./cache-config";

import { registerCommerceLoaders, applySectionConventions } from "@decocms/blocks/cms";
import { createSiteSetup } from "@decocms/blocks/setup";
import { createAdminSetup } from "@decocms/blocks-admin/setup";
import { autoconfigApps, type AppRegistry } from "@decocms/blocks-admin/apps";
import { createInstrumentedFetch } from "@decocms/blocks/sdk/instrumentedFetch";
import { initShopifyFromBlocks, setShopifyFetch } from "@decocms/apps-shopify";
import { SHOPIFY_REGISTRY_ENTRY } from "@decocms/apps-shopify/registry";
import * as shopifyMod from "@decocms/apps-shopify/mod";
import { blocks as generatedBlocks } from "../.deco/blocks.gen";
import { sectionMeta, syncComponents, loadingFallbacks } from "../.deco/sections.gen";
import { PreviewProviders } from "@decocms/tanstack";
// @ts-ignore Vite ?url import
import appCss from "./styles/app.css?url";

import "./setup/section-loaders";

// Per-app registry entries, assembled from each app package's own ./registry
// export — the aggregate `@decocms/apps/registry` no longer exists in the 7.x
// package split. Shopify is the only commerce app this store configures.
// SHOPIFY_REGISTRY_ENTRY.module is a dynamic `import("./mod")` that fails to
// resolve in the production (vite/workerd) build — autoconfigApps then silently
// swallows the error and skips Shopify, so its commerce loaders never register
// and PDP/shelves resolve to null (works in `vite dev`, breaks in prod). Provide
// the module statically so registration is build-safe.
const APP_REGISTRY: AppRegistry = [
  { ...SHOPIFY_REGISTRY_ENTRY, module: async () => shopifyMod as never },
];

// -- Framework setup (framework-generic options only) --
createSiteSetup({
  sections: import.meta.glob("./sections/**/*.tsx") as Record<string, () => Promise<any>>,
  blocks: generatedBlocks,
  productionOrigins: ["https://www.demo-storefront.com.br", "https://demo-storefront.com.br"],
  initPlatform: (blocks) => initShopifyFromBlocks(blocks),
  onResolveError: (error, resolveType, context) => {
    console.error(`[CMS-DEBUG] ${context} "${resolveType}" failed:`, error);
  },
  onDanglingReference: (resolveType) => {
    console.warn(`[CMS-DEBUG] Dangling reference: ${resolveType}`);
    return null;
  },
});

// -- Admin setup (admin-only options: meta schema, render shell, preview) --
createAdminSetup({
  meta: () => import("../.deco/meta.gen.json").then((m) => m.default),
  css: appCss,
  fonts: [],
  previewWrapper: PreviewProviders,
});

// -- Shopify wiring --
setShopifyFetch(createInstrumentedFetch("shopify"));

// -- Convention-driven section registration --
applySectionConventions({
  meta: sectionMeta,
  syncComponents,
  loadingFallbacks,
  sectionGlob: import.meta.glob("./sections/**/*.tsx") as Record<string, () => Promise<any>>,
});

// -- Apps: auto-configure from decofile against the APP_REGISTRY --
// Registers commerce loaders (CMS resolve path) + invoke handlers (admin path)
// for every app the site has configured. Adding a new app = add its
// `@decocms/apps-<vendor>/registry` entry to the APP_REGISTRY array above.
await autoconfigApps(generatedBlocks, APP_REGISTRY);

// -- Commerce-loader overrides --
//
// ⚠️ DEAD CODE, KEPT ON PURPOSE. No block resolves `shopify/loaders/*` for
// product data any more: the catalog is served from SQLite (D1 binding
// `CATALOG_DB`) by the `site/loaders/catalog*` entries registered further down.
// Nothing below this line runs today.
//
// Three reasons it stays instead of being deleted:
//
//   1. It is the escape hatch. Pointing `.deco/blocks/PLP%20Loader.json` back at
//      `shopify/loaders/ProductListingPage.ts` restores the Shopify-backed PLP
//      in one line — useful to compare behaviour between the two sources while
//      the SQLite path is still young.
//   2. The `resolvePageUrl` precedence below is hard-won knowledge, not
//      boilerplate: in the CMS resolve path `RequestContext.request.url` can be
//      the `_serverFn/...` URL rather than the page URL, so querystring filters
//      silently vanish and the loader returns the whole catalog as if nobody had
//      filtered. `src/platform/catalog/catalog.actions.ts` reimplements the same
//      three-step precedence for exactly this reason — deleting the original
//      would drop the explanation of *why* that code exists.
//   3. Removing it means also dropping the `@decocms/apps-shopify` PLP import,
//      which is a wider change than it looks: the app is still wired for cart,
//      checkout proxy and user session.
//
// Delete this block once the SQLite catalog is settled and nobody wants the
// comparison any more. Same applies to the `site/loaders/productByHandle`
// entries below, which the Hero stopped using when it moved to
// `catalogProductByHandle`.
//
// Shopify's productListingPage loader reads filters/sort/pagination from a
// URL. The framework calls commerce loaders with `(props)` only — it injects
// `__pageUrl` into props, but Shopify ignores it and falls back to a hardcoded
// `https://localhost`, so server-side filtering never matches the real URL.
// We wrap the loader to forward the request URL via the second positional arg.
//
// On CSR navigations, `__pageUrl` is unreliable for the home route ("/"):
// `loadCmsPageInternal` derives it from `getRequestUrl()`, which returns the
// `_serverFn/...` URL, not the user's page URL. The check
// `realUrlPath.startsWith(basePath)` is too loose when basePath is "/".
// To work around it, the home/catch-all loaders forward the real page URL
// in the `x-deco-page-url` header so we can read it back here.
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import productListingPageLoader from "@decocms/apps-shopify/loaders/ProductListingPage";

const SHOPIFY_PLP_KEY = "shopify/loaders/ProductListingPage";

const PAGE_URL_HEADER = "x-deco-page-url";

const resolvePageUrl = (props: any): URL | undefined => {
  // 1. Trust the explicit page-URL header if present (CSR home workaround).
  try {
    const headerUrl = RequestContext.request.headers.get(PAGE_URL_HEADER);
    if (headerUrl) return new URL(headerUrl, "http://localhost");
  } catch {
    // RequestContext may not be available in some isolated calls.
  }
  // 2. Framework-injected `__pageUrl` (correct for SSR + non-home CSR).
  if (props?.__pageUrl) return new URL(props.__pageUrl, "http://localhost");
  // 3. Last resort: the worker's request URL.
  try {
    return new URL(RequestContext.request.url);
  } catch {
    return undefined;
  }
};

const wrappedShopifyPLP = async (props: any) => {
  const pageUrl = resolvePageUrl(props);
  return productListingPageLoader(props, pageUrl);
};

registerCommerceLoaders({
  [SHOPIFY_PLP_KEY]: wrappedShopifyPLP,
  [`${SHOPIFY_PLP_KEY}.ts`]: wrappedShopifyPLP,
});

// -- Site-local loaders (not shipped by an app, still stubbed for Phase 6) --
// Cart is now served by TanStack Query via `platform/cart/` (server functions
// + `@decocms/apps/shopify/loaders/cart.getCart`), so no loader entry is
// needed here for minicart.
registerCommerceLoaders({
  "site/loaders/user.ts": async () => (await import("./loaders/user")).default(),
  "site/loaders/user": async () => (await import("./loaders/user")).default(),
  "site/loaders/wishlist.ts": async () => (await import("./loaders/wishlist")).default(),
  "site/loaders/wishlist": async () => (await import("./loaders/wishlist")).default(),
  "site/loaders/address.ts": async () => (await import("./loaders/address")).default(),
  "site/loaders/address": async () => (await import("./loaders/address")).default(),
  // ⚠️ Dead code, kept for the same reasons as the PLP override above: the Hero
  // slides moved to `catalogProductByHandle` and no block resolves this any more.
  "site/loaders/productByHandle.ts": async (props: any) =>
    (await import("./loaders/productByHandle")).default(props),
  "site/loaders/productByHandle": async (props: any) =>
    (await import("./loaders/productByHandle")).default(props),
  // Catálogo em SQLite (binding D1 `CATALOG_DB`). Devolve o mesmo `Product[]`
  // que `shopify/loaders/ProductList.ts`, então é intercambiável com ele em
  // qualquer bloco — ver `.deco/blocks/Product%20List%20Loader.json`.
  "site/loaders/catalogProductList.ts": async (props: any) =>
    (await import("./loaders/catalogProductList")).default(props),
  "site/loaders/catalogProductList": async (props: any) =>
    (await import("./loaders/catalogProductList")).default(props),
  "site/loaders/catalogProductDetailsPage.ts": async (props: any) =>
    (await import("./loaders/catalogProductDetailsPage")).default(props),
  "site/loaders/catalogProductDetailsPage": async (props: any) =>
    (await import("./loaders/catalogProductDetailsPage")).default(props),
  "site/loaders/catalogProductByHandle.ts": async (props: any) =>
    (await import("./loaders/catalogProductByHandle")).default(props),
  "site/loaders/catalogProductByHandle": async (props: any) =>
    (await import("./loaders/catalogProductByHandle")).default(props),
  "site/loaders/catalogProductListingPage.ts": async (props: any) =>
    (await import("./loaders/catalogProductListingPage")).default(props),
  "site/loaders/catalogProductListingPage": async (props: any) =>
    (await import("./loaders/catalogProductListingPage")).default(props),
  // Vitrine montada pelo agente a partir do sinal de "avise-me". Sem props: o
  // conteúdo depende de quem está pedindo, e a identidade sai do
  // RequestContext, não de configuração de bloco.
  "site/loaders/personalShelf.ts": async (props: any) =>
    (await import("./loaders/personalShelf")).default(props),
  "site/loaders/personalShelf": async (props: any) =>
    (await import("./loaders/personalShelf")).default(props),
  // O look que o agente compõe em volta da peça aberta. Recebe `req` porque o
  // handle vem da URL quando a prop está vazia — que é o caso na PDP, onde um
  // bloco só serve as 136 peças.
  "site/loaders/completeTheLook.ts": async (props: any, req: any) =>
    (await import("./loaders/completeTheLook")).default(props, req),
  "site/loaders/completeTheLook": async (props: any, req: any) =>
    (await import("./loaders/completeTheLook")).default(props, req),
});

// -- Site-local actions (registered via additive invoke handler registry) --
import { registerInvokeHandlers } from "@decocms/blocks-admin";

registerInvokeHandlers({
  "site/actions/wishlist/submit.ts": async (props, req) =>
    (await import("./actions/wishlist/submit")).default(props, req),
  "site/actions/wishlist/submit": async (props, req) =>
    (await import("./actions/wishlist/submit")).default(props, req),
  // O seletor de cidade. Vence o geo por IP, e é o que torna a feature
  // observável em `vite dev`, onde os headers da Vercel não existem.
  "site/actions/look/setLocal.ts": async (props, req) =>
    (await import("./actions/look/setLocal")).default(props as any, req),
  "site/actions/look/setLocal": async (props, req) =>
    (await import("./actions/look/setLocal")).default(props as any, req),
  // O outro lado do seletor: qual local está em vigor agora. Lido pelo cliente
  // porque o Header é `layout` e tem cache compartilhado entre visitantes —
  // ver o comentário em `src/loaders/lookLocal.ts`.
  "site/loaders/lookLocal.ts": async () => (await import("./loaders/lookLocal")).default(),
  "site/loaders/lookLocal": async () => (await import("./loaders/lookLocal")).default(),
  // ---------------------------------------------------------------------------
  // Loaders que o CLIENTE invoca, e que precisam estar AQUI e não só em
  // `registerCommerceLoaders`.
  //
  // Os dois registros não são a mesma coisa e é fácil confundi-los:
  //
  //   registerCommerceLoaders  -> resolve o decofile (sections, blocos)
  //   registerInvokeHandlers   -> resolve POST /deco/invoke/<chave>
  //
  // `wishlist` e `address` estavam só no primeiro. Como quem os chama é
  // `invoke.site.loaders.*` no cliente (wishlist.hooks.ts e address.hooks.ts),
  // as duas chamadas voltavam **404 em produção** — a lista de desejos e o
  // livro de endereços simplesmente não carregavam.
  //
  // Não aparecia em teste de navegação porque nenhuma section resolve estes
  // dois: eles só existem no caminho do cliente. E `status 200 não é sinal de
  // saúde neste site` não ajudava aqui — a página respondia 200 e o 404 ficava
  // no console.
  //
  // Regra prática: se alguém escreve `invoke.site.loaders.X`, X precisa de
  // entrada neste bloco. Hoje são três — `lookLocal`, `wishlist` e `address`.
  "site/loaders/wishlist.ts": async () => (await import("./loaders/wishlist")).default(),
  "site/loaders/wishlist": async () => (await import("./loaders/wishlist")).default(),
  "site/loaders/address.ts": async () => (await import("./loaders/address")).default(),
  "site/loaders/address": async () => (await import("./loaders/address")).default(),
  "site/actions/shipping/simulate.ts": async (props, req) =>
    (await import("./actions/shipping/simulate")).default(props, req),
  "site/actions/shipping/simulate": async (props, req) =>
    (await import("./actions/shipping/simulate")).default(props, req),
  // `req` is what lets the action read the signed-in shopper from the session
  // cookie instead of trusting the email in the body.
  "site/actions/notifyMe/subscribe.ts": async (props, req) =>
    (await import("./actions/notifyMe/subscribe")).default(props, req),
  "site/actions/notifyMe/subscribe": async (props, req) =>
    (await import("./actions/notifyMe/subscribe")).default(props, req),
  "site/actions/newsletter/subscribe.ts": async (props, req) =>
    (await import("./actions/newsletter/subscribe")).default(props, req),
  "site/actions/newsletter/subscribe": async (props, req) =>
    (await import("./actions/newsletter/subscribe")).default(props, req),
  "site/actions/address/submit.ts": async (props, req) =>
    (await import("./actions/address/submit")).default(props, req),
  "site/actions/address/submit": async (props, req) =>
    (await import("./actions/address/submit")).default(props, req),
});
