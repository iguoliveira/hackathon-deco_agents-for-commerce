/**
 * O agente da vitrine: etapa 1 -> modelo -> etapa 3.
 *
 * O modelo toca só o meio. A seleção do espaço de escolha (etapa 1) e a
 * resolução de volta (etapa 3) ficam em código, e é isso que torna alucinação
 * de produto **impossível por construção** em vez de mitigada: um handle que
 * não veio dos candidatos é descartado, nunca corrigido.
 *
 * Nada aqui lança. Todo caminho de falha termina numa vitrine — a do modelo ou
 * a do SQL. Uma section vazia por erro de agente é o pior resultado possível
 * desta feature.
 */

import { montarEspacoDeEscolha, type EspacoDeEscolha } from "./shelf.candidates";
import { perguntar } from "./shelf.decopilot";
import { montarMensagem, PISO_DE_CONFIANCA } from "./shelf.prompt";
import type { Candidato, ItemDaVitrine, RespostaCrua, Vitrine } from "./shelf.types";

/** Título usado quando o texto do modelo é descartado. */
const TITULO_PADRAO = "Disponíveis agora, perto do que você queria";

const MIN_ITENS = 3;
const MAX_ITENS = 6;

/**
 * Extrai o primeiro objeto JSON completo de um texto.
 *
 * Um `JSON.parse` no texto inteiro é ingênuo aqui: o Decopilot não garante
 * saída estruturada — ele tem prompt de sistema próprio, que briga com o nosso
 * "responda só JSON" — e pode envolver a resposta em cerca de markdown ou
 * emendar uma frase. Um regex ganancioso (`/\{[\s\S]*\}/`) também erra, porque
 * casa até a última chave do texto, engolindo qualquer coisa depois do objeto.
 *
 * Por isso o balanceamento de chaves, ignorando as que estiverem dentro de
 * string.
 */
export const extrairJson = (texto: string): unknown => {
  const inicio = texto.indexOf("{");
  if (inicio === -1) return null;

  let profundidade = 0;
  let dentroDeString = false;
  let escapado = false;

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];

    if (dentroDeString) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === '"') dentroDeString = false;
      continue;
    }

    if (c === '"') dentroDeString = true;
    else if (c === "{") profundidade++;
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0) {
        try {
          return JSON.parse(texto.slice(inicio, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
};

/** Corta com reticência em vez de truncar seco — motivo cortado no meio soa quebrado. */
const limitar = (texto: string, max: number): string =>
  texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;

/**
 * Etapa 3: resolve a escolha do modelo contra os candidatos. **Sem modelo.**
 *
 * Descarta, nunca conserta: um handle "quase certo" corrigido por proximidade
 * seria adivinhação, e a vitrine passaria a mostrar um produto que o modelo não
 * escolheu. Duplicata também sai — o modelo às vezes repete o melhor candidato.
 */
export const validar = (crua: RespostaCrua, candidatos: Candidato[]): ItemDaVitrine[] => {
  if (!Array.isArray(crua.itens)) return [];

  const validos = new Map(candidatos.map((c) => [c.handle, c]));
  const vistos = new Set<string>();
  const itens: ItemDaVitrine[] = [];

  for (const bruto of crua.itens) {
    if (!bruto || typeof bruto !== "object") continue;
    const { handle, motivo } = bruto as { handle?: unknown; motivo?: unknown };

    if (typeof handle !== "string" || !validos.has(handle) || vistos.has(handle)) continue;

    vistos.add(handle);
    itens.push({
      handle,
      motivo: typeof motivo === "string" ? limitar(motivo.trim(), 90) : "",
    });

    if (itens.length === MAX_ITENS) break;
  }

  return itens;
};

/**
 * A vitrine determinística: os candidatos na ordem que o SQL já deu.
 *
 * `findSimilarAvailable` ordena por nota (tag=3, mesmo tipo=4, mesma
 * coleção=2), então o topo desta lista já é defensável sem nenhum modelo. Sem
 * motivo, porque inventar texto aqui seria exatamente o que o agente existe
 * para fazer com julgamento.
 */
const vitrineDoSql = (candidatos: Candidato[], porque: string): Vitrine => ({
  titulo: TITULO_PADRAO,
  confianca: 0,
  itens: candidatos.slice(0, MAX_ITENS).map((c) => ({ handle: c.handle, motivo: "" })),
  origem: "sql",
  motivoDoFallback: porque,
});

/**
 * Monta a vitrine de um comprador.
 *
 * Roda em ~33s por causa do modelo — **nunca chame isto de dentro de uma
 * request que alguém esteja esperando.** O lugar dela é o gatilho do clique
 * (fora do caminho da resposta) e o cron de refresh.
 */
export const montarVitrine = async (email: string): Promise<Vitrine | null> => {
  const espaco = await montarEspacoDeEscolha(email);
  if (espaco.candidatos.length === 0) return null;

  return montarVitrineDoEspaco(espaco, email);
};

/** A parte que o dry run reaproveita sem repetir a consulta. */
export const montarVitrineDoEspaco = async (
  espaco: EspacoDeEscolha,
  rotulo: string,
): Promise<Vitrine> => {
  const { candidatos, desejos } = espaco;

  const resposta = await perguntar(montarMensagem(desejos, candidatos), `vitrine ${rotulo}`);
  if (!resposta) return vitrineDoSql(candidatos, "modelo indisponível ou com erro");

  const crua = extrairJson(resposta.texto) as RespostaCrua | null;
  if (!crua) return vitrineDoSql(candidatos, "resposta sem JSON parseável");

  const confianca = typeof crua.confianca === "number" ? crua.confianca : 0;
  if (confianca < PISO_DE_CONFIANCA) {
    return vitrineDoSql(candidatos, `confiança ${confianca} abaixo do piso`);
  }

  const itens = validar(crua, candidatos);
  // Menos de 3 itens não é vitrine, é sobra. Melhor a ordenação completa do SQL
  // do que três caixinhas com texto bonito.
  if (itens.length < MIN_ITENS) {
    return vitrineDoSql(candidatos, `só ${itens.length} item(ns) sobreviveram à validação`);
  }

  const titulo = typeof crua.titulo === "string" && crua.titulo.trim() ? crua.titulo.trim() : "";

  return {
    titulo: titulo ? limitar(titulo, 45) : TITULO_PADRAO,
    confianca,
    itens,
    origem: "agente",
  };
};
