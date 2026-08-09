/**
 * O agente de composição: etapa 1 -> modelo -> etapa 3.
 *
 * O modelo toca só o meio. A montagem do espaço de escolha (etapa 1) e a
 * resolução de volta (etapa 3) ficam em código, e é isso que torna alucinação
 * de produto **impossível por construção** em vez de mitigada: um handle que
 * não veio dos candidatos é descartado, nunca corrigido.
 *
 * Nada aqui lança. Todo caminho de falha termina num look — o do modelo ou o do
 * SQL. Uma section vazia por erro de agente é o pior resultado possível desta
 * feature, e passaria despercebido porque a página continua respondendo 200.
 */

import { extrairJson } from "../shelf/shelf.agent";
import { perguntar } from "../shelf/shelf.decopilot";
import { montarCandidatos } from "./look.candidates";
import { acharAncora, gravarLook, lerLook } from "./look.d1";
import { montarMensagem, PISO_DE_CONFIANCA } from "./look.prompt";
import type { Ancora, Candidato, Contexto, Look, PecaDoLook, RespostaCrua } from "./look.types";

/** Título usado quando o texto do modelo é descartado. */
const TITULO_PADRAO = "Complete o look";
/** Rótulo de bloco no fallback: neutro, porque não houve julgamento nenhum. */
const OCASIAO_PADRAO = "Combina com esta peça";

/** Abaixo disto não é look, é sobra. Melhor a ordenação completa do SQL. */
const MIN_PECAS = 4;
const MAX_PECAS = 10;

/**
 * Os produtos que a pessoa já comprou — o que sai do pool de candidatos.
 *
 * Exportado porque `look.actions.ts` monta os candidatos por conta própria no
 * cache miss (para responder na hora com a ordenação do SQL), e os dois
 * caminhos precisam excluir exatamente o mesmo conjunto. Se divergirem, o look
 * do fallback mostra uma peça que o do agente nunca mostraria — e ninguém
 * entenderia por que ela some no reload seguinte.
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
 * O look determinístico: os candidatos na ordem que o SQL já deu.
 *
 * `findComplementsAvailable` ordena por tags em comum e coleção, então o topo
 * já é defensável sem nenhum modelo. Sem motivos, porque inventar texto aqui
 * seria exatamente o que o agente existe para fazer com julgamento — e um
 * motivo genérico gerado em código seria pior que nenhum, porque mentiria sobre
 * a procedência.
 */
const lookDoSql = (candidatos: Candidato[], porque: string): Look => ({
  titulo: TITULO_PADRAO,
  confianca: 0,
  pecas: candidatos.slice(0, MAX_PECAS).map((candidato, i) => ({
    handle: candidato.handle,
    motivo: "",
    ocasiao: OCASIAO_PADRAO,
    position: i,
  })),
  origem: "sql",
  motivoDoFallback: porque,
});

/**
 * A composição, a partir de um espaço de escolha já montado.
 *
 * Separada de `gerarLook` para o dry run poder reaproveitá-la sem repetir a
 * consulta — e para que o caminho que o script exercita seja literalmente o
 * mesmo que roda em produção.
 */
export const comporLook = async (
  ancora: Ancora,
  contexto: Contexto,
  candidatos: Candidato[],
): Promise<Look> => {
  const resposta = await perguntar(
    montarMensagem(ancora, contexto, candidatos),
    `look ${ancora.handle}`,
  );
  if (!resposta) return lookDoSql(candidatos, "modelo indisponível ou com erro");

  const crua = extrairJson(resposta.texto) as RespostaCrua | null;
  if (!crua) return lookDoSql(candidatos, "resposta sem JSON parseável");

  const confianca = typeof crua.confianca === "number" ? crua.confianca : 0;
  if (confianca < PISO_DE_CONFIANCA) {
    return lookDoSql(candidatos, `confiança ${confianca} abaixo do piso`);
  }

  const pecas = validar(crua.pecas, candidatos);
  if (pecas.length < MIN_PECAS) {
    return lookDoSql(candidatos, `só ${pecas.length} peça(s) sobreviveram à validação`);
  }

  return {
    titulo: texto(crua.titulo, TITULO_PADRAO, 45),
    confianca,
    pecas,
    origem: "agente",
  };
};

/**
 * Compõe o look de uma peça para um contexto **e grava**.
 *
 * Leva ~35-60s por causa do modelo, e às vezes muito mais (o Decopilot entra em
 * `waiting-capacity` e trava até o timeout) — **nunca chame isto de dentro de
 * uma request que alguém esteja esperando.** Quem consome é `look.actions.ts`,
 * que dispara sem `await` e responde na hora com a ordenação do SQL.
 *
 * Grava inclusive o look do SQL. Ele não é só modo de falha: é estado
 * intermediário válido, que a próxima passada substitui por um do agente.
 */
export const gerarLook = async (
  handle: string,
  contexto: Contexto,
  contextoHash: string,
): Promise<Look | null> => {
  const alvo = await acharAncora(handle);
  if (!alvo) return null;

  const candidatos = await montarCandidatos(alvo.variantId, jaComprados(contexto), contexto.sementes);
  if (candidatos.length < MIN_PECAS) return null;

  const look = await comporLook(alvo.ancora, contexto, candidatos);
  await gravarLook(alvo.ancora.productGroupId, contextoHash, look);

  return look;
};

/**
 * O look já pronto, se existir. É o caminho quente da PDP: uma leitura indexada
 * e nada mais.
 */
export const lookEmCache = (anchorId: string, contextoHash: string): Promise<Look | null> =>
  lerLook(anchorId, contextoHash);

export { lookDoSql, MIN_PECAS, MAX_PECAS };
