import { createFileRoute } from "@tanstack/react-router";
import { dadosDoTeste, respostaJson } from "./_dados";

/**
 * O controle do experimento: mesmo trabalho, **sem** cache de borda.
 *
 * Os headers são os que o `_serverFn` usa hoje em produção — foi de lá que
 * saíram, medidos com `curl`. Sem este lado, a rota cacheada provaria apenas
 * que ela é rápida, não que o cache foi a causa.
 */
export const Route = createFileRoute("/perf/sem-cache")({
  server: {
    handlers: {
      GET: async () =>
        respostaJson(await dadosDoTeste(), {
          "cache-control": "public, max-age=0, must-revalidate",
        }),
    },
  },
});
