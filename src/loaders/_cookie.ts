import { EMPTY_WISHLIST, type WishlistState } from "../platform/wishlist";

export const WISHLIST_COOKIE = "deco_wishlist";
export const WISHLIST_COOKIE_TTL = 60 * 60 * 24 * 365;

export function readWishlistCookie(req: Request): WishlistState {
  const header = req.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${WISHLIST_COOKIE}=`));
  if (!match) return EMPTY_WISHLIST;
  try {
    const raw = decodeURIComponent(match.slice(WISHLIST_COOKIE.length + 1));
    const data = JSON.parse(raw);
    // Suporta formato antigo (productIDs: string[]) e novo (items: WishlistItem[])
    if (Array.isArray(data)) {
      return { items: data.map((id: string) => ({ productId: id, productGroupId: "", addedAt: new Date().toISOString() })) };
    }
    if (data?.items && Array.isArray(data.items)) {
      return { items: data.items };
    }
    if (data?.productIDs && Array.isArray(data.productIDs)) {
      return { items: data.productIDs.map((id: string) => ({ productId: id, productGroupId: "", addedAt: new Date().toISOString() })) };
    }
    return EMPTY_WISHLIST;
  } catch {
    return EMPTY_WISHLIST;
  }
}

export function serializeWishlistCookie(state: WishlistState): string {
  const value = encodeURIComponent(JSON.stringify({ items: state.items }));
  return `${WISHLIST_COOKIE}=${value}; Path=/; Max-Age=${WISHLIST_COOKIE_TTL}; SameSite=Lax`;
}

export function getProductIDs(state: WishlistState): string[] {
  return state.items.map((i) => i.productId);
}

export const NEWSLETTER_COOKIE = "deco_newsletter";
export const NEWSLETTER_COOKIE_TTL = 60 * 60 * 24 * 365;

export function readNewsletterCookie(req: Request): string[] {
  const header = req.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${NEWSLETTER_COOKIE}=`));
  if (!match) return [];
  try {
    const raw = decodeURIComponent(match.slice(NEWSLETTER_COOKIE.length + 1));
    const emails = JSON.parse(raw);
    return Array.isArray(emails) && emails.every((x) => typeof x === "string") ? emails : [];
  } catch {
    return [];
  }
}

export function serializeNewsletterCookie(emails: string[]): string {
  const value = encodeURIComponent(JSON.stringify(emails));
  return `${NEWSLETTER_COOKIE}=${value}; Path=/; Max-Age=${NEWSLETTER_COOKIE_TTL}; SameSite=Lax`;
}