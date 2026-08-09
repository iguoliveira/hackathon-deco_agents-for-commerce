import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { lookDaPeca } from "~/platform/look/look.actions";
import { acharAncora } from "~/platform/look/look.d1";
import type { LookPersonalizado } from "~/platform/look/look.actions";

export interface Props {
  /**
   * @title Handle da peça
   * @description OBRIGATÓRIO. A section só existe na home, e ali não há peça na URL para deduzir — deixar vazio faz a section sumir sem erro.
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
 * O caminho da página que a pessoa está vendo, ou `null` quando não dá para
 * saber. **Fonte única** — `slugDaPagina` deriva daqui.
 *
 * Mesma precedência que `resolvePageUrl` usa em `catalog.actions.ts:39` e
 * `setup.ts:135`, e vale repetir por que ela não é a óbvia.
 *
 * **`RequestContext.request.url` não serve**, e aqui isso é mais grave do que
 * nos outros dois. Esta section é diferida: quem a resolve é
 * `loadDeferredSection`, num POST separado para `_serverFn`. Naquele momento a
 * requisição corrente é a do server function, não a da página — o caminho seria
 * o da função, o guarda decidiria sobre a URL errada e reprovaria a própria
 * home, e a section sumiria em silêncio com a página em 200.
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

/** O último segmento do caminho — a peça, quando a página é uma PDP. */
const slugDaPagina = (pageUrlProp?: string): string | null => {
  const caminho = caminhoDaPagina(pageUrlProp);
  return caminho === null ? null : (caminho.split("/").filter(Boolean).at(-1) ?? null);
};

/**
 * O look que o agente compõe em volta de uma peça.
 *
 * **A section só existe na home**, e lá a peça vem da prop `handle` — não há
 * peça na URL para deduzir. O `slugDaPagina` continua aqui como caminho de
 * compatibilidade para quem montar a section noutra página, mas o guarda acima
 * já recusa esse caso; ele existe para não deixar a função com um único caminho
 * silencioso quando o handle vier vazio.
 *
 * Devolve `null` quando a peça não existe, quando não há candidatos suficientes
 * para compor, ou quando tudo o que o agente escolheu esgotou desde a geração.
 * A section some nos três casos, que é o comportamento certo: "complete o look"
 * com duas peças é pior que nenhum.
 *
 * **Não registra visita.** Registrava, e o argumento era *"este loader roda em
 * toda PDP"* — o que deixou de valer quando a section saiu de lá. Quem grava
 * `deco_recent` agora é `catalogProductDetailsPage.ts`, que é o loader que de
 * fato roda em toda PDP. Marcar daqui seria pior que não marcar: na home a peça
 * é fixa, e *toda* visita gravaria a mesma âncora no topo dos vistos, expulsando
 * sinal real de um cookie que só tem oito vagas.
 *
 * **Este loader pode demorar na primeira visita de um contexto novo?** Não. O
 * agente é disparado sem `await` em `look.actions.ts` e a resposta sai na hora.
 * Se algum dia isto passar a bloquear, é bug — ver a decisão de latência em
 * docs/agente-de-combinacoes.md §4.
 */
export default async function completeTheLookLoader(
  { handle, __pageUrl }: Props = {},
): Promise<LookPersonalizado | null> {
  // O guarda vem ANTES de qualquer consulta: uma página que não é a home não
  // deve nem tocar o banco por causa desta section.
  const caminho = caminhoDaPagina(__pageUrl);
  if (caminho !== null && !ehHome(caminho)) return null;

  const slug = handle ?? slugDaPagina(__pageUrl);
  if (!slug) return null;

  // Canonicaliza o slug antes de compor: numa página sem peça na URL o último
  // segmento não é handle nenhum, e descobrir isso aqui evita `colherSementes` e
  // `montarCandidatos` inteiros para terminar em `null`.
  const alvo = await acharAncora(slug);
  if (!alvo) return null;

  return lookDaPeca(alvo.ancora.handle);
}
