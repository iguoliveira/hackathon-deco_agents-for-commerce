/**
 * Os dois cookies desta feature: o que a pessoa viu e onde ela diz estar.
 *
 * Sem assinatura, ao contrário de `shelf.cookie.ts`, e a diferença é de
 * consequência: aquele decide **de quem é** a vitrine mostrada, então forjá-lo
 * vaza o que outra pessoa quis comprar. Estes dois só influenciam o que o
 * agente recomenda para quem os apresenta. Forjar `deco_local` é escolher a
 * própria cidade — que é literalmente o que o seletor faz.
 *
 * Ambos são marcados pelo SERVIDOR, nunca por `document.cookie`. O Safari
 * limita a 7 dias os cookies escritos por JavaScript, e um `Set-Cookie` de
 * primeira parte não cai nesse teto. Escrever pelo JS é o caminho "óbvio" e ele
 * apaga o histórico de uma fatia grande do tráfego sem avisar — armadilha já
 * documentada em docs/personal-shopping-agent-mudancas.md §2.
 */

import type { Local } from "./look.types";

export const RECENT_COOKIE = "deco_recent";
/**
 * 30 minutos. "Visto recentemente" é sinal de sessão, não de perfil: uma peça
 * olhada semana passada e nunca mais não diz nada sobre o que a pessoa está
 * montando agora, e entraria competindo com o favorito, que é declarado.
 */
export const RECENT_COOKIE_TTL = 60 * 30;
/**
 * Quantos handles cabem. Acima disso o cookie começa a pesar em toda requisição
 * e a cauda nunca é lida — as sementes são ordenadas por força e recência, e da
 * sexta em diante nada chega ao prompt.
 */
export const RECENT_MAX = 8;

export const LOCAL_COOKIE = "deco_local";
export const LOCAL_COOKIE_TTL = 60 * 60 * 24 * 365;

const ler = (req: Request | undefined, nome: string): string | null => {
  const header = req?.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${nome}=`));
  return match ? decodeURIComponent(match.slice(nome.length + 1)) : null;
};

/**
 * Os handles vistos, do mais recente para o mais antigo.
 *
 * Nunca lança: cookie corrompido ou de uma versão anterior do formato vira
 * lista vazia, que é o mesmo que um visitante novo — degradação correta.
 */
export const lerVistos = (req: Request | undefined): string[] => {
  const cru = ler(req, RECENT_COOKIE);
  if (!cru) return [];
  try {
    const lista = JSON.parse(cru);
    return Array.isArray(lista) && lista.every((x) => typeof x === "string")
      ? lista.slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
};

/**
 * Põe um handle na frente da lista, sem duplicar.
 *
 * Move para o topo em vez de ignorar quando já existe: revisitar uma peça é
 * sinal mais forte que vê-la uma vez, e a ordem é o que o desempate lê.
 */
export const serializarVistos = (vistos: string[], novo: string): string => {
  const lista = [novo, ...vistos.filter((h) => h !== novo)].slice(0, RECENT_MAX);
  const valor = encodeURIComponent(JSON.stringify(lista));
  return `${RECENT_COOKIE}=${valor}; Path=/; Max-Age=${RECENT_COOKIE_TTL}; SameSite=Lax`;
};

/** O local escolhido no seletor, ou `null` para deixar o geo decidir. */
export const lerLocalEscolhido = (req: Request | undefined): Local | null => {
  const cru = ler(req, LOCAL_COOKIE);
  if (!cru) return null;
  try {
    const valor = JSON.parse(cru);
    if (!valor || typeof valor !== "object") return null;
    const { cidade, regiao, pais } = valor as Record<string, unknown>;
    if (typeof cidade !== "string" || !cidade) return null;
    return {
      cidade,
      regiao: typeof regiao === "string" ? regiao : "",
      pais: typeof pais === "string" ? pais : "",
      origem: "seletor",
    };
  } catch {
    return null;
  }
};

export const serializarLocal = (local: Pick<Local, "cidade" | "regiao" | "pais">): string => {
  const valor = encodeURIComponent(JSON.stringify(local));
  return `${LOCAL_COOKIE}=${valor}; Path=/; Max-Age=${LOCAL_COOKIE_TTL}; SameSite=Lax`;
};
