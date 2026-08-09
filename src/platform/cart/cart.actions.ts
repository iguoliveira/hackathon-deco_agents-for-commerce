/**
 * O carrinho, contra o catálogo local.
 *
 * Era Shopify (`addItems`/`getCart` de `@decocms/apps-shopify`) e não podia
 * continuar sendo: o catálogo migrou para o Postgres, e um
 * `gid://catalog/Variant/909100` não existe do lado de lá. O botão de comprar
 * simplesmente não tinha o que chamar.
 *
 * A troca não encosta na interface. `CartState` e `CartItem` já eram neutros —
 * sem um tipo do Shopify sequer —, e `cart.hooks.ts`, `Minicart`, `Bag` e
 * `ProductActions` só conhecem esses dois. Todo o acoplamento estava confinado
 * aqui e em `cart.shopify.ts`, que sai junto.
 *
 * **O estado mora no cookie e o conteúdo é resolvido a cada leitura.** Ver
 * `cart.cookie.ts` para o porquê de não haver tabela, e `findCartLines` para o
 * porquê de não haver snapshot.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest, getResponse } from "@tanstack/react-start/server";
import { findCartLines } from "../catalog/catalog.d1";
import {
  definir,
  lerCarrinho,
  serializarCarrinho,
  somar,
  type LinhaDoCarrinho,
} from "./cart.cookie";
import { EMPTY_CART, type CartItem, type CartState } from "./cart.types";

/**
 * Monta o `CartState` a partir das linhas do cookie.
 *
 * `lineId` é o próprio `variantId`. No Shopify a linha tinha id próprio porque
 * a mesma variante podia aparecer duas vezes com atributos diferentes; aqui
 * não pode — `somar` funde por variante —, então um segundo identificador seria
 * cerimônia sem função.
 *
 * Linha cujo `variantId` sumiu do catálogo é descartada em silêncio: o produto
 * deixou de existir, e não há tela honesta para "um item que não existe mais".
 * É diferente de esgotado, que aparece marcado.
 */
const montarEstado = async (linhas: LinhaDoCarrinho[]): Promise<CartState> => {
  if (linhas.length === 0) return EMPTY_CART;

  const registros = await findCartLines(linhas.map((l) => l.variantId));
  const quantidadePor = new Map(linhas.map((l) => [l.variantId, l.quantidade]));

  const items: CartItem[] = registros.map((registro) => ({
    lineId: registro.variantId,
    merchandiseId: registro.variantId,
    // O título da variante é o tamanho ("M"); sozinho não diz o que é a peça.
    title: registro.productTitle,
    variantTitle: registro.variantTitle,
    productHandle: registro.productHandle,
    image: registro.imageUrl
      ? { url: registro.imageUrl, alt: registro.imageAlt || registro.productTitle }
      : undefined,
    price: { amount: registro.price, currencyCode: registro.currencyCode },
    compareAtPrice:
      registro.compareAtPrice != null
        ? { amount: registro.compareAtPrice, currencyCode: registro.currencyCode }
        : undefined,
    quantity: quantidadePor.get(registro.variantId) ?? 1,
    available: registro.available,
  }));

  const moeda = items[0]?.price.currencyCode ?? EMPTY_CART.total.currencyCode;
  const soma = items.reduce((total, item) => total + item.price.amount * item.quantity, 0);

  return {
    id: items.length > 0 ? "local" : null,
    items,
    subtotal: { amount: soma, currencyCode: moeda },
    // Sem frete, sem cupom e sem imposto neste storefront: total é a soma. Se
    // algum dia houver desconto, é aqui que ele entra — e `subtotal` deixa de
    // ser igual.
    total: { amount: soma, currencyCode: moeda },
    // Não existe checkout externo. Quem finaliza é a nossa própria ação, que
    // exige sessão — ver `orders`.
    checkoutUrl: null,
    totalQuantity: items.reduce((n, item) => n + item.quantity, 0),
  };
};

/** Lê o cookie da requisição atual e devolve as linhas. */
const linhasAtuais = (): LinhaDoCarrinho[] => lerCarrinho(getRequest());

/** Grava as linhas na resposta atual e monta o estado de volta. */
const gravar = async (linhas: LinhaDoCarrinho[]): Promise<CartState> => {
  getResponse()?.headers.append("Set-Cookie", serializarCarrinho(linhas));
  return montarEstado(linhas);
};

export const getCartServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CartState> => montarEstado(linhasAtuais()),
);

export const addItemServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { merchandiseId: string; quantity?: number }) => input)
  .handler(async (ctx): Promise<CartState> => {
    const variantId = ctx.data.merchandiseId?.trim();
    if (!variantId) return montarEstado(linhasAtuais());

    // Esgotado não entra. A checagem é do banco, na hora — o botão pode ter
    // sido renderizado minutos atrás, e uma página com TTL longo mostraria um
    // "adicionar" que já não vale.
    const [registro] = await findCartLines([variantId]);
    if (!registro?.available) return montarEstado(linhasAtuais());

    return gravar(somar(linhasAtuais(), variantId, Math.max(1, ctx.data.quantity ?? 1)));
  });

export const updateItemQuantityServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { lineId: string; quantity: number }) => input)
  .handler(
    async (ctx): Promise<CartState> =>
      gravar(definir(linhasAtuais(), ctx.data.lineId, ctx.data.quantity)),
  );

export const removeItemServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { lineId: string }) => input)
  .handler(async (ctx): Promise<CartState> => gravar(definir(linhasAtuais(), ctx.data.lineId, 0)));
