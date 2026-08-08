/**
 * O que a section consome. Nada acima daqui sabe que existe banco ou modelo.
 *
 * É aqui que mora a decisão de latência da feature: o Decopilot leva 35-60s e
 * uma PDP não segura isso. No cache miss a pessoa recebe **na hora** a
 * ordenação do SQL, sem motivos, e o agente é disparado sem `await` para o
 * próximo carregamento ter o look explicado.
 *
 * O produto degrada de **look explicado** para **look sem texto** — nunca para
 * vazio, nunca para erro. Mesmo padrão de `notifyMe/subscribe.ts`, que dispara
 * `gerarVitrine` sem esperar.
 */

import type { Product } from "@decocms/apps-commerce/types";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { findAvailableCatalogRecordsByHandles } from "../catalog/catalog.d1";
import { recordToProduct } from "../catalog/catalog.mapper";
import { donoDaVitrine } from "../shelf/shelf.identity";
import { gerarLook, jaComprados, lookDoSql, MIN_PECAS } from "./look.agent";
import { montarCandidatos } from "./look.candidates";
import { acharAncora, lerLook } from "./look.d1";
import { localDaRequisicao, localEmTexto, mesAtual } from "./look.local";
import { colherSementes } from "./look.seeds";
import type { Contexto, Look } from "./look.types";

/** Uma peça pronta para a tela: o produto e a linha que o justifica. */
export interface PecaRenderizavel {
  product: Product;
  /** Vazio quando o look veio do fallback por SQL. */
  motivo: string;
}

/**
 * Um bloco da vitrine.
 *
 * O agrupamento é por `ocasiao`, que é vocabulário do modelo — o código não
 * conhece nenhum valor possível e apenas agrupa por igualdade. É o que dá
 * blocos com títulos que ninguém programou.
 */
export interface BlocoDoLook {
  ocasiao: string;
  pecas: PecaRenderizavel[];
}

export interface LookPersonalizado {
  titulo: string;
  blocos: BlocoDoLook[];
  /** Para a section decidir se mostra os motivos. */
  origem: "agente" | "sql";
  /** "Porto Alegre, RS, BR" — a section mostra de onde o agente partiu. */
  lugar: string;
  mes: string;
  /** Quantos sinais o agente teve. 0 = visitante sem histórico. */
  sementes: number;
}

/**
 * Hash do contexto, em código, sem `node:crypto`.
 *
 * FNV-1a: rápido, estável entre processos e suficiente para uma chave de cache.
 * Colisão aqui serve um look ligeiramente errado a alguém, não abre falha de
 * segurança — se fosse assinatura de cookie, a escolha seria outra
 * (`shelf.cookie.ts` usa HMAC de propósito).
 *
 * **Não usar `node:crypto` é uma decisão, não conveniência.** O dynamic import
 * dos loaders em `setup.ts` arrasta este grafo para o bundle do cliente, e o
 * Rollup falha com `"createHash" is not exported by "__vite-browser-external"`.
 * Typecheck e dev não pegam — só o build do client. Já custou um stub em
 * `vite.config.ts` uma vez; ver docs/agente-vitrine.md → Armadilhas.
 */
const hashDoContexto = (contexto: Contexto): string => {
  // As sementes entram ORDENADAS: a mesma pessoa com as mesmas peças precisa
  // gerar a mesma chave, e a ordem que chega de `colherSementes` depende de
  // recência, que muda a cada visita. Sem o sort, o cache nunca acertaria.
  const material = [
    ...contexto.sementes.map((s) => `${s.kind}:${s.productGroupId}`).sort(),
    contexto.local.cidade,
    contexto.local.regiao,
    contexto.local.pais,
    contexto.mes,
  ].join("|");

  let hash = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

/**
 * `Product` carrega URLs absolutas, então precisa da origin da requisição.
 * Mesmo fallback de `catalog.actions.ts` para quando roda fora de um contexto
 * de request (build, preview do editor).
 */
const origemAtual = (): string => {
  const request = RequestContext.current?.request;
  return request ? new URL(request.url).origin : "https://localhost";
};

/**
 * Resolve os handles escolhidos em produtos, **reconferindo disponibilidade**.
 *
 * O look fica gravado enquanto o estoque muda. Recomendar peça esgotada num
 * look é o pior resultado possível desta feature, e passaria despercebido
 * porque a página continuaria respondendo 200.
 *
 * `findAvailableCatalogRecordsByHandles` **preserva a ordem pedida** — a ordem
 * é o julgamento do agente, e um `ORDER BY position` jogaria fora exatamente o
 * que se pagou um minuto de LLM para obter.
 */
const montarBlocos = async (look: Look): Promise<BlocoDoLook[]> => {
  const handles = look.pecas.map((peca) => peca.handle);
  const registros = await findAvailableCatalogRecordsByHandles(handles);
  if (registros.length === 0) return [];

  const porHandle = new Map(look.pecas.map((peca) => [peca.handle, peca]));
  const origem = origemAtual();

  // Map preserva ordem de inserção, e a inserção segue a ordem do agente —
  // então o primeiro bloco é o da peça em que ele mais acreditou.
  const blocos = new Map<string, PecaRenderizavel[]>();

  for (const registro of registros) {
    const peca = porHandle.get(registro.product.handle);
    if (!peca) continue;

    const product = recordToProduct(registro, origem);
    if (!product) continue;

    const atual = blocos.get(peca.ocasiao) ?? [];
    atual.push({ product, motivo: peca.motivo });
    blocos.set(peca.ocasiao, atual);
  }

  return [...blocos.entries()].map(([ocasiao, pecas]) => ({ ocasiao, pecas }));
};

/**
 * O look de uma peça para quem está olhando.
 *
 * `null` quando a peça não existe, quando não há candidatos suficientes para
 * compor, ou quando tudo o que o agente escolheu esgotou desde a geração. A
 * section some nos três casos, que é o comportamento certo — um "complete o
 * look" com duas peças é pior que nenhum.
 */
export const lookDaPeca = async (handle: string): Promise<LookPersonalizado | null> => {
  const alvo = await acharAncora(handle);
  if (!alvo) return null;

  // A identidade nunca vem por parâmetro: sessão primeiro, cookie assinado
  // depois. Mesma regra de `notifyMe/subscribe.ts`.
  const email = await donoDaVitrine();

  const contexto: Contexto = {
    sementes: await colherSementes(email),
    local: localDaRequisicao(),
    mes: mesAtual(),
  };
  const hash = hashDoContexto(contexto);

  const cacheado = await lerLook(alvo.ancora.productGroupId, hash);

  // HIT do agente: o caminho quente, uma leitura indexada e nada mais.
  // Um hit de origem `sql` NÃO curto-circuita — ele significa que a geração
  // anterior caiu, e tentar de novo é o certo. Sem isto, uma única falha do
  // provedor congelaria aquele par em "sem motivos" para sempre.
  if (cacheado?.origem === "agente") {
    return montar(cacheado, contexto);
  }

  // O MESMO conjunto de exclusão que `gerarLook` usa. Divergir aqui faria o
  // look do fallback mostrar uma peça que o do agente nunca mostraria — e ela
  // sumiria sozinha no reload seguinte, sem explicação.
  const candidatos = await montarCandidatos(alvo.variantId, jaComprados(contexto));
  if (candidatos.length < MIN_PECAS) return null;

  // Dispara e NÃO espera. É melhor esforço, e é honesto dizer por quê: sem
  // `waitUntil` a Vercel pode congelar a invocação assim que a resposta sai.
  // Não é problema porque o próximo carregamento tenta de novo — e para a demo
  // os produtos do roteiro são pré-aquecidos. `@vercel/functions` tornaria isto
  // garantido; vale medir antes de trazer dependência.
  void gerarLook(handle, contexto, hash).catch((erro) =>
    console.error(`[look] geração em background falhou para ${handle}`, erro),
  );

  return montar(lookDoSql(candidatos, "geração em andamento"), contexto);
};

/**
 * Compõe o look de uma peça **esperando o agente terminar**, e grava.
 *
 * É o passo 7 do plano (docs/agente-de-combinacoes.md §8): pré-aquecer os
 * produtos do roteiro para que a demo responda do cache em vez de mostrar a
 * ordenação do SQL enquanto alguém fala.
 *
 * A diferença para o `--gravar` do dry run é a única que importa: aquele grava
 * sob `contexto_hash = 'dryrun'`, que a PDP **nunca lê**. Aqui o contexto e o
 * hash são os mesmos que `lookDaPeca` calcularia — é por isso que isto vive
 * aqui, ao lado de `hashDoContexto`, e não no script.
 *
 * O contexto é o de quem chama. Rodado do terminal, é "visitante sem histórico
 * em São Paulo"; rodado dentro de uma request, é o de quem está pedindo. Para
 * pré-aquecer a persona da demo, abrir a PDP como ela continua sendo o caminho.
 *
 * **Não use no caminho de uma request que alguém esteja esperando** — leva os
 * mesmos 22-41s do agente.
 */
export const aquecerLook = async (handle: string): Promise<Look | null> => {
  const alvo = await acharAncora(handle);
  if (!alvo) return null;

  const contexto: Contexto = {
    sementes: await colherSementes(await donoDaVitrine()),
    local: localDaRequisicao(),
    mes: mesAtual(),
  };

  return gerarLook(alvo.ancora.handle, contexto, hashDoContexto(contexto));
};

const montar = async (look: Look, contexto: Contexto): Promise<LookPersonalizado | null> => {
  const blocos = await montarBlocos(look);
  const total = blocos.reduce((soma, bloco) => soma + bloco.pecas.length, 0);
  if (total < MIN_PECAS) {
    console.warn(`[look] caiu para ${total} peça(s) disponíveis — section não renderiza`);
    return null;
  }

  return {
    titulo: look.titulo,
    blocos,
    origem: look.origem,
    lugar: localEmTexto(contexto.local),
    mes: contexto.mes,
    sementes: contexto.sementes.length,
  };
};
