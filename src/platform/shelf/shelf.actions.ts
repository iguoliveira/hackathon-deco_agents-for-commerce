/**
 * O que a section consome. Nada acima daqui sabe que existe banco ou modelo.
 */

import type { Product } from "@decocms/apps-commerce/types";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { findAvailableCatalogRecordsByHandles } from "../catalog/catalog.d1";
import { recordToProduct } from "../catalog/catalog.mapper";
import { lerVitrine } from "./shelf.d1";
import { donoDaVitrine } from "./shelf.identity";

/** Um item pronto para a tela: o produto e a linha que o justifica. */
export interface ItemRenderizavel {
  product: Product;
  /** Vazio quando a vitrine veio do fallback por SQL. */
  motivo: string;
}

export interface VitrinePersonalizada {
  titulo: string;
  itens: ItemRenderizavel[];
  /** Para a section decidir se mostra os motivos. */
  origem: "agente" | "sql";
}

/** Abaixo disto não é vitrine, é sobra — melhor não renderizar nada. */
const MIN_ITENS = 3;

/**
 * Qual das duas vitrines montar.
 *
 * `alternativas` responde "no lugar do que você queria"; `combinam` responde
 * "para usar junto". São dois blocos no decofile, posicionáveis separadamente,
 * e não uma section que renderiza as duas — assim dá para pôr uma logo abaixo
 * do Hero e a outra depois do banner sem tocar em código.
 */
export type ListaDaVitrine = "alternativas" | "combinam";

/**
 * `Product` carrega URLs absolutas, então precisa da origin da requisição.
 * Mesmo fallback de `catalog.actions.ts` para quando roda fora de um contexto
 * de request (build, preview do editor).
 */
const origemAtual = (): string => {
  const request = RequestContext.current?.request;
  return request ? new URL(request.url).origin : "https://localhost";
};

/**
 * A vitrine do comprador logado, ou `null`.
 *
 * `null` em três situações que a section trata igual (sumindo da página) mas
 * que são bem diferentes entre si — e é por isso que cada uma loga:
 * ninguém logado, ninguém com vitrine gravada, ou tudo o que o agente escolheu
 * esgotou desde a geração.
 *
 * **A disponibilidade é reconferida aqui, a cada render.** A vitrine fica
 * gravada por dias enquanto o estoque muda; recomendar um item esgotado é
 * repetir exatamente o problema que trouxe a pessoa até aqui, e passaria
 * despercebido porque a página continuaria respondendo 200.
 */
export const vitrineDoComprador = async (
  lista: ListaDaVitrine = "alternativas",
): Promise<VitrinePersonalizada | null> => {
  const email = await donoDaVitrine();
  if (!email) return null;

  const gravada = await lerVitrine(email);
  if (!gravada) return null;

  const escolhidos = lista === "combinam" ? gravada.combinam : gravada.itens;
  const titulo = lista === "combinam" ? gravada.tituloCombina : gravada.titulo;
  if (escolhidos.length === 0) return null;

  const handles = escolhidos.map((item) => item.handle);
  const registros = await findAvailableCatalogRecordsByHandles(handles);
  if (registros.length < MIN_ITENS) {
    console.warn(
      `[shelf] vitrine "${lista}" de ${email} caiu para ${registros.length} item(ns) disponíveis`,
    );
    return null;
  }

  const origemUrl = origemAtual();
  const motivoPorHandle = new Map(escolhidos.map((item) => [item.handle, item.motivo]));

  const itens: ItemRenderizavel[] = [];
  for (const registro of registros) {
    const product = recordToProduct(registro, origemUrl);
    if (!product) continue;
    itens.push({ product, motivo: motivoPorHandle.get(registro.product.handle) ?? "" });
  }

  if (itens.length < MIN_ITENS) return null;

  return { titulo, itens, origem: gravada.origem };
};
