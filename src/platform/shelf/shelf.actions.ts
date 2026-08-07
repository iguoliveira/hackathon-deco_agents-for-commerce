/**
 * O que a section consome. Nada acima daqui sabe que existe banco ou modelo.
 */

import type { Product } from "@decocms/apps-commerce/types";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { readShopperIdentity } from "../alerts";
import { findAvailableCatalogRecordsByHandles } from "../catalog/catalog.d1";
import { recordToProduct } from "../catalog/catalog.mapper";
import { lerVitrine } from "./shelf.d1";

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
export const vitrineDoComprador = async (): Promise<VitrinePersonalizada | null> => {
  const identidade = await readShopperIdentity(RequestContext.current?.request);
  if (!identidade) return null;

  const gravada = await lerVitrine(identidade.email);
  if (!gravada || gravada.itens.length === 0) return null;

  const handles = gravada.itens.map((item) => item.handle);
  const registros = await findAvailableCatalogRecordsByHandles(handles);
  if (registros.length < MIN_ITENS) {
    console.warn(
      `[shelf] vitrine de ${identidade.email} caiu para ${registros.length} item(ns) disponíveis`,
    );
    return null;
  }

  const origem = origemAtual();
  const motivoPorHandle = new Map(gravada.itens.map((item) => [item.handle, item.motivo]));

  const itens: ItemRenderizavel[] = [];
  for (const registro of registros) {
    const product = recordToProduct(registro, origem);
    if (!product) continue;
    itens.push({ product, motivo: motivoPorHandle.get(registro.product.handle) ?? "" });
  }

  if (itens.length < MIN_ITENS) return null;

  return { titulo: gravada.titulo, itens, origem: gravada.origem };
};
