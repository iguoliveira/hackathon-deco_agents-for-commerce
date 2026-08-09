import type { ProductDetailsPage } from "@decocms/apps-commerce/types";
import { getProductDetailsPage } from "~/platform/catalog";
import { marcarVisita } from "~/platform/look/look.cookies";
import { acharAncora } from "~/platform/look/look.d1";

export interface Props {
  /**
   * @title Slug
   * @description Slug da URL da PDP. No bloco vem de `website/functions/requestToParam.ts`.
   */
  slug: string;
}

/**
 * PDP a partir do catálogo SQLite, em vez da Storefront API do Shopify.
 *
 * Substituto direto de `shopify/loaders/ProductDetailsPage.ts`: mesmo
 * `ProductDetailsPage | null`, então encaixa onde aquele loader estava —
 * ver `.deco/blocks/PDP%20Loader.json`.
 */
export default async function catalogProductDetailsPageLoader({
  slug,
}: Props): Promise<ProductDetailsPage | null> {
  const page = await getProductDetailsPage(slug);

  // A visita é registrada AQUI porque este loader é o que roda em toda PDP.
  //
  // Ela morava em `loaders/completeTheLook.ts`, que perdeu esse papel quando a
  // section saiu da PDP — e como aquela era a ÚNICA escrita de `deco_recent` no
  // repositório, o cookie tinha parado de existir. Um dos quatro sinais do
  // agente virava constante zero, sem erro nenhum e com a página em 200.
  //
  // `acharAncora` canonicaliza o slug antes de gravar, e a consulta paga por si:
  // `deco_recent` guarda HANDLE e `sementesPorHandle` casa `p.handle`, então
  // gravar `vintage-wash-tee-black-45123456` — que é o que a URL traz — seria
  // gravar uma semente que nunca resolve. O cookie viraria lixo silencioso,
  // ocupando as oito vagas com entradas mortas.
  //
  // Só grava quando a peça existe: 404 não é visita.
  //
  // **Isto depende de `ProductDetails` continuar DIFERIDA no decofile**, e a
  // dependência é invisível. Medido: desembrulhando a section do
  // `Rendering/Lazy.tsx`, este loader passa a rodar durante o streaming do SSR
  // — quando os headers da resposta já saíram — e o `Set-Cookie` é montado
  // corretamente em `RequestContext.responseHeaders` e simplesmente não chega
  // ao navegador. Sem erro, sem aviso, com a página em 200.
  //
  // Diferida, ela é resolvida num POST separado para `_serverFn`, cuja resposta
  // ainda não teve headers enviados — e o cookie sai. Era assim que a versão
  // anterior funcionava, em `completeTheLook.ts`.
  //
  // Se alguém atender ao aviso do framework ("Add it to registerSectionsSync()")
  // para esta section, `deco_recent` para de ser gravado de novo.
  if (page) {
    const alvo = await acharAncora(slug);
    if (alvo) marcarVisita(alvo.ancora.handle);
  }

  return page;
}
