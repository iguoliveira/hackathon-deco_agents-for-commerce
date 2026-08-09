/**
 * As chaves de cache do domínio, em código, **sem `node:crypto`**.
 *
 * Módulo próprio porque duas coisas agora precisam do mesmo primitivo: o
 * `contexto_hash` de `looks` (calculado em `look.actions.ts`) e o `sinais_hash`
 * de `personas` (em `persona.agent.ts`). Importar um do outro fecharia o ciclo
 * `look.actions → look.agent → persona.agent → look.actions`, e duplicar a
 * função deixaria duas versões livres para divergir — no dia em que
 * divergissem, o sintoma seria cache que nunca acerta, sem erro nenhum.
 *
 * **Não usar `node:crypto` é decisão, não conveniência.** O dynamic import dos
 * loaders em `setup.ts` arrasta este grafo para o bundle do cliente, e o Rollup
 * falha com `"createHash" is not exported by "__vite-browser-external"`.
 * Typecheck e dev não pegam — só o build do client. Já custou um stub em
 * `vite.config.ts` uma vez; ver docs/agente-vitrine.md → Armadilhas.
 *
 * FNV-1a é rápido, estável entre processos e suficiente para chave de cache.
 * Colisão aqui serve um look ligeiramente errado a alguém, não abre falha de
 * segurança — se fosse assinatura de cookie, a escolha seria outra
 * (`shelf.cookie.ts` usa HMAC de propósito).
 */

import type { Semente } from "./look.types";

/** Base36 de um FNV-1a de 32 bits: dígitos e minúsculas, nunca sublinhado. */
export const fnv1a = (material: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

/**
 * A chave da persona: o conjunto de sinais, **sem identidade**.
 *
 * Duas pessoas com o mesmo guarda-roupa compartilham a persona, e isso é inócuo
 * — ela é derivada só daqueles sinais, então não há nada de uma que a outra já
 * não tenha — além de fazer o cache esquentar mais rápido.
 *
 * Ordenado antes de juntar, pelo mesmo motivo que em `hashDoContexto`: a ordem
 * que chega de `colherSementes` é a de recência e muda a cada visita. Sem o
 * `sort`, a mesma pessoa geraria uma chave nova por pageview e o cache nunca
 * acertaria — que é exatamente o furo que a quarentena da #20 teve de consertar.
 *
 * `kinds` entra ordenado e junto: comprar uma peça que já era favorita muda o
 * que a síntese pode dizer sobre ela, então é um conjunto de sinais diferente.
 */
export const hashDosSinais = (sementes: Semente[]): string =>
  fnv1a(
    sementes
      .map((s) => `${[...s.kinds].sort().join(",")}:${s.productGroupId}`)
      .sort()
      .join("|"),
  );
