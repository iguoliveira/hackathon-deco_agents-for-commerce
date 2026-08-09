import { createFileRoute } from "@tanstack/react-router";
import { dadosDoTeste, respostaJson } from "./_dados";

/**
 * Metade do experimento: **com** cache de borda.
 *
 * A outra metade é `sem-cache.ts`, que faz exatamente o mesmo trabalho e difere
 * só nos headers. Duas rotas em vez de uma porque medir uma sozinha não separa
 * "o cache funcionou" de "a função ficou rápida" — o par isola a variável.
 *
 * `s-maxage` e não `max-age`: o primeiro fala com o CDN, o segundo com o
 * navegador. O que queremos provar é que a **borda em São Paulo** responde no
 * lugar da função na Virgínia, e para isso só o CDN precisa obedecer.
 *
 * `stale-while-revalidate` alto de propósito: depois de expirar, a pessoa
 * continua recebendo na hora enquanto a revalidação roda atrás. Para um
 * catálogo que só muda em migration, é o comportamento certo.
 */
export const Route = createFileRoute("/perf/com-cache")({
  server: {
    handlers: {
      GET: async () =>
        respostaJson(await dadosDoTeste(), {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
        }),
    },
  },
});
