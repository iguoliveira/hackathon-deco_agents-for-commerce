/**
 * As sementes: tudo o que a pessoa já declarou querer, numa lista só.
 *
 *   comprou    orders            (semeada para as personas — dito no slide)
 *   avise-me   stock_alerts      o sinal mais forte que a loja recebe de graça
 *   favoritou  cookie deco_wishlist
 *   viu        cookie deco_recent
 *
 * **Três das quatro já estavam persistidas e ninguém as lia como semente.** Era
 * o buraco que fazia o agente da vitrine depender de um único sinal — e o
 * diagnóstico "só entra quem clicou num produto esgotado" já estava escrito em
 * docs/feature-back-in-stock-shelf.md.
 *
 * Nada aqui lança. Cada fonte que falhar contribui com zero semente, e o agente
 * trabalha com o que sobrou: um look só com favoritos ainda é pessoal.
 */

import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { readWishlistCookie } from "../../loaders/_cookie";
import { findWaitedItems } from "../alerts";
import { comprasDe, sementesPorHandle, sementesPorVariante } from "./look.d1";
import { lerVistos } from "./look.cookies";
import type { Semente } from "./look.types";

/**
 * Quantos "avise-me" o banco devolve. **Não é o teto do prompt** — é o limite da
 * consulta, e ele existe porque `findWaitedItems` sempre pediu um.
 *
 * O teto do prompt caiu. Ele dizia:
 *
 *   > "acima disso o modelo começa a compor 'para todo mundo' — dez sinais de
 *   > tipos diferentes descrevem um guarda-roupa, não uma pessoa montando uma
 *   > roupa"
 *
 * O diagnóstico estava certo e a conclusão era de composição. Descrever o
 * guarda-roupa é exatamente o que a síntese da persona quer, então separar as
 * duas tarefas tira a razão de cortar: a passada 1 recebe o armário inteiro, a
 * passada 2 recebe um retrato compacto. Ver docs/persona-do-guarda-roupa.md §4.
 */
const LIMITE_DE_ESPERADOS = 12;

/**
 * As sementes de quem está fazendo esta requisição.
 *
 * `email` é opcional porque **duas das quatro fontes não precisam de
 * identidade**: favoritos e vistos são cookies de primeira parte. Um visitante
 * deslogado que favoritou três peças tem um look pessoal, e isso é o que faz o
 * momento da demo funcionar sem login.
 *
 * A identidade nunca vem por parâmetro de quem chama de fora — mesma regra de
 * `notifyMe/subscribe.ts` ("a sessão vence o e-mail do corpo"). Aqui ela vem de
 * `donoDaVitrine()`, que resolve sessão antes de cookie assinado.
 */
export const colherSementes = async (email: string | null): Promise<Semente[]> => {
  const request = RequestContext.current?.request;
  const agora = new Date().toISOString();

  // Fora de um contexto de request (build, preview do editor) não há cookie, e
  // `readWishlistCookie` lê `req.headers` direto — chamá-lo com `undefined`
  // lançaria dentro de um loader, que é exatamente o que este domínio não pode
  // fazer. Sem request, as duas fontes de cookie contribuem zero.
  const favoritos = request ? readWishlistCookie(request).productIDs : [];
  const vistos = lerVistos(request);

  // As quatro em paralelo: são independentes, e serializá-las somaria quatro
  // idas ao banco no caminho de uma PDP.
  const [comprados, esperados, favoritados, olhados] = await Promise.all([
    email ? comprasDe(email) : Promise.resolve([]),
    email ? findWaitedItems(email, LIMITE_DE_ESPERADOS) : Promise.resolve([]),
    sementesPorVariante(favoritos, "wishlist", agora),
    sementesPorHandle(vistos, "recent", agora),
  ]);

  const esperadasComoSemente: Semente[] = esperados.map((item) => ({
    productGroupId: item.productGroupId,
    titulo: item.title,
    tipo: item.productType,
    // Vazio: `WaitedItem` não carrega tags, e buscá-las custaria uma consulta a
    // mais no caminho da PDP. A consequência é limitada e vale dizer qual: uma
    // peça que só foi ESPERADA não contribui para `combinaComOGuardaRoupa` —
    // ela ainda chega ao modelo com título e tipo, como antes. Compras e
    // favoritos, que são posse ou intenção declarada, trazem as tags.
    tags: [],
    kinds: ["waited" as const],
    em: item.waitedAt,
  }));

  return consolidar([...comprados, ...esperadasComoSemente, ...favoritados, ...olhados]);
};

/**
 * Agrupa por produto, **unindo** as origens. Sem teto e sem pesos.
 *
 * A mesma peça chega por dois caminhos o tempo todo — favoritar e depois comprar
 * é o percurso normal. A versão anterior escolhia a origem "mais forte" e
 * descartava a outra, e escolher exigia a tabela de pesos que nunca foi medida.
 * Unir dissolve a pergunta: *"comprou, e já tinha favoritado"* é mais informação
 * que qualquer um dos dois, e o modelo decide o que fazer com ela.
 *
 * As tags também se unem, pelo mesmo motivo prático: um "avise-me" chega sem
 * tags (`findWaitedItems` não as carrega) e a mesma peça vinda de uma compra
 * chega com elas. Ficar com a lista vazia por ordem de chegada empobreceria
 * `combinaComOGuardaRoupa` por acidente.
 *
 * A ordenação final é **cronológica, não hierárquica**: o mais recente primeiro,
 * o que é fato sobre os sinais e não julgamento sobre eles.
 */
export const consolidar = (todas: Semente[]): Semente[] => {
  const porProduto = new Map<string, Semente>();

  for (const semente of todas) {
    const atual = porProduto.get(semente.productGroupId);

    if (!atual) {
      porProduto.set(semente.productGroupId, { ...semente, kinds: [...semente.kinds] });
      continue;
    }

    for (const kind of semente.kinds) {
      if (!atual.kinds.includes(kind)) atual.kinds.push(kind);
    }
    atual.tags = [...new Set([...atual.tags, ...semente.tags])];
    // O `em` da semente é o sinal mais recente dela — é o que a ordenação usa.
    if (semente.em > atual.em) atual.em = semente.em;
  }

  return [...porProduto.values()].sort((a, b) => b.em.localeCompare(a.em));
};
