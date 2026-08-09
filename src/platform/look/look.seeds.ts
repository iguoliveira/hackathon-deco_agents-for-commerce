/**
 * As sementes: tudo o que a pessoa já declarou querer, numa lista só.
 *
 *   comprou    orders + order_items
 *   avise-me   stock_alerts      o sinal mais forte que a loja recebe de graça
 *   favoritou  wishlist_items (logado) ∪ cookie deco_wishlist (todos)
 *   viu        cookie deco_recent
 *
 * **A wishlist tem duas casas, e as duas contam.** O cookie sempre existiu e é o
 * que dá look pessoal a quem não entrou; `wishlist_items` é onde o favorito
 * passa a morar quando há sessão. Ler só o cookie deixava de fora exatamente
 * quem se identificou — e é essa a pessoa que a feature atende (ver o recorte no
 * topo de docs/agente-de-combinacoes.md).
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
import { comprasDe, favoritosDe, sementesPorHandle, sementesPorVariante } from "./look.d1";
import { lerVistos } from "./look.cookies";
import type { Semente, SeedKind } from "./look.types";

/**
 * Quantas sementes chegam ao prompt.
 *
 * Não é economia de token à toa: acima disso o modelo começa a compor "para
 * todo mundo" — dez sinais de tipos diferentes descrevem um guarda-roupa, não
 * uma pessoa montando uma roupa. Melhor cortar por força e recência, em código,
 * do que deixar o modelo cortar por posição.
 */
const MAX_SEMENTES = 6;

/**
 * Peso de cada origem no desempate. Reflete o que cada sinal custou a quem o
 * emitiu, e essa é a única ordenação que o sistema faz sobre sementes.
 *
 * `purchased` na frente porque é o único que custou dinheiro. `recent` por
 * último porque olhar não é querer — entra para dar contexto quando não há
 * nada melhor, e sai do caminho assim que houver.
 */
const FORCA: Record<SeedKind, number> = {
  purchased: 4,
  waited: 3,
  wishlist: 2,
  recent: 1,
};

/**
 * As sementes de quem está fazendo esta requisição.
 *
 * `email` é opcional porque **duas fontes não precisam de identidade**: o cookie
 * de favoritos e o de vistos. Um visitante deslogado que favoritou três peças
 * tem um look pessoal, e isso é o que faz o momento da demo funcionar sem login.
 * Com sessão, `wishlist_items` entra por cima e o favorito sobrevive à troca de
 * dispositivo.
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

  // As cinco em paralelo: são independentes, e serializá-las somaria cinco idas
  // ao banco no caminho de uma PDP.
  //
  // A wishlist aparece duas vezes de propósito — ela tem duas casas. O cookie
  // atende quem não está logado e sempre existiu; `wishlist_items` é onde o
  // favorito passa a morar quando há sessão. Ler só o cookie deixava de fora
  // justamente quem se identificou.
  const [comprados, esperados, favoritadosNoBanco, favoritadosNoCookie, olhados] = await Promise.all(
    [
      email ? comprasDe(email) : Promise.resolve([]),
      email ? findWaitedItems(email, MAX_SEMENTES) : Promise.resolve([]),
      email ? favoritosDe(email, MAX_SEMENTES) : Promise.resolve([]),
      sementesPorVariante(favoritos, "wishlist", agora),
      sementesPorHandle(vistos, "recent", agora),
    ],
  );

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
    kind: "waited" as const,
    em: item.waitedAt,
  }));

  // **O banco vem antes do cookie, e a ordem é a decisão.** `consolidar` fica com
  // a PRIMEIRA semente de cada produto quando as forças empatam — e as duas
  // fontes de favorito produzem `kind: "wishlist"`, então empatam sempre. A do
  // banco carrega o `created_at` verdadeiro; a do cookie carrega `agora` para
  // tudo. Invertendo, a mesma peça favoritada nas duas casas entraria com data
  // falsa e o desempate por recência viraria sorteio.
  return consolidar([
    ...comprados,
    ...esperadasComoSemente,
    ...favoritadosNoBanco,
    ...favoritadosNoCookie,
    ...olhados,
  ]);
};

/**
 * Deduplica por produto e ordena por força, depois por recência.
 *
 * **A mesma peça pode chegar por dois caminhos** — favoritar e depois comprar é
 * o percurso normal, não a exceção —, e nesse caso a origem mais forte é a que
 * fica. Sem isto o mesmo produto ocuparia duas das seis vagas e empurraria para
 * fora um sinal genuinamente diferente.
 */
export const consolidar = (todas: Semente[]): Semente[] => {
  const porProduto = new Map<string, Semente>();

  for (const semente of todas) {
    const atual = porProduto.get(semente.productGroupId);
    if (!atual || FORCA[semente.kind] > FORCA[atual.kind]) {
      porProduto.set(semente.productGroupId, semente);
    }
  }

  return [...porProduto.values()]
    .sort((a, b) => FORCA[b.kind] - FORCA[a.kind] || b.em.localeCompare(a.em))
    .slice(0, MAX_SEMENTES);
};
