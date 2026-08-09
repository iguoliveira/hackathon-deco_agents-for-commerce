import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserServerFn,
  recoverPasswordServerFn,
  signInServerFn,
  signOutServerFn,
  signUpServerFn,
} from "./user.actions";
import type { Person, UserState } from "./user.types";

export const USER_QUERY_KEY = ["user"] as const;

/**
 * `isAuthenticated`, mas seguro para decidir **o que é renderizado**.
 *
 * `useUser()` devolve valores DIFERENTES no servidor e na primeira renderização
 * do cliente: no servidor a sessão resolve (logado), no cliente a query começa
 * em `placeholderData: null` (deslogado). Quem ramifica markup nisso produz
 * HTML divergente, e o React não conserta — ele **descarta a árvore inteira**:
 *
 *     Hydration failed because the server rendered text didn't match the client
 *     - href="/account"  ... - Account      (servidor)
 *     + href="/login"    ... + Login        (cliente)
 *
 * Custou caro: como o `SignIn` vive no header, TODA página do site abria em
 * branco para quem estivesse logado — categoria, PDP, tudo. Deslogado não
 * aparecia, porque aí os dois lados concordavam.
 *
 * Aqui o servidor e a primeira renderização do cliente sempre veem `false`, e o
 * estado real entra depois da montagem. O logado enxerga o rótulo de deslogado
 * por um quadro — preço barato por não perder a página.
 *
 * **Use este para renderizar; use `useUser()` para lógica que não vira markup.**
 */
export function useUserAfterHydration(): Person | null {
  const { user } = useUser();
  const [hidratado, setHidratado] = useState(false);

  // Só roda no cliente, e só depois que a hidratação comparou as duas árvores.
  useEffect(() => setHidratado(true), []);

  return hidratado ? user : null;
}

/** Idem, quando só o "está logado?" importa. */
export function useAuthAfterHydration(): boolean {
  return !!useUserAfterHydration()?.email;
}

export function useUser() {
  const query = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: () => getUserServerFn(),
    staleTime: 60_000,
    placeholderData: null,
  });
  const user: Person | null = query.data ?? null;
  return {
    user,
    isAuthenticated: !!user?.email,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => signInServerFn({ data: input }),
    onSuccess: (user: UserState) => {
      qc.setQueryData(USER_QUERY_KEY, user);
    },
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => signUpServerFn({ data: input }),
    onSuccess: (user: UserState) => {
      qc.setQueryData(USER_QUERY_KEY, user);
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => signOutServerFn(),
    onSuccess: () => {
      qc.setQueryData(USER_QUERY_KEY, null);
    },
  });
}

export function useRecoverPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) => recoverPasswordServerFn({ data: input }),
  });
}
