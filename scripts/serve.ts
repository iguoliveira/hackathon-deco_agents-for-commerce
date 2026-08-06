/**
 * Servidor Node que roda o build de produção localmente.
 *
 *   npm run build && npm run preview
 *
 * `vite preview` só serve os assets do client e não executa SSR nenhum, então
 * ele nunca pegaria um erro no entry — foi assim que um `RequestContext`
 * faltando teria passado batido.
 *
 * O handler é chamado no MESMO formato que a Vercel usa —
 * `(IncomingMessage, ServerResponse)` — e não numa ponte própria deste script.
 * Isso é deliberado: enquanto a conversão morava aqui, este preview passava e
 * a produção quebrava com `request.headers.get is not a function`, porque o
 * único caminho não coberto era justamente o real. Agora a conversão vive em
 * `src/server.ts` e este arquivo só entrega requests cruas a ele.
 */

// O `.env` precisa ser carregado à mão aqui. Em `vite dev` e `vite build` quem
// faz isso é o loadEnvPlugin do TanStack Start, que não roda num script solto —
// sem esta linha o preview sobe com DATABASE_URL indefinida e renderiza o site
// inteiro com catálogo vazio, que é fácil de confundir com bug de query.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Sem .env o site sobe com catálogo vazio — é o fallback esperado.
  }
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

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
  const handler = mod.default as (req: IncomingMessage, res: ServerResponse) => Promise<void>;

  createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (req.method === "GET" && tryStatic(pathname, res)) return;

      await handler(req, res);
    } catch (error) {
      console.error("[serve]", error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error");
    }
  }).listen(PORT, () => console.log(`http://localhost:${PORT}`));
};

main();
