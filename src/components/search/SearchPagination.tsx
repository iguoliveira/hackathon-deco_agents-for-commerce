import { Link } from "@tanstack/react-router";
import { clx } from "~/sdk/clx";
import { rebaseToSearch } from "~/sdk/url";
import Icon from "../ui/Icon";

type NavTarget = { to: string; search: Record<string, string> };

export interface Props {
  /** 1-indexada, para exibição. */
  currentPage: number;
  /** Quantas páginas o total de itens produz. */
  totalPages: number;
  /** Destino de uma página qualquer — precisa de `to` E `search`. */
  pageTarget: (page: number) => NavTarget;
  prev?: NavTarget;
  next?: NavTarget;
}

export function rebasePaginationHrefs(
  prevHref: string | undefined,
  nextHref: string | undefined,
  base: string,
) {
  return {
    prev: rebaseToSearch(prevHref, base),
    next: rebaseToSearch(nextHref, base),
  };
}

/**
 * Números de página a exibir, com reticências quando não cabem todos.
 *
 * Primeira e última sempre aparecem — sem elas não há como saltar para o fim
 * de uma listagem longa, que é justamente o que a numeração deveria resolver.
 * `null` marca onde vai a reticência.
 */
const janela = (atual: number, total: number): (number | null)[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas = new Set([1, total, atual, atual - 1, atual + 1]);
  // Perto das pontas, estica para o outro lado — assim a barra não encolhe
  // quando se está na página 1 ou na última.
  if (atual <= 3) [2, 3, 4].forEach((p) => paginas.add(p));
  if (atual >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => paginas.add(p));

  const ordenadas = [...paginas].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const saida: (number | null)[] = [];
  let anterior = 0;
  for (const p of ordenadas) {
    if (anterior && p - anterior > 1) saida.push(null);
    saida.push(p);
    anterior = p;
  }
  return saida;
};

const SETA =
  "tap-scale frost flex size-9 items-center justify-center rounded-sm transition-colors duration-(--duration-fast)";

export default function SearchPagination({
  currentPage,
  totalPages,
  pageTarget,
  prev,
  next,
}: Props) {
  // Uma página só não é navegação, é ruído.
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginação" className="flex items-center gap-1.5">
      <Link
        to={prev?.to ?? "#"}
        search={prev?.search}
        preload="intent"
        rel="prev"
        aria-label="Página anterior"
        aria-disabled={!prev}
        className={clx(SETA, !prev && "pointer-events-none opacity-30")}
      >
        <Icon id="chevron-right" className="rotate-180" size={16} />
      </Link>

      {janela(currentPage, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-muted-soft" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={p}
            {...pageTarget(p)}
            preload="intent"
            aria-label={`Página ${p}`}
            aria-current={p === currentPage ? "page" : undefined}
            className={clx(
              "tap-scale flex size-9 items-center justify-center rounded-sm text-xs transition-colors duration-(--duration-fast)",
              p === currentPage
                ? "bg-ink font-medium text-white"
                : "frost text-ink hover:bg-glass-strong",
            )}
          >
            {p}
          </Link>
        ),
      )}

      <Link
        to={next?.to ?? "#"}
        search={next?.search}
        preload="intent"
        rel="next"
        aria-label="Próxima página"
        aria-disabled={!next}
        className={clx(SETA, !next && "pointer-events-none opacity-30")}
      >
        <Icon id="chevron-right" size={16} />
      </Link>
    </nav>
  );
}
