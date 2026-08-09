import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyticsItem } from "@decocms/apps-commerce/types";
import { clx } from "~/sdk/clx";
import { useSendEvent } from "../../sdk/useSendEvent";
import { useIsInWishlistAfterHydration, useToggleWishlist } from "../../platform/wishlist";
import IconButton from "../ui/IconButton";
import Button from "../ui/Button";

interface Props {
  variant?: "full" | "icon";
  item: AnalyticsItem;
}

/** Quanto dura o `heart-pop` — casa com `--duration-base` no app.css. */
const DURACAO_POP = 220;

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
    toggle.mutate({ productId, productGroupId });
  }, [inWishlist, productId, productGroupId, toggle]);

  const label = inWishlist ? "Remove from wishlist" : "Add to wishlist";

  if (variant === "icon") {
    return (
      <IconButton
        icon="favorite"
        label={label}
        active={inWishlist}
        filled={inWishlist}
        // Sem `disabled` enquanto a mutação está em voo: ele anulava a
        // atualização otimista — o coração virava na hora e o botão travava
        // esperando a resposta, então desfazer um clique errado exigia
        // aguardar o servidor. A mutação é serializada por escopo em
        // `useToggleWishlist`.
        onClick={handleClick}
        className={clx(animando && "heart-pop")}
        {...addToWishlistEvent}
      />
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
