/**
 * O que a section consome, e o que o cron chama. Nada acima daqui sabe que
 * existe banco ou modelo.
 *
 * **Não há cron.** A geração é disparada pela própria requisição, sem `await`, e
 * o que a torna barata é a CHAVE — uma por pessoa por dia. É a solução da #30,
 * e adotá-la aqui não foi preferência: era conserto.
 *
 * ## O defeito que a #30 expôs neste arquivo
 *
 * A chave era `hashDosSinais(sementes)`. As sementes incluem `recent`, que sai
 * do cookie `deco_recent`, gravado a cada PDP aberta — então **abrir qualquer
 * peça mudava a chave da vitrine**. A gravada virava inalcançável, e a section
 * aparecia uma vez e sumia.
 *
 * Com cron seria pior, não melhor: o job calcularia o hash às 3h e a pessoa
 * chegaria de manhã com outro. A vitrine existiria no banco e nunca na tela.
 *
 * ## O desenho agora
 *
 *   vitrineDaPessoa(email)   lê pela chave do dia. No miss, dispara e devolve
 *                            `null` — a section aparece no carregamento seguinte.
 *   gerarVitrine(email)      compõe e grava. 60-120s.
 *
 * O `Set` de dedupe e a quarentena voltam, e é honesto dizer que voltam: eu tinha
 * escrito que a separação em dois caminhos os dispensava. Dispensava porque o
 * cron era o único a gerar. Sem cron, a home volta a ser a origem das chamadas —
 * e uma chave por pessoa por dia reduz o volume, não a concorrência.
 */

import type { Product } from "@decocms/apps-commerce/types";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { findAvailableCatalogRecordsByHandles } from "../catalog/catalog.d1";
import { recordToProduct } from "../catalog/catalog.mapper";
import { fnv1a } from "../look/look.hash";
import { obterPersona } from "../look/persona.agent";
import { colherSementes } from "../look/look.seeds";
import { montarCandidatos } from "./vitrine.candidates";
import {
  gravarFalhaDaVitrine,
  gravarVitrine,
  lerVitrine,
  vitrineFalhouRecentemente,
} from "./vitrine.d1";
import { MIN_PECAS, recomendar } from "./vitrine.agent";
import type { Semente, Vitrine } from "./vitrine.types";

/** Uma peça pronta para a tela: o produto e a linha que o justifica. */
export interface PecaRenderizavel {
  product: Product;
  motivo: string;
}

export interface VitrinePersonalizada {
  titulo: string;
  /** Lista única, sem agrupamento. Ver docs/vitrine-sem-ancora.md §5. */
  pecas: PecaRenderizavel[];
  /** Quantos sinais o agente teve. Vira a linha de procedência na tela. */
  sementes: number;
}

/** O dia em UTC, `YYYY-MM-DD`. Vira sozinho à meia-noite. */
export const diaDeHoje = (): string => new Date().toISOString().slice(0, 10);

/**
 * A chave do cache: **uma pessoa, um dia.**
 *
 * As sementes NÃO entram — é a mudança que a #30 trouxe para o look e que aqui
 * conserta um defeito, não otimiza um. Enquanto entravam, abrir uma PDP mudava a
 * chave e a vitrine gravada virava inalcançável.
 *
 * **Sem cidade nem mês**, ao contrário da chave do look. Aquele compõe a partir
 * do clima e por isso precisa saber onde e quando; esta recomenda a partir de
 * quem a pessoa é, e o prompt daqui não recebe lugar nenhum. Pôr cidade na chave
 * recomporia a vitrine quando a pessoa trocasse de cidade, sem nada no resultado
 * depender disso.
 *
 * **Sem `"anon"`.** O look usa `email ?? "anon"` porque a âncora também entra na
 * chave dele, então visitantes anônimos ao menos compartilham por peça. Aqui não
 * há âncora: um `"anon"` faria **todos os visitantes deslogados dividirem uma
 * vitrine só** — a recomendação de uma pessoa mostrada a outra, numa feature cujo
 * ponto inteiro é ser de alguém. Sem e-mail não há chave, e `vitrineDaPessoa`
 * devolve `null` antes de chegar aqui.
 */
export const chaveDoDia = (email: string, dia = diaDeHoje()): string =>
  fnv1a([email, dia].join("|"));

/**
 * Quanto tempo um conjunto de sinais que falhou fica em quarentena.
 *
 * Uma hora, e não os dez minutos do `look`. Lá o número tinha dono — a demo
 * precisava se recuperar sozinha entre o provedor voltar e o pitch começar, e a
 * geração era disparada por pageview. Aqui quem tenta de novo é o cron, na
 * cadência dele; uma quarentena curta só garantiria que a próxima passada
 * repetisse a mesma falha.
 */
const TTL_FALHA_MINUTOS = 60;

/**
 * `Product` carrega URLs absolutas, então precisa da origin da requisição.
 * Mesmo fallback de `catalog.actions.ts` para quando roda fora de um contexto
 * de request — que no cron é o caso normal, não a exceção.
 */
const origemAtual = (): string => {
  const request = RequestContext.current?.request;
  return request ? new URL(request.url).origin : "https://localhost";
};

/**
 * Resolve os handles escolhidos em produtos, **reconferindo disponibilidade**.
 *
 * A vitrine fica gravada enquanto o estoque muda, e recomendar peça esgotada é
 * o pior resultado possível desta feature — passaria despercebido porque a
 * página continuaria respondendo 200.
 *
 * `findAvailableCatalogRecordsByHandles` **preserva a ordem pedida**, e a ordem
 * é o julgamento do agente. Um `ORDER BY` aqui jogaria fora exatamente o que se
 * pagou um minuto de modelo para obter.
 */
const montarPecas = async (vitrine: Vitrine): Promise<PecaRenderizavel[]> => {
  const registros = await findAvailableCatalogRecordsByHandles(vitrine.pecas.map((p) => p.handle));
  if (registros.length === 0) return [];

  const porHandle = new Map(vitrine.pecas.map((peca) => [peca.handle, peca]));
  const origem = origemAtual();

  const pecas: PecaRenderizavel[] = [];
  for (const registro of registros) {
    const peca = porHandle.get(registro.product.handle);
    if (!peca) continue;

    const product = recordToProduct(registro, origem);
    if (!product) continue;

    pecas.push({ product, motivo: peca.motivo });
  }
  return pecas;
};

/**
 * As PESSOAS com geração em voo **neste processo**.
 *
 * A quarentena fecha o laço entre visitas; este `Set` fecha a janela DURANTE a
 * primeira. Enquanto uma geração de ~90s está em voo ela ainda não gravou nada,
 * então cada pageview que chega nesse intervalo dispara mais uma — e a home é
 * onde todas as abas de uma pessoa caem na mesma chave.
 *
 * Eu tinha escrito que o desenho em dois caminhos dispensava isto. Dispensava
 * enquanto o cron era o único a gerar. **A chave por dia reduz o volume de
 * chamadas, não a concorrência dentro do mesmo dia.**
 *
 * Honesto sobre o que não cobre: é por instância. Duas instâncias da Vercel
 * disparam duas vezes, e quem cobre esse caso é o marcador no banco.
 *
 * **A reserva tem de ser síncrona** — `has` e `add` separados por `await` não são
 * um guarda. Ver o `try/finally` abaixo.
 */
const emVoo = new Set<string>();

/**
 * A vitrine de quem está fazendo esta requisição.
 *
 * **Lê pela chave do dia; no miss, dispara e devolve `null`.** A section aparece
 * no carregamento seguinte — mesma decisão de latência do `look`, e pelo mesmo
 * motivo: o modelo leva ~90s e uma home não segura isso.
 *
 * `null` — e a section some — em cinco casos, todos normais:
 *
 *   1. **não há sessão.** Ver o guarda abaixo: é o mais importante deles.
 *   2. a pessoa não tem sinais, então não há o que recomendar;
 *   3. a vitrine do dia ainda não foi composta (e acabou de ser disparada);
 *   4. esta pessoa falhou há pouco e está em quarentena;
 *   5. tudo o que o agente escolheu esgotou desde a geração.
 *
 * Nenhum é erro, e o contrato duro sobrevive com um argumento melhor que o do
 * look: **esta não é a section principal do site.** Um buraco onde ela estaria
 * não quebra nada; uma vitrine genérica ocuparia o lugar da prova de
 * personalização com aquilo que qualquer loja já tem.
 */
export const vitrineDaPessoa = async (email: string | null): Promise<VitrinePersonalizada | null> => {
  // **Sem sessão, o agente não é acionado.** É o guarda que a #30 achou abrindo a
  // home deslogado: toda visita anônima disparava uma composição, e numa section
  // da home isso é bot, preview de link, health check e aba esquecida — cada um
  // custando ~90s de modelo.
  //
  // A chave por dia não protege disso: ela garante uma composição por PESSOA por
  // dia, e o visitante anônimo é sempre outro. Aqui o guarda é ainda mais claro
  // que no look, porque sem âncora não há nada que uma vitrine anônima pudesse
  // significar — ver `chaveDoDia`.
  if (!email) return null;

  const chave = chaveDoDia(email);
  const cacheada = await lerVitrine(chave);

  if (cacheada) {
    const pecas = await montarPecas(cacheada);
    if (pecas.length < MIN_PECAS) {
      console.warn(`[vitrine] caiu para ${pecas.length} peça(s) disponíveis — section não renderiza`);
      return null;
    }
    return { titulo: cacheada.titulo, pecas, sementes: cacheada.sinais };
  }

  // MISS. A reserva vem ANTES de qualquer `await`, e essa ordem é o guarda
  // inteiro: duas abas chegando juntas passariam as duas por um `has` que
  // estivesse separado do `add` por I/O.
  if (emVoo.has(chave)) return null;
  emVoo.add(chave);

  let disparou = false;
  try {
    if (await vitrineFalhouRecentemente(chave, TTL_FALHA_MINUTOS)) return null;

    // Dispara e NÃO espera. Melhor esforço, e é honesto dizer por quê: sem
    // `waitUntil` a Vercel pode congelar a invocação assim que a resposta sai.
    // Não é problema porque o próximo carregamento tenta de novo — e a chave do
    // dia garante que "de novo" não signifique "outra chave".
    disparou = true;
    void gerarVitrine(email)
      .catch((erro) => console.error(`[vitrine] geração em background falhou para ${email}`, erro))
      .finally(() => emVoo.delete(chave));

    return null;
  } finally {
    if (!disparou) emVoo.delete(chave);
  }
};

/**
 * Compõe e grava a vitrine de uma pessoa, **esperando o agente terminar**.
 *
 * Dois consumidores: o disparo sem `await` de `vitrineDaPessoa`, e o
 * `npm run vitrine:refresh` quando a demo precisa do resultado agora.
 *
 * **A chave é a do dia**, e `dia` é parâmetro para o refresh poder reescrever a
 * de hoje em vez de criar outra. As sementes seguem indo ao prompt e à persona —
 * o que saiu da chave foi *quando* recompor, não *com o quê*.
 *
 * A ordem das guardas não é arbitrária:
 *
 *   1. **sinais** — sem eles não há o que recomendar, e é grátis descobrir.
 *   2. **cache** — o disparo pode chegar depois de outra aba já ter gravado.
 *   3. **quarentena** — só interessa quando não há vitrine boa.
 *   4. **persona** — o PORTÃO. Sem retrato confiável não há vitrine, e desistir
 *      aqui economiza a chamada de recomendação, que é a cara.
 *   5. **recomendação** — 35-90s.
 *
 * **Leva 60-150s no total** (persona + recomendação, sequenciais). Nunca chame
 * de dentro de uma request que alguém esteja esperando.
 */
export const gerarVitrine = async (
  email: string,
  dia = diaDeHoje(),
  /**
   * Ignora o cache e a quarentena e compõe de novo.
   *
   * Existe porque sem isto o `vitrine:refresh` não refresca nada: `gerarVitrine`
   * lê o cache antes de qualquer outra coisa — que é o certo para o disparo da
   * home, e o oposto do que a válvula de demo precisa. Medido: o refresh voltava
   * em 2,9s com a vitrine de antes.
   *
   * **Só o refresh passa `true`.** O disparo da home nunca deve, ou a chave
   * diária perde o sentido.
   */
  forcar = false,
): Promise<Vitrine | null> => {
  const chave = chaveDoDia(email, dia);
  const sementes = await colherSementes(email);

  const desistir = async (porque: string): Promise<null> => {
    console.warn(`[vitrine] ${email}: sem vitrine — ${porque}`);
    await gravarFalhaDaVitrine(chave, porque);
    return null;
  };

  if (sementes.length === 0) {
    // Sem marcador: a pessoa pode favoritar algo em cinco minutos, e uma
    // quarentena de uma hora a deixaria sem vitrine por nada. "Não tem sinal" é
    // barato de redescobrir — não custa modelo.
    console.warn(`[vitrine] ${email}: nenhum sinal`);
    return null;
  }

  if (!forcar) {
    const cacheada = await lerVitrine(chave);
    if (cacheada) return cacheada;

    if (await vitrineFalhouRecentemente(chave, TTL_FALHA_MINUTOS)) {
      console.warn(`[vitrine] ${email} em quarentena — pulando`);
      return null;
    }
  }

  // O portão. `obterPersona` já tem cache e quarentena próprios, então duas
  // pessoas com o mesmo armário pagam uma síntese só.
  const persona = await obterPersona(sementes);
  if (!persona) return desistir("sem persona confiável");

  const jaComprados = sementes
    .filter((s: Semente) => s.kinds.includes("purchased"))
    .map((s: Semente) => s.productGroupId);

  const candidatos = await montarCandidatos(sementes, jaComprados);
  const { vitrine, porque } = await recomendar(persona, candidatos, sementes.length);
  if (!vitrine) return desistir(porque ?? "motivo não registrado");

  await gravarVitrine(chave, vitrine);
  return vitrine;
};
