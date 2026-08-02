/**
 * Produtos do Shopify que NÃO entram no catálogo local.
 *
 * ── Por que existe ────────────────────────────────────────────────────────────
 *
 * A loja `gimenesdevstore` é uma loja de brindes: vende camisetas ao lado de
 * stickers, canecas, cadernos e pelúcias. A demo que estamos construindo é uma
 * loja de moda — vestuário e acessórios de corpo. Um sticker de R$11 na vitrine
 * ao lado de uma jaqueta desmonta a leitura da página, e mais adiante vai
 * poluir os agentes: o de busca passa a ter que decidir se "algo pra correr no
 * frio" pode devolver uma caneca, e o de coleções sugeridas passa a agrupar
 * tópicos que não são moda.
 *
 * Filtrar aqui, no import, é mais barato do que ensinar cada agente a ignorar.
 *
 * ── Por que uma lista explícita, e não um filtro por categoria ────────────────
 *
 * Foi a primeira coisa que tentei. Não funciona nesta loja:
 *
 *   - `product_type` está VAZIO em 55 dos 58 produtos;
 *   - 12 produtos não têm coleção nenhuma — e entre eles estão as camisetas
 *     infantis e os calçados, que FICAM;
 *   - a coleção "Accessories" contém a capinha de iPhone, que SAI.
 *
 * Qualquer predicado que acertasse esses três casos seria mais frágil, e bem
 * menos auditável, do que a lista abaixo — onde cada linha diz o que é.
 *
 * ── Onde isto é aplicado ──────────────────────────────────────────────────────
 *
 * `scripts/generate-catalog-migration.ts` filtra por esta lista ANTES de emitir
 * SQL, então produto negado nunca chega ao banco. Bancos que já receberam o
 * catálogo completo (import anterior à existência desta lista) são corrigidos
 * pela migration `db/migrations/0004_apparel_only.sql`, que remove os mesmos
 * itens. As duas coisas precisam existir: a migration conserta o passado, a
 * denylist impede a reincidência.
 *
 * ── Mantendo ──────────────────────────────────────────────────────────────────
 *
 * Ao negar um produto novo, adicione o handle no grupo certo. Depois:
 * `npm run catalog:generate` gera a próxima migration já sem ele.
 */

/** Stickers — o maior bloco, e o mais distante de moda. */
const STICKERS = [
  "code-deco",
  "d",
  "deco",
  "developer-community",
  "deco-cx",
  "deco-inside",
  "deco-rainbow",
  "developers-developers-developers",
  "get-side-done",
  "give-me-a-br",
  "i-center-divs",
  "id-rather-be-coding",
  "its-not-a-bug",
  "it-works",
  "judging-cwv",
  "tech-stack",
];

/** Pelúcias. */
const PLUSHIES = ["cookie-capy-monster", "capy-coding-companion"];

/** Papelaria. */
const STATIONERY = ["the-syntax-scribbler-notebook", "pixel-perfection-pen", "notebook"];

/** Casa e utilidades — copo, garrafas, caneca, almofada. */
const HOMEWARE = [
  "insulated-tumbler-with-a-straw",
  "stainless-steel-water-bottle",
  "mug",
  "bottle",
  "pillow",
];

/**
 * Acessórios que não são de corpo.
 *
 * Fronteira mais discutível da lista: a capinha está em "Accessories" na loja,
 * mas é acessório de aparelho, não de vestuário. Pelo mesmo critério, bolsas e
 * mochilas FICAM — são carregadas no corpo e lidas como acessório de moda.
 */
const NON_BODY_ACCESSORIES = ["snap-case-for-iphone®"];

/** Handles negados, comparação exata. */
export const DENIED_HANDLES: ReadonlySet<string> = new Set([
  ...STICKERS,
  ...PLUSHIES,
  ...STATIONERY,
  ...HOMEWARE,
  ...NON_BODY_ACCESSORIES,
]);

/**
 * Prefixos negados — rede de segurança para handles com caractere não-ASCII,
 * onde um mismatch de encoding faria a comparação exata falhar em silêncio.
 * `snap-case-for-iphone®` termina em U+00AE e é justamente esse caso.
 */
export const DENIED_HANDLE_PREFIXES: readonly string[] = ["snap-case-for-iphone"];

/** True quando o produto não deve entrar no catálogo local. */
export const isDenied = (handle: string): boolean =>
  DENIED_HANDLES.has(handle) || DENIED_HANDLE_PREFIXES.some((p) => handle.startsWith(p));
