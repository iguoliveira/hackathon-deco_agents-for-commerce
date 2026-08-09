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
import { comprasDe, favoritosDe, sementesPorHandle, sementesPorVariante } from "./look.d1";
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

  // **O cookie não repete o que o banco já sabe.**
  //
  // `consolidar` une as origens e fica com o `em` MAIS RECENTE. O cookie não
  // guarda quando cada favorito foi feito, então `sementesPorVariante` carimba
  // `agora` em todos — e para uma peça favoritada nas duas casas esse carimbo é
  // sempre mais novo que o `created_at` verdadeiro. Ele venceria a comparação, e
  // a peça subiria ao topo da ordem cronológica com uma data inventada,
  // empurrando para baixo sinais que de fato aconteceram depois dela.
  //
  // Descartar a entrada do cookie não perde nada: é a mesma peça, com o mesmo
  // `kinds: ["wishlist"]`, só que com data pior. O filtro é por
  // `productGroupId` — a mesma chave por que `consolidar` agrupa —, então duas
  // variantes da mesma peça também não escapam.
  //
  // Isto não restaura hierarquia entre as fontes: nenhuma vence a outra por ser
  // mais "forte". O banco é preferido num ponto só, o da data, e por ser o único
  // dos dois que a tem.
  const jaVeioDoBanco = new Set(favoritadosNoBanco.map((s) => s.productGroupId));
  const cookieSemRepetir = favoritadosNoCookie.filter((s) => !jaVeioDoBanco.has(s.productGroupId));

  return consolidar([
    ...comprados,
    ...esperadasComoSemente,
    ...favoritadosNoBanco,
    ...cookieSemRepetir,
    ...olhados,
  ]);
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
