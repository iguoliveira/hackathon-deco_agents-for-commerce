import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { userLoader as shopifyUserLoader } from "@decocms/apps-shopify";
import { createStockAlert } from "../../platform/alerts";

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
 * Identity of the shopper filing the request.
 *
 * Signed in, the session is authoritative and the client-sent email is
 * discarded: this endpoint is public, so trusting the body would let anyone
 * file alerts under someone else's address — and the shelf we later build from
 * these rows is personal to that address.
 *
 * A session that fails to resolve degrades to the form instead of throwing:
 * losing the signal is worse than filing it under a typed email.
 */
const readSession = async (request: Request | undefined) => {
  if (!request) return null;
  try {
    const person = await shopifyUserLoader(request.headers);
    if (!person?.email) return null;
    const name = [person.givenName, person.familyName].filter(Boolean).join(" ").trim();
    return { email: person.email, name: name || undefined };
  } catch (error) {
    console.warn("[notifyMe] could not resolve the signed-in shopper:", error);
    return null;
  }
};

/**
 * Records that this shopper wanted this exact variant and could not have it.
 *
 * Despite the name inherited from the button, nothing here sends email. The
 * row is a demand signal: the agent that builds the shopper's personalised
 * shelf reads it back via `findWaitedItems` and looks for available products
 * matching what they waited for. See db/migrations/0005_create_stock_alerts.sql.
 *
 * Only `skuId` is stored — size, type, collections and tags all hang off the
 * variant in the catalog and are resolved by JOIN at read time.
 */
async function action(props: NotifyMeProps, req?: Request): Promise<NotifyMeResult> {
  const skuId = props?.skuId?.trim();
  // Public invoke endpoint — validate here, not just via the form.
  if (!skuId) throw new Error("skuId is required");

  const session = await readSession(req ?? RequestContext.current?.request);

  const email = session?.email ?? props?.email?.trim();
  const name = session?.name ?? props?.name?.trim();

  if (!email || !EMAIL_RE.test(email)) {
    throw new Error("a valid email is required");
  }

  const stored = await createStockAlert({ variantId: skuId, email, name: name || undefined });

  // A failed write must not read as success: the shopper would be told they
  // are on the list while the signal that drives their shelf was dropped.
  if (!stored) throw new Error("could not record the request, please try again");

  return { success: true };
}

export default action;
