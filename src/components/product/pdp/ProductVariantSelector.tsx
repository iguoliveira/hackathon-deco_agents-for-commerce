import { useRouterState } from "@tanstack/react-router";
import type { Product } from "@decocms/apps-commerce/types";
import { useVariantPossibilities } from "@decocms/apps-commerce/sdk/useVariantPossibilities";
import { useOffer } from "@decocms/apps-commerce/sdk/useOffer";
import { relative } from "../../../sdk/url";
import { ColorSwatchNavList } from "../ColorSwatch";
import { SizePillList } from "../SizePill";

export interface VariantSelectorConfig {
  /**
   * @title Show attribute labels
   * @description Show the attribute name (Cores, Tamanhos) above each row
   * @default true
   */
  showLabels?: boolean;
  /**
   * @title Preload strategy
   * @description When to prefetch sibling variant routes
   * @default "intent"
   */
  preloadStrategy?: "intent" | "viewport" | "render" | false;
}

export interface Props {
  product: Product;
  config?: VariantSelectorConfig;
}

const isColorAttr = (name: string) => /color|cor(es)?/i.test(name);

export default function ProductVariantSelector({ product, config }: Props) {
  const preloadStrategy = config?.preloadStrategy ?? "intent";
  const showLabels = config?.showLabels ?? true;

  const hasVariant = product.isVariantOf?.hasVariant ?? [];
  const possibilities = useVariantPossibilities(hasVariant, product);
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const currentProductPath = relative(product.url);
  const selectedHref = (currentPath || currentProductPath) as string;

  // `useVariantPossibilities` only yields value -> href; it knows nothing about
  // stock, so every size used to render identically and you only discovered a
  // size was gone after clicking it. Availability lives on each sibling
  // variant's offer, keyed here by the same relative href the pills link to.
  //
  // `useOffer` is a plain function despite the name (see SearchResult.tsx,
  // which calls it inside a map), so this loop is not a hook violation.
  const unavailableHrefs = new Set<string>();
  for (const variant of hasVariant) {
    const href = relative(variant?.url);
    if (!href) continue;
    if (useOffer(variant.offers).availability !== "https://schema.org/InStock") {
      unavailableHrefs.add(href);
    }
  }

  const attrNames = Object.keys(possibilities).filter((n) => {
    const lower = n.toLowerCase();
    return lower !== "title" && lower !== "default title";
  });

  // Only attributes with at least one navigable value are worth a row —
  // some Shopify option groups (e.g. a single-value "Product Type") resolve
  // to zero valid entries and would otherwise render a bare, empty label.
  const withEntries = attrNames
    .map((attrName) => ({
      attrName,
      entries: Object.entries(possibilities[attrName])
        .filter(([value, link]) => value && link)
        .map(([value, link]) => [value, relative(link) as string] as const),
    }))
    .filter(({ entries }) => entries.length > 0);

  if (withEntries.length === 0) return null;

  // Sizes before colors — matches the Figma PDP order (Tamanhos, then Cores).
  const ordered = [...withEntries].sort(
    (a, b) => Number(isColorAttr(a.attrName)) - Number(isColorAttr(b.attrName)),
  );

  return (
    <ul className="flex flex-col gap-[15px]">
      {ordered.map(({ attrName, entries }) => {
        return (
          <li key={attrName} className="flex w-full flex-col gap-[15px]">
            {showLabels ? (
              <span className="text-xs font-medium text-muted-soft capitalize">{attrName}</span>
            ) : null}
            {isColorAttr(attrName) ? (
              <ColorSwatchNavList
                variants={entries}
                selectedHref={selectedHref}
                size={10}
                preloadStrategy={preloadStrategy}
              />
            ) : (
              <SizePillList
                entries={entries}
                selectedHref={selectedHref}
                unavailableHrefs={unavailableHrefs}
                preloadStrategy={preloadStrategy}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
