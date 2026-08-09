import React from "react";

import type { JSX } from "react";

export type AvailableIcons =
  | "search"
  | "shopping_bag"
  | "menu"
  | "account_circle"
  | "close"
  | "chevron-right"
  | "favorite"
  /**
   * O coração SÓLIDO. Existe porque `favorite` não é um traço — é um contorno
   * vazado, desenhado como um preenchimento com furo no meio. Trocar o `fill`
   * dele não preenche nada: o furo continua lá, e por isso o `filled` do
   * `IconButton` nunca teve efeito visual no coração.
   *
   * Este símbolo é o mesmo path sem o segundo subpath (o furo), então as duas
   * formas coincidem pixel a pixel — o que permite sobrepô-las e animar o
   * preenchimento por dentro. Ver `WishlistButton`.
   */
  | "favorite-filled"
  | "home_pin"
  | "call"
  | "local_shipping"
  | "pan_zoom"
  | "share"
  | "sell"
  | "check-circle"
  | "error"
  | "trash";

interface Props extends React.SVGAttributes<SVGSVGElement> {
  /**
   * Symbol id from element to render. Take a look at `/static/icons.svg`.
   *
   * Example: <Icon id="search" />
   */
  id: AvailableIcons;
  size?: number;
}

function Icon({ id, size = 24, width, height, ...otherProps }: Props) {
  return (
    <svg {...otherProps} width={width ?? size} height={height ?? size}>
      <use href={`/sprites.svg#${id}`} />
    </svg>
  );
}

export default Icon;
