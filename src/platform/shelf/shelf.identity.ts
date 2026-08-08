/**
 * Quem é o dono da vitrine — a cola entre a sessão, o cookie e a requisição.
 *
 * A assinatura do cookie mora em `shelf.cookie.ts`, sem framework, para poder
 * ser testada sozinha. Aqui fica só o que depende do `RequestContext`.
 */

import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { readShopperIdentity } from "../alerts";
import { lerCookieDaVitrine, serializarCookieDaVitrine } from "./shelf.cookie";

/**
 * O e-mail dono da vitrine: sessão primeiro, cookie depois.
 *
 * A ordem importa. A sessão é verificada pelo Shopify; o cookie é só assinado
 * por nós, o que prova que **nós** o emitimos — não que quem o apresenta é a
 * pessoa. Para uma vitrine de recomendação isso basta; para qualquer coisa com
 * dado de pedido ou pagamento, não bastaria.
 */
export const donoDaVitrine = async (): Promise<string | null> => {
  const request = RequestContext.current?.request;

  const sessao = await readShopperIdentity(request);
  if (sessao?.email) return sessao.email;

  return lerCookieDaVitrine(request);
};

/** Emite o cookie na resposta atual. Silencioso quando não há segredo. */
export const marcarDonoDaVitrine = (email: string): void => {
  const cookie = serializarCookieDaVitrine(email);
  if (cookie) RequestContext.responseHeaders.append("Set-Cookie", cookie);
};
