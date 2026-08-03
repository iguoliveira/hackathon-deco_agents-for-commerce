import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { createStockAlert, readShopperIdentity } from "../../platform/alerts";

export interface NotifyMeProps {
  /** SKU/variant the shopper wants — already identifies item + size + colour. */
  skuId: string;
  /** Only read when signed out. A signed-in shopper's session wins — see below. */
  email?: string;
  name?: string;
}

export interface NotifyMeResult {
  success: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Records that this shopper wanted this exact variant and could not have it.
 *
 * Despite the name inherited from the button, nothing here sends email. The
 * row is a demand signal: the agent that builds the shopper's personalised
 * shelf reads it back via `findWaitedItems` and looks for available products
 * matching what they waited for. See docs/feature-back-in-stock-shelf.md.
 *
 * Only `skuId` is stored — size, type, collections and tags all hang off the
 * variant in the catalog and are resolved by JOIN at read time.
 *
 * Signed in, the session is authoritative and the client-sent email is
 * discarded: this endpoint is public, so trusting the body would let anyone
 * file alerts under someone else's address, and the shelf we later build from
 * these rows is personal to that address.
 */
async function action(props: NotifyMeProps, req?: Request): Promise<NotifyMeResult> {
  const skuId = props?.skuId?.trim();
  // Public invoke endpoint — validate here, not just via the form.
  if (!skuId) throw new Error("skuId is required");

  const identity = await readShopperIdentity(req ?? RequestContext.current?.request);

  const email = identity?.email ?? props?.email?.trim();
  const name = identity?.name ?? props?.name?.trim();

  if (!email || !EMAIL_RE.test(email)) {
    throw new Error("a valid email is required");
  }

  const outcome = await createStockAlert({ variantId: skuId, email, name: name || undefined });

  // Distinct messages because the causes are distinct: an unknown variant is a
  // bad request, a failed write is ours. Reporting success for either would
  // tell the shopper they are on the list while the signal that drives their
  // shelf was dropped.
  if (outcome === "unknown_variant") throw new Error("unknown product variant");
  if (outcome === "failed") throw new Error("could not record the request, please try again");

  return { success: true };
}

export default action;
