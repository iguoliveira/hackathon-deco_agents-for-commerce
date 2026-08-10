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
import { diaDeHoje, gerarVitrine } from "../vitrine/vitrine.actions";
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

    // A compra é o sinal mais forte que existe, e o único que muda o armário de
    // POSSE. Recompor aqui é o que impede a vitrine de recomendar, pelo resto do
    // dia, a partir de um armário que a pessoa acabou de deixar para trás.
    recomporVitrine(identidade.email);

    return {
      ok: true,
      pedidoId,
      // Os handles ficam de fora de propósito: quem chama é a sacola, que já
      // tem os itens em mãos. Devolver ids basta para ela decidir se avisa.
      removidos: naoEntraram.map((l) => l.variantId),
    };
  },
);

/**
 * Recompõe a vitrine depois de uma compra. **Sem `await`, e forçando.**
 *
 * Mesmo padrão de `notifyMe/subscribe.ts`, com o mesmo argumento e o mesmo
 * preço — mas por um gatilho mais forte. Lá a pessoa declarou que **quer** uma
 * peça; aqui ela **passou a ter** uma, e `purchased` é a única origem que
 * significa posse. `comprasDe` já lê `order_items`, então o pedido gravado
 * acima muda as sementes na próxima leitura, e a persona é re-sintetizada por
 * consequência (`obterPersona` cacheia por hash dos sinais).
 *
 * **`forcar = true`, e isto merece defesa** porque o comentário de `gerarVitrine`
 * diz que só o `vitrine:refresh` deveria passar `true`. Sem forçar, a chamada
 * encontraria a vitrine de hoje no cache e devolveria a antiga — que é
 * exatamente a que acabou de ficar obsoleta. A regra existe para o disparo da
 * home, que roda a cada pageview e faria a chave diária perder o sentido; uma
 * compra acontece poucas vezes por dia e **é o evento que justifica recompor**.
 * Não fura o teto por acidente: fura pelo motivo pelo qual o teto tem exceção.
 *
 * **Deliberadamente sem `await`.** São ~90s em duas passadas de modelo, e quem
 * clicou está esperando "pedido confirmado", não vitrine nenhuma.
 *
 * Melhor esforço, e vale dizer o que se perde: sem `waitUntil` a plataforma pode
 * congelar a invocação quando a resposta sai, matando a geração no meio. O custo
 * disso aqui é menor que no `notifyMe` — a vitrine do dia continua servindo, só
 * sem refletir a compra até a próxima recomposição. Nada quebra; fica velha.
 *
 * Nunca lança: o pedido já está gravado e a pessoa já recebeu o sucesso dela.
 * Uma falha de telemetria não pode derrubar um checkout que deu certo.
 */
function recomporVitrine(email: string): void {
  void gerarVitrine(email, diaDeHoje(), true).catch((erro) => {
    console.error(`[orders] falha ao recompor a vitrine de ${email}:`, erro);
  });
}

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
