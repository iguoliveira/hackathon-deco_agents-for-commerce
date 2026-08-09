import { mapProductToAnalyticsItem } from "@decocms/apps-commerce/utils/productToAnalyticsItem";
import { useOffer } from "@decocms/apps-commerce/sdk/useOffer";
import type { LookPersonalizado } from "~/platform/look/look.actions";
import ProductCard from "~/components/product/card/ProductCard";
import Section from "~/components/ui/Section";
import { useSendEvent } from "~/sdk/useSendEvent";
import { type LoadingFallbackProps } from "~/types/deco";

export interface Props {
  /**
   * @title O look
   * @description Resolve com `site/loaders/completeTheLook.ts`. Na PDP, deixe o handle vazio lá.
   */
  look: LookPersonalizado | null;
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
export default function CompleteTheLook({ look, mostrarProcedencia = true }: Props) {
  const todas = look?.blocos.flatMap((bloco) => bloco.pecas) ?? [];

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
        <span className="text-display font-medium text-ink">{look.titulo}</span>
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

/**
 * **Nada na tela enquanto não houver look.** Não é um esqueleto discreto: é a
 * ausência dele, de propósito.
 *
 * A versão anterior desenhava `Section.Placeholder height="480px"` sob um
 * `Section.Header` de título **sempre vazio** — o wrapper do framework passa
 * `rawProps` vazio ao fallback de propósito ("LoadingFallback components should
 * be pure layout skeletons"), então não há título para mostrar. Medido: 592px
 * de cinza sem uma palavra.
 *
 * Isso desenha uma section que promete conteúdo antes de existir conteúdo, e o
 * caso em que ela não vai existir é o COMUM, não a exceção: `lookDaPeca`
 * devolve `null` em cinco situações previstas — sem candidatos, contexto ainda
 * não composto, peça em quarentena, tudo esgotado, peça inexistente — e todas
 * são estado normal, não erro. O contrato já estava em `look.types.ts`: **ou o
 * look é do agente, ou a section não aparece.** O esqueleto era a única parte
 * do sistema que discordava dele.
 *
 * Medido depois da troca, no navegador, com rolagem de verdade:
 *
 *   São Paulo (look em cache)   data-deferred sai · 2010px · 21 links
 *   Reykjavik (nunca composto)  data-deferred sai · 0px    · nada
 *
 * O segundo é o ponto: o carregamento acontece, e o que ele devolve é vazio.
 * Antes, esse mesmo caminho pintava meia tela de cinza no meio da home.
 *
 * Há ainda um caminho em que o esqueleto ficaria para **sempre**, e ele é da
 * hospedagem, não nosso: `loadDeferredSection` devolve `null` quando o
 * `rawProps` não está no cache do servidor (o próprio framework avisa que isso
 * acontece por cache miss entre isolates), e o wrapper não tem estado de
 * "carregou e veio vazio" — sem resposta, ele mantém o fallback na tela. Não dá
 * para consertar daqui; dá para fazer o sintoma ser invisível, que é isto.
 *
 * O `<div>` de 1px não é sobra: quem dispara o carregamento é um
 * `IntersectionObserver` no elemento que envolve este retorno, e alvo de altura
 * zero é caso de borda entre navegadores. Um pixel transparente custa nada e
 * tira a dúvida — sem ele, o conserto do sintoma poderia virar "a section nunca
 * mais carrega", que é pior porque não faz barulho.
 */
export const LoadingFallback = (_: LoadingFallbackProps<Props>) => (
  <div aria-hidden="true" className="h-px" />
);
