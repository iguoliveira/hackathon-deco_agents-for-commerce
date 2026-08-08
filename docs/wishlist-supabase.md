# Plano de Implementação: Wishlist com Supabase (Postgres)

## Contexto Atual

- **Wishlist hoje**: funciona apenas via cookie (`deco_wishlist`) — persiste no browser, sem backend
- **Plataforma configurada**: `shopify` em `src/apps/site.ts`, mas o app migrou para **Supabase (Postgres)**
- **Autenticação**: usa Shopify Customer Account API (cookie `secure_customer_sig`)
- **Problema**: ao trocar de dispositivo/navegador ou limpar cookies, a wishlist some; não há sincronização entre sessões

---

## Objetivo

Mover a wishlist para o **Supabase (Postgres)** mantendo:
1. **Usuários autenticados** → wishlist no banco (persistente, multi-dispositivo)
2. **Usuários não autenticados** → fallback no cookie (comportamento atual preservado)
3. **Migração transparente** → ao fazer login, wishlist do cookie mergeia com a do banco

---

## Arquitetura (seguindo padrão `src/platform/*`)

```
src/platform/wishlist/
├── wishlist.types.ts      # Tipos (WishlistState, WishlistItem, etc.)
├── wishlist.pg.ts         # Único arquivo com SQL (Postgres) — isolamento de storage
├── wishlist.actions.ts    # toggle, merge (cookie → db no login)
├── wishlist.hooks.ts      # useWishlist, useToggleWishlist (React Query)
└── index.ts               # Barrel

src/loaders/wishlist.ts    # Loader do CMS (lê do banco ou cookie)
src/actions/wishlist/submit.ts  # Action invocada pelo botão (usa wishlist.actions.ts)

db/migrations/
└── 0015_wishlist.sql      # Tabela wishlist + índices
```

---

## 1. Migration: `db/migrations/0015_wishlist.sql`

```sql
-- Wishlist itens (um por produto por usuário)
CREATE TABLE IF NOT EXISTS wishlist_items (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,           -- email do Shopify (customerAccessToken subject)
  product_id    TEXT NOT NULL,           -- variant ID (SKU)
  product_group_id TEXT NOT NULL,        -- product group ID (handle pai)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- Índice para listar itens do usuário ordenados por recência
CREATE INDEX IF NOT EXISTS idx_wishlist_user_created
  ON wishlist_items (user_id, created_at DESC);

-- Índice para checar existência rápida
CREATE INDEX IF NOT EXISTS idx_wishlist_user_product
  ON wishlist_items (user_id, product_id);
```

**Notas:**
- `user_id` = email do cliente Shopify (vém do `customerAccessToken`)
- `product_id` = variant ID (o que o botão envia hoje como `productID`)
- `product_group_id` = product group ID (para exibição agrupada futuramente)
- Sem `FOREIGN KEY` proposital: catálogo é reseedado nas migrations; `ON DELETE CASCADE` apagaria histórico

---

## 2. `src/platform/wishlist/wishlist.types.ts`

```typescript
export interface WishlistItem {
  productId: string;          // variant ID (SKU)
  productGroupId: string;     // product group ID
  addedAt: string;            // ISO 8601
}

export interface WishlistState {
  items: WishlistItem[];
  // Compatibilidade com código existente
  get productIDs(): string[] {
    return this.items.map(i => i.productId);
  }
}

export const EMPTY_WISHLIST: WishlistState = { items: [] };

// Input da action de toggle
export interface ToggleWishlistInput {
  productId: string;          // variant ID
  productGroupId: string;
}
```

---

## 3. `src/platform/wishlist/wishlist.pg.ts`

```typescript
import { getDb } from "../db";

/** Lê wishlist do usuário autenticado */
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  const db = getDb();
  const rows = await db`
    SELECT product_id, product_group_id, created_at
    FROM wishlist_items
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map(r => ({
    productId: r.product_id,
    productGroupId: r.product_group_id,
    addedAt: r.created_at,
  }));
}

/** Adiciona item (idempotente: UNIQUE constraint evita duplicata) */
export async function addWishlistItem(
  userId: string,
  productId: string,
  productGroupId: string
): Promise<void> {
  const db = getDb();
  await db`
    INSERT INTO wishlist_items (user_id, product_id, product_group_id)
    VALUES (${userId}, ${productId}, ${productGroupId})
    ON CONFLICT (user_id, product_id) DO NOTHING
  `;
}

/** Remove item */
export async function removeWishlistItem(
  userId: string,
  productId: string
): Promise<void> {
  const db = getDb();
  await db`
    DELETE FROM wishlist_items
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
}

/** Merge: move itens do cookie para o banco no login (idempotente) */
export async function mergeCookieWishlist(
  userId: string,
  cookieProductIds: string[]
): Promise<void> {
  if (cookieProductIds.length === 0) return;

  const db = getDb();
  // Busca product_group_id dos produtos no catálogo
  const catalogRows = await db`
    SELECT v.variant_id, p.product_group_id
    FROM variants v
    JOIN products p ON p.product_group_id = v.product_group_id
    WHERE v.variant_id = ANY(${cookieProductIds})
  `;

  const groupIdByVariant = new Map(catalogRows.map(r => [r.variant_id, r.product_group_id]));

  for (const productId of cookieProductIds) {
    const productGroupId = groupIdByVariant.get(productId);
    if (!productGroupId) continue; // produto não existe mais no catálogo

    await db`
      INSERT INTO wishlist_items (user_id, product_id, product_group_id)
      VALUES (${userId}, ${productId}, ${productGroupId})
      ON CONFLICT (user_id, product_id) DO NOTHING
    `;
  }
}
```

---

## 4. `src/platform/wishlist/wishlist.actions.ts`

```typescript
import { getWishlist, addWishlistItem, removeWishlistItem, mergeCookieWishlist } from "./wishlist.pg";
import { readWishlistCookie, serializeWishlistCookie, EMPTY_WISHLIST } from "../../loaders/_cookie";
import type { WishlistState, WishlistItem, ToggleWishlistInput } from "./wishlist.types";

/** Obtém email do usuário autenticado via Shopify (já existe em user.actions.ts) */
async function getAuthenticatedUserEmail(): Promise<string | null> {
  // Reusa a lógica de userLoader do Shopify
  const { shopifyUserLoader } = await import("@decocms/apps-shopify");
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const user = await shopifyUserLoader(request.headers);
  return user?.email ?? null;
}

/** Wishlist completa (banco se logado, cookie se não) */
export async function getWishlistState(): Promise<WishlistState> {
  const email = await getAuthenticatedUserEmail();

  if (email) {
    const items = await getWishlist(email);
    return { items };
  }

  // Não autenticado: cookie
  const request = getRequest?.();
  return request ? readWishlistCookie(request) : EMPTY_WISHLIST;
}

/** Toggle: adiciona/remove item */
export async function toggleWishlistItem(input: ToggleWishlistInput): Promise<WishlistState> {
  const email = await getAuthenticatedUserEmail();

  if (email) {
    // Usuário logado: banco
    const current = await getWishlist(email);
    const exists = current.some(i => i.productId === input.productId);

    if (exists) {
      await removeWishlistItem(email, input.productId);
    } else {
      await addWishlistItem(email, input.productId, input.productGroupId);
    }

    // Retorna estado atualizado
    const updated = await getWishlist(email);
    return { items: updated };
  }

  // Não logado: cookie (comportamento atual)
  const request = getRequest();
  if (!request) return EMPTY_WISHLIST;

  const current = readWishlistCookie(request);
  const next: WishlistState = current.items.some(i => i.productId === input.productId)
    ? { items: current.items.filter(i => i.productId !== input.productId) }
    : { items: [...current.items, { productId: input.productId, productGroupId: input.productGroupId, addedAt: new Date().toISOString() }] };

  // Seta cookie na resposta
  const { RequestContext } = await import("@decocms/blocks/sdk/requestContext");
  RequestContext.responseHeaders.append("Set-Cookie", serializeWishlistCookie(next));
  return next;
}

/** Called no login bem-sucedido: merge cookie → banco */
export async function mergeWishlistOnLogin(): Promise<void> {
  const email = await getAuthenticatedUserEmail();
  if (!email) return;

  const request = getRequest();
  if (!request) return;

  const cookieState = readWishlistCookie(request);
  if (cookieState.items.length === 0) return;

  await mergeCookieWishlist(email, cookieState.items.map(i => i.productId));

  // Limpa cookie após merge bem-sucedido
  const { RequestContext } = await import("@decocms/blocks/sdk/requestContext");
  RequestContext.responseHeaders.append("Set-Cookie", serializeWishlistCookie(EMPTY_WISHLIST));
}
```

---

## 5. `src/platform/wishlist/wishlist.hooks.ts` (atualização mínima)

```typescript
// Mantém a interface existente, só ajusta tipos internos
export function useWishlist() {
  const query = useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => invoke.site.loaders.wishlist() as Promise<WishlistState>,
    staleTime: 60_000,
    placeholderData: EMPTY_WISHLIST,
  });
  const wishlist = query.data ?? EMPTY_WISHLIST;
  return {
    wishlist,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isInWishlist: (productId: string) => wishlist.items.some(i => i.productId === productId),
  };
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ToggleWishlistInput): Promise<WishlistState> =>
      invoke.site.actions.wishlist.submit(input) as Promise<WishlistState>,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const prev = qc.getQueryData<WishlistState>(WISHLIST_QUERY_KEY) ?? EMPTY_WISHLIST;
      const exists = prev.items.some(i => i.productId === input.productId);
      const next: WishlistState = exists
        ? { items: prev.items.filter(i => i.productId !== input.productId) }
        : { items: [...prev.items, { productId: input.productId, productGroupId: input.productGroupId, addedAt: new Date().toISOString() }] };
      qc.setQueryData(WISHLIST_QUERY_KEY, next);
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(WISHLIST_QUERY_KEY, ctx.prev);
    },
    onSuccess: (server) => qc.setQueryData(WISHLIST_QUERY_KEY, server),
  });
}
```

---

## 6. `src/loaders/wishlist.ts` (atualização)

```typescript
import { getWishlistState } from "../platform/wishlist/wishlist.actions";

export default async function wishlistLoader(): Promise<WishlistState> {
  return getWishlistState();
}
```

---

## 7. `src/actions/wishlist/submit.ts` (atualização)

```typescript
import { toggleWishlistItem, type ToggleWishlistInput } from "../../platform/wishlist/wishlist.actions";

export default async function action(props: ToggleWishlistInput): Promise<WishlistState> {
  if (!props?.productId) throw new Error("productId is required");
  return toggleWishlistItem(props);
}
```

---

## 8. Integração no Login (`src/platform/user/user.actions.ts`)

No `signInServerFn`, após `persistAccessToken(token)`, adicionar:

```typescript
// Merge wishlist do cookie para o banco
const { mergeWishlistOnLogin } = await import("../wishlist/wishlist.actions");
await mergeWishlistOnLogin();
```

---

## 9. `WishlistButton.tsx` — ajustes mínimos

- `item.item_id` → `productId` (variant ID)
- `item.item_group_id` → `productGroupId`
- O hook `useWishlist` já expõe `isInWishlist(productId)` compatível

---

## 10. Seção de Wishlist (página `/wishlist`)

`src/components/wishlist/WishlistGallery.tsx` já existe e usa `useWishlist()`. Funcionará automaticamente — só precisa resolver `productId` → `Product` para renderizar cards.

---

## Ordem de Execução

| # | Passo | Arquivos | Validação |
|---|-------|----------|-----------|
| 1 | Migration + `wishlist.pg.ts` | `db/migrations/0015_wishlist.sql`, `wishlist.pg.ts` | `npm run db:migrate` roda 2x sem erro; `db:query` lê/escreve |
| 2 | `wishlist.actions.ts` + tipos | `wishlist.types.ts`, `wishlist.actions.ts` | Typecheck limpo |
| 3 | Loader + Action CMS | `loaders/wishlist.ts`, `actions/wishlist/submit.ts` | `npm run dev` → PDP: botão coração toggleia |
| 4 | Hooks React Query | `wishlist.hooks.ts` | Otimistic update funciona; refetch sincroniza |
| 5 | Merge no login | `user.actions.ts` (signInServerFn) | Login → wishlist do cookie aparece no banco |
| 6 | Página `/wishlist` | `WishlistGallery.tsx` | Lista renderiza itens com dados do catálogo |

---

## Testes Manuais (checklist)

- [ ] **Não logado**: adiciona/remove no cookie → persiste ao recarregar
- [ ] **Logado**: adiciona/remove no banco → persiste ao trocar de aba/navegador
- [ ] **Login com cookie pré-existente**: itens do cookie migram para o banco; cookie limpo
- [ ] **Logout**: wishlist some da UI (query invalida); login novamente → itens voltam
- [ ] **Produto removido do catálogo**: não quebra a wishlist (join falha graciosamente)
- [ ] **Concorrência**: duas abas logadas no mesmo usuário → toggle em uma reflete na outra (React Query refetch)

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| `shopifyUserLoader` falha no loader/action | Fallback para cookie (já existe no código) |
| `product_group_id` não encontrado no merge | Pula item; loga warning; não derruba login |
| Cookie > 4KB (muitos itens) | Limitar a 100 itens no cookie; banco não tem limite prático |
| Race condition no merge | `ON CONFLICT DO NOTHING` é idempotente; seguro rodar 2x |

---

## Notas de Implementação

1. **Não usar `node:crypto`** — mesmo motivo do `look`/`shelf`: vaza pro bundle do client
2. **SQL no `.pg.ts` apenas** — isolamento de storage igual `catalog.d1.ts`, `alerts.d1.ts`, `look.d1.ts`
3. **Barrel `index.ts`** — exporta só o público (`useWishlist`, `useToggleWishlist`, tipos)
4. **Compatibilidade** — `WishlistState.productIDs` getter mantém código antigo funcionando
5. **`usePlatform()` continua `"shopify"`** — a wishlist não depende da plataforma de catálogo