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
import { gravarVitrine } from "./shelf.d1";
import { perguntar } from "./shelf.decopilot";
import { montarMensagem, PISO_DE_CONFIANCA } from "./shelf.prompt";
import type { Candidato, ItemDaVitrine, RespostaCrua, Vitrine } from "./shelf.types";

/** Título usado quando o texto do modelo é descartado. */
const TITULO_PADRAO = "Disponíveis agora, perto do que você queria";
/** Idem, para a vitrine de composição. */
const TITULO_COMBINA_PADRAO = "Para usar com o que você queria";

const MIN_ITENS = 3;
const MAX_ITENS = 10;
const MIN_COMBINAM = 3;
const MAX_COMBINAM = 6;

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
export const validar = (
  lista: unknown,
  candidatos: Candidato[],
  maximo: number,
  jaUsados: Set<string> = new Set(),
): ItemDaVitrine[] => {
  if (!Array.isArray(lista)) return [];

  const validos = new Set(candidatos.map((c) => c.handle));
  const vistos = new Set<string>(jaUsados);
  const itens: ItemDaVitrine[] = [];

  for (const bruto of lista) {
    if (!bruto || typeof bruto !== "object") continue;
    const { handle, motivo } = bruto as { handle?: unknown; motivo?: unknown };

    // `validos` é o pool DAQUELA vitrine, não a união dos dois. É o que impede
    // um complemento de vazar para a lista de alternativas quando o modelo
    // ignora a separação — o handle existe, mas não naquela lista.
    if (typeof handle !== "string" || !validos.has(handle) || vistos.has(handle)) continue;

    vistos.add(handle);
    itens.push({
      handle,
      motivo: typeof motivo === "string" ? limitar(motivo.trim(), 90) : "",
    });

    if (itens.length === maximo) break;
  }

  return itens;
};

/**
 * As vitrines determinísticas: os candidatos na ordem que o SQL já deu.
 *
 * `findSimilarAvailable` e `findComplementsAvailable` ordenam por afinidade,
 * então o topo de cada lista já é defensável sem nenhum modelo. Sem motivo,
 * porque inventar texto aqui seria exatamente o que o agente existe para fazer
 * com julgamento.
 */
const vitrineDoSql = (espaco: EspacoDeEscolha, porque: string): Vitrine => {
  const itens = espaco.alternativas.slice(0, MAX_ITENS);
  // Os dois pools podem conter o mesmo produto de propósito (ver
  // shelf.candidates.ts); quem impede a repetição na tela é sempre a saída,
  // inclusive aqui, onde não houve modelo nenhum.
  const usados = new Set(itens.map((c) => c.handle));

  return {
    titulo: TITULO_PADRAO,
    confianca: 0,
    itens: itens.map((c) => ({ handle: c.handle, motivo: "" })),
    tituloCombina: TITULO_COMBINA_PADRAO,
    combinam: espaco.complementos
      .filter((c) => !usados.has(c.handle))
      .slice(0, MAX_COMBINAM)
      .map((c) => ({ handle: c.handle, motivo: "" })),
    origem: "sql",
    motivoDoFallback: porque,
  };
};

/**
 * Monta as vitrines de um comprador **e grava**.
 *
 * Roda em ~33s por causa do modelo, e às vezes muito mais (o Decopilot entra em
 * `waiting-capacity` e trava até o timeout) — **nunca chame isto de dentro de
 * uma request que alguém esteja esperando.** O lugar dela é o gatilho do clique
 * (fora do caminho da resposta) e o cron de refresh.
 *
 * Grava inclusive a vitrine do SQL. Ela não é só um modo de falha: é um estado
 * intermediário válido, que a próxima passada do cron substitui por uma do
 * agente. Não gravar deixaria o comprador sem vitrine nenhuma sempre que o
 * provedor estivesse saturado.
 */
export const gerarVitrine = async (email: string): Promise<Vitrine | null> => {
  const espaco = await montarEspacoDeEscolha(email);
  if (espaco.alternativas.length === 0 && espaco.complementos.length === 0) return null;

  const vitrine = await montarVitrineDoEspaco(espaco, email);
  const ancora = espaco.brutos[0];
  if (ancora) await gravarVitrine(email, vitrine, ancora.variantId);

  return vitrine;
};

/** A parte que o dry run reaproveita sem repetir a consulta. */
export const montarVitrineDoEspaco = async (
  espaco: EspacoDeEscolha,
  rotulo: string,
): Promise<Vitrine> => {
  const { alternativas, complementos, desejos } = espaco;

  const resposta = await perguntar(
    montarMensagem(desejos, alternativas, complementos),
    `vitrine ${rotulo}`,
  );
  if (!resposta) return vitrineDoSql(espaco, "modelo indisponível ou com erro");

  const crua = extrairJson(resposta.texto) as RespostaCrua | null;
  if (!crua) return vitrineDoSql(espaco, "resposta sem JSON parseável");

  const confianca = typeof crua.confianca === "number" ? crua.confianca : 0;
  if (confianca < PISO_DE_CONFIANCA) {
    return vitrineDoSql(espaco, `confiança ${confianca} abaixo do piso`);
  }

  const itens = validar(crua.itens, alternativas, MAX_ITENS);
  // Menos de 3 alternativas não é vitrine, é sobra. Melhor a ordenação completa
  // do SQL do que três caixinhas com texto bonito.
  if (itens.length < MIN_ITENS) {
    return vitrineDoSql(espaco, `só ${itens.length} alternativa(s) sobreviveram à validação`);
  }

  // A vitrine de "combina" não derruba a principal: se ela sair curta, cai
  // sozinha para a ordenação do SQL enquanto as alternativas mantêm o texto do
  // agente. Descartar o trabalho todo por causa da segunda lista seria trocar
  // uma vitrine boa e uma média por duas médias.
  // `jaUsados` é onde a não-repetição entre as duas vitrines é imposta — e não
  // na montagem dos pools, que precisa deles ricos. Ver shelf.candidates.ts.
  const usadosNasAlternativas = new Set(itens.map((item) => item.handle));
  const combinamDoAgente = validar(
    crua.combinam,
    complementos,
    MAX_COMBINAM,
    usadosNasAlternativas,
  );
  const combinam =
    combinamDoAgente.length >= MIN_COMBINAM
      ? combinamDoAgente
      : complementos
          .filter((c) => !usadosNasAlternativas.has(c.handle))
          .slice(0, MAX_COMBINAM)
          .map((c) => ({ handle: c.handle, motivo: "" }));

  const texto = (valor: unknown, padrao: string): string =>
    typeof valor === "string" && valor.trim() ? limitar(valor.trim(), 45) : padrao;

  return {
    titulo: texto(crua.titulo, TITULO_PADRAO),
    confianca,
    itens,
    tituloCombina: texto(crua.tituloCombina, TITULO_COMBINA_PADRAO),
    combinam,
    origem: "agente",
  };
};
