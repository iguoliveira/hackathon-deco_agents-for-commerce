/**
 * Função serverless da Vercel — o único ponto de entrada HTTP em produção.
 *
 * A lógica do site NÃO mora aqui: mora em `src/server.ts`, que é o mesmo
 * handler exercitado por `npm run preview`. Aqui só existe a ponte entre o
 * formato que a Vercel entrega e o `Request`/`Response` que aquele handler
 * fala — a mesma ponte de `scripts/serve.ts`, que é o que permite testar o
 * caminho inteiro sem deployar.
 *
 * A ponte aceita AS DUAS assinaturas de propósito. O runtime Node da Vercel
 * invoca funções em `api/` no formato clássico `(IncomingMessage,
 * ServerResponse)`, mas também sabe entregar um `Request` da Web API dependendo
 * de como detecta o handler. Reexportar o handler direto assumia a segunda e
 * quebrava na primeira, com `request.headers.get is not a function` — que a
 * Vercel reporta só como FUNCTION_INVOCATION_FAILED. Suportar as duas custa
 * ~30 linhas e remove a adivinhação.
 *
 * `.mjs` e não `.ts` porque este arquivo importa o build (`dist/`), que não
 * tem tipos.
 */

import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import handler from "../dist/server/server.js";

/** IncomingMessage -> Request. */
const toWebRequest = (req) => {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.set(key, value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(`${proto}://${host}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req), duplex: "half" } : {}),
  });
};

/** Response -> ServerResponse, sem bufferizar (o SSR é streaming). */
const sendWebResponse = async (response, res) => {
  const headers = {};
  for (const [key, value] of response.headers) headers[key] = value;

  // Set-Cookie é o único header que pode repetir; o iterador acima colapsa.
  const cookies = response.headers.getSetCookie?.();
  if (cookies?.length) headers["set-cookie"] = cookies;

  res.writeHead(response.status, headers);

  if (!response.body) {
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body), res);
};

export default async function vercelHandler(req, res) {
  // `res.writeHead` é o discriminador confiável: no formato web o segundo
  // argumento não existe, e um `Request` nunca tem esse método.
  const isNodeStyle = typeof res?.writeHead === "function";

  if (!isNodeStyle) return handler(req);

  await sendWebResponse(await handler(toWebRequest(req)), res);
}
