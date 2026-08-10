import { RequestContext } from "@decocms/blocks/sdk/requestContext";
import { createStockAlert, readShopperIdentity } from "../../platform/alerts";
import { marcarDonoDaVitrine } from "../../platform/shelf/shelf.identity";

export interface NotifyMeProps {
  /** SKU/variant the shopper wants — already identifies item + size + colour. */
  skuId: string;
  /** Only read when signed out. A signed-in shopper's session wins — see below. */
  email?: string;
  name?: string;
}

export interface NotifyMeResult {
  success: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Records that this shopper wanted this exact variant and could not have it.
 *
 * Despite the name inherited from the button, nothing here sends email. The
 * row is a demand signal: the agent that builds the shopper's personalised
 * shelf reads it back via `findWaitedItems` and looks for available products
 * matching what they waited for. See docs/feature-back-in-stock-shelf.md.
 *
 * Only `skuId` is stored — size, type, collections and tags all hang off the
 * variant in the catalog and are resolved by JOIN at read time.
 *
 * Signed in, the session is authoritative and the client-sent email is
 * discarded: this endpoint is public, so trusting the body would let anyone
 * file alerts under someone else's address, and the shelf we later build from
 * these rows is personal to that address.
 */
async function action(props: NotifyMeProps, req?: Request): Promise<NotifyMeResult> {
  const skuId = props?.skuId?.trim();
  // Public invoke endpoint — validate here, not just via the form.
  if (!skuId) throw new Error("skuId is required");

  const identity = await readShopperIdentity(req ?? RequestContext.current?.request);

  const email = identity?.email ?? props?.email?.trim();
  const name = identity?.name ?? props?.name?.trim();

  if (!email || !EMAIL_RE.test(email)) {
    throw new Error("a valid email is required");
  }

  const outcome = await createStockAlert({ variantId: skuId, email, name: name || undefined });

  // Distinct messages because the causes are distinct: an unknown variant is a
  // bad request, a failed write is ours. Reporting success for either would
  // tell the shopper they are on the list while the signal that drives their
  // shelf was dropped.
  if (outcome === "unknown_variant") throw new Error("unknown product variant");
  if (outcome === "failed") throw new Error("could not record the request, please try again");

  // Marca de quem é a vitrine, para esta pessoa ser reconhecida quando voltar.
  // Precisa vir antes do retorno: depois dele não há mais resposta onde
  // pendurar o Set-Cookie.
  marcarDonoDaVitrine(email);

  // **A vitrine do "avise-me" não é mais montada aqui.** O cookie continua:
  // `donoDaVitrine()` é a identidade que a vitrine recomendada usa quando não há
  // sessão do Shopify, então marcá-la segue valendo — e vale mais agora, porque
  // é o único jeito de um visitante que só clicou em "avise-me" ser reconhecido.
  //
  // O que saiu foi o disparo do agente `shelf`. Ver o comentário de
  // `dispararGeracaoDaVitrine`, logo abaixo.

  return { success: true };
}

/*
 * `dispararGeracaoDaVitrine` foi removida daqui.
 *
 * Ela chamava `gerarVitrine` do domínio `shelf` — o agente que compunha duas
 * vitrines por comprador ancoradas no item esgotado: o que substitui o que
 * faltou, e o que se veste junto.
 *
 * **Saiu porque não havia mais onde exibi-las.** As duas sections da home e as
 * páginas `/minha-vitrine` e `/minha-vitrine/combina` foram retiradas: a
 * recomendação por IA passou a viver numa vitrine só, montada a partir de TODOS
 * os sinais da pessoa e não apenas do que ela pediu para ser avisada.
 *
 * Mantê-la seria pior que inútil. Cada clique em "avise-me" gastava ~33s de
 * modelo — às vezes 120s — para gravar em `shelves` uma vitrine que ninguém
 * abriria. Custo invisível é o que menos aparece numa revisão.
 *
 * O domínio `src/platform/shelf/` continua no repositório e agora está **sem
 * consumidor**: `shelf.agent`, `shelf.candidates`, `shelf.prompt` e a tabela
 * `shelves` não são mais alcançados por caminho nenhum. Não apaguei porque é
 * uma feature inteira, documentada em `docs/agente-vitrine.md` e
 * `feature-back-in-stock-shelf.md`, e a decisão de aposentá-la de vez é de quem
 * a construiu — não de quem está tirando ela da tela.
 *
 * Exceções que SOBREVIVEM e não são do agente:
 *   `shelf.identity`  `donoDaVitrine()`, a identidade que a vitrine recomendada usa
 *   `shelf.cookie`    o cookie assinado que a sustenta
 *   `shelf.decopilot` `perguntar()`, o cliente do modelo que todos os agentes usam
 *   `shelf.agent`     `extrairJson()`, idem
 */

export default action;
