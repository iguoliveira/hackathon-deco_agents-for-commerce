import type { AnalyticsItem } from "@decocms/apps-commerce/types";
import { useSendEvent } from "../../sdk/useSendEvent";
import { useToggleWishlist, useWishlist } from "../../platform/wishlist";
import IconButton from "../ui/IconButton";
import Button from "../ui/Button";

interface Props {
  variant?: "full" | "icon";
  item: AnalyticsItem;
}

function WishlistButton({ item, variant = "full" }: Props) {
  const productId = (item as { item_id: string }).item_id;
  const productGroupId = item.item_group_id ?? "";

  const { isInWishlist } = useWishlist();
  const toggle = useToggleWishlist();

  const inWishlist = isInWishlist(productId);
  const pending = toggle.isPending && toggle.variables?.productId === productId;

  const addToWishlistEvent = useSendEvent({
    on: "click",
    event: { name: "add_to_wishlist", params: { items: [item] } },
  });

  const handleClick = () => {
    toggle.mutate({ productId, productGroupId });
  };

  const label = inWishlist ? "Remove from wishlist" : "Add to wishlist";

  if (variant === "icon") {
    return (
      <IconButton
        icon="favorite"
        label={label}
        active={inWishlist}
        filled={inWishlist}
        disabled={pending}
        onClick={handleClick}
        {...addToWishlistEvent}
      />
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      disabled={pending}
      onClick={handleClick}
      className="w-full"
      {...addToWishlistEvent}
    >
      {label}
    </Button>
  );
}

export default WishlistButton;
