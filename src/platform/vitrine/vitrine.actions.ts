/**
 * O que a section consome, e o que o cron chama. Nada acima daqui sabe que
 * existe banco ou modelo.
 *
 * **Os dois caminhos são separados de propósito, e essa é a diferença de
 * latência para o `look`.** Lá, a PDP descobria o cache frio e disparava a
 * geração sem `await` — melhor esforço, com o risco de a Vercel congelar a
 * invocação antes de gravar. Aqui a geração tem dono: o cron. A requisição
 * **só lê**.
 *
 *   vitrineDaPessoa(email)   caminho de leitura. Uma consulta indexada, e nada
 *                            mais. Nunca chama modelo, nunca dispara nada.
 *   gerarVitrine(email)      caminho do cron. Leva 60-120s e grava.
 *
 * Isso torna a home previsível: ou existe vitrine gravada e ela aparece, ou não
 * existe e a section some. Não há terceiro estado, não há disparo em voo, não há
 * o `Set` de dedupe que o `look` precisou.
 */

import type { Product } from "@decocms/apps-commerce/types";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { findAvailableCatalogRecordsByHandles } from "../catalog/catalog.d1";
import { recordToProduct } from "../catalog/catalog.mapper";
import { hashDosSinais } from "../look/look.hash";
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
 * A vitrine de quem está fazendo esta requisição. **Só lê.**
 *
 * `null` — e a section some — em três casos, todos normais:
 *
 *   1. a pessoa não tem sinais suficientes, então nunca houve vitrine;
 *   2. o cron ainda não passou por este conjunto de sinais;
 *   3. tudo o que o agente escolheu esgotou desde a geração.
 *
 * Nenhum deles é erro, e é por isso que o contrato duro do `look` sobrevive aqui
 * com um argumento melhor: **esta não é a section principal do site.** Um buraco
 * onde ela estaria não quebra nada. Uma vitrine genérica, sim — ocuparia o lugar
 * da prova de personalização com aquilo que qualquer loja tem.
 */
export const vitrineDaPessoa = async (email: string | null): Promise<VitrinePersonalizada | null> => {
  const sementes = await colherSementes(email);
  if (sementes.length === 0) return null;

  const cacheada = await lerVitrine(hashDosSinais(sementes));
  if (!cacheada) return null;

  const pecas = await montarPecas(cacheada);
  if (pecas.length < MIN_PECAS) {
    console.warn(`[vitrine] caiu para ${pecas.length} peça(s) disponíveis — section não renderiza`);
    return null;
  }

  return { titulo: cacheada.titulo, pecas, sementes: sementes.length };
};

/**
 * Compõe e grava a vitrine de uma pessoa. **É o que o cron chama.**
 *
 * Recebe **e-mail**, não hash — e isso corrige o contrato que
 * docs/vitrine-sem-ancora.md §8 anunciou errado. A ideia lá era o cron varrer
 * `SELECT sinais_hash FROM personas`, e ela não funciona: o hash é via única, e
 * as sementes que o geraram não estão guardadas em lugar nenhum. Sem elas não há
 * como calcular `combinaComOGuardaRoupa` — que é o eixo da recomendação.
 *
 * O cron varre **identidades** (de `orders`, `stock_alerts`, `wishlist_items`) e
 * passa o e-mail. Tudo o mais é derivado aqui.
 *
 * A ordem das guardas não é arbitrária:
 *
 *   1. **sinais** — sem eles não há o que retratar, e é grátis descobrir isso.
 *   2. **cache** — o cron pode passar duas vezes pelo mesmo conjunto de sinais
 *      (duas pessoas com o mesmo armário compartilham o hash).
 *   3. **quarentena** — só interessa quando não há vitrine boa.
 *   4. **persona** — o PORTÃO. Sem retrato confiável não há vitrine, e desistir
 *      aqui economiza a chamada de recomendação inteira, que é a cara.
 *   5. **recomendação** — 35-60s.
 *
 * **Leva 60-120s no total** (persona + recomendação, sequenciais). Nunca chame
 * de dentro de uma request.
 */
export const gerarVitrine = async (email: string): Promise<Vitrine | null> => {
  const sementes = await colherSementes(email);
  const hash = hashDosSinais(sementes);

  const desistir = async (porque: string): Promise<null> => {
    console.warn(`[vitrine] ${email}: sem vitrine — ${porque}`);
    await gravarFalhaDaVitrine(hash, porque);
    return null;
  };

  if (sementes.length === 0) {
    // Sem marcador: não há hash estável a marcar (o de uma lista vazia é o mesmo
    // para todo mundo), e marcá-lo poria em quarentena todos os visitantes sem
    // histórico de uma vez.
    console.warn(`[vitrine] ${email}: nenhum sinal`);
    return null;
  }

  const cacheada = await lerVitrine(hash);
  if (cacheada) return cacheada;

  if (await vitrineFalhouRecentemente(hash, TTL_FALHA_MINUTOS)) {
    console.warn(`[vitrine] ${hash} em quarentena — pulando`);
    return null;
  }

  // O portão. `obterPersona` já tem cache e quarentena próprios, então duas
  // pessoas com o mesmo armário pagam uma síntese só.
  const persona = await obterPersona(sementes);
  if (!persona) return desistir("sem persona confiável");

  const jaComprados = sementes
    .filter((s: Semente) => s.kinds.includes("purchased"))
    .map((s: Semente) => s.productGroupId);

  const candidatos = await montarCandidatos(sementes, jaComprados);
  const { vitrine, porque } = await recomendar(persona, candidatos);
  if (!vitrine) return desistir(porque ?? "motivo não registrado");

  await gravarVitrine(hash, vitrine);
  return vitrine;
};
