import { formatPrice } from "@decocms/apps-commerce/sdk/formatPrice";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import Image from "~/components/ui/Image";
// Do módulo, não do barrel — ver a nota em Minicart.tsx.
import { listarPedidosServerFn } from "../platform/orders/orders.actions";
import type { Pedido } from "../platform/orders/orders.types";
import { useAuthAfterHydration, useUser } from "../platform/user";

export const Route = createFileRoute("/meus-pedidos")({
  component: MeusPedidos,
});

/**
 * Rota de arquivo, e não página do CMS como `/minha-vitrine`.
 *
 * A diferença é o que a página mostra: uma vitrine é conteúdo, e faz sentido
 * alguém reposicioná-la no admin. Um extrato de pedidos não é conteúdo — é
 * dado da pessoa, e não existe arranjo de blocos que faça sentido editar. Pôr
 * no CMS só criaria uma section que ninguém deve mover, com o custo extra de
 * carregar diferida (e neste site section diferida que falha vira página vazia
 * com status 200).
 */
function MeusPedidos() {
  // `useAuthAfterHydration` pelo mesmo motivo de `SignIn` e do minicart: esta
  // página escolhe entre duas telas inteiras a partir da sessão, e `useUser`
  // responde diferente no servidor e na primeira renderização do cliente.
  const isAuthenticated = useAuthAfterHydration();
  const { isLoading: carregandoUsuario } = useUser();

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => listarPedidosServerFn(),
    // Só consulta quando há sessão: o servidor devolveria lista vazia de todo
    // jeito, mas pedir é dizer ao visitante deslogado que existe algo lá.
    enabled: isAuthenticated,
  });

  if (carregandoUsuario) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="card bg-base-100 shadow w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Seus pedidos</h1>
          <p className="text-base-content/70 mb-6">Entre para ver o que você comprou.</p>
          <Link to="/login" preload="intent" className="btn btn-primary">
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-3xl font-semibold mb-1">Meus pedidos</h1>
      <p className="text-base-content/70 mb-8">
        Compras simuladas — nenhum pagamento é processado.
      </p>

      {isLoading ? (
        <span className="loading loading-spinner" />
      ) : !pedidos || pedidos.length === 0 ? (
        <div className="card bg-base-100 shadow p-8 text-center">
          <p className="text-base-content/70 mb-6">Você ainda não fez nenhum pedido.</p>
          <Link to="/" className="btn btn-outline self-center">
            Ver produtos
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {pedidos.map((pedido) => (
            <CartaoDoPedido key={pedido.id} pedido={pedido} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Data curta em pt-BR. O banco guarda ISO 8601 em UTC. */
const emData = (iso: string): string => {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? iso
    : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

function CartaoDoPedido({ pedido }: { pedido: Pedido }) {
  const cancelado = pedido.status === "cancelled";

  return (
    <li className="card bg-base-100 shadow overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-base-200 px-5 py-3">
        <div className="flex flex-col">
          {/* O id inteiro é ruído numa tela; os últimos dígitos bastam para a
              pessoa citar o pedido, e o `title` guarda o valor completo. */}
          <span className="font-medium" title={pedido.id}>
            Pedido #{pedido.id.slice(-6)}
          </span>
          <span className="text-xs text-base-content/60">{emData(pedido.criadoEm)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${cancelado ? "badge-ghost" : "badge-success"} badge-sm`}>
            {cancelado ? "Cancelado" : "Pago"}
          </span>
          <span className="font-medium">{formatPrice(pedido.total, "BRL")}</span>
        </div>
      </header>

      <ul className="divide-y divide-base-200">
        {pedido.itens.map((item) => (
          <li key={item.variantId} className="flex items-center gap-3 px-5 py-3">
            {item.imagem ? (
              <Image
                className="w-14 h-14 rounded border border-base-200 object-cover"
                src={item.imagem.url}
                alt={item.imagem.alt}
                width={56}
                height={56}
                loading="lazy"
              />
            ) : (
              <div className="w-14 h-14 rounded bg-base-200" aria-hidden="true" />
            )}

            <div className="grow min-w-0">
              {/* O título é o SNAPSHOT — o nome que a pessoa viu ao comprar.
                  Se o produto foi renomeado depois, o recibo não muda. */}
              {/* `<a>` e não `<Link>`: a PDP não é rota de arquivo, ela é
                  servida pelo catch-all `$.tsx` a partir do CMS. `Link` só
                  conhece as rotas tipadas (`/`, `/account`, `/login`,
                  `/meus-pedidos`), e apontar para uma inexistente compila e
                  quebra no clique. */}
              {item.productHandle ? (
                <a
                  href={`/products/${item.productHandle}`}
                  className="text-sm font-medium hover:underline line-clamp-2"
                >
                  {item.titulo}
                </a>
              ) : (
                <span className="text-sm font-medium line-clamp-2">{item.titulo}</span>
              )}
              <div className="text-xs text-base-content/60">
                {item.quantidade} × {formatPrice(item.precoUnitario, "BRL")}
              </div>
            </div>

            <span className="text-sm tabular-nums">
              {formatPrice(item.precoUnitario * item.quantidade, "BRL")}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
