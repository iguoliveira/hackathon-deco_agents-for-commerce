import { useId } from "react";
import { mapProductToAnalyticsItem } from "@decocms/apps-commerce/utils/productToAnalyticsItem";
import { useOffer } from "@decocms/apps-commerce/sdk/useOffer";
import type { VitrinePersonalizada } from "~/platform/shelf/shelf.actions";
import ProductCard from "~/components/product/card/ProductCard";
import Section from "~/components/ui/Section";
import Slider from "~/components/ui/Slider";
import { clx } from "~/sdk/clx";
import { useSendEvent } from "~/sdk/useSendEvent";
import { type LoadingFallbackProps } from "~/types/deco";

export interface Props {
  /**
   * @title Vitrine pessoal
   * @description Resolve com `site/loaders/personalShelf.ts`. Sem props: o conteúdo depende de quem está pedindo.
   */
  vitrine: VitrinePersonalizada | null;
}

/**
 * A vitrine que o agente montou a partir do que a pessoa quis e não pôde levar.
 *
 * Não é `ProductShelf` com outro loader: a diferença é o **motivo** sob cada
 * produto. Sem ele isto vira mais uma prateleira de "produtos similares", que é
 * exatamente o que já existe em qualquer loja — o texto é o que transforma uma
 * lista ordenada por SQL numa vitrine que se explica.
 *
 * Some da página quando não há vitrine (ninguém logado, ninguém com desejo, ou
 * tudo esgotou desde a geração). Vitrine pessoal vazia é pior que seção nenhuma.
 */
export default function PersonalShelf({ vitrine }: Props) {
  const id = useId();

  const viewItemListEvent = useSendEvent({
    on: "view",
    event: {
      name: "view_item_list",
      params: {
        item_list_name: vitrine?.titulo,
        items: (vitrine?.itens ?? []).map(({ product }, index) =>
          mapProductToAnalyticsItem({ index, product, ...useOffer(product.offers) }),
        ),
      },
    },
  });

  if (!vitrine || vitrine.itens.length === 0) return null;

  return (
    <Section.Container {...viewItemListEvent}>
      <Section.Header title={vitrine.titulo} />

      <div
        id={id}
        className="grid grid-rows-1"
        style={{ gridTemplateColumns: "min-content 1fr min-content" }}
      >
        <div className="col-start-1 col-span-3 row-start-1 row-span-1">
          <Slider className="carousel carousel-center sm:carousel-end gap-3 w-full">
            {vitrine.itens.map(({ product, motivo }, index) => (
              <Slider.Item
                key={product.productID ?? product.url ?? index}
                index={index}
                className={clx("carousel-item", "sm:flex-1! sm:shrink! sm:max-w-[372px]!")}
              >
                <div className="flex flex-col gap-2 w-full">
                  <ProductCard
                    index={index}
                    product={product}
                    itemListName={vitrine.titulo}
                    disableReveal
                  />
                  {/* min-h fixo: sem ele, um motivo de uma linha ao lado de um
                      de duas desalinha a régua inteira do carrossel. */}
                  {motivo ? (
                    <p className="text-sm text-base-content/70 leading-snug min-h-[2.5rem] px-1">
                      {motivo}
                    </p>
                  ) : null}
                </div>
              </Slider.Item>
            ))}
          </Slider>
        </div>
      </div>
    </Section.Container>
  );
}

export const LoadingFallback = ({ vitrine }: LoadingFallbackProps<Props>) => (
  <Section.Container>
    <Section.Header title={vitrine?.titulo ?? ""} />
    <Section.Placeholder height="540px" />
  </Section.Container>
);
