/**
 * O agente de recomendação: etapa 1 -> modelo -> etapa 3.
 *
 * O modelo toca só o meio. A montagem do espaço de escolha (`vitrine.candidates`)
 * e a resolução de volta (`validar`, aqui) ficam em código, e é isso que torna
 * alucinação de produto **impossível por construção** em vez de mitigada: um
 * handle que não veio dos candidatos é descartado, nunca corrigido.
 *
 * **A etapa 3 pesa mais aqui do que no `look`.** Lá o modelo escolhia 5 a 10
 * entre 18 candidatos relacionados à peça aberta, e a âncora já era uma
 * restrição forte. Aqui ele escolhe entre 127 sem nada que o obrigue a se
 * relacionar com coisa alguma — a validação é a única fronteira entre o
 * catálogo e a tela, junto com a persona.
 *
 * Nada aqui lança. Todo caminho de falha termina em `null`, e `null` significa
 * uma coisa só: **a section não aparece**. Ver `vitrine.types.ts` → `Vitrine`.
 */

import { extrairJson } from "../shelf/shelf.agent";
import { perguntar } from "../shelf/shelf.decopilot";
import {
  MAX_PECAS,
  MIN_PECAS,
  montarMensagem,
  PISO_DE_CONFIANCA,
} from "./vitrine.prompt";
import type {
  Candidato,
  PecaRecomendada,
  Persona,
  RespostaCrua,
  Vitrine,
} from "./vitrine.types";

/** Título usado quando o modelo escolheu bem mas não soube nomear a vitrine. */
const TITULO_PADRAO = "Recomendações com a sua cara";

/** Corta com reticência: motivo cortado no meio soa quebrado. */
const limitar = (texto: string, max: number): string =>
  texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;

/**
 * Etapa 3: resolve a escolha do modelo contra os candidatos. **Sem modelo.**
 *
 * Descarta, nunca conserta. Um handle "quase certo" corrigido por proximidade
 * seria adivinhação, e a vitrine passaria a mostrar um produto que o modelo não
 * escolheu — com um motivo escrito para outro.
 *
 * **Peça sem motivo é descartada**, e isso não é rigor estético. Uma peça sem
 * explicação numa vitrine explicada é indistinguível de uma grade de
 * "recomendados", que é exatamente aquilo que esta feature existe para
 * contradizer. Se o modelo não soube dizer por que aquele produto serve àquela
 * pessoa, ele não escolheu: preencheu.
 *
 * Exportada porque é pura e é a fronteira que impede alucinação — o tipo de
 * função que precisa de teste próprio, não de teste através de quem a chama.
 */
export const validar = (lista: unknown, candidatos: readonly Candidato[]): PecaRecomendada[] => {
  if (!Array.isArray(lista)) return [];

  const validos = new Set(candidatos.map((c) => c.handle));
  const vistos = new Set<string>();
  const pecas: PecaRecomendada[] = [];

  for (const bruto of lista) {
    if (!bruto || typeof bruto !== "object") continue;
    const { handle, motivo } = bruto as Record<string, unknown>;

    if (typeof handle !== "string" || !validos.has(handle) || vistos.has(handle)) continue;
    if (typeof motivo !== "string" || !motivo.trim()) continue;

    vistos.add(handle);
    pecas.push({ handle, motivo: limitar(motivo.trim(), 90), position: pecas.length });

    if (pecas.length === MAX_PECAS) break;
  }

  return pecas;
};

/** O que `recomendar` devolve: a vitrine, ou a razão de não ter havido uma. */
export interface Recomendacao {
  vitrine: Vitrine | null;
  /** Preenchido **só** quando `vitrine` é `null`. Vai para o log e para o banco. */
  porque: string | null;
}

/**
 * A vitrine de uma pessoa, a partir do retrato dela e do catálogo.
 *
 * **Recebe a persona pronta, e isso é a decisão de desenho.** Ela não é derivada
 * aqui porque é o portão da feature (docs/vitrine-sem-ancora.md §6b): sem
 * retrato confiável não há vitrine, e quem decide isso é quem chama, ANTES de
 * gastar esta chamada. Passar `Persona | null` e desistir aqui dentro custaria
 * montar o pool de 127 produtos para jogá-lo fora.
 *
 * **Leva 35-60s**, e às vezes muito mais. Nunca chame de dentro de uma request
 * que alguém esteja esperando — o consumidor previsto é o cron.
 */
export const recomendar = async (
  persona: Persona,
  candidatos: readonly Candidato[],
): Promise<Recomendacao> => {
  const desistir = (porque: string): Recomendacao => {
    console.warn(`[vitrine] sem recomendação — ${porque}`);
    return { vitrine: null, porque };
  };

  // Pool pequeno demais não depende do modelo, então gastar a chamada para
  // descobrir isso é desperdício garantido.
  if (candidatos.length < MIN_PECAS) {
    return desistir(`só ${candidatos.length} produto(s) disponíveis no catálogo`);
  }

  const resposta = await perguntar(
    montarMensagem(persona, [...candidatos]),
    `vitrine ${candidatos.length} produtos`,
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
    vitrine: {
      titulo:
        typeof crua.titulo === "string" && crua.titulo.trim()
          ? limitar(crua.titulo.trim(), 45)
          : TITULO_PADRAO,
      confianca,
      pecas,
    },
    porque: null,
  };
};

export { MIN_PECAS, MAX_PECAS, TITULO_PADRAO };
