/**
 * O agente de composição: etapa 1 -> modelo -> etapa 3.
 *
 * O modelo toca só o meio. A montagem do espaço de escolha (etapa 1) e a
 * resolução de volta (etapa 3) ficam em código, e é isso que torna alucinação
 * de produto **impossível por construção** em vez de mitigada: um handle que
 * não veio dos candidatos é descartado, nunca corrigido.
 *
 * Nada aqui lança. Todo caminho de falha termina em `null`, e `null` significa
 * uma coisa só: **a section não aparece**. Não existe look de consolação — ver
 * `look.types.ts` → `Look`.
 *
 * Isso torna o log a única testemunha de uma falha, porque a página continua
 * respondendo 200 e a section ausente é indistinguível de "esta peça não tem
 * complemento". Por isso todo caminho de desistência escreve uma linha em
 * `console.warn` dizendo qual foi.
 */

import { extrairJson } from "../shelf/shelf.agent";
import { perguntar } from "../shelf/shelf.decopilot";
import { montarCandidatos } from "./look.candidates";
import { acharAncora, gravarFalha, gravarLook, lerLook } from "./look.d1";
import { montarMensagem, PISO_DE_CONFIANCA } from "./look.prompt";
import type { Ancora, Candidato, Contexto, Look, PecaDoLook, RespostaCrua } from "./look.types";

/** Título usado quando o modelo compôs bem mas não soube nomear o conjunto. */
const TITULO_PADRAO = "Complete o look";
/** Rótulo de bloco para a peça que o modelo escolheu sem rotular. Ver `validar`. */
const OCASIAO_PADRAO = "Combina com esta peça";

/** Abaixo disto não é look, é sobra — e sobra não vai para a tela. */
const MIN_PECAS = 4;
const MAX_PECAS = 10;

/**
 * Os produtos que a pessoa já comprou — o que sai do pool de candidatos.
 *
 * Exportado porque `look.actions.ts` também precisa do conjunto para decidir,
 * no cache miss, se vale a pena disparar a geração — e as duas contagens de
 * candidatos têm de bater. Se divergirem, a PDP dispara o agente para uma peça
 * cujo pool ele vai recusar por ser pequeno demais, e gasta um minuto de modelo
 * a cada visita para não produzir nada.
 */
export const jaComprados = (contexto: Contexto): Set<string> =>
  new Set(contexto.sementes.filter((s) => s.kind === "purchased").map((s) => s.productGroupId));

/** Corta com reticência em vez de truncar seco — motivo cortado no meio soa quebrado. */
const limitar = (texto: string, max: number): string =>
  texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;

const texto = (valor: unknown, padrao: string, max: number): string =>
  typeof valor === "string" && valor.trim() ? limitar(valor.trim(), max) : padrao;

/**
 * Etapa 3: resolve a escolha do modelo contra os candidatos. **Sem modelo.**
 *
 * Descarta, nunca conserta: um handle "quase certo" corrigido por proximidade
 * seria adivinhação, e o look passaria a mostrar uma peça que o modelo não
 * escolheu. Duplicata também sai — o modelo às vezes repete o melhor candidato.
 *
 * Uma peça **sem motivo é descartada**, e isso não é rigor estético: uma peça
 * sem explicação num look explicado é indistinguível de um carrossel comum, e
 * quebra a única coisa que esta feature tem a provar. Se o modelo não soube
 * dizer por que duas peças combinam, ele não escolheu — ele preencheu.
 */
export const validar = (lista: unknown, candidatos: Candidato[]): PecaDoLook[] => {
  if (!Array.isArray(lista)) return [];

  const validos = new Set(candidatos.map((c) => c.handle));
  const vistos = new Set<string>();
  const pecas: PecaDoLook[] = [];

  for (const bruto of lista) {
    if (!bruto || typeof bruto !== "object") continue;
    const { handle, motivo, ocasiao } = bruto as Record<string, unknown>;

    if (typeof handle !== "string" || !validos.has(handle) || vistos.has(handle)) continue;
    if (typeof motivo !== "string" || !motivo.trim()) continue;

    vistos.add(handle);
    pecas.push({
      handle,
      motivo: limitar(motivo.trim(), 90),
      // Ocasião vazia não descarta a peça: o agrupamento é apresentação, e uma
      // peça bem escolhida com rótulo faltando ainda vale mais que um buraco no
      // look. Ela cai no bloco padrão.
      ocasiao: texto(ocasiao, OCASIAO_PADRAO, 24),
      position: pecas.length,
    });

    if (pecas.length === MAX_PECAS) break;
  }

  return pecas;
};

/**
 * O que `comporLook` devolve: o look, ou a razão de não ter havido um.
 *
 * O `porque` já existia — ia para o `console.warn` e morria ali. Ele passou a
 * ser devolvido porque a falha agora é PERSISTIDA (`gravarFalha`), e "tentei e
 * não deu" sem dizer o que não deu é um registro que não responde nada quando
 * alguém for olhar. `motivo_do_fallback` é a coluna que estava esperando por
 * isto desde a 0014.
 *
 * Não é união discriminada de propósito: os dois consumidores em `scripts/` só
 * perguntam `if (!look)`, e um discriminante que não estreita depois do
 * destructuring seria cerimônia sem retorno.
 */
export interface Composicao {
  look: Look | null;
  /** Preenchido **só** quando `look` é `null`. */
  porque: string | null;
}

/**
 * A composição, a partir de um espaço de escolha já montado.
 *
 * Devolve `look: null` — e não um look de consolação — em todo caminho de falha.
 * Ver a decisão inteira em `look.types.ts` → `Look`: uma lista sem motivos,
 * servida justamente quando o agente falhou, ocupa na tela o lugar da única
 * coisa que esta feature tem a provar.
 *
 * O `porque` **não vai para a tela** — vai para o log e para o banco. Ele existe
 * porque "por que não apareceu look?" precisa de resposta sem anexar um
 * depurador; quem responde é o terminal, não a pessoa que veio comprar.
 *
 * Separada de `gerarLook` para o dry run poder reaproveitá-la sem repetir a
 * consulta — e para que o caminho que o script exercita seja literalmente o
 * mesmo que roda em produção.
 */
export const comporLook = async (
  ancora: Ancora,
  contexto: Contexto,
  candidatos: Candidato[],
): Promise<Composicao> => {
  const desistir = (porque: string): Composicao => {
    console.warn(`[look] ${ancora.handle}: sem look — ${porque}`);
    return { look: null, porque };
  };

  const resposta = await perguntar(
    montarMensagem(ancora, contexto, candidatos),
    `look ${ancora.handle}`,
  );
  if (!resposta) return desistir("modelo indisponível ou com erro");

  const crua = extrairJson(resposta.texto) as RespostaCrua | null;
  if (!crua) return desistir("resposta sem JSON parseável");

  const confianca = typeof crua.confianca === "number" ? crua.confianca : 0;
  if (confianca < PISO_DE_CONFIANCA) {
    return desistir(`confiança ${confianca} abaixo do piso`);
  }

  const pecas = validar(crua.pecas, candidatos);
  if (pecas.length < MIN_PECAS) {
    return desistir(`só ${pecas.length} peça(s) sobreviveram à validação`);
  }

  return {
    look: {
      titulo: texto(crua.titulo, TITULO_PADRAO, 45),
      confianca,
      pecas,
    },
    porque: null,
  };
};

/**
 * Compõe o look de uma peça para um contexto **e grava**.
 *
 * Leva ~35-60s por causa do modelo, e às vezes muito mais (o Decopilot entra em
 * `waiting-capacity` e trava até o timeout) — **nunca chame isto de dentro de
 * uma request que alguém esteja esperando.** Quem consome é `look.actions.ts`,
 * que dispara sem `await` e responde na hora.
 *
 * **Falha grava um marcador, e não um look.** A versão anterior não gravava
 * nada, com um argumento que parecia bom: sem linha, o próximo carregamento
 * tenta de novo, que é o certo quando a causa provável é saturação do provedor.
 * O que faltava ao argumento é o caso em que a geração NUNCA converge — aí
 * "tenta de novo" deixa de ser resiliência e vira laço, e a cada pageview nasce
 * uma chamada de 120s que falha e não deixa rastro. Responder a uma saturação
 * gerando mais carga é o pior comportamento disponível.
 *
 * O marcador preserva a intenção original e corrige o defeito: o retry continua
 * existindo, só que **espaçado** por `TTL_FALHA_MINUTOS` em vez de imediato. Ele
 * não é servível — `lerLook` ignora `origem <> 'agente'` —, então a regra "ou o
 * look é do agente, ou a section não aparece" segue intacta.
 */
export const gerarLook = async (
  handle: string,
  contexto: Contexto,
  contextoHash: string,
): Promise<Look | null> => {
  const alvo = await acharAncora(handle);
  if (!alvo) return null;

  const candidatos = await montarCandidatos(alvo.variantId, jaComprados(contexto), contexto.sementes);

  // Pool pequeno também é falha que se repete: ele não depende do modelo, então
  // a visita seguinte encontraria exatamente o mesmo número. Marcar evita o par
  // gastar duas consultas de candidatos por pageview para sempre desistir.
  if (candidatos.length < MIN_PECAS) {
    await gravarFalha(alvo.ancora.productGroupId, `só ${candidatos.length} candidato(s) no pool`);
    return null;
  }

  const { look, porque } = await comporLook(alvo.ancora, contexto, candidatos);
  if (!look) {
    await gravarFalha(alvo.ancora.productGroupId, porque ?? "motivo não registrado");
    return null;
  }

  await gravarLook(alvo.ancora.productGroupId, contextoHash, look);

  return look;
};

/**
 * O look já pronto, se existir. É o caminho quente da PDP: uma leitura indexada
 * e nada mais.
 */
export const lookEmCache = (anchorId: string, contextoHash: string): Promise<Look | null> =>
  lerLook(anchorId, contextoHash);

export { MIN_PECAS, MAX_PECAS };
