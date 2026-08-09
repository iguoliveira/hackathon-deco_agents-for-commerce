import { Link } from "@tanstack/react-router";
import { useAuthAfterHydration } from "../../platform/user";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

interface Props {
  variant: "mobile" | "desktop";
}

const MOBILE_ICON_CLASS =
  "tap-scale flex size-10 items-center justify-center rounded-sm text-ink transition-colors duration-(--duration-fast) hover:bg-white/60";

/**
 * Atalho para os pedidos, ao lado do botão de conta.
 *
 * **Some para quem não está logado**, e não vira um link para a tela de login:
 * oferecer "Pedidos" a quem não tem nenhum é prometer conteúdo que não existe.
 * Quem entra vê o botão aparecer.
 *
 * `useAuthAfterHydration` e não `useUser` — mesma regra do `SignIn` ao lado.
 * Aqui a consequência de errar é ainda mais direta: o servidor renderizaria o
 * botão e o cliente não, que é exatamente a divergência de markup que derrubava
 * o site inteiro. Com o hook, os dois começam sem o botão e ele entra depois da
 * montagem.
 */
function Orders({ variant }: Props) {
  const isAuthenticated = useAuthAfterHydration();

  if (!isAuthenticated) return null;

  if (variant === "mobile") {
    return (
      <Link
        to="/meus-pedidos"
        aria-label="Meus pedidos"
        preload="intent"
        className={MOBILE_ICON_CLASS}
      >
        <Icon id="shopping_bag" size={18} />
      </Link>
    );
  }

  return (
    <Button href="/meus-pedidos" size="md" prefetch="intent">
      Pedidos
    </Button>
  );
}

export default Orders;
