import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWishlistStateServerFn,
  toggleWishlistItemServerFn,
  mergeWishlistOnLoginServerFn,
} from "./wishlist.actions";
import { EMPTY_WISHLIST, type WishlistState, type ToggleWishlistInput } from "./wishlist.types";

export const WISHLIST_QUERY_KEY = ["wishlist"] as const;

export function useWishlist() {
  const query = useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => getWishlistStateServerFn(),
    staleTime: 60_000,
    placeholderData: EMPTY_WISHLIST,
  });
  const wishlist = query.data ?? EMPTY_WISHLIST;
  return {
    wishlist,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isInWishlist: (productId: string) => wishlist.items.some((i) => i.productId === productId),
  };
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ToggleWishlistInput): Promise<WishlistState> =>
      toggleWishlistItemServerFn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const prev = qc.getQueryData<WishlistState>(WISHLIST_QUERY_KEY) ?? EMPTY_WISHLIST;
      const exists = prev.items.some((i) => i.productId === input.productId);
      const next: WishlistState = exists
        ? { items: prev.items.filter((i) => i.productId !== input.productId) }
        : {
            items: [
              ...prev.items,
              { productId: input.productId, productGroupId: input.productGroupId, addedAt: new Date().toISOString() },
            ],
          };
      qc.setQueryData(WISHLIST_QUERY_KEY, next);
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(WISHLIST_QUERY_KEY, ctx.prev);
    },
    onSuccess: (server) => qc.setQueryData(WISHLIST_QUERY_KEY, server),
  });
}

export function useMergeWishlistOnLogin() {
  return useMutation({
    mutationFn: () => mergeWishlistOnLoginServerFn(),
  });
}