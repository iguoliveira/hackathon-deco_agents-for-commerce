/**
 * Função serverless da Vercel.
 *
 * Só reexporta: o handler de `src/server.ts` já aceita as duas assinaturas
 * (`Request` da Web API e `(IncomingMessage, ServerResponse)` do Node), então
 * não há nada a adaptar aqui.
 *
 * A conversão mora lá de propósito. Quando ela vivia nesta casca, o stack de
 * produção mostrou a Vercel invocando `dist/server/server.js` DIRETO, sem
 * passar por aqui — e o TypeError voltava. Com a lógica no handler, funciona
 * seja qual for o arquivo que o runtime escolha invocar, e `npm run preview`
 * exercita exatamente o mesmo caminho.
 *
 * `.mjs` e não `.ts` porque importa o build (`dist/`), que não tem tipos.
 */

export { default } from "../dist/server/server.js";
