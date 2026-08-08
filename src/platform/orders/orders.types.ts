/**
 * O que a tela de pedidos consome. Nada acima daqui sabe que existe banco.
 *
 * Repare no que **não** está aqui: tipo, tags, coleção, disponibilidade. Um
 * pedido é um recibo — ele conta o que aconteceu, com os valores daquele
 * momento. Quem precisa saber o que a peça É hoje faz JOIN com o catálogo, e
 * quem faz isso é o agente (`comprasDe`), não esta tela.
 */

export type StatusDoPedido = "paid" | "cancelled";

export interface ItemDoPedido {
  variantId: string;
  /** O handle serve só para linkar de volta à PDP. */
  productHandle: string | null;
  /** Congelado: o nome como a pessoa viu ao comprar. */
  titulo: string;
  quantidade: number;
  /** Congelado: o preço unitário pago. */
  precoUnitario: number;
  /**
   * Resolvida do catálogo na leitura, e por isso opcional: se o produto saiu do
   * ar, o pedido continua existindo e a linha aparece sem foto. Um recibo não
   * pode sumir porque uma imagem sumiu.
   */
  imagem?: { url: string; alt: string };
}

export interface Pedido {
  id: string;
  status: StatusDoPedido;
  /** Soma paga, congelada. Não é recalculada a partir dos itens. */
  total: number;
  /** ISO 8601 em UTC, como o resto do banco. */
  criadoEm: string;
  itens: ItemDoPedido[];
}
