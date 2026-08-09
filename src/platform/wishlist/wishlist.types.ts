export interface WishlistItem {
  productId: string; // variant ID (SKU)
  productGroupId: string; // product group ID (handle pai)
  addedAt: string; // ISO 8601
}

export interface WishlistState {
  items: WishlistItem[];
}

export const EMPTY_WISHLIST: WishlistState = { items: [] };

// Helper para compatibilidade com código existente
export function getProductIDs(state: WishlistState): string[] {
  return state.items.map((i) => i.productId);
}

// Input da action de toggle
export interface ToggleWishlistInput {
  productId: string; // variant ID
  productGroupId: string;
}