import { formatPrice } from "@decocms/apps-commerce/sdk/formatPrice";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { clx } from "~/sdk/clx";
import Image from "~/components/ui/Image";
import Icon from "../ui/Icon";
import { MINICART_DRAWER_ID } from "../../constants";
import React from "react";
import {
  CART_QUERY_KEY,
  EMPTY_CART,
  useCartAfterHydration,
  useRemoveCartItem,
  useUpdateCartItem,
  type CartItem,
  type CartState,
} from "../../platform/cart";
// Do módulo, não do barrel: `platform/orders/index.ts` reexporta `orders.d1`,
// que puxa `getDb` e o driver `postgres` para o grafo do cliente. Existe um
// stub em vite.config.ts que mascara isso, mas contar com ele é o caminho para
// o mesmo build quebrado que `node:crypto` já causou uma vez.
import { checkoutServerFn } from "../../platform/orders/orders.actions";
import { useAuthAfterHydration } from "../../platform/user";

function QuantityStepper({ item }: { item: CartItem }) {
  const update = useUpdateCartItem();
  const set = (quantity: number) =>
    update.mutate({ lineId: item.lineId, quantity: Math.max(1, quantity) });
  // No `pending` freeze: the quantity updates optimistically on click and the
  // "cart" mutation scope serializes the requests, so rapid clicks stay
  // consistent and the buttons remain interactive. Only the lower bound is
  // disabled.
  return (
    <div className="join border border-base-200 rounded">
      <button
        type="button"
        className="join-item btn btn-ghost btn-sm no-animation"
        aria-label="Decrease quantity"
        disabled={item.quantity <= 1}
        onClick={() => set(item.quantity - 1)}
      >
        -
      </button>
      <span className="join-item px-3 self-center text-sm min-w-[2ch] text-center">
        {item.quantity}
      </span>
      <button
        type="button"
        className="join-item btn btn-ghost btn-sm no-animation"
        aria-label="Increase quantity"
        onClick={() => set(item.quantity + 1)}
      >
        +
      </button>
    </div>
  );
}

function CartLine({ item, currency }: { item: CartItem; currency: string }) {
  const remove = useRemoveCartItem();
  const removing = remove.isPending && remove.variables?.lineId === item.lineId;
  return (
    <li
      className={clx(
        "flex gap-3 py-3 border-b border-base-200 last:border-none",
        removing && "opacity-50 pointer-events-none",
      )}
    >
      {item.image ? (
        <Image
          className="rounded border border-base-200 w-16 h-16 object-cover"
          src={item.image.url}
          alt={item.image.alt ?? item.title}
          width={64}
          height={64}
          loading="lazy"
        />
      ) : (
        <div className="w-16 h-16 rounded bg-base-200" aria-hidden="true" />
      )}
      <div className="flex flex-col grow gap-1">
        {/* `/products/{handle}`: a rota deste storefront. O `/{handle}` daqui
            era da época do Shopify e levava a 404 em todo item da sacola. */}
        <a
          href={`/products/${item.productHandle}`}
          className="text-sm font-medium line-clamp-2 hover:underline"
        >
          {item.title}
        </a>
        {/* Sem o rótulo da variante, dois tamanhos da mesma peça ficam
            indistinguíveis na sacola — e a pessoa remove o errado. */}
        {item.variantTitle && (
          <div className="text-xs text-base-400">{item.variantTitle}</div>
        )}
        {item.available === false && (
          <div className="text-xs font-medium text-error">Esgotado — remova para finalizar</div>
        )}
        <div className="text-sm text-base-400">{formatPrice(item.price.amount, currency)}</div>
        <div className="flex items-center justify-between mt-1">
          <QuantityStepper item={item} />
          <button
            type="button"
            className="btn btn-ghost btn-xs no-animation"
            aria-label="Remove item"
            disabled={removing}
            onClick={() => remove.mutate({ lineId: item.lineId })}
          >
            <Icon id="trash" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col gap-6 items-center justify-center grow">
      <span className="font-medium text-2xl">Your bag is empty</span>
      <label htmlFor={MINICART_DRAWER_ID} className="btn btn-outline no-animation cursor-pointer">
        Choose products
      </label>
    </div>
  );
}

/**
 * O rodapé com o botão que fecha a compra.
 *
 * Três estados, e o do meio é o que a regra de identidade exige: **sem sessão
 * não se finaliza**. Um pedido grava um e-mail, e o único e-mail confiável é o
 * da sessão verificada (ver `orders.actions.ts`). O carrinho, ao contrário,
 * fica aberto a todo mundo — travar o "adicionar" não protegeria nada e faria a
 * pessoa perder o carrinho ao entrar.
 */
function Footer({ cart }: { cart: CartState }) {
  const navigate = useNavigate();
  // `useAuthAfterHydration` e não `useUser`: este bloco escolhe ENTRE DOIS
  // elementos diferentes (um link e um botão), e `useUser` responde logado no
  // servidor e deslogado na primeira renderização do cliente. Isso é markup
  // divergente, e derruba a árvore inteira na hidratação — o mesmo defeito que
  // o `SignIn` do header tinha. O servidor reconfere a sessão de qualquer
  // forma; isto aqui decide só o rótulo.
  const isAuthenticated = useAuthAfterHydration();

  const qc = useQueryClient();
  const finalizar = useMutation({
    mutationFn: () => checkoutServerFn(),
    onSuccess: (resultado) => {
      if (!resultado.ok) return;

      // Com item removido, NÃO navega: a pessoa precisa ver a sacola com o que
      // ficou de fora. Mandá-la para os pedidos aqui é o mesmo sumiço de antes,
      // só que com um pedido certo na tela para distrair.
      if (resultado.removidos.length > 0) {
        qc.invalidateQueries({ queryKey: CART_QUERY_KEY });
        return;
      }

      qc.setQueryData(CART_QUERY_KEY, EMPTY_CART);
      navigate({ to: "/meus-pedidos" });
    },
  });

  const temEsgotado = cart.items.some((item) => item.available === false);
  const resultado = finalizar.data;

  return (
    <footer className="w-full border-t border-base-200">
      <div className="px-4 py-4 flex justify-between items-center">
        <span className="text-sm">Subtotal</span>
        <span className="font-medium">
          {formatPrice(cart.subtotal.amount, cart.subtotal.currencyCode)}
        </span>
      </div>
      <div className="px-4 pb-2 text-xs text-base-400 text-right">
        Compra simulada — nenhum pagamento é processado
      </div>
      <div className="p-4 flex flex-col gap-2">
        {!isAuthenticated ? (
          <Link to="/login" preload="intent" className="btn btn-primary w-full no-animation">
            Entrar para finalizar
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full no-animation"
            disabled={finalizar.isPending || temEsgotado || cart.items.length === 0}
            onClick={() => finalizar.mutate()}
          >
            {finalizar.isPending ? "Finalizando…" : "Finalizar compra"}
          </button>
        )}

        {resultado?.ok && resultado.removidos.length > 0 && (
          <p className="text-xs text-warning text-center">
            {resultado.removidos.length === 1
              ? "Um item esgotou e ficou de fora do pedido — ele continua na sacola."
              : `${resultado.removidos.length} itens esgotaram e ficaram de fora — continuam na sacola.`}{" "}
            <Link to="/meus-pedidos" className="underline">
              Ver o pedido
            </Link>
          </p>
        )}

        {resultado && !resultado.ok && (
          <p className="text-xs text-error text-center">
            {resultado.motivo === "sem-sessao"
              ? "Entre para finalizar a compra."
              : resultado.motivo === "indisponivel"
                ? "Os itens do carrinho esgotaram."
                : "Não deu para finalizar agora. Tente de novo."}
          </p>
        )}
      </div>
    </footer>
  );
}

export default function Minicart() {
  // `useCartAfterHydration`: `EmptyState` contra a lista e o `disabled` do
  // finalizar sao markup decidido pelo estado da query. Ver o hook.
  const { cart, isFetching } = useCartAfterHydration();
  const currency = cart.subtotal.currencyCode;

  // Avoid hydration mismatch: isFetching is client-only, don't use it for SSR-rendered classes
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      className={clx(
        "flex flex-col h-full w-full",
        mounted && isFetching && "transition-opacity duration-150 opacity-80",
      )}
    >
      <div className="flex items-center justify-between border-b border-base-200 px-4 py-3">
        <h2 className="font-medium text-xl">Your bag</h2>
        <label
          htmlFor={MINICART_DRAWER_ID}
          aria-label="Close cart"
          className="btn btn-ghost btn-sm no-animation cursor-pointer"
        >
          <Icon id="close" />
        </label>
      </div>

      {cart.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="grow overflow-y-auto px-4">
            {cart.items.map((item) => (
              <CartLine key={item.lineId} item={item} currency={currency} />
            ))}
          </ul>
          <Footer cart={cart} />
        </>
      )}
    </div>
  );
}
