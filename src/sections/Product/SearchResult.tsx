import Section from "../../components/ui/Section";

export { default, loader } from "../../components/search/SearchResult";

/**
 * O esqueleto enquanto a listagem carrega.
 *
 * Faltava, e a falta não era cosmética: o decofile envolve TODA section em
 * `website/sections/Rendering/Lazy.tsx` (ver `.deco/blocks/pages-Category*`),
 * então mesmo uma section `eager` passa pelo caminho diferido. As outras três
 * eager — `Header`, `Footer` e `Theme` — sobrevivem a isso porque declaram
 * `sync` e exportam `LoadingFallback`. Esta não declarava nenhum dos dois, e
 * era a única página do site que abria vazia.
 *
 * Sem fallback o framework renderiza um aviso de dev no lugar da section, e em
 * produção não renderiza nada — foi assim que `/shirts` ficou em branco no ar,
 * com `Minified React error #418` no console.
 */
export const LoadingFallback = () => (
  <Section.Container>
    <Section.Placeholder height="720px" />
  </Section.Container>
);

// Eager so the section stays mounted across URL changes (filter/sort/page).
// Deferred sections re-resolve by propsHash and remount with a page-wide
// skeleton; eager sections receive new props from the route loader and only
// the products grid swaps to a skeleton via TanStack Router's loading state
// (see SearchResult.tsx). Filters/breadcrumb/sort stay visible the whole time.
export const eager = true;

// `sync` acompanha `eager` obrigatoriamente, e a ausência dela quebrava a PLP
// por inteiro — em produção também, não só no dev.
//
// Sem `sync`, a section eager cai no caminho de `React.lazy`: o servidor
// renderiza o conteúdo e o cliente, na hidratação, ainda não tem o componente.
// O resultado é `Minified React error #418` (divergência de texto entre
// servidor e cliente), e o React **descarta a árvore inteira** — a categoria
// abre em branco. No dev o sintoma é diferente e engana: aparece a caixa
// vermelha "[AsyncRender] Missing LoadingFallback", que parece um aviso de
// estilo e não a falha que é.
//
// O próprio framework avisa em toda renderização — `[DecoPageRenderer] Eager
// section "..." is not in registerSectionsSync(). This may cause blank content
// during hydration.` —, e `Header`, `Footer` e `Theme`, as outras três eager,
// já declaravam as duas desde sempre. Esta era a única fora do padrão.
export const sync = true;

// NOTE: deliberately NOT cached. The section loader injects `req.url` into
// props so Filters/Sort/Pagination can rebase commerce-loader URLs onto the
// current page path. The framework's section cache keys on props only, so
// caching would freeze the first request's URL across every subsequent page.
