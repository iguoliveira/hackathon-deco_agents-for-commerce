import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { mapProductToAnalyticsItem } from "@decocms/apps-commerce/utils/productToAnalyticsItem";
import { useOffer } from "@decocms/apps-commerce/sdk/useOffer";
import type { VitrinePersonalizada } from "~/platform/shelf/shelf.actions";
import ProductCard from "~/components/product/card/ProductCard";
import Icon from "~/components/ui/Icon";
import Section from "~/components/ui/Section";
import Slider from "~/components/ui/Slider";
import { clx } from "~/sdk/clx";
import { useSendEvent } from "~/sdk/useSendEvent";
import { type LoadingFallbackProps } from "~/types/deco";

export interface Props {
  /**
   * @title Vitrine pessoal
   * @description Resolve com `site/loaders/personalShelf.ts`. Escolha ali qual lista aparece.
   */
  vitrine: VitrinePersonalizada | null;
  /**
   * @title Quantos mostrar
   * @description Vazio mostra todos. Na home vale limitar e apontar o "ver mais" para a página inteira.
   */
  maxItens?: number;
  /**
   * @title Link do "ver mais"
   * @description Ex.: "/minha-vitrine". Só aparece quando há mais itens do que os exibidos.
   */
  verMais?: string;
  /**
   * @title Formato
   * @description Carrossel para a home; grade para uma página dedicada.
   */
  formato?: "carrossel" | "grade";
}

/**
 * A vitrine que o agente montou a partir do que a pessoa quis e não pôde levar.
 *
 * Não é `ProductShelf` com outro loader: a diferença é o **motivo** sob cada
 * produto. Sem ele isto vira mais uma prateleira de "produtos similares", que é
 * exatamente o que já existe em qualquer loja — o texto é o que transforma uma
 * lista ordenada por SQL numa vitrine que se explica.
 *
 * Some da página quando não há vitrine (ninguém identificado, ninguém com
 * desejo, ou tudo esgotou desde a geração). Vitrine pessoal vazia é pior que
 * seção nenhuma.
 */
export default function PersonalShelf({ vitrine, maxItens, verMais, formato }: Props) {
  const id = useId();

  const todos = vitrine?.itens ?? [];
  const mostrados = maxItens && maxItens > 0 ? todos.slice(0, maxItens) : todos;

  const viewItemListEvent = useSendEvent({
    on: "view",
    event: {
      name: "view_item_list",
      params: {
        item_list_name: vitrine?.titulo,
        // Só o que está na tela: reportar os escondidos infla a impressão e faz
        // a taxa de clique parecer pior do que é.
        items: mostrados.map(({ product }, index) =>
          mapProductToAnalyticsItem({ index, product, ...useOffer(product.offers) }),
        ),
      },
    },
  });

  if (!vitrine || mostrados.length === 0) return null;

  // Sem link quando não sobrou nada para ver: um "ver mais" que leva à mesma
  // lista é pior que nenhum.
  const temMais = !!verMais && todos.length > mostrados.length;

  const cartao = (item: (typeof mostrados)[number], index: number) => (
    <div className="flex w-full flex-col gap-2">
      <ProductCard
        index={index}
        product={item.product}
        itemListName={vitrine.titulo}
        disableReveal={formato !== "grade"}
      />
      {/* min-h fixo: sem ele, um motivo de uma linha ao lado de um de duas
          desalinha a régua inteira do carrossel. */}
      {item.motivo ? (
        <p className="min-h-[2.5rem] px-1 text-sm leading-snug text-base-content/70">
          {item.motivo}
        </p>
      ) : null}
    </div>
  );

  return (
    <Section.Container {...viewItemListEvent}>
      <div className="flex items-end justify-between gap-2">
        <span className="text-display font-medium text-ink">{vitrine.titulo}</span>
        {temMais && (
          // Link próprio em vez do `cta` do Section.Header: aquele rotula
          // "See all" em inglês, e toda a copy desta vitrine é do agente, em
          // português. Misturar os dois idiomas na mesma linha entrega que o
          // texto veio de dois lugares.
          <Link
            to={verMais}
            className="tap-scale flex items-center gap-1 text-sm text-ink-soft transition-colors duration-(--duration-fast) hover:text-ink"
          >
            Ver todos os {todos.length}
            <Icon id="chevron-right" size={12} />
          </Link>
        )}
      </div>

      {formato === "grade" ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {mostrados.map((item, index) => (
            <div key={item.product.productID ?? item.product.url ?? index}>
              {cartao(item, index)}
            </div>
          ))}
        </div>
      ) : (
        <div
          id={id}
          className="grid grid-rows-1"
          style={{ gridTemplateColumns: "min-content 1fr min-content" }}
        >
          <div className="col-span-3 col-start-1 row-span-1 row-start-1">
            <Slider className="carousel carousel-center sm:carousel-end w-full gap-3">
              {mostrados.map((item, index) => (
                <Slider.Item
                  key={item.product.productID ?? item.product.url ?? index}
                  index={index}
                  className={clx("carousel-item", "sm:flex-1! sm:shrink! sm:max-w-[372px]!")}
                >
                  {cartao(item, index)}
                </Slider.Item>
              ))}
            </Slider>
          </div>
        </div>
      )}
    </Section.Container>
  );
}

export const LoadingFallback = ({ vitrine }: LoadingFallbackProps<Props>) => (
  <Section.Container>
    <Section.Header title={vitrine?.titulo ?? ""} />
    <Section.Placeholder height="540px" />
  </Section.Container>
);
