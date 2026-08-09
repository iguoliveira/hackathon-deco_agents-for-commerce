export interface CartItemPrice {
  amount: number;
  currencyCode: string;
}

export interface CartItem {
  /** Cart line ID — use for update/remove operations. */
  lineId: string;
  /** Merchandise/variant ID — what was added. */
  merchandiseId: string;
  title: string;
  /**
   * O rótulo da variante — o tamanho ("M"), ou a cor quando a peça não tem
   * tamanho. Separado de `title` porque a sacola precisa dos dois: o nome diz
   * o que é, o rótulo diz qual.
   */
  variantTitle?: string;
  productHandle: string;
  image?: { url: string; alt?: string };
  price: CartItemPrice;
  compareAtPrice?: CartItemPrice;
  quantity: number;
  /**
   * Se ainda dá para comprar. Um item que esgotou depois de entrar no carrinho
   * continua aparecendo, marcado — sumir em silêncio faz a pessoa achar que o
   * site comeu o pedido.
   */
  available?: boolean;
}

export interface CartState {
  id: string | null;
  items: CartItem[];
  subtotal: CartItemPrice;
  total: CartItemPrice;
  checkoutUrl: string | null;
  totalQuantity: number;
}

// BRL e não USD: o catálogo inteiro é `currency_code = 'BRL'`. Ficou USD da
// época do Shopify, e só não aparecia porque o carrinho vazio não mostra preço.
export const EMPTY_CART: CartState = {
  id: null,
  items: [],
  subtotal: { amount: 0, currencyCode: "BRL" },
  total: { amount: 0, currencyCode: "BRL" },
  checkoutUrl: null,
  totalQuantity: 0,
};
