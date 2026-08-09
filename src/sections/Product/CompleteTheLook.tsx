import { mapProductToAnalyticsItem } from "@decocms/apps-commerce/utils/productToAnalyticsItem";
import { useOffer } from "@decocms/apps-commerce/sdk/useOffer";
import type { LookPersonalizado } from "~/platform/look/look.actions";
import ProductCard from "~/components/product/card/ProductCard";
import Section from "~/components/ui/Section";
import { useSendEvent } from "~/sdk/useSendEvent";
import { type LoadingFallbackProps } from "~/types/deco";

/** O nome da section na tela. Ver `Props.titulo`. */
export const TITULO_PADRAO = "Recomendações Com a sua cara";

export interface Props {
  /**
   * @title O look
   * @description Resolve com `site/loaders/completeTheLook.ts`. Deixe o handle vazio para usar a peça da URL.
   */
  look: LookPersonalizado | null;
  /**
   * @title Título da section
   * @description O nome que aparece na tela. Vazio usa "Recomendações Com a sua cara".
   */
  titulo?: string;
  /**
   * @title Mostrar a procedência
   * @description A linha "montado para <cidade>, a partir de N sinais". Deixe ligado na demo — é o que torna a personalização visível.
   */
  mostrarProcedencia?: boolean;
}

/**
 * O look que o agente compôs em volta da peça aberta.
 *
 * Não é `ProductShelf` com outro loader, e a diferença não é cosmética: são
 * **blocos por ocasião** e um **motivo por peça**. Sem os dois isto vira mais um
 * carrossel de "produtos relacionados", que é exatamente o que qualquer loja já
 * tem — o texto e o agrupamento são o que transformam uma lista ordenada por
 * SQL numa composição que se explica.
 *
 * Os títulos dos blocos **não estão no código**. Eles vêm de `ocasiao`, escrito
 * pelo modelo a partir deste catálogo, e o componente apenas os renderiza na
 * ordem em que chegaram. Um `SHELVES = [...]` aqui travaria a loja em moda.
 *
 * Some da página quando não há look. Composição vazia é pior que seção nenhuma.
 */
export default function CompleteTheLook({
  look,
  titulo,
  mostrarProcedencia = true,
}: Props) {
  const todas = look?.blocos.flatMap((bloco) => bloco.pecas) ?? [];

  // O nome da section é FIXO; o `look.titulo` que o agente escreve não vai mais
  // para a tela. A troca é deliberada: como cabeçalho ele mudava a cada
  // recarregamento ("Camadas para o frio de SP", "Complete o look casual"), e um
  // título instável no mesmo lugar da página lê como erro, não como
  // personalização. O que prova o agente continua na tela — a procedência logo
  // abaixo, os rótulos de ocasião e o motivo em cada peça —, e o `look.titulo`
  // segue alimentando a analítica, onde a variação é dado e não ruído.
  const nome = titulo?.trim() || TITULO_PADRAO;

  const viewItemListEvent = useSendEvent({
    on: "view",
    event: {
      name: "view_item_list",
      params: {
        item_list_name: look?.titulo,
        items: todas.map(({ product }, index) =>
          mapProductToAnalyticsItem({ index, product, ...useOffer(product.offers) }),
        ),
      },
    },
  });

  if (!look || todas.length === 0) return null;

  return (
    <Section.Container {...viewItemListEvent}>
      <div className="flex flex-col gap-1">
        <span className="text-display font-medium text-ink">{nome}</span>
        {mostrarProcedencia && (
          // A procedência é o que responde "por que ESTE look?" antes de alguém
          // perguntar — e é a única coisa na tela que prova que a cidade e o
          // histórico entraram na decisão. Na demo é o que se aponta ao trocar
          // de cidade e recarregar.
          <span className="text-sm text-ink-soft">
            Montado pelo agente para {look.lugar} em {look.mes}
            {look.sementes > 0
              ? `, a partir de ${look.sementes} ${look.sementes === 1 ? "sinal seu" : "sinais seus"}`
              : ", sem histórico seu ainda"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-10">
        {look.blocos.map((bloco) => (
          <div key={bloco.ocasiao} className="flex flex-col gap-4">
            {/* Um bloco só não ganha subtítulo: repetir "Complete o look" logo
                abaixo do título da section é ruído. O agrupamento só informa
                quando há mais de um eixo. */}
            {look.blocos.length > 1 && (
              <span className="text-base font-medium text-ink">{bloco.ocasiao}</span>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {bloco.pecas.map((peca, index) => (
                <div
                  key={peca.product.productID ?? peca.product.url ?? index}
                  className="flex w-full flex-col gap-2"
                >
                  <ProductCard
                    index={index}
                    product={peca.product}
                    itemListName={`${look.titulo} — ${bloco.ocasiao}`}
                  />
                  {/* Sem guarda de motivo vazio: `validar` descarta peça sem
                      motivo e não existe mais look sem texto, então um card mudo
                      aqui seria bug a ser visto, não caso a ser tolerado.

                      min-h fixo: sem ele, um motivo de uma linha ao lado de um
                      de duas desalinha a régua inteira da grade. */}
                  <p className="min-h-[2.5rem] px-1 text-sm leading-snug text-base-content/70">
                    {peca.motivo}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section.Container>
  );
}

// O fallback usa o MESMO nome fixo. Antes ele lia `look?.titulo`, que durante o
// carregamento é sempre `undefined` — então o cabeçalho nascia vazio e "pulava"
// quando o look chegava. Com o nome fixo não há salto: o que entra depois são só
// os cards, no lugar do placeholder.
export const LoadingFallback = ({ titulo }: LoadingFallbackProps<Props>) => (
  <Section.Container>
    <Section.Header title={titulo?.trim() || TITULO_PADRAO} />
    <Section.Placeholder height="480px" />
  </Section.Container>
);
