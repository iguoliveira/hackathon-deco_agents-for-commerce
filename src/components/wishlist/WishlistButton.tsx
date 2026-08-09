import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import type { AnalyticsItem } from "@decocms/apps-commerce/types";
import { clx } from "~/sdk/clx";
import { useSendEvent } from "../../sdk/useSendEvent";
import { useIsInWishlistAfterHydration, useToggleWishlist } from "../../platform/wishlist";
import Icon from "../ui/Icon";
import IconButton from "../ui/IconButton";
import Button from "../ui/Button";

interface Props {
  variant?: "full" | "icon";
  item: AnalyticsItem;
}

/** Quanto dura o `heart-pop` — casa com `--duration-base` no app.css. */
const DURACAO_POP = 220;

/**
 * A rota em que o coração deixa de fazer sentido.
 *
 * Numa vitrine, o coração é um TOGGLE e o estado dele informa: cheio significa
 * "já está na sua lista". Na página da lista, todos os itens estão — o ícone
 * fica constante, e ícone que não distingue nada é decoração. A única ação
 * possível ali é tirar, então o ícone passa a ser um X.
 *
 * Ler a rota aqui, em vez de receber por prop, é escolha de custo: a página da
 * lista renderiza `SearchResult` -> `ProductGallery` -> `ProductCard`, os três
 * compartilhados com a PLP e a busca. Atravessar uma prop por eles espalharia
 * um conceito de wishlist em componentes que não têm nada com isso. O
 * precedente existe — `ProductVariantSelector.tsx:80` também lê `pathname`.
 *
 * Se um dia a lista aparecer fora desta rota (uma gaveta, um modal), isto vira
 * prop. Enquanto for uma página só, a rota é a informação mais barata.
 */
const ROTA_DA_LISTA = "/wishlist";

function WishlistButton({ item, variant = "full" }: Props) {
  const productId = (item as { item_id: string }).item_id;
  const productGroupId = item.item_group_id ?? "";

  // `useIsInWishlistAfterHydration` e não `useWishlist`: este componente decide
  // `aria-label`, `aria-pressed` e o `fill` do SVG a partir do estado da lista,
  // e a query responde diferente no servidor e na primeira renderização do
  // cliente. Isso é markup divergente — derrubava a árvore inteira e a página
  // ficava em branco. Ver o hook.
  const estaNaLista = useIsInWishlistAfterHydration();
  const toggle = useToggleWishlist();

  // `startsWith` e não igualdade: a rota pode ganhar query de filtro ou
  // paginação (`/wishlist?page=2`) sem deixar de ser a página da lista.
  const naPaginaDaLista = useRouterState({
    select: (s) => s.location.pathname.startsWith(ROTA_DA_LISTA),
  });
  const router = useRouter();

  // Otimista: `useToggleWishlist` escreve no cache em `onMutate` e desfaz em
  // `onError`, então isto vira `true` no clique, sem esperar o servidor.
  const inWishlist = estaNaLista(productId);

  const [animando, setAnimando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const addToWishlistEvent = useSendEvent({
    on: "click",
    event: { name: "add_to_wishlist", params: { items: [item] } },
  });

  /**
   * A animação é disparada pelo CLIQUE, não por observar o estado virar.
   *
   * Observar o estado parece mais simples e está errado aqui: com o guard de
   * hidratação, `inWishlist` só vira `true` DEPOIS da montagem para uma peça
   * já favoritada — então toda PDP de item favoritado abriria com o coração
   * pulsando sozinho, sem ninguém ter clicado.
   *
   * Só ao ENTRAR na lista. Remover não anima de propósito: comemorar uma
   * remoção confunde, e o coração esvaziando já conta a história.
   */
  const handleClick = useCallback(() => {
    if (!inWishlist) {
      if (timer.current) clearTimeout(timer.current);
      setAnimando(true);
      timer.current = setTimeout(() => setAnimando(false), DURACAO_POP);
    }
    toggle.mutate(
      { productId, productGroupId },
      {
        // Na página da lista, mexer no cache do React Query não basta.
        //
        // O botão reage na hora porque `useToggleWishlist` é otimista sobre
        // `WISHLIST_QUERY_KEY` — mas os CARDS não vêm de lá. Eles vêm de
        // `WishlistGallery.loader`, que roda no servidor, cruza a lista com o
        // catálogo e devolve `page.products`. Esse loader não escuta o React
        // Query, então o card do item removido continuava na tela até um
        // refresh manual.
        //
        // `router.invalidate()` refaz o loader da rota. Só aqui: numa PLP ou
        // PDP a lista não alimenta nada renderizado, e invalidar recarregaria a
        // listagem inteira para nada.
        onSuccess: naPaginaDaLista ? () => void router.invalidate() : undefined,
      },
    );
  }, [inWishlist, productId, productGroupId, toggle, naPaginaDaLista, router]);

  const label = inWishlist ? "Remove from wishlist" : "Add to wishlist";

  if (variant === "icon") {
    // Na página da lista o botão é uma remoção, e o ícone diz isso.
    //
    // `close` e não `trash` de propósito: lixeira promete destruir algo que
    // existe, e não é o que acontece — o produto continua no catálogo e pode
    // ser favoritado de novo no próximo card. X significa "tira daqui", que é
    // exatamente o alcance da ação.
    //
    // Sem `active`/`filled`: o X não representa estado, representa o que o
    // clique faz. Manter o botão "aceso" ali repetiria em cada card uma
    // informação que a página inteira já dá.
    // Sem `&& inWishlist`, e isso não é descuido. `useToggleWishlist` é
    // otimista: no clique o item sai do cache ANTES da resposta do servidor,
    // então `inWishlist` vira `false` na hora. Com a condição amarrada a ele, o
    // X piscava de volta para coração no instante do clique e só então o card
    // sumia — parecia que a remoção tinha falhado e desfeito.
    //
    // Nesta rota o botão é sempre uma remoção, independente do que o cache diga
    // no meio da transição. Quem tira o card da tela é o refetch da lista.
    if (naPaginaDaLista) {
      return (
        <IconButton
          icon="close"
          label="Remove from wishlist"
          onClick={handleClick}
          {...addToWishlistEvent}
        >
          <Icon
            id="close"
            size={16}
            fill="none"
            stroke="currentColor"
            className="icon-hover"
          />
        </IconButton>
      );
    }

    return (
      <IconButton
        icon="favorite"
        label={label}
        active={inWishlist}
        // O preenchimento é feito pelos filhos, não pelo `filled` do botão —
        // ver o comentário do bloco abaixo.
        filled={false}
        // Sem `disabled` enquanto a mutação está em voo: ele anulava a
        // atualização otimista — o coração virava na hora e o botão travava
        // esperando a resposta, então desfazer um clique errado exigia
        // aguardar o servidor. A mutação é serializada por escopo em
        // `useToggleWishlist`.
        onClick={handleClick}
        className={clx(animando && "heart-pop")}
        {...addToWishlistEvent}
      >
        {/*
         * Dois corações sobrepostos, e a animação está no de cima.
         *
         * O contorno fica sempre visível. O preenchido cresce por dentro dele,
         * de `scale-0` ao centro até `scale-100`, o que dá a leitura de "o
         * coração encheu" em vez de "algo mudou de cor". Trocar só o `fill` de
         * `none` para `currentColor` não animava: `fill` não interpola entre
         * nenhum e uma cor, então a mudança era instantânea e passava batida.
         *
         * `origin-center` é o que faz crescer de dentro; sem ele o `scale`
         * parte do canto e o coração parece entrar deslizando.
         */}
        <span className="pointer-events-none relative inline-flex size-4 items-center justify-center">
          <Icon
            id="favorite"
            size={16}
            fill="none"
            stroke="currentColor"
            // Um empurrãozinho no hover, para o alvo responder antes do clique.
            className="icon-hover"
          />
          <Icon
            id="favorite-filled"
            size={16}
            className={clx(
              "absolute inset-0 origin-center transition-transform duration-(--duration-base) ease-(--ease-out-soft)",
              inWishlist ? "scale-100" : "scale-0",
            )}
          />
        </span>
      </IconButton>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      onClick={handleClick}
      className={clx("w-full", animando && "heart-pop")}
      {...addToWishlistEvent}
    >
      {label}
    </Button>
  );
}

export default WishlistButton;
