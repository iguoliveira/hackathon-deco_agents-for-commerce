/**
 * Finalizar a compra e listar pedidos.
 *
 * **A identidade vem de `readShopperIdentity` — a sessão verificada pelo
 * Shopify — e nunca de `donoDaVitrine()`**, mesmo sendo esta a mais
 * conveniente. `donoDaVitrine` cai no nosso cookie assinado quando não há
 * sessão, e aquele cookie prova que *nós* o emitimos, não que quem o apresenta
 * é a pessoa. O comentário em `shelf.identity.ts` já delimita: serve para uma
 * vitrine de recomendação, não serve para "qualquer coisa com dado de pedido".
 *
 * A diferença de consequência é o que decide: forjar identidade numa vitrine
 * mostra a você as sugestões de outra pessoa; forjar num pedido **grava uma
 * compra no nome de outra pessoa**.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest, getResponse } from "@tanstack/react-start/server";
import { readShopperIdentity } from "../alerts";
import { lerCarrinho, limparCarrinho } from "../cart/cart.cookie";
import { findCartLines } from "../catalog/catalog.d1";
import { criarPedido, pedidosDe } from "./orders.d1";
import type { Pedido } from "./orders.types";

export type ResultadoDaCompra =
  | { ok: true; pedidoId: string }
  | { ok: false; motivo: "sem-sessao" | "carrinho-vazio" | "indisponivel" | "falhou" };

/**
 * Cria o pedido a partir do carrinho atual.
 *
 * Não recebe **nada** do cliente, e isso é a regra de segurança inteira desta
 * ação: os itens saem do cookie, os preços saem do banco no mesmo instante, e o
 * e-mail sai da sessão. Aceitar preço do navegador deixaria qualquer pessoa
 * comprar por R$ 1; aceitar e-mail do corpo deixaria comprar no nome de outra.
 *
 * Não há pagamento. O pedido nasce `paid` porque não existe checkout neste
 * storefront, e **isso vai dito no slide** — fingir pipeline de compra é o tipo
 * de coisa que um jurado de e-commerce reconhece na hora.
 */
export const checkoutServerFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ResultadoDaCompra> => {
    const identidade = await readShopperIdentity(getRequest());
    if (!identidade?.email) return { ok: false, motivo: "sem-sessao" };

    const linhas = lerCarrinho(getRequest());
    if (linhas.length === 0) return { ok: false, motivo: "carrinho-vazio" };

    const registros = await findCartLines(linhas.map((l) => l.variantId));
    const quantidadePor = new Map(linhas.map((l) => [l.variantId, l.quantidade]));

    // Reconferido AGORA, não quando o item entrou no carrinho. Entre adicionar
    // e finalizar pode ter passado uma semana — é o TTL do cookie.
    const disponiveis = registros.filter((r) => r.available);
    if (disponiveis.length === 0) return { ok: false, motivo: "indisponivel" };

    const pedidoId = await criarPedido(
      identidade.email,
      disponiveis.map((registro) => ({
        variantId: registro.variantId,
        quantidade: quantidadePor.get(registro.variantId) ?? 1,
        precoUnitario: registro.price,
        // Com a cor, porque é o que a pessoa viu — e o título no catálogo muda.
        titulo: registro.variantTitle
          ? `${registro.productTitle} (${registro.variantTitle})`
          : registro.productTitle,
      })),
    );

    if (!pedidoId) return { ok: false, motivo: "falhou" };

    // Só limpa depois de gravar. Limpar antes perderia o carrinho se o INSERT
    // falhasse, e a pessoa não teria como tentar de novo.
    getResponse()?.headers.append("Set-Cookie", limparCarrinho());

    return { ok: true, pedidoId };
  },
);

/** Os pedidos de quem está logado. Lista vazia para quem não está. */
export const listarPedidosServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Pedido[]> => {
    const identidade = await readShopperIdentity(getRequest());
    if (!identidade?.email) return [];
    return pedidosDe(identidade.email);
  },
);

/** Se há sessão — o botão da sacola usa isto para escolher o rótulo. */
export const temSessaoServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => !!(await readShopperIdentity(getRequest()))?.email,
);
