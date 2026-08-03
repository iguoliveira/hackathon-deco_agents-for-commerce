import { userLoader as shopifyUserLoader } from "@decocms/apps-shopify";

export interface ShopperIdentity {
  email: string;
  name?: string;
}

/**
 * Quem está pedindo, segundo a sessão.
 *
 * Vive aqui, e não dentro da action, porque a escrita e a leitura precisam
 * concordar sobre quem é o comprador: se a gravação usa o e-mail da sessão e a
 * consulta "já pedi isto?" usasse outro critério, a tela diria que ninguém
 * pediu nada logo depois de a pessoa ter pedido.
 *
 * Continua no Shopify enquanto o catálogo já migrou para SQLite — o login é a
 * parte que não veio junto.
 *
 * Nunca lança: uma sessão que não resolve degrada para "anônimo", e é o
 * chamador que decide o que fazer com isso.
 */
export const readShopperIdentity = async (
  request: Request | undefined,
): Promise<ShopperIdentity | null> => {
  if (!request) return null;
  try {
    const person = await shopifyUserLoader(request.headers);
    if (!person?.email) return null;
    const name = [person.givenName, person.familyName].filter(Boolean).join(" ").trim();
    return { email: person.email, name: name || undefined };
  } catch (error) {
    console.warn("[alerts] não foi possível resolver a sessão do comprador:", error);
    return null;
  }
};
