import { getWishlistStateServerFn } from "../platform/wishlist/wishlist.actions";
import type { WishlistState } from "../platform/wishlist/wishlist.types";

export default async function wishlistLoader(): Promise<WishlistState> {
  return getWishlistStateServerFn();
}