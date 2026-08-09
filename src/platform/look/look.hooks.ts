import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "../../runtime";
import type { Local } from "./look.types";

export const LOCAL_QUERY_KEY = ["look-local"] as const;

/**
 * O local em vigor, lido do servidor.
 *
 * Não sai de `document.cookie` de propósito: o servidor é quem resolve a
 * precedência (seletor > geo da Vercel > padrão), e o cookie sozinho não sabe
 * responder "de onde o geo achou que eu sou" quando ninguém escolheu nada.
 *
 * `staleTime` alto porque isto só muda quando a própria pessoa troca — e
 * quando troca, a mutação abaixo invalida.
 */
export function useLocalAtual() {
  const query = useQuery({
    queryKey: LOCAL_QUERY_KEY,
    queryFn: () => invoke.site.loaders.lookLocal({}) as Promise<Local>,
    staleTime: 5 * 60_000,
  });

  return { local: query.data, isLoading: query.isLoading };
}

/**
 * Troca a cidade e recarrega a página.
 *
 * O reload não é preguiça: o look é composto no servidor, dentro de uma section
 * diferida, e o `contexto_hash` muda junto com a cidade. Invalidar só a query
 * do local repintaria o seletor e deixaria o look antigo na tela — que é
 * exatamente o print errado para o momento do palco, quando a pessoa troca de
 * cidade esperando ver a roupa mudar.
 */
export function useTrocarLocal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (escolhido: Pick<Local, "cidade" | "regiao" | "pais">) =>
      invoke.site.actions.look.setLocal(escolhido) as Promise<Local>,
    onSuccess: (local) => {
      queryClient.setQueryData(LOCAL_QUERY_KEY, local);
      if (typeof window !== "undefined") window.location.reload();
    },
  });
}
