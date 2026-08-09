import SearchResult, { Props as SearchResultProps } from "../search/SearchResult";
import { useWishlist } from "../../platform/wishlist";
import { type SectionProps } from "~/types/deco";
import type { ProductListingPage, PageInfo, Product } from "@decocms/apps-commerce/types";
import { getWishlistProducts } from "../../platform/catalog/catalog.actions";

export type Props = SearchResultProps;

function WishlistGallery(props: SectionProps<typeof loader>) {
  const { page } = props;

  if (!page || page.products.length === 0) {
    return (
      <div className="container mx-4 sm:mx-auto">
        <div className="mx-10 my-20 flex flex-col gap-4 justify-center items-center">
          <span className="font-medium text-2xl">Your wishlist is empty</span>
          <span>Log in and add items to your wishlist for later. They will show up here</span>
        </div>
      </div>
    );
  }

  // Pass the URL so SearchResult can build pagination/filter links
  return <SearchResult {...props} page={page} url="/wishlist" />;
}

export const loader = async (): Promise<{ page: ProductListingPage | null }> => {
  const { getWishlistStateServerFn } = await import("../../platform/wishlist/wishlist.actions");
  const state = await getWishlistStateServerFn();

  const productIds = state.items.map((i) => i.productId);

  // Fetch ONLY the products that are in the user's wishlist
  const wishlistProducts = productIds.length > 0 ? await getWishlistProducts(productIds) : [];

  // Create a ProductListingPage from the wishlist products
  const pageInfo: PageInfo = {
    currentPage: 1,
    recordPerPage: 50,
    records: wishlistProducts.length,
    nextPage: undefined,
    previousPage: undefined,
  };

  const page: ProductListingPage | null =
    wishlistProducts.length > 0
      ? {
          "@type": "ProductListingPage",
          products: wishlistProducts,
          filters: [],
          breadcrumb: {
            "@type": "BreadcrumbList",
            numberOfItems: 1,
            itemListElement: [
              { name: "Wishlist", item: "/wishlist", position: 1, "@type": "ListItem" },
            ],
          },
          pageInfo,
          sortOptions: [],
          seo: {
            title: "Wishlist",
            description: "Your saved items",
            canonical: "/wishlist",
          },
        }
      : null;

  return { page };
};

export default WishlistGallery;
