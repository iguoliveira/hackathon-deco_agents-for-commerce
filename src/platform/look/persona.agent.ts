/**
 * A síntese: sinais → retrato do guarda-roupa. Uma chamada ao modelo.
 *
 * Mesma anatomia do agente de composição — determinístico → modelo →
 * determinístico —, e pelo mesmo motivo: é a etapa 3 que torna invenção
 * **impossível por construção** em vez de mitigada. Lá, um handle fora dos
 * candidatos é descartado; aqui, um título de evidência que não veio dos sinais
 * derruba o eixo inteiro.
 *
 * A diferença de consequência entre os dois justifica o rigor ser maior aqui: um
 * look ruim é um look ruim, e a pessoa vê e ignora. Uma persona ruim fica **a
 * montante** e envenena todos os looks daquela pessoa até os sinais mudarem.
 *
 * Nada lança. Todo caminho de falha termina em `null`, e `null` significa uma
 * coisa só: **compõe sem persona**, que é o que o agente já faz hoje para quem
 * não tem histórico. Nenhum consumidor precisa aprender um terceiro estado.
 */

import { extrairJson } from "../shelf/shelf.agent";
import { perguntar } from "../shelf/shelf.decopilot";
import {
  gravarFalhaDaPersona,
  gravarPersona,
  lerPersona,
  personaFalhouRecentemente,
} from "./look.d1";
import { hashDosSinais } from "./look.hash";
import {
  MIN_EIXOS,
  montarMensagemDaPersona,
  PISO_DA_PERSONA,
} from "./persona.prompt";
import type { EixoDaPersona, Persona, RespostaDaPersona, Semente } from "./look.types";

/** Corta com reticência: eixo cortado no meio soa quebrado. */
const limitar = (texto: string, max: number): string =>
  texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;

/**
 * Resolve o retrato contra os sinais que o geraram. **Sem modelo.**
 *
 * Descarta, nunca conserta — e o que se descarta é o eixo inteiro, não só a
 * evidência ruim. Um eixo que perdeu metade da evidência é uma afirmação que
 * perdeu metade do apoio, e mantê-la seria deixar o modelo afirmar mais do que
 * observou.
 *
 * A comparação é por **título exato**. Casar por proximidade ("Pleated Chino" ≈
 * "Pleated Chinos") seria adivinhar qual peça ele quis dizer, que é exatamente
 * o erro que a validação existe para impedir.
 */
export const validarPersona = (bruto: unknown, sinais: Semente[]): EixoDaPersona[] => {
  if (!Array.isArray(bruto)) return [];

  const titulosReais = new Set(sinais.map((s) => s.titulo));
  const eixosVistos = new Set<string>();
  const eixos: EixoDaPersona[] = [];

  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const { eixo, valor, evidencia } = item as Record<string, unknown>;

    if (typeof eixo !== "string" || !eixo.trim()) continue;
    if (typeof valor !== "string" || !valor.trim()) continue;

    // Dois eixos com o mesmo nome não são dois eixos — o segundo é ruído, e no
    // retrato ele apareceria como se fosse observação nova.
    const chave = eixo.trim().toLowerCase();
    if (eixosVistos.has(chave)) continue;

    if (!Array.isArray(evidencia)) continue;
    const apoio = evidencia.filter(
      (titulo): titulo is string => typeof titulo === "string" && titulosReais.has(titulo),
    );

    // **Eixo sem apoio não existe.** É a regra que separa esta persona da que o
    // prompt de composição proíbe: sem as peças que a sustentam, "cor dominante:
    // escuros" é uma opinião sobre a pessoa.
    if (apoio.length === 0) continue;

    eixosVistos.add(chave);
    eixos.push({
      eixo: limitar(eixo.trim(), 24),
      valor: limitar(valor.trim(), 40),
      evidencia: [...new Set(apoio)],
    });
  }

  return eixos;
};

/**
 * O retrato de um conjunto de sinais, ou `null`.
 *
 * `null` em todo caminho de falha, e o motivo vai para o log — mesma escolha de
 * `comporLook`. A section não some por causa disto: quem não tem persona compõe
 * sem ela.
 *
 * **Leva 22-41s**, como qualquer chamada ao Decopilot. Nunca chame de dentro de
 * uma request que alguém esteja esperando.
 */
export const derivarPersona = async (
  sinais: Semente[],
): Promise<{ persona: Persona | null; porque: string }> => {
  const desistir = (porque: string) => {
    console.warn(`[persona] sem retrato — ${porque}`);
    return { persona: null, porque };
  };

  // Menos que isto não descreve armário nenhum, e gastar 40s de modelo para
  // ouvir "confiança 0.3" é pagar para aprender o que a contagem já dizia.
  if (sinais.length < MIN_EIXOS) {
    return desistir(`só ${sinais.length} sinal(is) — não há armário a descrever`);
  }

  const resposta = await perguntar(montarMensagemDaPersona(sinais), `persona ${sinais.length}`);
  if (!resposta) return desistir("modelo indisponível ou com erro");

  const crua = extrairJson(resposta.texto) as RespostaDaPersona | null;
  if (!crua) return desistir("resposta sem JSON parseável");

  const confianca = typeof crua.confianca === "number" ? crua.confianca : 0;
  if (confianca < PISO_DA_PERSONA) {
    return desistir(`confiança ${confianca} abaixo do piso`);
  }

  const eixos = validarPersona(crua.eixos, sinais);
  if (eixos.length < MIN_EIXOS) {
    return desistir(`só ${eixos.length} eixo(s) sobreviveram à validação`);
  }

  return { persona: { eixos, confianca }, porque: "" };
};

/**
 * Quanto tempo um conjunto de sinais que falhou fica em quarentena.
 *
 * Mesmos dez minutos de `TTL_FALHA_MINUTOS`, e o mesmo argumento: é o maior
 * valor que ainda cabe entre "parou de gerar carga" e "alguém percebeu no
 * palco". Vale mais aqui do que no look, porque a persona é a montante de todas
 * as peças — sem quarentena, um provedor saturado recebe uma síntese nova por
 * PDP aberta, de toda pessoa que tenha sinais.
 */
const TTL_FALHA_MINUTOS = 10;

/**
 * A persona de quem tem estes sinais: cache → quarentena → síntese → grava.
 *
 * **É o único ponto de entrada que a composição usa.** `derivarPersona` fica
 * exportada para o dry run e para o `look:eval` poderem sintetizar sem tocar no
 * banco, mas quem chama no caminho de produção chama isto.
 *
 * A ordem das três guardas não é arbitrária:
 *
 *   1. **cache** primeiro, porque é o caminho quente e custa uma leitura
 *      indexada. Uma pessoa que abre cinco PDPs sintetiza uma vez.
 *   2. **quarentena** depois, porque só interessa quando não há persona boa —
 *      e `lerPersona` já ignora a linha de falha, então as duas consultas nunca
 *      concordam por acidente.
 *   3. **síntese** por último, porque é a que custa 22-41s.
 *
 * `null` em qualquer ponto significa "compõe sem persona", nunca "erro".
 *
 * **Não chame de dentro de uma request que alguém esteja esperando.**
 */
export const obterPersona = async (sinais: Semente[]): Promise<Persona | null> => {
  if (sinais.length === 0) return null;

  const hash = hashDosSinais(sinais);

  const cacheada = await lerPersona(hash);
  if (cacheada) return cacheada;

  if (await personaFalhouRecentemente(hash, TTL_FALHA_MINUTOS)) {
    console.warn(`[persona] ${hash} em quarentena — compondo sem retrato`);
    return null;
  }

  const { persona, porque } = await derivarPersona(sinais);

  if (!persona) {
    // Grava a falha ANTES de devolver: é o que impede a próxima PDP da mesma
    // pessoa de repetir a mesma síntese de 40s. Falha que não deixa rastro vira
    // laço — a lição da #20, aplicada uma camada acima.
    await gravarFalhaDaPersona(hash, porque);
    return null;
  }

  await gravarPersona(hash, persona);
  return persona;
};
