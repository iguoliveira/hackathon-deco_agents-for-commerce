import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@decocms/apps-commerce/types";
import { invoke } from "../../runtime";
import { useUserAfterHydration } from "../../platform/user";
import { STOCK_ALERT_QUERY_KEY, useHasStockAlert } from "../../platform/alerts";
import type { NotifyMeResult } from "../../actions/notifyMe/subscribe";
import Button from "../ui/Button";

export interface Props {
  productID: Product["productID"];
}

const INPUT_CLASS =
  "frost h-10 rounded-sm px-3 text-sm text-ink placeholder:text-muted-soft focus:outline-none";

export default function OutOfStock({ productID }: Props) {
  // `useUserAfterHydration` e nao `useUser`: a linha 60 ramifica markup no
  // e-mail da sessao, e `useUser` responde logado no servidor e deslogado na
  // primeira renderizacao do cliente — divergencia que derruba a arvore.
  const user = useUserAfterHydration();
  const queryClient = useQueryClient();
  // Signed-out shoppers always read `false` here: their identity is the email
  // they are about to type, which does not exist yet at render time.
  const { alreadyRequested } = useHasStockAlert(productID);
  const notify = useMutation({
    // `email` is omitted when signed in — the server takes it from the session.
    mutationFn: async (input: { email?: string; name?: string }) => {
      const result = (await invoke.site.actions.notifyMe.subscribe({
        skuId: productID,
        email: input.email,
        name: input.name,
      })) as NotifyMeResult | undefined;
      if (!result?.success) throw new Error("Notify request failed");
      return result;
    },
    // The row we just wrote is exactly what `useHasStockAlert` reads, and its
    // cached `false` outlives this component: switch to another size and come
    // back within the `staleTime` window and the form renders again, as if the
    // request had never happened. `notify.isSuccess` does not survive that
    // unmount — the cache is what has to be corrected.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...STOCK_ALERT_QUERY_KEY, productID] });
    },
  });

  // `alreadyRequested` covers the return visit: without it the form rendered
  // blank days later, as if the shopper had never asked, and the only way to
  // find out was to submit again.
  if (notify.isSuccess || alreadyRequested) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink-soft">You're on the list!</span>
        <span className="text-xs text-muted">
          We'll email you when this product is back in stock.
        </span>
      </div>
    );
  }

  // Signed in: we already know who this is, and the server reads the identity
  // from the session anyway — asking for it again would be theatre, and any
  // address typed here would be ignored.
  if (user?.email) {
    return (
      <div className="flex flex-col items-start gap-2">
        <span className="text-sm font-medium text-ink-soft">
          This product is currently unavailable
        </span>
        <span className="text-xs text-muted">
          We'll let you know at <span className="text-ink-soft">{user.email}</span>
        </span>

        <Button
          type="button"
          variant="solid"
          size="md"
          disabled={notify.isPending}
          onClick={() => notify.mutate({})}
        >
          {notify.isPending ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            "Notify me when it's back"
          )}
        </Button>

        {notify.isError && (
          <span className="text-xs text-error">Something went wrong. Please try again.</span>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const email = `${data.get("email") ?? ""}`.trim();
        const name = `${data.get("name") ?? ""}`.trim();
        if (email) notify.mutate({ email, name });
      }}
    >
      <span className="text-sm font-medium text-ink-soft">
        This product is currently unavailable
      </span>
      <span className="text-xs text-muted">Notify me when it's back in stock</span>

      <input placeholder="Name" className={INPUT_CLASS} name="name" />
      <input placeholder="Email" type="email" required className={INPUT_CLASS} name="email" />

      <Button type="submit" variant="solid" size="md" disabled={notify.isPending}>
        {notify.isPending ? <span className="loading loading-spinner loading-xs" /> : "Submit"}
      </Button>

      {notify.isError && (
        <span className="text-xs text-error">Something went wrong. Please try again.</span>
      )}
    </form>
  );
}
