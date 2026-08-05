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
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { getAppMiddleware } from "@decocms/blocks-admin/sdk/setupApps";

type NodeRequest = IncomingMessage;
type NodeResponse = ServerResponse;

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

/** O handler de verdade — sempre em Web API. */
const handleWebRequest = async (request: Request, ...rest: unknown[]): Promise<Response> =>
  RequestContext.run(request, async () => {
    const appMiddleware = getAppMiddleware();
    const inner = () =>
      (startHandler as (req: Request, ...args: unknown[]) => Promise<Response>)(request, ...rest);

    const response = appMiddleware ? await appMiddleware(request, inner) : await inner();

    deduplicateSetCookies(response);
    return finalizeHtmlResponse(response);
  });

/**
 * Lê o corpo da request como Buffer.
 *
 * Bufferiza em vez de repassar o stream, e isso não é preguiça: o launcher da
 * Vercel pode consumir e parsear o corpo ANTES de nos chamar, expondo o
 * resultado em `req.body`. Nesse caso o stream já veio drenado, e um
 * `Readable.toWeb(req)` fica esperando bytes que nunca chegam — o POST trava
 * até o timeout da plataforma, sem erro nenhum. Foi o que aconteceu com o
 * endpoint de invoke em produção enquanto todos os GETs passavam.
 *
 * Bufferizar também dispensa o `duplex: "half"`. Os corpos aqui são JSON de
 * formulário, não upload — não há streaming a preservar na entrada.
 */
const readBody = async (req: NodeRequest): Promise<Buffer | undefined> => {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const parsed = (req as NodeRequest & { body?: unknown }).body;
  if (parsed !== undefined && parsed !== null) {
    if (Buffer.isBuffer(parsed)) return parsed;
    if (typeof parsed === "string") return Buffer.from(parsed);
    // Já parseado pelo launcher: reserializa para o handler receber o mesmo
    // conteúdo que o cliente mandou.
    return Buffer.from(JSON.stringify(parsed));
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

/** IncomingMessage -> Request. */
const toWebRequest = async (req: NodeRequest): Promise<Request> => {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "https";

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.set(key, String(value));
  }

  const body = await readBody(req);
  // Content-length pode divergir do que reserializamos; o fetch recalcula.
  headers.delete("content-length");

  return new Request(`${proto}://${String(host)}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    ...(body?.length ? { body: body as unknown as BodyInit } : {}),
  });
};

/** Response -> ServerResponse, sem bufferizar (o SSR é streaming). */
const sendWebResponse = async (response: Response, res: NodeResponse): Promise<void> => {
  const headers: Record<string, string | string[]> = {};
  for (const [key, value] of response.headers) headers[key] = value;

  // Set-Cookie é o único header que pode repetir; o iterador acima colapsa.
  const cookies = response.headers.getSetCookie?.();
  if (cookies?.length) headers["set-cookie"] = cookies;

  res.writeHead(response.status, headers);

  if (!response.body) {
    res.end();
    return;
  }
  // `pipeline` e não `.pipe()`: só ele espera o fim do stream e propaga erro.
  await pipeline(Readable.fromWeb(response.body as never), res);
};

/**
 * Entrada única, nas DUAS assinaturas.
 *
 * O runtime Node da Vercel invoca no formato clássico `(IncomingMessage,
 * ServerResponse)`; TanStack Start e os testes locais entregam um `Request` da
 * Web API. Aceitar as duas aqui — e não numa casca em `api/` — é o que garante
 * que o caminho de produção seja o MESMO que `npm run preview` exercita. O
 * TypeError `request.headers.get is not a function` em produção existiu
 * justamente porque a conversão morava só no script de preview, deixando o
 * caminho real sem cobertura nenhuma.
 *
 * `res.writeHead` é o discriminador confiável: no formato web não há segundo
 * argumento, e um `Request` nunca tem esse método.
 */
export default async function handler(
  request: Request | NodeRequest,
  ...rest: unknown[]
): Promise<Response | void> {
  const res = rest[0] as NodeResponse | undefined;

  if (typeof res?.writeHead !== "function") {
    return handleWebRequest(request as Request, ...rest);
  }

  const webRequest = await toWebRequest(request as NodeRequest);
  await sendWebResponse(await handleWebRequest(webRequest), res);
}
