/**
 * Entry HTTP do storefront (Node / Vercel).
 *
 * Substitui o `src/worker-entry.ts`, que era o entry da Cloudflare. O que sumiu
 * junto com o Worker, de propósito, ao decidirmos não editar mais pela Studio:
 * protocolo de admin (handleMeta/handleRender), Fast Deploy via DECO_KV,
 * A/B por SITES_KV e a instrumentação OTel + tail worker.
 *
 * O que NÃO podia sumir e por isso foi reimplementado aqui:
 *
 *   1. `RequestContext.run(request, ...)` — a coisa mais fácil de esquecer e a
 *      mais silenciosa quando falta. `useDevice()` resolve o device a partir do
 *      user-agent guardado no RequestContext; sem o wrapper ele cai no fallback
 *      "desktop" e Header.tsx, Carousel.tsx e DeviceVisible.tsx passam a
 *      renderizar layout de desktop no celular — sem erro, sem log, só errado.
 *
 *   2. O app middleware — injeta o estado dos apps (Shopify) no
 *      `RequestContext.bag` e roda o encaminhamento de cookies. Sem ele o
 *      login não sobrevive à navegação.
 *
 *   3. Deduplicação de `Set-Cookie` — várias camadas podem escrever o mesmo
 *      cookie; sem isso o navegador recebe o mesmo nome repetido.
 *
 *   4. Headers de segurança + CSP, que antes vinham do framework.
 */

import "./setup";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { getAppMiddleware } from "@decocms/blocks-admin/sdk/setupApps";

/**
 * CSP do site, herdado do worker-entry. Continua **report-only**: era assim que
 * o framework o emitia, e promovê-lo a enforcing junto com a migração de host
 * misturaria duas mudanças de risco muito diferente na mesma alteração.
 *
 * MANUAL REVIEW: adicionar domínios de analytics / CDN / tag manager.
 */
const CSP_DIRECTIVES = [
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.shopify.com *.shopify.com",
  "img-src 'self' data: blob: cdn.shopify.com *.shopify.com *.myshopify.com",
  "connect-src 'self' *.myshopify.com cdn.shopify.com",
  "frame-src 'self' *.shopify.com",
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
  "font-src 'self' fonts.gstatic.com data:",
];

/**
 * Declarados aqui, não importados de `@decocms/tanstack`, porque lá eles moram
 * dentro do módulo do Worker — importar puxaria de volta o código Cloudflare
 * que esta migração existe para remover.
 *
 * `frame-ancestors 'self'`: o default do framework liberava studio.decocms.com
 * para a Studio poder embedar o site no preview. Como não vamos usar a Studio,
 * ninguém precisa mais embedar — e liberar terceiro a te colocar em iframe sem
 * necessidade é superfície de clickjacking de graça.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": "frame-ancestors 'self'",
  "Content-Security-Policy-Report-Only": CSP_DIRECTIVES.join("; "),
};

/** Mantém só a última ocorrência de cada cookie. */
const deduplicateSetCookies = (response: Response): void => {
  const setCookies = response.headers.getSetCookie?.();
  if (!setCookies || setCookies.length <= 1) return;

  const seen = new Map<string, string>();
  for (const cookie of setCookies) {
    const eq = cookie.indexOf("=");
    seen.set(eq > 0 ? cookie.slice(0, eq).trim() : cookie, cookie);
  }
  if (seen.size === setCookies.length) return;

  response.headers.delete("set-cookie");
  for (const cookie of seen.values()) response.headers.append("set-cookie", cookie);
};

/**
 * Ajustes finais da resposta HTML: headers de segurança e chave de cache.
 *
 * Só em HTML — aplicar CSP a imagem ou JS não protege nada e engorda toda
 * resposta de asset.
 *
 * `new Response(resp.body, resp)` repassa o body como stream — não bufferiza,
 * então o streaming do `defaultStreamHandler` continua de pé.
 */
const finalizeHtmlResponse = (response: Response): Response => {
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;

  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(key)) out.headers.set(key, value);
  }

  // `Vary: User-Agent` é obrigatório aqui, não é otimização.
  //
  // As sections renderizam markup DIFERENTE por device (Header.tsx,
  // Carousel.tsx, DeviceVisible.tsx), e a resposta sai `public, s-maxage=900`.
  // Na Cloudflare isso era seguro porque o `buildSegment` do worker-entry
  // colocava o device na chave do cache de borda. Fora dela ninguém faz isso:
  // sem este header, o primeiro visitante popula o cache e todo mundo recebe o
  // layout dele por 15 minutos — desktop servido para quem está no celular.
  //
  // O custo é real: user-agent tem cardinalidade altíssima, então o cache
  // compartilhado praticamente para de acertar. A saída melhor é normalizar o
  // device num cookie/header em middleware e dar `Vary` nele, o que reduz a
  // duas variantes. Fica para depois — correto e lento ganha de rápido e errado.
  const vary = out.headers.get("vary");
  out.headers.set("vary", vary ? `${vary}, User-Agent` : "User-Agent");

  return out;
};

const startHandler = createStartHandler(defaultStreamHandler);

export default async function handler(request: Request, ...rest: unknown[]): Promise<Response> {
  return RequestContext.run(request, async () => {
    const appMiddleware = getAppMiddleware();
    const inner = () =>
      (startHandler as (req: Request, ...args: unknown[]) => Promise<Response>)(request, ...rest);

    const response = appMiddleware ? await appMiddleware(request, inner) : await inner();

    deduplicateSetCookies(response);
    return finalizeHtmlResponse(response);
  });
}
