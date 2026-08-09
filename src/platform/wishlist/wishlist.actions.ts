import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  toggleWishlistItem,
  mergeCookieWishlist,
} from "./wishlist.pg";
import { readWishlistCookie, serializeWishlistCookie } from "../../loaders/_cookie";
import {
  EMPTY_WISHLIST,
  type WishlistState,
  type WishlistItem,
  type ToggleWishlistInput,
} from "./wishlist.types";

/** Obtém email do usuário autenticado via Shopify (reusa lógica de user.actions.ts) */
async function getAuthenticatedUserEmail(request: Request | undefined): Promise<string | null> {
  if (!request) return null;
  const { userLoader } = await import("@decocms/apps-shopify");
  const user = await userLoader(request.headers);
  return user?.email ?? null;
}

/** Wishlist completa (banco se logado, cookie se não). Usada pelo loader do CMS. */
export const getWishlistStateServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<WishlistState> => {
    const request = getRequest();
    const email = await getAuthenticatedUserEmail(request);

    if (email) {
      const items = await getWishlist(email);
      return { items };
    }

    // Não autenticado: cookie
    return request ? readWishlistCookie(request) : EMPTY_WISHLIST;
  },
);

/** Toggle: adiciona/remove item. Usada pela action do CMS (botão de coração). */
export const toggleWishlistItemServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: ToggleWishlistInput) => input)
  .handler(async (ctx): Promise<WishlistState> => {
    const { productId, productGroupId } = ctx.data;
    if (!productId) throw new Error("productId is required");

    const request = getRequest();
    const response = await getResponse();
    const email = await getAuthenticatedUserEmail(request);

    if (email) {
      // Usuário logado: banco - usa toggle atômico
      await toggleWishlistItem(email, productId, productGroupId);

      // Retorna estado atualizado
      const updated = await getWishlist(email);
      return { items: updated };
    }

    // Não logado: cookie (comportamento atual preservado)
    if (!request) return EMPTY_WISHLIST;

    const current = readWishlistCookie(request);
    const next: WishlistState = current.items.some((i) => i.productId === productId)
      ? { items: current.items.filter((i) => i.productId !== productId) }
      : {
          items: [
            ...current.items,
            { productId, productGroupId, addedAt: new Date().toISOString() },
          ],
        };

    // Seta cookie na resposta
    response.headers.append("Set-Cookie", serializeWishlistCookie(next));
    return next;
  });

/** Called no login bem-sucedido: merge cookie → banco. Deve ser chamado após persistir o access token. */
export const mergeWishlistOnLoginServerFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<void> => {
    const request = getRequest();
    const email = await getAuthenticatedUserEmail(request);
    if (!email) return;

    const cookieState = readWishlistCookie(request);
    if (cookieState.items.length === 0) return;

    await mergeCookieWishlist(
      email,
      cookieState.items.map((i) => i.productId),
    );

    // Limpa cookie após merge bem-sucedido
    const response = await getResponse();
    response.headers.append("Set-Cookie", serializeWishlistCookie(EMPTY_WISHLIST));
  },
);

// Helper para obter o objeto RequestContext.responseHeaders
async function getResponse() {
  const { getResponse } = await import("@tanstack/react-start/server");
  return getResponse();
}
