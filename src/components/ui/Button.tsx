import type { ButtonHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import { clx } from "~/sdk/clx";

export type ButtonVariant = "glass" | "solid" | "outline";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  glass: "frost text-ink hover:bg-glass-strong",
  solid: "bg-ink text-white hover:bg-ink-soft",
  outline: "bg-transparent text-ink border border-gray-300 hover:border-ink",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-2xs gap-1.5",
  md: "h-10 px-3 text-sm gap-2",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type AsLink = CommonProps & {
  href: string;
  /**
   * Query string do destino, repassada ao `<Link>` do router.
   *
   * Existe porque `href` carrega só o caminho: sem isto, um link para
   * `/shirts?page=1` navegava para `/shirts` e a página não mudava. Era o
   * "Show more" da listagem, que ficou anos sem aparecer porque nenhuma
   * coleção passava de uma página — o bug só ficou visível quando o catálogo
   * cresceu.
   */
  search?: Record<string, string>;
  prefetch?: "intent" | false;
  disabled?: undefined;
};

export type Props = AsButton | AsLink;

/**
 * Shared pill/rectangle button used across the header, PDP and marketing
 * sections. Renders a router `<Link>` when `href` is given, a `<button>`
 * otherwise — same visual system either way.
 */
export default function Button(props: Props) {
  const { variant = "glass", size = "sm", className, children } = props;

  const classes = clx(
    // `cursor-pointer` pelo mesmo motivo do `IconButton`: o Preflight do
    // Tailwind v4 define `cursor: default` em `button`, e sem isto nenhum botão
    // do site mostra a mãozinha. `disabled:cursor-not-allowed` vem junto porque
    // um botão desabilitado com mãozinha promete um clique que não acontece.
    "tap-scale inline-flex cursor-pointer items-center justify-center rounded-sm font-medium capitalize whitespace-nowrap transition-colors duration-(--duration-fast) disabled:cursor-not-allowed",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link
        to={props.href}
        search={props.search}
        preload={props.prefetch ?? "intent"}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  const { type = "button", ...rest } = props as AsButton;
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
