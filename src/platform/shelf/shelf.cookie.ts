/**
 * O cookie que diz de quem é a vitrine — assinatura e leitura, sem framework.
 *
 * Separado de `shelf.identity.ts` de propósito: aqui não entra `RequestContext`
 * nem sessão, só `node:crypto` e uma string. Isso torna a parte que precisa
 * estar certa — a assinatura — testável sozinha, fora do Vite.
 *
 * ## O problema que este arquivo resolve
 *
 * **Não é capturar, é reconhecer de volta.** No formulário de "avise-me" a
 * pessoa digita o e-mail, então a identidade existe no instante da escrita. O
 * que faltava era ela voltar depois e a loja saber quem é: `readShopperIdentity`
 * só responde para quem tem sessão do Shopify, e a maioria de quem clica nesse
 * botão está deslogada.
 *
 * ## Por que assinar
 *
 * O cookie decide de quem é a vitrine que a página mostra. Sem assinatura,
 * qualquer pessoa edita o valor para o e-mail de outra e vê o que aquela pessoa
 * quis comprar. Não é catástrofe — são recomendações de produto — mas é
 * informação de outra pessoa, e o HMAC custa quinze linhas.
 *
 * Sem `SHELF_COOKIE_SECRET` o cookie **não é emitido nem aceito**. Degrada para
 * identidade por sessão, que é o comportamento anterior. Falhar fechado é o
 * único default aceitável: emitir sem assinar seria trocar segurança por
 * conveniência em silêncio.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SHELF_COOKIE = "deco_shelf";
const TTL_SEGUNDOS = 60 * 60 * 24 * 90;

const segredo = (): string | null => process.env.SHELF_COOKIE_SECRET ?? null;

const assinar = (valor: string, chave: string): string =>
  createHmac("sha256", chave).update(valor).digest("base64url");

/**
 * Compara com tempo constante.
 *
 * `a === b` vazaria, por quanto tempo leva para falhar, quantos caracteres
 * iniciais da assinatura estavam certos — o que permite forjar byte a byte. É o
 * tipo de detalhe que nenhum teste funcional pega.
 */
const conferir = (esperada: string, recebida: string): boolean => {
  const a = Buffer.from(esperada);
  const b = Buffer.from(recebida);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** `<email base64url>.<assinatura>` — o e-mail é legível, só não é forjável. */
export const serializarCookieDaVitrine = (email: string): string | null => {
  const chave = segredo();
  if (!chave) {
    console.warn("[shelf] SHELF_COOKIE_SECRET ausente — cookie de identidade não será emitido");
    return null;
  }

  const corpo = Buffer.from(email).toString("base64url");
  const valor = `${corpo}.${assinar(corpo, chave)}`;

  // HttpOnly: nenhum script precisa ler isto, e não lê-lo tira o cookie do
  // alcance de qualquer XSS. SameSite=Lax porque a vitrine é navegação normal.
  return `${SHELF_COOKIE}=${valor}; Path=/; Max-Age=${TTL_SEGUNDOS}; HttpOnly; SameSite=Lax`;
};

/** O e-mail do cookie, se a assinatura conferir. */
export const lerCookieDaVitrine = (request: Request | undefined): string | null => {
  if (!request) return null;
  const chave = segredo();
  if (!chave) return null;

  const cabecalho = request.headers.get("cookie") ?? "";
  const encontrado = cabecalho.split(/;\s*/).find((parte) => parte.startsWith(`${SHELF_COOKIE}=`));
  if (!encontrado) return null;

  const valor = decodeURIComponent(encontrado.slice(SHELF_COOKIE.length + 1));
  const separador = valor.lastIndexOf(".");
  if (separador <= 0) return null;

  const corpo = valor.slice(0, separador);
  if (!conferir(assinar(corpo, chave), valor.slice(separador + 1))) {
    console.warn("[shelf] cookie de identidade com assinatura inválida — descartado");
    return null;
  }

  try {
    const email = Buffer.from(corpo, "base64url").toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
};
