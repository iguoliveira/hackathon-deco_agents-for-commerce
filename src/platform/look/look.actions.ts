/**
 * O que a section consome. Nada acima daqui sabe que existe banco ou modelo.
 *
 * É aqui que mora a decisão de latência da feature: o Decopilot leva 35-60s e
 * uma PDP não segura isso. No cache miss a pessoa recebe **`null` na hora** e a
 * section não aparece; o agente é disparado sem `await` e o próximo
 * carregamento daquele par (peça, contexto) já vem explicado.
 *
 * **A degradação é para nada, não para uma lista sem motivos.** É a decisão de
 * `look.types.ts` → `Look`, e ela tem um preço que precisa ficar dito onde
 * alguém vá ler: a primeira visita a um contexto novo não mostra look nenhum.
 * Isso torna `npm run look:warm` parte do roteiro da demo, não um enfeite —
 * quem chega pelo link do pitch sem contexto aquecido vê a PDP sem a feature.
 *
 * O disparo sem `await` segue o padrão de `notifyMe/subscribe.ts`.
 */

import type { Product } from "@decocms/apps-commerce/types";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { findAvailableCatalogRecordsByHandles } from "../catalog/catalog.d1";
import { recordToProduct } from "../catalog/catalog.mapper";
import { donoDaVitrine } from "../shelf/shelf.identity";
import { gerarLook, jaComprados, MIN_PECAS } from "./look.agent";
import { montarCandidatos } from "./look.candidates";
import { acharAncora, lerLook } from "./look.d1";
import { localDaRequisicao, localEmTexto, mesAtual } from "./look.local";
import { colherSementes } from "./look.seeds";
import type { Contexto, Look } from "./look.types";

/**
 * Uma peça pronta para a tela: o produto e a linha que o justifica.
 *
 * `motivo` nunca é vazio. `validar` descarta peça sem motivo, e não existe mais
 * caminho que produza look sem texto — se chegou até aqui, foi escolhida e
 * explicada pelo agente.
 */
export interface PecaRenderizavel {
  product: Product;
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
 * `null` — e a section some — em quatro casos:
 *
 *   1. a peça não existe;
 *   2. não há candidatos suficientes para compor;
 *   3. **o agente ainda não compôs este par (peça, contexto)**;
 *   4. tudo o que ele escolheu esgotou desde a geração.
 *
 * O caso 3 é o novo, e é o que faz esta função ter dois estados em vez de três:
 * ou existe um look do agente, ou não existe look. Um "complete o look" que é
 * só uma lista ordenada não é uma versão mais fraca da feature — é outra coisa,
 * e ela mente sobre a procedência justamente quando o agente falhou.
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

  // HIT: o caminho quente, uma leitura indexada e nada mais. Só existe linha
  // gravada quando o agente compôs — `gerarLook` não persiste falha.
  const cacheado = await lerLook(alvo.ancora.productGroupId, hash);
  if (cacheado) return montar(cacheado, contexto);

  // MISS. Antes de gastar um minuto de modelo, confere se há com o que compor —
  // e usa o MESMO conjunto de exclusão que `gerarLook` vai usar. Divergir aqui
  // faria a PDP disparar o agente para um pool que ele recusaria por pequeno,
  // repetindo o gasto a cada visita sem nunca produzir look.
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

  // A section some nesta visita. É o custo aceito ao remover o fallback: sem
  // motivos não há o que mostrar, e mostrar a lista crua seria mostrar o
  // carrossel que qualquer loja tem no lugar da prova de que houve composição.
  return null;
};

/**
 * Compõe o look de uma peça **esperando o agente terminar**, e grava.
 *
 * É o passo 7 do plano (docs/agente-de-combinacoes.md §8), e desde que o
 * fallback por SQL caiu ele deixou de ser otimização: sem cache quente a
 * section **não aparece** na primeira visita de um contexto, então pré-aquecer
 * os produtos do roteiro é o que garante que exista feature no palco.
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
    lugar: localEmTexto(contexto.local),
    mes: contexto.mes,
    sementes: contexto.sementes.length,
  };
};
