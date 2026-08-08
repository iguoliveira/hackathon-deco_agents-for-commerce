import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { decoVitePlugin } from "@decocms/tanstack/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "path";

const srcDir = path.resolve(__dirname, "src");

export default defineConfig({
  server: {
    allowedHosts: [".decocdn.com", ".trycloudflare.com", ".preview-studio.decocms.com"],
    // Shopify Storefront API is called server-side from loaders — no dev
    // proxy is needed. Checkout happens on Shopify's hosted checkout (or
    // the store's custom domain).
  },
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    react({
      babel: {
        plugins: [
          ["babel-plugin-react-compiler", { target: "19" }],
        ],
      },
    }),
    tailwindcss(),
    decoVitePlugin(),
    {
      name: "site-manual-chunks",
      config(_cfg, { command }) {
        if (command !== "build") return;
        return {
          build: {
            rollupOptions: {
              output: {
                manualChunks(id: string) {
                  if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/"))
                    return "vendor-react";
                  if (id.includes("@tanstack/react-router") || id.includes("@tanstack/start"))
                    return "vendor-router";
                  if (id.includes("@tanstack/react-query")) return "vendor-query";
                },
              },
            },
          },
        };
      },
    },
    {
      name: "deco-stub-meta-gen",
      enforce: "pre" as const,
      resolveId(id, importer, options) {
        if (!options?.ssr && importer && id.includes("meta.gen")) {
          return "\0stub:meta-gen";
        }
      },
      load(id) {
        if (id === "\0stub:meta-gen") {
          return "export default {};";
        }
      },
    },
    // O driver do Postgres importa builtins do Node (crypto, stream,
    // perf_hooks) e não tem o que fazer no browser. Ele chega ao grafo do
    // client do mesmo jeito que `cloudflare:workers` chegava antes: o catálogo
    // o importa (src/platform/db) e os dynamic imports de loaders em setup.ts
    // arrastam a cadeia inteira — o Rollup então falha o build do client em
    // "perf_hooks não pode ser resolvido".
    //
    // Os loaders nunca rodam no browser, então no client o módulo vira um stub
    // que devolve `null`: `getClient()` propaga esse null, `getDb()` devolve
    // null e cada leitura já cai no seu fallback (lista vazia, `false`).
    {
      name: "deco-stub-postgres",
      enforce: "pre" as const,
      resolveId(id, _importer, options) {
        if (!options?.ssr && id === "postgres") {
          return "\0stub:postgres";
        }
      },
      load(id) {
        if (id === "\0stub:postgres") {
          return "export default () => null;";
        }
      },
    },
    // Mesma história do postgres, um nível acima: `src/platform/shelf/
    // shelf.cookie.ts` assina o cookie de identidade com `node:crypto`, e chega
    // ao grafo do client pela mesma porta — o dynamic import de
    // `site/loaders/personalShelf` em setup.ts arrasta a cadeia. O Rollup falha
    // com `"createHmac" is not exported by "__vite-browser-external"`.
    //
    // A assinatura só faz sentido no servidor: é ela que decide de quem é a
    // vitrine, e uma versão que rodasse no browser seria pior que inútil —
    // exporia o segredo. As funções que a usam já degradam para `null` quando
    // não há segredo, então o stub lança: se este código executar no browser é
    // bug de arquitetura, e falhar alto é melhor que assinar com lixo.
    {
      name: "deco-stub-node-crypto",
      enforce: "pre" as const,
      resolveId(id, _importer, options) {
        if (!options?.ssr && (id === "node:crypto" || id === "crypto")) {
          return "\0stub:node-crypto";
        }
      },
      load(id) {
        if (id === "\0stub:node-crypto") {
          return `const naoAqui = () => {
            throw new Error("node:crypto não existe no browser — isto é código de servidor");
          };
          export const createHmac = naoAqui;
          export const timingSafeEqual = naoAqui;
          export default { createHmac, timingSafeEqual };`;
        }
      },
    },
  ],
  build: {
    sourcemap: "hidden",
    rollupOptions: {
      onLog(level, log, handler) {
        if (
          log.code === "PLUGIN_WARNING" &&
          log.plugin === "vite:reporter" &&
          log.message?.includes("dynamic import will not move module")
        ) {
          return;
        }
        handler(level, log);
      },
    },
  },
  define: {
    "process.env.DECO_SITE_NAME": JSON.stringify(
      process.env.DECO_SITE_NAME || "demo-storefront"
    ),
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    dedupe: [
      "@tanstack/react-start",
      "@tanstack/react-router",
      "@tanstack/react-start-server",
      "@tanstack/start-server-core",
      "@tanstack/start-client-core",
      "@tanstack/start-plugin-core",
      "@tanstack/start-storage-context",
      "react",
      "react-dom",
    ],
    alias: {
      "~": srcDir,
    },
  },
});
