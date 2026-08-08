import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { localDaRequisicao } from "~/platform/look/look.local";
import { serializarLocal } from "~/platform/look/look.cookies";
import type { Local } from "~/platform/look/look.types";

interface Props {
  cidade: string;
  regiao?: string;
  pais?: string;
}

/**
 * Guarda a cidade escolhida pela pessoa. É o que vence o geo por IP.
 *
 * Existe por dois motivos, e o segundo é o que a torna indispensável:
 *
 * 1. Quem viaja continua comprando para casa. O IP diz onde o corpo está, não
 *    para onde a roupa vai.
 * 2. **Em `vite dev` os headers de geo da Vercel não existem.** Sem o seletor,
 *    a feature inteira só seria observável depois de um deploy — e a diferença
 *    entre um look para Porto Alegre e um para Recife é justamente o que
 *    precisa ser iterado com o dev server aberto.
 *
 * Não valida a cidade contra lista nenhuma, e isso é deliberado: uma lista de
 * cidades no código seria o mesmo erro que uma lista de estações. O modelo
 * recebe o texto e decide se reconhece — o prompt manda explicitamente não
 * inventar clima para lugar desconhecido.
 */
async function action(props: Props, _req?: Request): Promise<Local> {
  const cidade = props?.cidade?.trim();
  if (!cidade) throw new Error("cidade is required");

  const escolhido = {
    cidade,
    regiao: props.regiao?.trim() ?? "",
    pais: props.pais?.trim() ?? "",
  };

  RequestContext.responseHeaders.append("Set-Cookie", serializarLocal(escolhido));

  // Devolve o `Local` completo, com `origem: "seletor"`, para o cliente poder
  // pintar o estado novo sem uma segunda ida ao servidor.
  return { ...escolhido, origem: "seletor" };
}

/** O local em vigor agora — o que o seletor mostra como selecionado ao abrir. */
export const localAtual = (): Local => localDaRequisicao();

export default action;
