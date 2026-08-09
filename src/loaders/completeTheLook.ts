import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { lookDaPeca } from "~/platform/look/look.actions";
import { acharAncora } from "~/platform/look/look.d1";
import { lerVistos, serializarVistos } from "~/platform/look/look.cookies";
import type { LookPersonalizado } from "~/platform/look/look.actions";

export interface Props {
  /**
   * @title Handle da peça
   * @description Deixe vazio na PDP: o handle é lido da URL. Preencher só serve para fixar uma peça numa página que não é de produto.
   */
  handle?: string;
  /**
   * URL real da página, injetada pelo framework. É a única fonte confiável do
   * slug aqui — ver `slugDaPagina` abaixo.
   * @ignore
   */
  __pageUrl?: string;
}

const PAGE_URL_HEADER = "x-deco-page-url";

/**
 * O slug da PDP, pela mesma precedência que `resolvePageUrl` usa em
 * `catalog.actions.ts:39` e `setup.ts:135`.
 *
 * **`RequestContext.request.url` não serve sozinho**, e aqui isso é mais grave
 * do que nos outros dois. Esta section é diferida: quem a resolve é
 * `loadDeferredSection`, num POST separado para `_serverFn`. Naquele momento a
 * requisição corrente é a do server function, não a da PDP — o último segmento
 * seria o nome da função, `acharAncora` não acharia linha, e a section sumiria
 * em silêncio, com a página em 200.
 *
 * `__pageUrl` é o caminho certo porque o framework o preenche justamente para
 * isto: `resolve.ts:867` faz `resolvedProps.__pageUrl = rctx.matcherCtx.url`, e
 * no caminho diferido o `matcherCtx.url` é `pageUrl || serverUrl` — a URL da
 * página que a pessoa está vendo.
 *
 * O `req` **não** é uma opção: `resolve.ts:911` chama o commerce loader com um
 * único argumento (`commerceLoader(resolvedProps)`), então o segundo parâmetro
 * que `setup.ts` repassa chega `undefined` neste caminho.
 */
const slugDaPagina = (pageUrlProp?: string): string | null => {
  const daUrl = (valor: string): string | null => {
    try {
      const partes = new URL(valor, "http://localhost").pathname.split("/").filter(Boolean);
      return partes.at(-1) ?? null;
    } catch {
      return null;
    }
  };

  try {
    const header = RequestContext.request.headers.get(PAGE_URL_HEADER);
    if (header) return daUrl(header);
  } catch {
    // RequestContext pode não existir em chamadas isoladas.
  }

  if (pageUrlProp) return daUrl(pageUrlProp);

  const request = RequestContext.current?.request;
  return request ? daUrl(request.url) : null;
};

/**
 * O caminho da página que a pessoa está vendo, ou `null` quando não dá para
 * saber. Mesma precedência de `slugDaPagina`, e pelos mesmos motivos.
 *
 * Separado em vez de reaproveitado porque as duas perguntas são diferentes:
 * aquela quer o ÚLTIMO segmento (a peça), esta quer o caminho INTEIRO.
 */
const caminhoDaPagina = (pageUrlProp?: string): string | null => {
  const daUrl = (valor: string): string | null => {
    try {
      return new URL(valor, "http://localhost").pathname;
    } catch {
      return null;
    }
  };

  try {
    const header = RequestContext.request.headers.get(PAGE_URL_HEADER);
    if (header) return daUrl(header);
  } catch {
    // RequestContext pode não existir em chamadas isoladas.
  }

  if (pageUrlProp) return daUrl(pageUrlProp);

  // Sem header e sem prop, NÃO caímos em `RequestContext.request.url`. No
  // caminho diferido aquela é a URL do `_serverFn`, não a da página — usá-la
  // aqui faria o guarda decidir sobre o caminho errado, e ele reprovaria a home.
  return null;
};

/**
 * A vitrine do agente só existe na home. Este é o guarda que sustenta isso.
 *
 * O decofile já a coloca só lá, mas isso é o estado de hoje: a section continua
 * registrada, e basta alguém adicioná-la a outra página pelo admin para ela
 * reaparecer onde não deve. O guarda transforma configuração em regra.
 *
 * **Falha ABERTO de propósito.** Quando o caminho não pode ser determinado
 * (`null`), a section renderiza. A alternativa — esconder na dúvida — troca um
 * risco por um pior: a section sumiria da própria home sem erro nenhum, com a
 * página em 200, que é a classe de falha silenciosa que já custou caro neste
 * repositório. Como o decofile hoje só a monta na home, falhar aberto não abre
 * buraco real; falhar fechado apagaria a feature.
 */
const ehHome = (caminho: string): boolean => caminho.replace(/\/+$/, "") === "";

/**
 * O look que o agente compõe em volta da peça aberta.
 *
 * O handle vem da URL e não de uma prop porque a section vive na PDP, e o
 * decofile é um só para todas as peças — uma prop obrigatória exigiria um bloco
 * por produto.
 *
 * Devolve `null` quando a peça não existe, quando não há candidatos suficientes
 * para compor, ou quando tudo o que o agente escolheu esgotou desde a geração.
 * A section some nos três casos, que é o comportamento certo: "complete o look"
 * com duas peças é pior que nenhum.
 *
 * **Este loader pode demorar na primeira visita de um contexto novo?** Não. O
 * agente é disparado sem `await` em `look.actions.ts` e a resposta sai com a
 * ordenação do SQL. Se algum dia isto passar a bloquear, é bug — ver a decisão
 * de latência em docs/agente-de-combinacoes.md §4.
 */
export default async function completeTheLookLoader(
  { handle, __pageUrl }: Props = {},
  _req?: Request,
): Promise<LookPersonalizado | null> {
  // O guarda vem ANTES de qualquer consulta: uma página que não é a home não
  // deve nem tocar o banco por causa desta section.
  const caminho = caminhoDaPagina(__pageUrl);
  if (caminho !== null && !ehHome(caminho)) return null;

  const daUrl = !handle;
  const slug = handle ?? slugDaPagina(__pageUrl);
  if (!slug) return null;

  // Canonicaliza o slug ANTES de compor, e não é gasto à toa. Duas coisas
  // dependem do handle real, não do que a URL trouxe:
  //
  //   1. `deco_recent` guarda handle — `sementesPorHandle` casa `p.handle`.
  //      Gravar `vintage-wash-tee-black-45123456` ali seria gravar uma semente
  //      que nunca resolve, e o cookie viraria lixo silencioso.
  //   2. Numa página que não é PDP (`/s`, home), o último segmento não é peça
  //      nenhuma — descobrir isso aqui evita `colherSementes` e
  //      `montarCandidatos` inteiros para terminar em `null`.
  const alvo = await acharAncora(slug);
  if (!alvo) return null;

  const look = await lookDaPeca(alvo.ancora.handle);

  // Só marca visita quando o alvo veio da URL. Com a prop preenchida a section
  // está fixada numa página que não é de produto, e ali *toda* visita gravaria
  // aquela peça no topo de `deco_recent` — um handle que ninguém abriu passaria
  // a valer como "viu agora há pouco" e expulsaria sinal real, que só tem oito
  // vagas.
  //
  // Registra DEPOIS de compor, e a ordem é o ponto: se `deco_recent` fosse
  // gravado antes, a peça aberta entraria como semente do próprio look já na
  // primeira visita.
  if (daUrl) marcarVisita(alvo.ancora.handle, _req);

  return look;
}

/**
 * Põe a peça na frente do cookie de vistos.
 *
 * Vive aqui e não num middleware em `src/server.ts` de propósito: aquele é o
 * entry, e o `RequestContext.run` e a dedup de `Set-Cookie` que moram lá são
 * frágeis a mexida (ver docs/deploy-vercel-supabase.md). Este loader roda em
 * toda PDP, que é exatamente onde uma visita acontece — o middleware não
 * compraria nada além de risco.
 *
 * `Set-Cookie` pela resposta HTTP, nunca por `document.cookie`: o Safari limita
 * a 7 dias os cookies escritos por JavaScript, e o caminho "óbvio" apagaria o
 * histórico de uma fatia grande do tráfego sem avisar.
 */
const marcarVisita = (handle: string, req?: Request): void => {
  const request = req ?? RequestContext.current?.request;
  if (!request) return;

  try {
    RequestContext.responseHeaders.append(
      "Set-Cookie",
      serializarVistos(lerVistos(request), handle),
    );
  } catch (erro) {
    // Nunca derruba a PDP por causa de um cookie de conveniência.
    console.warn("[look] não deu para marcar a visita", erro);
  }
};
