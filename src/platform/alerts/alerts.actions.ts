import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { hasStockAlert } from "./alerts.d1";
import { readShopperIdentity } from "./alerts.session";

/**
 * Se o comprador atual já pediu aviso para esta variante.
 *
 * A identidade é resolvida no servidor, e não recebida do cliente, de propósito:
 * aceitar um e-mail do corpo aqui deixaria qualquer um consultar por quem
 * outra pessoa está esperando.
 *
 * `false` para quem está deslogado — não porque não pediu, mas porque não dá
 * para saber sem uma identidade anônima (ver alerts.d1.hasStockAlert).
 */
export const hasStockAlertServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { variantId: string }) => input)
  .handler(async (ctx): Promise<boolean> => {
    const variantId = ctx.data.variantId?.trim();
    if (!variantId) return false;

    const identity = await readShopperIdentity(getRequest());
    if (!identity) return false;

    return hasStockAlert(identity.email, variantId);
  });
