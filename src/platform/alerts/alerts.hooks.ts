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
