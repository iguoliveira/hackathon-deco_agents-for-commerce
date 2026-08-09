import { mapProductToAnalyticsItem } from "@decocms/apps-commerce/utils/productToAnalyticsItem";
import { useOffer } from "@decocms/apps-commerce/sdk/useOffer";
import type { LookPersonalizado } from "~/platform/look/look.actions";
import ProductCard from "~/components/product/card/ProductCard";
import Section from "~/components/ui/Section";
import { useSendEvent } from "~/sdk/useSendEvent";
import { type LoadingFallbackProps } from "~/types/deco";

/** O nome da section na tela. Ver `Props.titulo`. */
export const TITULO_PADRAO = "Recomendações com a sua cara";

/**
 * A caixa que envolve a vitrine inteira.
 *
 * Borda e véu no verde da marca: é o que separa visualmente o que o **agente
 * compôs** do que é prateleira comum — a home tem quatro vitrines seguidas, e
 * sem marcação nenhuma esta era só mais uma fileira de produtos.
 *
 * **Caixa contida, não faixa sangrando.** A primeira versão usava `-mx-3` para
 * ocupar a largura toda, e isso encostava o texto na borda da tela — o título
 * ficava sem respiro nenhum. Aqui a caixa vive DENTRO do `Section.Container`,
 * então o padding externo continua sendo do container e o interno é dela; os
 * dois não brigam.
 */
const CAIXA =
  "rounded-lg border border-agente-linha bg-agente-veu px-4 py-6 sm:px-8 sm:py-8";

/**
 * Quantas peças chegam à tela. **É uma trava de segurança, não um corte.**
 *
 * Quem garante o número é o agente: a #32 o faz devolver 5 peças, e é lá que a
 * decisão mora. Este teto existe para a section não quebrar o layout se algum
 * dia chegar mais do que isso.
 *
 * **E se chegar mais, ele corta errado.** Vale saber por quê, porque o engano é
 * natural: a ordem que chega aqui NÃO é a ordem do agente. `montarBlocos`
 * agrupa por `ocasiao` num `Map` (`look.actions.ts`), então o `flatMap` percorre
 * bloco a bloco — o resultado é ordem por ocasião. Medido com um look real de 8
 * peças em 3 ocasiões:
 *
 *   ordem do agente   0 1 2 3 4 5 6 7
 *   após agrupar      0 3 4 5 | 1 2 | 6 7
 *   as 5 primeiras    0 3 4 5 1        <- descarta a posição 2, mantém a 5
 *
 * E a terceira ocasião some inteira da tela. Ou seja: cortar aqui não descarta
 * "as menos convictas" — descarta a última ocasião, sistematicamente.
 *
 * Consertar exigiria carregar o `position` (existe em `PecaDoLook`, é jogado
 * fora em `look.actions.ts` quando vira `PecaRenderizavel`) e ordenar antes de
 * fatiar. Não foi feito porque com o agente devolvendo 5 o `slice` nunca corta.
 * **Se `MAX_PECAS` voltar a passar de 5, isto vira bug de novo, em silêncio.**
 *
 * Sobre o número 5: ele casa com `lg:grid-cols-5`, então no desktop a vitrine é
 * uma fileira cheia. Nas faixas menores não — 2 colunas dão 2+2+1 e 3 colunas
 * dão 3+2. O vão da última fileira continua existindo no celular e no tablet.
 */
const NA_TELA = 5;

export interface Props {
  /**
   * @title O look
   * @description Resolve com `site/loaders/completeTheLook.ts`. O `handle` lá é OBRIGATÓRIO — a section só vive na home, e sem ele ela some sem erro.
   */
  look: LookPersonalizado | null;
  /**
   * @title Título da section
   * @description O nome que aparece na tela. Vazio usa "Recomendações com a sua cara".
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
export default function CompleteTheLook({ look, titulo, mostrarProcedencia = true }: Props) {
  // Achata os blocos carregando a `ocasiao` junto. Ela não aparece mais na tela,
  // mas continua indo para a analítica em `itemListName` — é o que permite
  // depois perguntar "qual ocasião converte melhor" sem ter mudado o dado.
  const todas =
    look?.blocos.flatMap((bloco) => bloco.pecas.map((peca) => ({ ...peca, ocasiao: bloco.ocasiao }))) ??
    [];

  // Trava de segurança, não corte: o agente devolve 5 (#32). Se um dia chegar
  // mais, este `slice` fica enviesado — a ordem aqui é por ocasião, não por
  // convicção. O porquê está em `NA_TELA`, com a medição.
  const mostradas = todas.slice(0, NA_TELA);

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
        items: mostradas.map(({ product }, index) =>
          mapProductToAnalyticsItem({ index, product, ...useOffer(product.offers) }),
        ),
      },
    },
  });

  if (!look || mostradas.length === 0) return null;

  /**
   * Um card: a peça e o motivo. **Mesma régua da `PersonalShelf`**, de
   * propósito — as duas são vitrines do agente, as duas põem um motivo sob a
   * foto, e duas medidas diferentes para a mesma ideia é o que fazia esta
   * parecer de outro site.
   *
   * **`disableReveal` não é escolha estética, é o que faz os cards existirem.**
   * O utilitário `reveal` nasce com `opacity: 0` e só chega a `1` quando um
   * `IntersectionObserver` marca `data-revealed` (app.css → `@utility reveal`).
   * Esta section é DIFERIDA: o conteúdo é montado depois da passada inicial do
   * observer, e num carregamento em que ele não dispara de novo o resultado é a
   * caixa com título e borda e **nenhum item visível** — sem erro, sem log, com
   * a página em 200. Foi exatamente o sintoma relatado.
   *
   * O preço é abrir mão da animação de entrada nesta vitrine. Barato: uma
   * animação que às vezes deixa o conteúdo invisível é pior que nenhuma.
   */
  const cartao = (peca: (typeof mostradas)[number], index: number) => (
    <div className="flex w-full flex-col gap-2">
      <ProductCard
        index={index}
        product={peca.product}
        itemListName={`${look.titulo} — ${peca.ocasiao}`}
        disableReveal
      />
      {/* Sem guarda de motivo vazio: `validar` descarta peça sem motivo e não
          existe mais look sem texto, então um card mudo aqui seria bug a ser
          visto, não caso a ser tolerado.

          min-h fixo: sem ele, um motivo de uma linha ao lado de um de duas
          desalinha a régua inteira da fileira. */}
      <p className="min-h-[2.5rem] px-1 text-sm leading-snug text-base-content/70">
        {peca.motivo}
      </p>
    </div>
  );

  return (
    <Section.Container {...viewItemListEvent}>
      <div className={CAIXA}>
        <div className="flex flex-col gap-1">
          <Section.Header title={nome} />
          {mostrarProcedencia && (
            // A procedência é o que responde "por que ESTE look?" antes de
            // alguém perguntar — e é a única coisa na tela que prova que a
            // cidade e o histórico entraram na decisão. Na demo é o que se
            // aponta ao trocar de cidade e recarregar.
            <span className="text-sm text-ink-soft">
              Montado pelo agente para {look.lugar} em {look.mes}
              {look.sementes > 0
                ? `, a partir de ${look.sementes} ${look.sementes === 1 ? "sinal seu" : "sinais seus"}`
                : ", sem histórico seu ainda"}
            </span>
          )}
        </div>

        {/*
          Uma fileira só, sem os rótulos de ocasião.

          Os blocos que o agente devolve continuam existindo no dado — e a
          `ocasiao` segue indo para a analítica via `itemListName` —, mas na
          tela eles viravam três subtítulos empilhados dentro de uma caixa,
          e o que era agrupamento lia como bagunça. Achatar aqui é decisão de
          apresentação, não de domínio: o agrupamento volta na hora que a
          vitrine tiver espaço para ele.

          5 colunas no desktop, que é o pedido — e degrada para 3 e 2 nas
          larguras menores, senão o card fica estreito demais para a foto.
        */}
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {mostradas.map((peca, index) => (
            <div key={peca.product.productID ?? peca.product.url ?? index}>
              {cartao(peca, index)}
            </div>
          ))}
        </div>
      </div>
    </Section.Container>
  );
}

export const LoadingFallback = (_props: LoadingFallbackProps<Props>) => (
  <Section.Container>
    {/* A MESMA caixa do render final. Sem ela o esqueleto nasce sem fundo e a
        borda surge de repente quando o look chega — a caixa piscaria na tela,
        que é pior que não ter caixa. */}
    <div className={CAIXA}>
      <Section.Header title={TITULO_PADRAO} />
      <Section.Placeholder height="420px" />
    </div>
  </Section.Container>
);
