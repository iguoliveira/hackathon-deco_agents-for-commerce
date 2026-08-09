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
import { lerCarrinho, limparCarrinho, serializarCarrinho } from "../cart/cart.cookie";
import { findCartLines } from "../catalog/catalog.d1";
import { criarPedido, pedidosDe } from "./orders.d1";
import type { Pedido } from "./orders.types";

export type ResultadoDaCompra =
  | {
      ok: true;
      pedidoId: string;
      /**
       * Variantes que estavam no carrinho e **não** entraram no pedido —
       * esgotaram ou sumiram do catálogo entre a renderização e o clique.
       *
       * Elas continuam na sacola; isto existe para a tela poder dizer que
       * aconteceu, em vez de a pessoa descobrir contando os itens do recibo.
       */
      removidos: string[];
    }
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

    // O que NÃO entra no pedido. Duas causas, e as duas somem do mesmo jeito se
    // ninguém olhar: a variante esgotou, ou ela sumiu do catálogo (um seed a
    // apagou) e nem voltou de `findCartLines`.
    //
    // Antes daqui, essas linhas eram descartadas em silêncio: o pedido nascia
    // com dois itens de três, devolvia `ok: true`, e o carrinho — único registro
    // do que a pessoa tinha escolhido — era zerado logo depois. Ela não tinha
    // como descobrir o que sumiu.
    //
    // O botão do minicart já desabilita com item esgotado, então o caso só é
    // alcançável quando a peça esgota ENTRE a renderização e o clique. É a
    // corrida que esta reconferência existe para pegar — e perder o registro
    // dela justamente aqui seria perder o único caso que ela cobre.
    const compradosAgora = new Set(disponiveis.map((r) => r.variantId));
    const naoEntraram = linhas.filter((l) => !compradosAgora.has(l.variantId));

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

    // Só mexe no cookie depois de gravar. Antes perderia o carrinho se o INSERT
    // falhasse, e a pessoa não teria como tentar de novo.
    //
    // E **preserva** o que não entrou, em vez de limpar tudo: assim a peça que
    // esgotou continua na sacola, marcada em vermelho pelo `available === false`
    // que o `Minicart` já trata. A pessoa vê o que ficou de fora sem precisar de
    // tela nova, e pode remover ou esperar voltar.
    getResponse()?.headers.append(
      "Set-Cookie",
      naoEntraram.length > 0 ? serializarCarrinho(naoEntraram) : limparCarrinho(),
    );

    return {
      ok: true,
      pedidoId,
      // Os handles ficam de fora de propósito: quem chama é a sacola, que já
      // tem os itens em mãos. Devolver ids basta para ela decidir se avisa.
      removidos: naoEntraram.map((l) => l.variantId),
    };
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
