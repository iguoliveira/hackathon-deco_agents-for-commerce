import type { ButtonHTMLAttributes } from "react";
import { clx } from "~/sdk/clx";
import Icon, { type AvailableIcons } from "./Icon";

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: AvailableIcons;
  label: string;
  active?: boolean;
  size?: "sm" | "md";
  iconSize?: number;
  filled?: boolean;
  /**
   * Substitui o `<Icon>` interno, mantendo o resto: a superfície circular, o
   * alvo de toque de 44px, o `tap-scale` e o `aria-pressed`.
   *
   * Existe para o coração da wishlist, que precisa de dois ícones sobrepostos
   * para animar o preenchimento por dentro — algo específico demais para virar
   * prop deste componente, e genérico demais para justificar duplicar o botão.
   */
  children?: React.ReactNode;
}

const SIZE_CLASS = {
  sm: "size-8",
  md: "size-10",
};

/**
 * Circular glass icon button — wishlist heart, search trigger, menu
 * hamburger/close. Padding extends the tap target to 44px on touch even
 * when the visible glass surface is smaller (see web-animation-design tip).
 */
export default function IconButton({
  icon,
  label,
  active = false,
  size = "sm",
  iconSize = 16,
  filled = false,
  children,
  className,
  ...props
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={clx(
        // `cursor-pointer` explícito: o Preflight do Tailwind v4 passou a
        // definir `cursor: default` em `button`, ao contrário do v3. Sem isto
        // nenhum botão de ícone do site mostra a mãozinha — coração, X, busca e
        // menu ficavam com o cursor de seta.
        "tap-scale relative inline-flex cursor-pointer items-center justify-center rounded-sm transition-colors duration-(--duration-fast)",
        "before:absolute before:-inset-[6px] before:content-['']", // 44px+ hit area
        active ? "glass-strong text-ink" : "frost text-ink hover:bg-glass-strong",
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      {children ?? (
        <Icon
          id={icon}
          size={iconSize}
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
        />
      )}
    </button>
  );
}
