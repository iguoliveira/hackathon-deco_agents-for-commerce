import { useCanGoBack, useRouter } from "@tanstack/react-router";
import Icon from "./Icon";

interface Props {
  /** Para onde ir quando não há histórico — chegou pelo link direto. */
  fallbackTo?: string;
  children?: React.ReactNode;
}

/**
 * Volta uma página no histórico.
 *
 * `history.back()` e não um link fixo para a home: quem chegou em "meus
 * pedidos" a partir de um produto quer voltar ao produto, não à home. Um botão
 * que sempre leva ao mesmo lugar não é "voltar", é "ir para".
 *
 * **`useCanGoBack` é o que evita o beco sem saída.** Quem abre a página por
 * link direto ou em aba nova não tem histórico, e ali `back()` não faz nada —
 * o botão pareceria quebrado. Nesse caso ele navega para o `fallbackTo`.
 */
export default function BackButton({ fallbackTo = "/", children = "Voltar" }: Props) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <button
      type="button"
      onClick={() => (canGoBack ? router.history.back() : router.navigate({ to: fallbackTo }))}
      className="tap-scale mb-4 inline-flex items-center gap-1.5 text-sm text-base-content/70 transition-colors duration-(--duration-fast) hover:text-base-content"
    >
      {/* O conjunto só tem `chevron-right`; girar 180° evita acrescentar um
          símbolo ao sprite para uma seta que é o espelho de outra. */}
      <Icon id="chevron-right" size={16} className="rotate-180" />
      {children}
    </button>
  );
}
