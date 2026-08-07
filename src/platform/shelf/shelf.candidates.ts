/**
 * Etapa 1 do pipeline: montar o espaço de escolha. **Sem modelo.**
 *
 * Aqui está a decisão que define o produto: os candidatos vêm sempre de
 * `findSimilarAvailable(variantId)`, ancorados no que a pessoa quis e não pôde
 * levar — nunca de uma consulta geral ao catálogo. Um agente que recebesse a
 * loja inteira produziria uma vitrine plausível e genérica, que é exatamente o
 * que qualquer loja já tem e não usa o sinal que esta feature captura.
 */

import { findWaitedItems, type WaitedItem } from "../alerts";
import { findSimilarAvailable } from "../catalog/catalog.d1";
import type { Candidato, DesejoNoPrompt } from "./shelf.types";

/**
 * Quantos candidatos buscar por desejo. O da âncora recebe mais porque é dele
 * que devem sair as alternativas do topo da vitrine.
 */
const POR_DESEJO_ANCORA = 10;
const POR_DESEJO_SECUNDARIO = 5;

/**
 * Teto de candidatos no prompt.
 *
 * Não é economia de token à toa: o custo é linear no tamanho da lista, e acima
 * de ~16 o modelo passa a ignorar a cauda de qualquer jeito. Melhor cortar em
 * código, por nota, do que deixar o modelo cortar por posição.
 */
const TETO = 16;

/** Quantos desejos entram. Além disso o prompt vira ruído. */
const MAX_DESEJOS = 3;

export interface EspacoDeEscolha {
  desejos: DesejoNoPrompt[];
  candidatos: Candidato[];
  /** Os desejos crus — quem grava a vitrine precisa do `variantId` da âncora. */
  brutos: WaitedItem[];
}

/** O tamanho pedido, quando existe. Acessório não tem, e isso não é erro. */
const tamanhoDe = (item: WaitedItem): string => item.options.Size ?? item.options.size ?? "único";

/**
 * Espaço de escolha de um comprador.
 *
 * **Uma vitrine por comprador, ancorada no desejo mais recente.** Os demais
 * contribuem candidatos, e cada candidato carrega em `paraODesejo` de onde
 * veio. Sem essa procedência o motivo degenera para um "combina com você"
 * genérico — com ela o agente escreve "para a calça que você queria".
 *
 * Três vitrines empilhadas (uma por desejo) foi descartado: pior de ler e
 * triplica o custo de LLM sem triplicar o valor.
 *
 * Não lança: quem consome é uma vitrine, e vitrine vazia é resultado aceitável.
 */
export const montarEspacoDeEscolha = async (email: string): Promise<EspacoDeEscolha> => {
  const vazio: EspacoDeEscolha = { desejos: [], candidatos: [], brutos: [] };

  const todos = await findWaitedItems(email, MAX_DESEJOS);
  // Um desejo que já voltou ao estoque não precisa de substituto: o melhor
  // "produto que combina" é o próprio item esperado, e a loja deveria estar
  // avisando que ele voltou, não recomendando outro.
  const pendentes = todos.filter((item) => !item.available);
  if (pendentes.length === 0) return vazio;

  // `findWaitedItems` já devolve do mais recente para o mais antigo.
  const porHandle = new Map<string, Candidato>();

  for (const [indice, desejo] of pendentes.entries()) {
    const limite = indice === 0 ? POR_DESEJO_ANCORA : POR_DESEJO_SECUNDARIO;
    const similares = await findSimilarAvailable(desejo.variantId, limite);

    for (const similar of similares) {
      const produto = similar.record.product;
      // O primeiro a reivindicar um handle fica com ele — e a iteração começa
      // pela âncora, então em empate a procedência é a do desejo mais recente,
      // que é a que o motivo deve citar.
      if (porHandle.has(produto.handle)) continue;

      const tamanhos = similar.record.variants
        .filter((variante) => variante.available === 1)
        .map(
          (variante) =>
            similar.record.optionsByVariant
              .get(variante.variant_id)
              ?.find((opcao) => opcao.name === "Size")?.value,
        )
        .filter((valor): valor is string => !!valor);

      porHandle.set(produto.handle, {
        handle: produto.handle,
        titulo: produto.title,
        tipo: produto.product_type,
        preco: similar.record.variants[0]?.price ?? 0,
        mesmoTipo: similar.sameType,
        mesmaColecao: similar.sameCollection,
        tagsEmComum: similar.sharedTags,
        tamanhosDisponiveis: [...new Set(tamanhos)],
        // 160 caracteres: o bastante para o modelo julgar a peça, longe do
        // bastante para as descrições (média de 866) dominarem o prompt.
        descricao: (produto.description ?? "").slice(0, 160),
        paraODesejo: desejo.title,
      });
    }
  }

  return {
    desejos: pendentes.map((item) => ({
      titulo: item.title,
      tipo: item.productType,
      tamanho: tamanhoDe(item),
    })),
    candidatos: [...porHandle.values()].slice(0, TETO),
    brutos: pendentes,
  };
};
