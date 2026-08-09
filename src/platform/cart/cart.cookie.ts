/**
 * O carrinho mora num cookie: `[[variantId, quantidade], ...]`.
 *
 * Sem tabela e sem sessão, por três motivos:
 *
 *   1. **Carrinho é efêmero.** Uma tabela exigiria dono, e dono exigiria login
 *      — o que impediria montar o carrinho antes de entrar, que é justamente o
 *      percurso normal.
 *   2. **Só o pedido é histórico.** É ele que precisa sobreviver, e é ele que
 *      vai para o banco. Ver `orders` / `order_items`.
 *   3. É o padrão que o repositório já usa para `deco_wishlist` e
 *      `deco_recent`, e repetir um padrão conhecido custa menos que inventar.
 *
 * **Guarda id e quantidade, nada mais.** Sem preço, sem título, sem foto: tudo
 * isso é resolvido a cada leitura por `findCartLines`. Um snapshot no cookie
 * ficaria mostrando o catálogo de ontem — e não é hipótese, é o que aconteceu
 * quando 47 fotos e 9 cores mudaram numa tarde.
 *
 * Não é assinado, ao contrário de `shelf.cookie.ts`. Aqui não há o que forjar:
 * o cookie não carrega identidade, e mexer nele só muda o próprio carrinho de
 * quem mexeu. A identidade entra uma única vez, no fim — e vem da sessão
 * verificada, nunca daqui.
 */

export const CART_COOKIE = "deco_cart";

/** 7 dias. Carrinho que dura um mês vira lixo; um que dura uma hora frustra. */
const TTL_SEGUNDOS = 60 * 60 * 24 * 7;

/** Teto de linhas distintas. Cookie tem limite de ~4KB e nada aqui justifica chegar perto. */
const MAX_LINHAS = 40;

/** Teto por linha — segura engano de clique, não regra de negócio. */
const MAX_POR_LINHA = 20;

export interface LinhaDoCarrinho {
  variantId: string;
  quantidade: number;
}

const ler = (req: Request | undefined, nome: string): string | null => {
  const header = req?.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${nome}=`));
  return match ? decodeURIComponent(match.slice(nome.length + 1)) : null;
};

/**
 * As linhas do carrinho. Nunca lança.
 *
 * Cookie corrompido, de outra versão do formato, ou com tipo errado vira
 * carrinho vazio — que é o mesmo que um visitante novo. Lançar aqui derrubaria
 * o header do site inteiro, porque a sacola é renderizada em toda página.
 */
export const lerCarrinho = (req: Request | undefined): LinhaDoCarrinho[] => {
  const cru = ler(req, CART_COOKIE);
  if (!cru) return [];

  try {
    const dados = JSON.parse(cru);
    if (!Array.isArray(dados)) return [];

    return dados
      .filter(
        (par): par is [string, number] =>
          Array.isArray(par) && typeof par[0] === "string" && typeof par[1] === "number",
      )
      .map(([variantId, quantidade]) => ({
        variantId,
        quantidade: Math.min(Math.max(Math.trunc(quantidade), 1), MAX_POR_LINHA),
      }))
      .slice(0, MAX_LINHAS);
  } catch {
    return [];
  }
};

/**
 * O `Set-Cookie` do carrinho.
 *
 * `HttpOnly` de propósito: nada no cliente precisa ler este cookie — a sacola
 * recebe o `CartState` já resolvido pela server function. Deixá-lo legível por
 * JavaScript só abriria uma segunda fonte da verdade para o mesmo dado.
 *
 * Escrito sempre pelo servidor, nunca por `document.cookie`: o Safari limita a
 * 7 dias os cookies escritos por JS, e o carrinho perderia o prazo sem aviso.
 */
export const serializarCarrinho = (linhas: LinhaDoCarrinho[]): string => {
  const pares = linhas.slice(0, MAX_LINHAS).map(({ variantId, quantidade }) => [
    variantId,
    Math.min(Math.max(Math.trunc(quantidade), 1), MAX_POR_LINHA),
  ]);

  const valor = encodeURIComponent(JSON.stringify(pares));
  return `${CART_COOKIE}=${valor}; Path=/; Max-Age=${TTL_SEGUNDOS}; HttpOnly; SameSite=Lax`;
};

/** Apaga o carrinho — usado quando o pedido é criado. */
export const limparCarrinho = (): string =>
  `${CART_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

/**
 * Soma uma quantidade a uma linha, criando-a se não existir.
 *
 * Somar em vez de substituir: adicionar duas vezes o mesmo tamanho é a pessoa
 * querendo dois, não corrigindo o primeiro clique. A linha vai para o FIM
 * quando é nova e fica no lugar quando já existia — reordenar a sacola por
 * causa de um "+1" faz o item parecer outro.
 */
export const somar = (
  linhas: LinhaDoCarrinho[],
  variantId: string,
  quantidade: number,
): LinhaDoCarrinho[] => {
  const existente = linhas.find((l) => l.variantId === variantId);
  if (!existente) return [...linhas, { variantId, quantidade }];

  return linhas.map((l) =>
    l.variantId === variantId ? { ...l, quantidade: l.quantidade + quantidade } : l,
  );
};

/** Define a quantidade de uma linha. Zero ou menos remove. */
export const definir = (
  linhas: LinhaDoCarrinho[],
  variantId: string,
  quantidade: number,
): LinhaDoCarrinho[] =>
  quantidade <= 0
    ? linhas.filter((l) => l.variantId !== variantId)
    : linhas.map((l) => (l.variantId === variantId ? { ...l, quantidade } : l));
