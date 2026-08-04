/**
 * Função serverless da Vercel — o único ponto de entrada HTTP em produção.
 *
 * Não há lógica aqui de propósito: ela mora em `src/server.ts`, que é o mesmo
 * handler exercitado por `npm run preview` (scripts/serve.ts). Duplicar
 * qualquer coisa aqui criaria um caminho que só roda em produção e que
 * ninguém consegue testar antes de subir.
 *
 * `.mjs` e não `.ts`: este arquivo importa o build (`dist/`), que não tem
 * tipos. Em TypeScript o import seria um erro de tipo sem ganho nenhum — o
 * arquivo tem duas linhas.
 *
 * Assets estáticos não passam por aqui: o `outputDirectory` do vercel.json
 * aponta para `dist/client`, e o rewrite só pega o que não casou com arquivo.
 */

export { default } from "../dist/server/server.js";
