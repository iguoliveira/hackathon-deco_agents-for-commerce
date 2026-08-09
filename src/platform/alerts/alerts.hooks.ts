import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { hasStockAlertServerFn } from "./alerts.actions";

export const STOCK_ALERT_QUERY_KEY = ["stock-alert"] as const;

/**
 * Se o comprador logado já pediu aviso para esta variante.
 *
 * `enabled` cortado quando não há `variantId` para não disparar a consulta em
 * produto disponível — só a PDP de uma variante esgotada renderiza isto.
 */
export function useHasStockAlert(variantId: string | undefined) {
  const query = useQuery({
    queryKey: [...STOCK_ALERT_QUERY_KEY, variantId],
    queryFn: () => hasStockAlertServerFn({ data: { variantId: variantId as string } }),
    enabled: !!variantId,
    staleTime: 60_000,
    placeholderData: false,
  });

  return { alreadyRequested: query.data ?? false, isLoading: query.isLoading };
}

/**
 * `alreadyRequested`, mas seguro para decidir **o que é renderizado**.
 *
 * `OutOfStock` escolhe entre o formulário e a confirmação a partir deste valor,
 * e a query responde diferente no servidor e na primeira renderização do
 * cliente — lá a sessão resolve e o alerta existe; aqui ela começa em
 * `placeholderData: false`. Markup divergente derruba a árvore inteira, e a
 * PDP fica em branco.
 *
 * Mesmo guarda de `useUserAfterHydration`, `useIsInWishlistAfterHydration` e
 * `useCartAfterHydration`. A regra está em docs/pedidos-e-compra-simulada.md
 * §6.1b: **query com `placeholderData` não decide markup.**
 */
export function useHasStockAlertAfterHydration(variantId: string | undefined) {
  const { alreadyRequested, isLoading } = useHasStockAlert(variantId);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => setHidratado(true), []);

  return { alreadyRequested: hidratado && alreadyRequested, isLoading };
}
