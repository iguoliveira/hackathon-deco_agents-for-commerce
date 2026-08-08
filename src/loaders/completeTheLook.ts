import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { lookDaPeca } from "~/platform/look/look.actions";
import { lerVistos, serializarVistos } from "~/platform/look/look.cookies";
import type { LookPersonalizado } from "~/platform/look/look.actions";

export interface Props {
  /**
   * @title Handle da peça
   * @description Deixe vazio na PDP: o handle é lido da URL. Preencher só serve para fixar uma peça numa página que não é de produto.
   */
  handle?: string;
}

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
  { handle }: Props = {},
  req?: Request,
): Promise<LookPersonalizado | null> {
  const alvo = handle ?? handleDaUrl(req);
  if (!alvo) return null;

  const look = await lookDaPeca(alvo);

  // Registra a visita DEPOIS de compor, e a ordem é o ponto: se `deco_recent`
  // fosse gravado antes, a peça aberta entraria como semente do próprio look e
  // o agente receberia "essa pessoa gosta desta peça que ela está olhando" —
  // ruído que empurraria um sinal real para fora das seis vagas.
  marcarVisita(alvo, req);

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

/**
 * O último segmento de `/produtos/<handle>` (ou `/p/<handle>`).
 *
 * Lê da URL em vez de receber o `Product` já resolvido de propósito: receber o
 * produto acoplaria esta section à ordem de resolução da PDP, e o loader
 * precisaria esperar o outro terminar. O handle é o suficiente, e `acharAncora`
 * já busca tudo o que falta numa query.
 *
 * Cai no `RequestContext` quando o registry não passa a requisição. Os loaders
 * de catálogo em `setup.ts` são registrados como `(props) => ...` e os de action
 * como `(props, req) => ...` — em vez de apostar em qual regra vale aqui, tenta
 * os dois. `shelf.actions.ts` já usa o `RequestContext` por este motivo.
 */
const handleDaUrl = (req?: Request): string | null => {
  const request = req ?? RequestContext.current?.request;
  if (!request) return null;
  try {
    const partes = new URL(request.url).pathname.split("/").filter(Boolean);
    return partes.at(-1) ?? null;
  } catch {
    return null;
  }
};
