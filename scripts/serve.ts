/**
 * Servidor Node que roda o build de produção localmente.
 *
 *   npm run build && npm run preview
 *
 * Existe por dois motivos. O primeiro é poder ver o build real antes de subir —
 * `vite preview` só serve os assets do client e não executa SSR nenhum, então
 * ele nunca teria pego, por exemplo, o `RequestContext` faltando no entry.
 *
 * O segundo é ser a única forma de exercitar o `src/server.ts` fora da Vercel:
 * a Vercel entrega `Request` e recebe `Response` (Web API), enquanto o Node
 * puro fala `IncomingMessage`/`ServerResponse`. A ponte entre os dois está
 * aqui, e é o que permite testar o entry inteiro com um curl.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIR = "dist/client";

const MIME: Record<string, string> = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

/** IncomingMessage -> Request. */
const toWebRequest = (req: IncomingMessage): Request => {
  const url = `http://${req.headers.host ?? `localhost:${PORT}`}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.set(key, value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream, duplex: "half" } : {}),
  } as RequestInit);
};

/** Response -> ServerResponse, sem bufferizar (o SSR é streaming). */
const sendWebResponse = async (response: Response, res: ServerResponse): Promise<void> => {
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
  // `pipeline` e não `.pipe()`: só ele espera o fim do stream e propaga erro
  // de escrita — com `.pipe()` a função retornaria antes da resposta terminar.
  await pipeline(Readable.fromWeb(response.body as never), res);
};

/** Serve dist/client, com guarda contra path traversal. */
const tryStatic = (pathname: string, res: ServerResponse): boolean => {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(CLIENT_DIR, rel);

  if (!file.startsWith(normalize(CLIENT_DIR))) return false;
  if (!existsSync(file) || !statSync(file).isFile()) return false;

  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
  return true;
};

const main = async () => {
  if (!existsSync("dist/server/server.js")) {
    console.error("dist/ não existe — rode `npm run build` antes.");
    process.exit(1);
  }

  const mod = await import("../dist/server/server.js");
  const handler = mod.default as (request: Request) => Promise<Response>;

  createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (req.method === "GET" && tryStatic(pathname, res)) return;

      await sendWebResponse(await handler(toWebRequest(req)), res);
    } catch (error) {
      console.error("[serve]", error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error");
    }
  }).listen(PORT, () => console.log(`http://localhost:${PORT}`));
};

main();
