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
 * As duas entram como a mesma origem, `wishlist`, e **nenhuma vale mais que a
 * outra**: não há peso aqui, nem entre as fontes nem dentro delas. O que a do
 * banco tem a mais é a data em que cada favorito foi feito, e é só nisso que ela
 * é preferida — ver o filtro em `colherSementes`.
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
import {
  comprasDe,
  favoritosDe,
  sementesPorHandle,
  sementesPorVariante,
  tagsDeProdutos,
} from "./look.d1";
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
 * Quantos favoritos o banco devolve. **Também não é teto de prompt** — pelo
 * mesmo motivo que o de cima deixou de ser: a passada 1 quer o armário inteiro.
 *
 * É um limite de consulta, e existe porque uma wishlist não tem tamanho máximo:
 * sem `LIMIT`, uma pessoa com trezentos favoritos traria trezentas linhas com
 * tags para dentro do caminho de uma PDP. Doze é o mesmo número dos esperados,
 * e por nenhuma razão mais nobre que a de não inventar um segundo número sem
 * medida para justificá-lo.
 *
 * O corte é pelos **mais recentes** (`ORDER BY created_at DESC` em
 * `favoritosDe`), que é a única ordem que o dado permite sem julgar os sinais.
 */
const LIMITE_DE_FAVORITOS = 12;

/**
 * As sementes de quem está fazendo esta requisição.
 *
 * `email` é opcional porque **duas fontes não precisam de identidade**: o cookie
 * de favoritos e o de vistos. Um visitante deslogado que favoritou três peças
 * tem um look pessoal, e isso é o que faz o momento da demo funcionar sem login.
 * Com sessão, `wishlist_items` entra **ao lado** do cookie e o favorito
 * sobrevive à troca de dispositivo.
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
  const [comprados, esperados, favoritadosNoBanco, favoritadosNoCookie, olhados] =
    await Promise.all([
      email ? comprasDe(email) : Promise.resolve([]),
      email ? findWaitedItems(email, LIMITE_DE_ESPERADOS) : Promise.resolve([]),
      email ? favoritosDe(email, LIMITE_DE_FAVORITOS) : Promise.resolve([]),
      sementesPorVariante(favoritos, "wishlist", agora),
      sementesPorHandle(vistos, "recent", agora),
    ]);

  // As tags dos "avise-me", numa consulta a mais e só quando há esperados.
  //
  // Antes iam vazias, com o argumento de que a consulta extra não valia a pena e
  // a consequência era limitada — uma peça só esperada não contribuía para
  // `combinaComOGuardaRoupa`. **O argumento caiu.** Na vitrine sem âncora o
  // desejo alimenta `combinaComOQueQuer`, que é metade do único eixo entre
  // produto e pessoa, e medido nos armários semeados — cujo desejo vem só de
  // "avise-me" — o campo dava zero em 127 produtos. Sinal ausente, não fraco.
  const tagsDosEsperados = await tagsDeProdutos(esperados.map((item) => item.productGroupId));

  const esperadasComoSemente: Semente[] = esperados.map((item) => ({
    productGroupId: item.productGroupId,
    titulo: item.title,
    tipo: item.productType,
    tags: tagsDosEsperados.get(item.productGroupId) ?? [],
    kinds: ["waited" as const],
    em: item.waitedAt,
  }));

  // **O cookie não carimba data em peça que já tem data de verdade.**
  //
  // `consolidar` une as origens e fica com o `em` MAIS RECENTE. O cookie não
  // guarda quando cada favorito foi feito — `sementesPorVariante` carimba
  // `agora` em todos —, e `agora` vence qualquer data real por construção. A
  // peça subiria ao topo da ordem cronológica com uma data inventada,
  // empurrando para baixo sinais que de fato aconteceram depois dela.
  //
  // **As três fontes com data real entram no cruzamento, não só a do banco.**
  // A primeira versão disto olhava apenas `favoritadosNoBanco`, e cobria uma
  // das três colisões possíveis: uma compra de maio favoritada no cookie
  // chegava ao prompt como o sinal mais recente da pessoa, na frente de uma
  // compra de agosto. `comprados` e `esperadasComoSemente` também trazem data,
  // e também eram atropeladas.
  //
  // **A entrada do cookie herda a data real em vez de ser descartada.** Filtrar
  // resolveria a ordem, mas ao custo do `kinds`: a peça perderia a origem
  // `wishlist`, e "comprou e favoritou" viraria só "comprou" — exatamente a
  // informação que a #26 ganhou ao parar de eleger vencedora entre origens.
  // Herdando, as duas coisas sobrevivem: `consolidar` funde os `kinds` e o `em`
  // continua sendo o que aconteceu de verdade.
  //
  // Isto não restaura hierarquia entre fontes: nenhuma vence outra por ser mais
  // "forte". O cookie cede num ponto só, o da data, e por ser o único que não a
  // tem. Um favorito que exista **apenas** no cookie segue com `agora`, que é a
  // melhor aproximação disponível para ele.
  const cookieSemDataInventada = herdarDataReal(favoritadosNoCookie, [
    ...comprados,
    ...esperadasComoSemente,
    ...favoritadosNoBanco,
  ]);

  return consolidar([
    ...comprados,
    ...esperadasComoSemente,
    ...favoritadosNoBanco,
    ...cookieSemDataInventada,
    ...olhados,
  ]);
};

/**
 * Troca o `agora` das sementes de cookie pela data verdadeira da mesma peça,
 * quando alguma fonte com data a conhece.
 *
 * Exportada para ser testável: a lógica vive no meio de `colherSementes`, que
 * precisa de request e de banco, e o defeito que ela conserta é silencioso —
 * ordem errada não lança, não aparece em `typecheck` e só se manifesta num
 * prompt que ninguém lê.
 *
 * `datadas` deve conter **todas** as fontes que trazem `em` real. Passar só uma
 * delas foi o bug original: cobria `wishlist ∩ cookie` e deixava
 * `purchased ∩ cookie` e `waited ∩ cookie` intactas.
 */
export const herdarDataReal = (
  doCookie: readonly Semente[],
  datadas: readonly Semente[],
): Semente[] => {
  if (doCookie.length === 0) return [];

  const maisRecentePorProduto = new Map<string, string>();
  for (const semente of datadas) {
    const atual = maisRecentePorProduto.get(semente.productGroupId);
    if (!atual || semente.em > atual) maisRecentePorProduto.set(semente.productGroupId, semente.em);
  }

  return doCookie.map((semente) => {
    const real = maisRecentePorProduto.get(semente.productGroupId);
    return real ? { ...semente, em: real } : semente;
  });
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
