/**
 * Único arquivo com SQL de `looks`, `personas`, `orders` e da resolução de
 * sementes.
 *
 * Nada aqui lança: quem consome é uma section, e look vazio é resultado
 * aceitável — derrubar a PDP por causa dele não é.
 */

import { getDb } from "../db";
import type { Ancora, EixoDaPersona, Persona, Semente, SeedKind } from "./look.types";

// ---------------------------------------------------------------------------
// Sementes
// ---------------------------------------------------------------------------

interface SementeRow {
  product_group_id: string;
  title: string;
  product_type: string;
  tags: string[] | null;
}

/**
 * As tags do produto, no mesmo formato que `acharAncora` já usa.
 *
 * Repetido como fragmento em vez de virar JOIN porque as três consultas de
 * semente partem de tabelas diferentes (variante, handle, pedido) e só
 * compartilham o `product_group_id` no fim.
 */
const TAGS_DO_PRODUTO = `COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                                    WHERE pp.product_group_id = p.product_group_id
                                      AND pp.name = 'TAG'), '{}') AS tags`;

/**
 * Resolve variantes em produtos. É como favoritos e compras viram semente: os
 * dois guardam `variant_id` (o cookie `deco_wishlist` guarda o `productID`, que
 * é o `variant_id` — ver `catalog.mapper.ts:95`), e o agente raciocina sobre
 * produto.
 */
export const sementesPorVariante = async (
  variantIds: string[],
  kind: SeedKind,
  em: string,
): Promise<Semente[]> => {
  const db = getDb();
  if (!db || variantIds.length === 0) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT DISTINCT p.product_group_id, p.title, p.product_type, ${TAGS_DO_PRODUTO}
           FROM products p
           JOIN variants v ON v.product_group_id = p.product_group_id
          WHERE v.variant_id = ANY(?)`,
      )
      .bind(variantIds)
      .all<SementeRow>();

    return results.map((linha) => ({
      productGroupId: linha.product_group_id,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      tags: linha.tags ?? [],
      kinds: [kind],
      em,
    }));
  } catch (erro) {
    console.error("[look] sementesPorVariante falhou", erro);
    return [];
  }
};

/** Idem para os vistos, que o cookie guarda por handle (é o que a URL tem). */
export const sementesPorHandle = async (
  handles: string[],
  kind: SeedKind,
  em: string,
): Promise<Semente[]> => {
  const db = getDb();
  if (!db || handles.length === 0) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT p.product_group_id, p.handle, p.title, p.product_type, ${TAGS_DO_PRODUTO}
           FROM products p
          WHERE p.handle = ANY(?)`,
      )
      .bind(handles)
      .all<SementeRow & { handle: string }>();

    // A ordem do cookie é a ordem de recência e o SQL não a preserva. Reordenar
    // aqui é o que faz a peça vista há um minuto pesar mais que a de meia hora
    // atrás no desempate — e sem isto o `slice` das sementes cortaria por acaso.
    const posicaoNoCookie = new Map(handles.map((handle, i) => [handle, i]));

    return results
      .map((linha) => ({
        productGroupId: linha.product_group_id,
        titulo: linha.title,
        tipo: linha.product_type ?? "",
        tags: linha.tags ?? [],
        kinds: [kind],
        em,
        _pos: posicaoNoCookie.get(linha.handle) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a._pos - b._pos)
      .map(({ _pos: _, ...semente }) => semente);
  } catch (erro) {
    console.error("[look] sementesPorHandle falhou", erro);
    return [];
  }
};

/**
 * As tags de um conjunto de produtos, por `product_group_id`.
 *
 * Existe para os "avise-me". As outras três origens já chegam com tags —
 * favoritos e vistos passam por `sementesPorVariante`/`sementesPorHandle`,
 * compras por `comprasDe` —, mas `findWaitedItems` vive no domínio `alerts` e
 * devolve `WaitedItem`, que não as carrega.
 *
 * Isso deixava a semente `waited` com `tags: []`, e o comentário em
 * `look.seeds.ts` admitia a limitação chamando-a de "consequência limitada": uma
 * peça só esperada não contribuía para `combinaComOGuardaRoupa`.
 *
 * **Deixou de ser limitada.** Na vitrine sem âncora, o desejo alimenta
 * `combinaComOQueQuer`, que é metade do único eixo que liga produto e pessoa —
 * e medido nos quatro armários semeados, cujo desejo vem só de "avise-me", o
 * campo dava zero em 127 produtos. Não era sinal fraco: era sinal ausente.
 *
 * Uma consulta a mais, e só quando há esperados. Barata: índice por
 * `product_group_id` e nada de JOIN.
 */
export const tagsDeProdutos = async (
  productGroupIds: readonly string[],
): Promise<Map<string, string[]>> => {
  const db = getDb();
  if (!db || productGroupIds.length === 0) return new Map();

  try {
    const { results } = await db
      .prepare(
        `SELECT product_group_id, ARRAY_AGG(value) AS tags
           FROM product_props
          WHERE name = 'TAG' AND product_group_id = ANY(?)
          GROUP BY product_group_id`,
      )
      .bind([...productGroupIds])
      .all<{ product_group_id: string; tags: string[] | null }>();

    return new Map(results.map((linha) => [linha.product_group_id, linha.tags ?? []]));
  } catch (erro) {
    console.error("[look] tagsDeProdutos falhou", erro);
    return new Map();
  }
};

interface CompraRow extends SementeRow {
  created_at: string;
}

/**
 * O que a pessoa comprou.
 *
 * `INNER JOIN` com o catálogo, não `LEFT`: uma compra cuja variante saiu do
 * catálogo não tem o que informar ao agente — não há tipo, não há tag, não há
 * do que compor em volta. Mesma escolha que `findWaitedItems` já faz.
 *
 * Parte de `order_items` e não de `orders` desde a 0017: o pedido passou a ter
 * vários itens, e a variante desceu para a linha do item. O JOIN com o catálogo
 * **vivo** é de propósito — o agente precisa do tipo e das tags de agora, não
 * dos de quando a compra aconteceu. O que ficou congelado no pedido é só o que
 * foi transacionado (preço e título), e nada disso entra aqui.
 *
 * Pedido cancelado não conta: o sinal é POSSE, e quem cancelou não tem a peça.
 */
export const comprasDe = async (email: string): Promise<Semente[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT DISTINCT ON (p.product_group_id)
                p.product_group_id, p.title, p.product_type, o.created_at, ${TAGS_DO_PRODUTO}
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           JOIN variants v ON v.variant_id = oi.variant_id
           JOIN products p ON p.product_group_id = v.product_group_id
          WHERE o.email = ? AND o.status <> 'cancelled'
          ORDER BY p.product_group_id, o.created_at DESC`,
      )
      .bind(email)
      .all<CompraRow>();

    return results.map((linha) => ({
      productGroupId: linha.product_group_id,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      tags: linha.tags ?? [],
      kinds: ["purchased" as const],
      em: linha.created_at,
    }));
  } catch (erro) {
    console.error("[look] comprasDe falhou", erro);
    return [];
  }
};

/**
 * O que a pessoa favoritou **estando logada**.
 *
 * A wishlist tem duas casas, e o agente precisa das duas. O cookie
 * `deco_wishlist` sempre existiu e é o que faz um visitante deslogado ter look
 * pessoal; a tabela `wishlist_items` é onde o favorito passa a morar quando há
 * sessão. Ler só o cookie deixaria de fora exatamente quem se identificou — e
 * quem se identificou é o público desta feature (ver o recorte no topo de
 * docs/agente-de-combinacoes.md).
 *
 * Quem une as duas é `colherSementes`; aqui só sai a metade do banco.
 *
 * **`created_at` real, não `now()`.** É a única coisa que esta fonte tem e a do
 * cookie não: o cookie guarda uma lista de ids, sem quando. Depois que a
 * pesagem de sementes caiu (ver `consolidar`), a ordem que chega ao modelo é
 * cronológica — então a data deixou de ser critério de desempate e passou a ser
 * a própria ordenação. Uma data inventada aqui não empataria nada; mentiria.
 *
 * **`wishlist_items` pode não existir** num banco que não rodou a `0015`. A
 * consulta falha, o `catch` devolve `[]`, e o agente segue com o cookie — que é
 * o comportamento de quem não está logado. Nada quebra.
 */
export const favoritosDe = async (email: string, limite: number): Promise<Semente[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    // Duas camadas, e a de fora não é enfeite. `DISTINCT ON` exige que o
    // `ORDER BY` comece pela coluna distinta, então o de dentro ordena por
    // produto — e um `LIMIT` ali cortaria por `product_group_id`, que é ordem
    // alfabética de id. Quem tivesse trinta favoritos receberia doze
    // arbitrários em vez dos doze últimos. A camada de fora reordena por data e
    // só então corta.
    const { results } = await db
      .prepare(
        `SELECT * FROM (
           SELECT DISTINCT ON (p.product_group_id)
                  p.product_group_id, p.title, p.product_type, ${TAGS_DO_PRODUTO},
                  to_char(w.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
             FROM wishlist_items w
             JOIN variants v ON v.variant_id = w.product_id
             JOIN products p ON p.product_group_id = v.product_group_id
            WHERE w.user_id = ?
            ORDER BY p.product_group_id, w.created_at DESC
         ) AS por_produto
          ORDER BY created_at DESC
          LIMIT ?`,
      )
      .bind(email, limite)
      .all<CompraRow>();

    return results.map((linha) => ({
      productGroupId: linha.product_group_id,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      tags: linha.tags ?? [],
      // Lista, não valor único: a mesma peça pode chegar por outras origens, e
      // `consolidar` une as listas em vez de escolher uma vencedora.
      kinds: ["wishlist" as const],
      em: linha.created_at,
    }));
  } catch (erro) {
    console.error("[look] favoritosDe falhou", erro);
    return [];
  }
};

// ---------------------------------------------------------------------------
// A âncora
// ---------------------------------------------------------------------------

interface AncoraRow {
  product_group_id: string;
  handle: string;
  title: string;
  product_type: string;
  description: string | null;
  tags: string[] | null;
}

/** Uma tentativa de casar o handle exato. `null` quando não existe. */
const buscarAncora = async (
  handle: string,
): Promise<{ ancora: Ancora; variantId: string } | null> => {
  const db = getDb();
  if (!db) return null;

  const linha = await db
    .prepare(
      `SELECT p.product_group_id, p.handle, p.title, p.product_type, p.description,
              COALESCE((SELECT ARRAY_AGG(pp.value) FROM product_props pp
                         WHERE pp.product_group_id = p.product_group_id
                           AND pp.name = 'TAG'), '{}') AS tags,
              (SELECT v.variant_id FROM variants v
                WHERE v.product_group_id = p.product_group_id
                ORDER BY v.available DESC, v.variant_id ASC LIMIT 1) AS variant_id
         FROM products p
        WHERE p.handle = ?`,
    )
    .bind(handle)
    .first<AncoraRow & { variant_id: string | null }>();

  if (!linha?.variant_id) return null;

  return {
    variantId: linha.variant_id,
    ancora: {
      productGroupId: linha.product_group_id,
      handle: linha.handle,
      titulo: linha.title,
      tipo: linha.product_type ?? "",
      // 240 caracteres: o bastante para o modelo entender a peça que ancora o
      // look, longe do bastante para a descrição (média de 866) competir com
      // os candidatos pelo espaço do prompt.
      descricao: (linha.description ?? "").slice(0, 240),
      tags: linha.tags ?? [],
    },
  };
};

/**
 * A peça aberta, com o que o agente precisa para compor em volta dela.
 *
 * Devolve o `variant_id` de uma variante qualquer junto porque os dois pools
 * (`findSimilarAvailable`, `findComplementsAvailable`) recebem variante, não
 * produto — eles nasceram servindo o sinal de "avise-me", que é por variante.
 *
 * **Recebe o SLUG da PDP, não o handle**, e a diferença não é cosmética: todo
 * link do site sai de `catalog.mapper.ts:productPath`, que anexa o id numérico
 * da variante (`/products/vintage-wash-tee-black-45123456`). Casar só handle
 * exato faria a section sumir em todo clique vindo de PLP, prateleira ou do
 * próprio look — sem erro, com a página em 200.
 *
 * A precedência é a mesma de `getProductDetailsPage` e existe pelo mesmo
 * motivo: **o slug inteiro é tentado como handle primeiro**. Handles legítimos
 * terminam em número (`high-top-canvas-shoes-1` é o Women's Slides, não uma
 * variante do High Top), e inverter a ordem resolveria para o produto errado
 * sem erro nenhum.
 */
export const acharAncora = async (
  slug: string,
): Promise<{ ancora: Ancora; variantId: string } | null> => {
  if (!slug) return null;

  try {
    const exato = await buscarAncora(slug);
    if (exato) return exato;

    const comVariante = slug.match(/^(.*)-(\d+)$/);
    if (!comVariante?.[1]) return null;

    return await buscarAncora(comVariante[1]);
  } catch (erro) {
    console.error("[look] acharAncora falhou", erro);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Cache de looks
// ---------------------------------------------------------------------------

// (O cache do look — `lerLook`, `gravarLook`, `gravarFalha`, `falhaRecente` e o
// `HASH_DA_FALHA` da quarentena — saiu junto com o agente que o usava. A tabela
// `looks` continua no banco: dropá-la exigiria uma migration para não comprar
// nada, e ela guarda o histórico do que aquele agente compôs.)

// ---------------------------------------------------------------------------
// Personas — o retrato do guarda-roupa
// ---------------------------------------------------------------------------
//
// Mora neste arquivo, e não num `persona.d1.ts`, pela mesma razão que `orders`
// mora aqui: o cabeçalho promete "único arquivo com SQL", e a persona é lida
// exatamente no mesmo caminho que o look. Dois arquivos de SQL para o mesmo
// fluxo é onde uma segunda `getDb` começa a divergir da primeira.

interface PersonaRow {
  eixos: string;
  confianca: number;
  origem: string;
}

/**
 * A persona daquele conjunto de sinais, ou `null`.
 *
 * **Linha com `origem <> 'agente'` é tratada como inexistente**, exatamente como
 * em `lerLook`. É o que torna seguro o marcador de falha morar nesta mesma
 * tabela: quem consome nunca vê um terceiro estado, só persona ou nada.
 *
 * `evidencia` volta do JSON sem revalidação contra os sinais. A validação
 * aconteceu uma vez, em `validarPersona`, sobre os sinais que geraram esta
 * linha — e como o hash dos sinais é a própria chave, sinal diferente é linha
 * diferente. Revalidar aqui checaria a mesma coisa contra a mesma entrada.
 */
export const lerPersona = async (sinaisHash: string): Promise<Persona | null> => {
  const db = getDb();
  if (!db) return null;

  try {
    const linha = await db
      .prepare(`SELECT eixos, confianca, origem FROM personas WHERE sinais_hash = ?`)
      .bind(sinaisHash)
      .first<PersonaRow>();

    if (!linha || linha.origem !== "agente") return null;

    const eixos = JSON.parse(linha.eixos) as EixoDaPersona[];
    if (!Array.isArray(eixos) || eixos.length === 0) return null;

    return { eixos, confianca: linha.confianca };
  } catch (erro) {
    console.error("[look] lerPersona falhou", erro);
    return null;
  }
};

/**
 * Grava a persona daquele conjunto de sinais, substituindo a anterior.
 *
 * `UPSERT` pelo mesmo motivo de `gravarLook`: torna o pré-aquecimento e um
 * refresh futuro idempotentes. Aqui ele quase nunca dispara de verdade — o hash
 * dos sinais mudou significa chave nova —, mas duas requisições concorrentes da
 * mesma pessoa chegam ao mesmo hash, e sem o `ON CONFLICT` a segunda estouraria.
 */
export const gravarPersona = async (sinaisHash: string, persona: Persona): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO personas (sinais_hash, eixos, confianca, origem, motivo, generated_at)
              VALUES (?, ?, ?, 'agente', NULL,
                      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (sinais_hash) DO UPDATE
                 SET eixos = EXCLUDED.eixos,
                     confianca = EXCLUDED.confianca,
                     origem = EXCLUDED.origem,
                     motivo = EXCLUDED.motivo,
                     generated_at = EXCLUDED.generated_at`,
      )
      .bind(sinaisHash, JSON.stringify(persona.eixos), persona.confianca)
      .run();

    return true;
  } catch (erro) {
    console.error("[look] gravarPersona falhou", erro);
    return false;
  }
};

/**
 * Registra que ESTES SINAIS foram tentados e não deram.
 *
 * A quarentena da #20 aplicada à síntese, e ela importa mais aqui do que em
 * `looks`: uma síntese que não converge fica **a montante de todas as peças**,
 * então sem marcador cada PDP de cada visita dispara uma chamada nova de até
 * 120s pelo mesmo conjunto de sinais que já falhou.
 *
 * Não há chave reservada a inventar (o `HASH_DA_FALHA` de `looks` existe porque
 * lá a chave é composta e o marcador é por peça): aqui o marcador ocupa a
 * própria chave dos sinais, e `origem` sozinha o distingue.
 *
 * O `WHERE personas.origem <> 'agente'` impede que uma falha APAGUE uma persona
 * boa já gravada — mesmo cinto de `gravarFalha`.
 */
export const gravarFalhaDaPersona = async (
  sinaisHash: string,
  motivo: string,
): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO personas (sinais_hash, eixos, confianca, origem, motivo, generated_at)
              VALUES (?, '[]', 0, 'falha', ?,
                      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (sinais_hash) DO UPDATE
                 SET origem = 'falha',
                     motivo = EXCLUDED.motivo,
                     generated_at = EXCLUDED.generated_at
               WHERE personas.origem <> 'agente'`,
      )
      .bind(sinaisHash, motivo.slice(0, 200))
      .run();

    return true;
  } catch (erro) {
    console.error("[look] gravarFalhaDaPersona falhou", erro);
    return false;
  }
};

/**
 * Se estes sinais já falharam nos últimos `minutos`.
 *
 * Comparação de string, correta porque `generated_at` é ISO 8601 UTC de largura
 * fixa — mesma justificativa de `falhaRecente`. Erro devolve `false`: na dúvida,
 * tenta sintetizar; um banco intermitente não deve desligar a persona.
 */
export const personaFalhouRecentemente = async (
  sinaisHash: string,
  minutos: number,
): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    const linha = await db
      .prepare(
        `SELECT 1 AS existe
           FROM personas
          WHERE sinais_hash = ? AND origem = 'falha'
            AND generated_at > to_char((now() - make_interval(mins => ?)) AT TIME ZONE 'UTC',
                                       'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      )
      .bind(sinaisHash, minutos)
      .first<{ existe: number }>();

    return !!linha;
  } catch (erro) {
    console.error("[look] personaFalhouRecentemente falhou", erro);
    return false;
  }
};
