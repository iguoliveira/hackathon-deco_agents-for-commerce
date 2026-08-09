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
import { acharAncora, falhaRecente, lerLook } from "./look.d1";
import { fnv1a } from "./look.hash";
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
 * Hash do contexto. O primitivo e o porquê de não ser `node:crypto` moram em
 * `look.hash.ts`, que a persona também usa.
 *
 * **A persona NÃO entra aqui**, ainda que esteja no `Contexto`. Ela é derivada
 * das sementes, que já estão no hash — somá-la poria a mesma informação duas
 * vezes na chave, e faria uma síntese que falhou invalidar um cache de look
 * perfeitamente bom.
 */
const hashDoContexto = (contexto: Contexto): string =>
  fnv1a(
    [
      // As sementes entram ORDENADAS: a mesma pessoa com as mesmas peças precisa
      // gerar a mesma chave, e a ordem que chega de `colherSementes` é a de
      // recência, que muda a cada visita. Sem o sort, o cache nunca acertaria.
      ...contexto.sementes.map((s) => `${[...s.kinds].sort().join(",")}:${s.productGroupId}`).sort(),
      contexto.local.cidade,
      contexto.local.regiao,
      contexto.local.pais,
      contexto.mes,
    ].join("|"),
  );

/**
 * Quanto tempo um par (peça, contexto) que falhou fica em quarentena.
 *
 * Minutos, não horas, e o número tem dono: a demo precisa se recuperar sozinha.
 * Se o provedor voltar às 15h04, a section tem de reaparecer antes do pitch sem
 * ninguém rodar nada — dez minutos é o maior valor que ainda cabe entre "parou
 * de gerar carga" e "alguém percebeu no palco".
 *
 * É a única constante desta correção que se ajusta sem entender o resto: subir
 * protege mais o provedor, descer recupera mais rápido.
 */
const TTL_FALHA_MINUTOS = 10;

/**
 * As PEÇAS com geração em voo **neste processo**.
 *
 * O marcador no banco fecha o laço entre visitas, mas não fecha a janela DURANTE
 * a primeira: enquanto uma geração de 120s está em voo, ela ainda não gravou
 * nada, então cada pageview que chega nesse intervalo dispara mais uma. Na home,
 * ancorada num handle fixo, todo visitante cai na mesma peça — o que transforma
 * um pico de tráfego em N chamadas simultâneas para a mesma resposta.
 *
 * **Por peça, e não por par (peça, contexto)** — mesma chave da quarentena, e
 * pelo mesmo motivo: o contexto muda a cada PDP navegada (`deco_recent` entra no
 * hash), então uma chave por par deixava a rajada passar inteira para quem está
 * navegando. Ver `gravarFalha` para o argumento completo.
 *
 * Um `Set` em memória resolve o caso que importa e é honesto sobre o que não
 * resolve: **é por instância**. Duas instâncias da Vercel disparam duas vezes.
 * Isso é aceitável porque as duas camadas cobrem coisas diferentes — o `Set`
 * corta a rajada dentro de uma instância quente, o marcador corta a repetição
 * entre visitas e entre instâncias. Um lock de verdade seria um `INSERT` de
 * reserva antes de chamar o modelo; vale se um dia isto sair da demo.
 *
 * **A reserva tem de ser síncrona.** Ver o `try/finally` em `lookDaPeca`: um
 * `await` entre perguntar e reservar reabre exatamente a rajada que este
 * conjunto existe para fechar.
 */
const emVoo = new Set<string>();

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
 * `null` — e a section some — em cinco casos:
 *
 *   1. a peça não existe;
 *   2. não há candidatos suficientes para compor;
 *   3. **o agente ainda não compôs este par (peça, contexto)**;
 *   4. tudo o que ele escolheu esgotou desde a geração;
 *   5. esta PEÇA falhou há menos de `TTL_FALHA_MINUTOS` e está em quarentena.
 *
 * O caso 5 é o que mantém o 3 barato. Sem ele, "ainda não compôs" e "não
 * consegue compor" eram indistinguíveis, e o segundo disparava uma geração nova
 * a cada visita — indefinidamente, porque falha não deixava rastro.
 *
 * A quarentena é por **peça**, não pelo par: o contexto muda a cada PDP que a
 * pessoa abre (`deco_recent` entra no hash), então uma quarentena por par nunca
 * seria consultada por quem está navegando. Ver `gravarFalha`.
 *
 * O caso 3 é o que faz esta função ter dois estados em vez de três:
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

  // HIT: o caminho quente, uma leitura indexada e nada mais. `lerLook` só
  // devolve linha do agente — o marcador de falha que `gerarLook` grava tem
  // `origem = 'falha'` e é ignorado aqui, então ele nunca vira look na tela.
  const cacheado = await lerLook(alvo.ancora.productGroupId, hash);
  if (cacheado) return montar(cacheado, contexto);

  // MISS. A reserva vem ANTES de qualquer `await`, e essa ordem é a correção
  // inteira: `has` e `add` separados por I/O não são um guarda.
  //
  // O JavaScript não tem corrida de memória aqui, mas tem ponto de suspensão.
  // Com o teste no topo e o `add` junto do disparo, duas requisições da home
  // chegando juntas passavam as duas pelo `has` — enquanto a primeira esperava
  // `falhaRecente`, a segunda rodava do começo e ainda via o conjunto vazio.
  // Cada `await` entre a pergunta e a reserva é uma janela por onde cabe uma
  // requisição inteira, e o pico simultâneo é precisamente o que este `Set`
  // existe para conter.
  const chave = alvo.ancora.productGroupId;
  if (emVoo.has(chave)) return null;
  emVoo.add(chave);

  // A reserva é solta em um de dois lugares, nunca nos dois: no `finally` de
  // baixo quando desistimos antes de chamar o modelo, ou no `finally` da
  // promessa quando chegamos a disparar. `disparou` é quem decide qual.
  let disparou = false;

  try {
    if (await falhaRecente(alvo.ancora.productGroupId, TTL_FALHA_MINUTOS)) return null;

    // Antes de gastar um minuto de modelo, confere se há com o que compor —
    // e usa o MESMO conjunto de exclusão que `gerarLook` vai usar. Divergir aqui
    // faria a PDP disparar o agente para um pool que ele recusaria por pequeno,
    // repetindo o gasto a cada visita sem nunca produzir look.
    //
    // O terceiro argumento é o guarda-roupa. Ele não filtra nada — só acrescenta
    // `combinaComOGuardaRoupa` e `jaTemDesteTipo` a cada candidato. Passá-lo aqui
    // e em `gerarLook` é obrigatório pelo mesmo motivo que `jaComprados`: os dois
    // caminhos precisam produzir o MESMO pool, senão o que a PDP mede para decidir
    // se vale chamar o modelo não é o que o modelo recebe.
    const candidatos = await montarCandidatos(
      alvo.variantId,
      jaComprados(contexto),
      contexto.sementes,
    );
    if (candidatos.length < MIN_PECAS) return null;

    // Dispara e NÃO espera. É melhor esforço, e é honesto dizer por quê: sem
    // `waitUntil` a Vercel pode congelar a invocação assim que a resposta sai.
    // Não é problema porque o próximo carregamento tenta de novo — e para a demo
    // os produtos do roteiro são pré-aquecidos. `@vercel/functions` tornaria isto
    // garantido; vale medir antes de trazer dependência.
    //
    // O `finally` da promessa é o que faz o `emVoo` ser um guarda e não um
    // vazamento: se a chave só saísse no sucesso, uma geração que estourasse o
    // timeout deixaria o par bloqueado para sempre nesta instância — trocando o
    // laço por uma feature permanentemente desligada, que é pior porque não faz
    // barulho. Se a invocação for congelada pela Vercel nem isto roda; quem cobre
    // esse caso é o marcador no banco.
    disparou = true;
    void gerarLook(handle, contexto, hash)
      .catch((erro) => console.error(`[look] geração em background falhou para ${handle}`, erro))
      .finally(() => emVoo.delete(chave));

    // A section some nesta visita. É o custo aceito ao remover o fallback: sem
    // motivos não há o que mostrar, e mostrar a lista crua seria mostrar o
    // carrossel que qualquer loja tem no lugar da prova de que houve composição.
    return null;
  } finally {
    if (!disparou) emVoo.delete(chave);
  }
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
