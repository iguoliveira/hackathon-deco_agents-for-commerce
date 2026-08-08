/**
 * Onde a pessoa está.
 *
 * Três fontes, nesta ordem, e a ordem é a decisão inteira:
 *
 *   1. o cookie do seletor  — ela disse
 *   2. os headers de geo    — a Vercel deduziu do IP
 *   3. o padrão             — não deu para saber
 *
 * **O seletor vence o geo**, e não o contrário. Quem viaja e continua comprando
 * para casa é o caso comum, não a exceção — e no palco é o que permite trocar
 * de cidade ao vivo com o mesmo IP.
 *
 * O que este arquivo deliberadamente NÃO faz: converter lugar em clima. Não há
 * tabela de estação, não há hemisfério, não há `if (cidade === ...)`. O local
 * cru vai para o prompt e o modelo conclui. Ver look.types.ts → `Local`.
 */

import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { lerLocalEscolhido } from "./look.cookies";
import type { Local } from "./look.types";

/**
 * Headers que a Vercel injeta na borda, de graça, em produção.
 * https://vercel.com/docs/headers/request-headers
 *
 * Em `vite dev` eles não existem — e é por isso que o seletor não é enfeite: sem
 * ele, o desenvolvimento inteiro aconteceria com o local no padrão, e ninguém
 * veria a feature funcionar antes do deploy.
 */
const HEADER_CIDADE = "x-vercel-ip-city";
const HEADER_REGIAO = "x-vercel-ip-country-region";
const HEADER_PAIS = "x-vercel-ip-country";

/**
 * O padrão quando não há seletor nem geo.
 *
 * É um lugar real e não uma string vazia porque o prompt precisa de algo sobre
 * o que raciocinar — e um agente que responde "não sei onde você está" no meio
 * de uma vitrine é pior que um que assume a maior cidade do país da loja. A
 * `origem` registra que foi suposição, e o seletor mostra isso na tela.
 */
const PADRAO: Local = { cidade: "São Paulo", regiao: "SP", pais: "BR", origem: "padrao" };

/** A cidade vem percent-encoded no header (`S%C3%A3o%20Paulo`). */
const decodificar = (valor: string): string => {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
};

export const localDaRequisicao = (req?: Request): Local => {
  const request = req ?? RequestContext.current?.request;

  const escolhido = lerLocalEscolhido(request);
  if (escolhido) return escolhido;

  const cidade = request?.headers.get(HEADER_CIDADE);
  if (cidade) {
    return {
      cidade: decodificar(cidade),
      regiao: decodificar(request?.headers.get(HEADER_REGIAO) ?? ""),
      pais: request?.headers.get(HEADER_PAIS) ?? "",
      origem: "geo",
    };
  }

  return PADRAO;
};

/** "Porto Alegre, RS, BR" — o formato que o modelo lê. Sem partes vazias. */
export const localEmTexto = (local: Local): string =>
  [local.cidade, local.regiao, local.pais].filter(Boolean).join(", ");

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * O mês por extenso, em português.
 *
 * Nome e não número porque é sobre isso que o modelo raciocina bem: "agosto" no
 * hemisfério sul carrega a inferência de frio, e `8` não carrega nada. Pelo
 * mesmo motivo o mês vai ao prompt junto do país — a mesma data é inverno em
 * Porto Alegre e verão em Lisboa, e quem sabe disso é o modelo, não este
 * arquivo.
 */
export const mesAtual = (agora = new Date()): string => MESES[agora.getUTCMonth()];
