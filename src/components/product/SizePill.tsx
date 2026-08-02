import { Link } from "@tanstack/react-router";
import { clx } from "~/sdk/clx";

export interface SizePillListProps {
  entries: Array<readonly [value: string, link: string]>;
  selectedHref: string;
  /**
   * Hrefs whose variant is out of stock. They stay navigable on purpose:
   * selecting a sold-out size is how the shopper reaches the "notify me"
   * form, so disabling the link would remove the only way in.
   */
  unavailableHrefs?: ReadonlySet<string>;
  preloadStrategy?: "intent" | "viewport" | "render" | false;
}

/**
 * Round size selector pills ("Tamanhos" on the PDP) — glass by default,
 * solid ink when selected, struck through when sold out.
 */
export function SizePillList({
  entries,
  selectedHref,
  unavailableHrefs,
  preloadStrategy = "intent",
}: SizePillListProps) {
  return (
    <ul className="flex flex-wrap items-center gap-1">
      {entries.map(([value, href]) => {
        const checked = href === selectedHref;
        const unavailable = unavailableHrefs?.has(href) ?? false;
        return (
          <li key={href}>
            <Link
              to={href}
              preload={preloadStrategy === false ? false : preloadStrategy}
              activeOptions={{ exact: true }}
              // The strike-through is decorative; screen readers get it here.
              aria-label={unavailable ? `Size: ${value} — out of stock` : `Size: ${value}`}
              aria-current={checked ? "page" : undefined}
              className={clx(
                "tap-scale flex size-[26px] items-center justify-center rounded-full text-2xs capitalize transition-colors duration-(--duration-fast)",
                checked ? "bg-ink text-white" : "frost text-muted-soft hover:bg-glass-strong",
                // Keep the selected pill legible: dim only the unselected ones,
                // or a sold-out size you just picked would fade as you click it.
                unavailable && "line-through",
                unavailable && !checked && "opacity-45",
              )}
            >
              {value}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
