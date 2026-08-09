import { donoDaVitrine } from "~/platform/shelf/shelf.identity";
import { vitrineDaPessoa } from "~/platform/vitrine/vitrine.actions";
import type { VitrinePersonalizada } from "~/platform/vitrine/vitrine.actions";

/**
 * A vitrine que o agente recomendou para quem está olhando.
 *
 * **Repare no que este loader NÃO tem**, comparado com `completeTheLook.ts`:
 * nem `handle`, nem `__pageUrl`, nem `slugDaPagina`, nem precedência de header.
 * Aquele loader precisava de trinta linhas só para descobrir qual peça a pessoa
 * estava vendo, porque a section é diferida e roda num POST separado onde
 * `RequestContext.request.url` aponta para o server function, não para a página.
 *
 * Aqui não há peça. A pergunta é "quem é esta pessoa?", e a resposta não depende
 * da URL — o que faz o problema inteiro daquele arquivo desaparecer em vez de
 * ser resolvido de novo.
 *
 * **Não tem props**, e isso é deliberado: nada aqui deve ser configurável no
 * CMS. Um `limite` ou um `handle` de bloco seria alguém decidindo pela pessoa
 * fora do agente.
 *
 * **Este loader não gera nada.** `vitrineDaPessoa` só lê. Quem compõe é o cron,
 * via `gerarVitrine` — ver `vitrine.actions.ts`. Se algum dia isto passar a
 * bloquear ou a disparar modelo, é bug.
 *
 * `null` quando a pessoa não tem sinais, quando o cron ainda não passou por ela,
 * ou quando o que o agente escolheu esgotou. Os três são estado normal, e a
 * section some nos três.
 */
export default async function vitrineRecomendadaLoader(): Promise<VitrinePersonalizada | null> {
  // A identidade nunca vem por parâmetro de quem chama de fora — mesma regra de
  // `notifyMe/subscribe.ts` ("a sessão vence o e-mail do corpo"). Aqui ela vem
  // de `donoDaVitrine()`, que resolve sessão antes de cookie assinado.
  return vitrineDaPessoa(await donoDaVitrine());
}
