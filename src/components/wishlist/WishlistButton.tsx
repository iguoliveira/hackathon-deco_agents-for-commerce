import { useEffect, useRef, useState } from "react";
import type { AnalyticsItem } from "@decocms/apps-commerce/types";
import { clx } from "~/sdk/clx";
import { useSendEvent } from "../../sdk/useSendEvent";
import { useToggleWishlist, useWishlist } from "../../platform/wishlist";
import IconButton from "../ui/IconButton";
import Button from "../ui/Button";

interface Props {
  variant?: "full" | "icon";
  item: AnalyticsItem;
}

/**
 * Dispara uma vez a cada vez que `ativo` passa de falso para verdadeiro.
 *
 * Compara com o valor anterior em vez de reagir a `ativo` sozinho porque o
 * componente re-renderiza por vários motivos — refetch da lista, mudança de
 * outro item, hidratação —, e animar em toda renderização com o coração cheio
 * faria a peça favoritada pulsar sozinha na tela.
 *
 * O primeiro render nunca anima: `anterior` começa com o valor atual, então
 * abrir uma PDP de peça já favoritada não celebra nada.
 */
function useAnimarAoEntrar(ativo: boolean, duracaoMs = 220): boolean {
  const anterior = useRef(ativo);
  const [animando, setAnimando] = useState(false);

  useEffect(() => {
    const entrou = ativo && !anterior.current;
    anterior.current = ativo;
    if (!entrou) return;

    setAnimando(true);
    const t = setTimeout(() => setAnimando(false), duracaoMs);
    // Limpa se o componente sair ou se houver outro toggle antes do fim — sem
    // isto, cliques rápidos deixariam timers empilhados apagando a classe no
    // meio da animação seguinte.
    return () => clearTimeout(t);
  }, [ativo, duracaoMs]);

  return animando;
}

function WishlistButton({ item, variant = "full" }: Props) {
  const productId = (item as { item_id: string }).item_id;
  const productGroupId = item.item_group_id ?? "";

  const { isInWishlist } = useWishlist();
  const toggle = useToggleWishlist();

  // Otimista: `useToggleWishlist` já escreve no cache em `onMutate` e desfaz em
  // `onError`, então isto vira `true` no clique, sem esperar o servidor.
  const inWishlist = isInWishlist(productId);
  const animando = useAnimarAoEntrar(inWishlist);

  const addToWishlistEvent = useSendEvent({
    on: "click",
    event: { name: "add_to_wishlist", params: { items: [item] } },
  });

  const handleClick = () => {
    toggle.mutate({ productId, productGroupId });
  };

  const label = inWishlist ? "Remove from wishlist" : "Add to wishlist";

  if (variant === "icon") {
    return (
      <IconButton
        icon="favorite"
        label={label}
        active={inWishlist}
        filled={inWishlist}
        // **Sem `disabled` enquanto a mutação está em voo.** Ele existia aqui e
        // anulava a atualização otimista: o coração virava na hora e o botão
        // travava esperando a resposta, então desfazer um clique errado exigia
        // aguardar o servidor. A mutação é serializada por escopo em
        // `useToggleWishlist`, e o estado vem do cache — clicar rápido duas
        // vezes volta ao ponto de partida, que é o que a pessoa espera.
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
