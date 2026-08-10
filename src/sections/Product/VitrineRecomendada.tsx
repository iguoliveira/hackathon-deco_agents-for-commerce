import { mapProductToAnalyticsItem } from "@decocms/apps-commerce/utils/productToAnalyticsItem";
import { useOffer } from "@decocms/apps-commerce/sdk/useOffer";
import type { VitrinePersonalizada } from "~/platform/vitrine/vitrine.actions";
import ProductCard from "~/components/product/card/ProductCard";
import Section from "~/components/ui/Section";
import { clx } from "~/sdk/clx";
import { useSendEvent } from "~/sdk/useSendEvent";
import { type LoadingFallbackProps } from "~/types/deco";

/** O nome da section na tela. Ver `Props.titulo` e o `LoadingFallback`. */
export const TITULO_PADRAO = "Recomendações com a sua cara";

/**
 * A caixa que envolve a vitrine inteira.
 *
 * Borda e véu no verde da marca: é o que separa visualmente o que o **agente
 * recomendou** do que é prateleira comum. A home tem quatro vitrines seguidas —
 * duas `PersonalShelf`, uma `ProductShelf` e esta — e sem marcação nenhuma esta
 * era só mais uma fileira de produtos, o que apaga justamente a coisa que ela
 * tem a provar.
 *
 * **Caixa contida, não faixa sangrando.** Uma primeira versão usava `-mx-3` para
 * ocupar a largura toda e encostava o texto na borda da tela — o título ficava
 * sem respiro. Aqui a caixa vive DENTRO do `Section.Container`, então o padding
 * externo continua sendo do container e o interno é dela; os dois não brigam.
 */
const CAIXA =
  "rounded-lg border border-agente-linha bg-agente-veu px-4 py-6 sm:px-8 sm:py-8";

export interface Props {
  /**
   * @title A vitrine
   * @description Resolve com `site/loaders/vitrineRecomendada.ts`. O loader não tem props — a vitrine é de quem está olhando.
   */
  vitrine: VitrinePersonalizada | null;
  /**
   * @title Título da section
   * @description O nome que aparece na tela. Vazio usa "Recomendações com a sua cara".
   */
  titulo?: string;
  /**
   * @title Mostrar a procedência
   * @description A linha "recomendado pelo agente a partir de N sinais seus". É o que torna a personalização visível.
   */
  mostrarProcedencia?: boolean;
}

/**
 * Os produtos que o agente recomendou para esta pessoa.
 *
 * **Não é um look, e a diferença está na estrutura.** `CompleteTheLook` desenha
 * blocos por `ocasiao`, porque uma roupa tem partes — calça, calçado, camada.
 * Aqui é uma grade só: a vitrine recomenda produtos, e podem ser oito camisetas
 * se for isso que serve à pessoa. Ver docs/vitrine-sem-ancora.md §5.
 *
 * O que sobrevive daquela section, e é o que a distingue de uma grade de
 * "recomendados" que qualquer loja tem: **um motivo por peça**, escrito sobre a
 * pessoa e não sobre o produto. Sem ele isto é um carrossel.
 *
 * **O título da section é do CMS, não do modelo.** O agente escreve um título
 * em `vitrine.titulo`, e ele NÃO vai para a tela — fica no banco como registro
 * do que ele achou que estava montando. Foi a decisão da #27 para o look, pelo
 * motivo que vale aqui igual: título que muda a cada geração faz a home mudar de
 * nome sozinha entre visitas.
 *
 * Some da página quando não há vitrine. Ver a §6b do doc: esta não é a section
 * principal do site, é uma recomendação extra — um buraco não quebra nada, e uma
 * vitrine genérica ocuparia o lugar da prova de personalização.
 */
export default function VitrineRecomendada({
  vitrine,
  titulo,
  mostrarProcedencia = true,
}: Props) {
  const pecas = vitrine?.pecas ?? [];
  const nome = titulo?.trim() || TITULO_PADRAO;

  const viewItemListEvent = useSendEvent({
    on: "view",
    event: {
      name: "view_item_list",
      params: {
        item_list_name: nome,
        items: pecas.map(({ product }, index) =>
          mapProductToAnalyticsItem({ index, product, ...useOffer(product.offers) }),
        ),
      },
    },
  });

  if (!vitrine || pecas.length === 0) return null;

  return (
    <Section.Container {...viewItemListEvent}>
      <div className={CAIXA}>
        <div className="flex flex-col gap-1">
          {/* `Section.Header` e não um `<span>` copiado: ele renderiza
              exatamente `text-display font-medium text-ink`, então a troca não
              muda um pixel e apaga uma duplicata da régua tipográfica. */}
          <Section.Header title={nome} />
          {mostrarProcedencia && (
            // A procedência responde "por que ESTES produtos?" antes de alguém
            // perguntar, e é a única coisa na tela que prova que o histórico
            // entrou na decisão. Sem cidade nem mês aqui, ao contrário do look:
            // a vitrine não depende de clima — depende de quem a pessoa é.
            <span className="text-sm text-ink-soft">
              Recomendado pelo agente a partir de {vitrine.sementes}{" "}
              {vitrine.sementes === 1 ? "sinal seu" : "sinais seus"}
            </span>
          )}
        </div>

        {/* A grade segue a CONTAGEM, não um número fixo.

            `MAX_PECAS` é 5 e `MIN_PECAS` é 4 — o prompt manda escolher entre os
            dois e diz que "escolher menos e explicar bem vale mais que
            preencher". Então a vitrine sai com 4 ou com 5, e nenhuma grade fixa
            acerta os dois: em quatro colunas, cinco peças viram 4+1 com três
            vãos, que lê como erro de layout; em cinco, quatro peças deixam um
            vão no fim.

            Uma classe por caso resolve, e é a apresentação concordando com a
            decisão que o prompt já tomou — não uma decisão nova.

            As duas literais aparecem inteiras no código de propósito: o Tailwind
            só gera a classe que consegue ver, e um template `lg:grid-cols-${n}`
            não produziria CSS nenhum.

            Nos breakpoints menores não perseguimos o mesmo: em `md` cinco peças
            dão 3+2 e quatro dão 3+1; no celular, 2+2+1 e 2+2. Sempre haverá uma
            das contagens com fileira incompleta, e uma órfã ao lado de UM vão
            não se parece com defeito — a de `lg`, com três, sim. */}
        <div
          className={clx(
            "mt-6 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3",
            pecas.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
          )}
        >
          {pecas.map((peca, index) => (
            <div
              key={peca.product.productID ?? peca.product.url ?? index}
              className="flex w-full flex-col gap-2"
            >
              {/* `disableReveal`: o utilitário `reveal` nasce com `opacity: 0` e
                  depende de um `IntersectionObserver` marcar `data-revealed`.
                  Numa section diferida isso já resultou em caixa com título e
                  NENHUM item visível — sem erro, sem log, página em 200 (ver a
                  #31). A causa exata segue em disputa; o sintoma não. Quatro
                  outros call sites de `ProductCard` desligam pelo mesmo motivo,
                  e o preço é só a animação de entrada. */}
              <ProductCard
                index={index}
                product={peca.product}
                itemListName={nome}
                disableReveal
              />
              {/* Sem guarda de motivo vazio: `validar` descarta peça sem motivo,
                  e não existe vitrine sem texto — um card mudo aqui seria bug a
                  ser visto, não caso a ser tolerado.

                  min-h fixo: sem ele, um motivo de uma linha ao lado de um de
                  duas desalinha a régua inteira da grade. */}
              <p className="min-h-[2.5rem] px-1 text-sm leading-snug text-base-content/70">
                {peca.motivo}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section.Container>
  );
}

/**
 * O esqueleto do carregamento, no padrão que a #27 estabeleceu para o look.
 *
 * **Título fixo, não `titulo`.** O framework passa `rawProps` vazio ao fallback
 * de propósito ("LoadingFallback components should be pure layout skeletons"),
 * então ler a prop daria cabeçalho vazio que depois "pula" para o valor
 * configurado. Se um dia o fallback precisar do valor do CMS, o caminho é o
 * framework voltar a serializar props, não um `??` aqui.
 *
 * ## Uma ressalva que fica registrada
 *
 * Segue o padrão da casa, e há um argumento contra ele que vale para esta
 * section mais do que para a do look: aqui o caso "não vem conteúdo" é o
 * **comum**, não a exceção — sem persona confiável não há vitrine, e é isso que
 * acontece com quem tem poucos sinais.
 *
 * Um esqueleto de 480px que quase sempre colapsa para nada é uma promessa que
 * quase sempre não se cumpre. A medição está na #28. A decisão de manter o
 * esqueleto é da #27, e ela vale para as duas sections — consistência visual
 * entre elas importa mais que a minha preferência, e uma section da home que se
 * comporta diferente da vizinha é pior que qualquer das duas escolhas.
 *
 * Se a #28 for retomada, esta é a segunda a mudar.
 */
export const LoadingFallback = (_props: LoadingFallbackProps<Props>) => (
  <Section.Container>
    {/* A MESMA caixa do render final. Sem ela o esqueleto nasce sem fundo e a
        borda surge de repente quando a vitrine chega — a caixa piscaria na tela,
        que é pior que não ter caixa. Uma constante só, compartilhada, para as
        duas não poderem divergir. */}
    <div className={CAIXA}>
      <Section.Header title={TITULO_PADRAO} />
      {/* 420px e não 480: com uma fileira de cinco a section é mais baixa, e um
          esqueleto alto demais deixa um buraco antes do conteúdo chegar. */}
      <Section.Placeholder height="420px" />
    </div>
  </Section.Container>
);
