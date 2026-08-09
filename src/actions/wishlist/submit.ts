import { toggleWishlistItemServerFn } from "../../platform/wishlist/wishlist.actions";
import type { ToggleWishlistInput, WishlistState } from "../../platform/wishlist";

export default async function action(props: ToggleWishlistInput): Promise<WishlistState> {
  if (!props?.productId) throw new Error("productId is required");
  return toggleWishlistItemServerFn({ data: props });
}