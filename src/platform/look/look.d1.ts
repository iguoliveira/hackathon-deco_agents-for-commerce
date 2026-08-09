/**
 * Único arquivo com SQL de `looks`, `personas`, `orders` e da resolução de
 * sementes.
 *
 * Nada aqui lança: quem consome é uma section, e look vazio é resultado
 * aceitável — derrubar a PDP por causa dele não é.
 */

import { getDb } from "../db";
import type {
  Ancora,
  EixoDaPersona,
  Look,
  PecaDoLook,
  Persona,
  Semente,
  SeedKind,
} from "./look.types";

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

interface LookRow {
  titulo: string;
  confianca: number;
  pecas: string;
  origem: string;
}

/**
 * O look gravado daquele par, ou `null`.
 *
 * **Linha com `origem <> 'agente'` é tratada como inexistente.** As colunas
 * `origem` e `motivo_do_fallback` continuam na tabela porque a `0014` já foi
 * aplicada e apagá-las custaria uma migration para não comprar nada — mas nada
 * escreve `'sql'` desde que o fallback caiu. O filtro existe para as linhas
 * antigas: servir uma delas hoje poria na tela um look sem motivo nenhum, que é
 * exatamente o que se decidiu não mostrar. Sendo ignoradas, elas são
 * regeneradas na primeira visita e somem sozinhas.
 *
 * O mesmo filtro é o que torna seguro `gravarFalha` escrever nesta tabela: um
 * marcador de falha é `origem = 'falha'`, então ele **nunca** chega à tela por
 * este caminho, e nenhum consumidor precisou aprender um terceiro estado.
 */
export const lerLook = async (anchorId: string, contextoHash: string): Promise<Look | null> => {
  const db = getDb();
  if (!db) return null;

  try {
    const linha = await db
      .prepare(
        `SELECT titulo, confianca, pecas, origem
           FROM looks WHERE anchor_id = ? AND contexto_hash = ?`,
      )
      .bind(anchorId, contextoHash)
      .first<LookRow>();

    if (!linha || linha.origem !== "agente") return null;

    const pecas = JSON.parse(linha.pecas) as PecaDoLook[];
    if (!Array.isArray(pecas)) return null;

    return {
      titulo: linha.titulo,
      confianca: linha.confianca,
      pecas,
    };
  } catch (erro) {
    console.error("[look] lerLook falhou", erro);
    return null;
  }
};

/**
 * Grava o look, substituindo o anterior daquele par.
 *
 * O `UPSERT` é o que torna o pré-aquecimento e um refresh futuro idempotentes:
 * rodar duas vezes reescreve, nunca duplica nem falha por chave.
 *
 * **Só chega aqui look do agente** — `gerarLook` retorna antes quando a
 * composição falha. Daí `origem` ser literal: a coluna sobrevive para as linhas
 * antigas e para o `lerLook` poder ignorá-las, não porque haja o que decidir.
 */
export const gravarLook = async (
  anchorId: string,
  contextoHash: string,
  look: Look,
): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO looks (anchor_id, contexto_hash, titulo, confianca, pecas, origem,
                            motivo_do_fallback, generated_at)
              VALUES (?, ?, ?, ?, ?, 'agente', NULL,
                      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (anchor_id, contexto_hash) DO UPDATE
                 SET titulo = EXCLUDED.titulo,
                     confianca = EXCLUDED.confianca,
                     pecas = EXCLUDED.pecas,
                     origem = EXCLUDED.origem,
                     motivo_do_fallback = EXCLUDED.motivo_do_fallback,
                     generated_at = EXCLUDED.generated_at`,
      )
      .bind(anchorId, contextoHash, look.titulo, look.confianca, JSON.stringify(look.pecas))
      .run();

    return true;
  } catch (erro) {
    console.error("[look] gravarLook falhou", erro);
    return false;
  }
};

/**
 * O `contexto_hash` reservado da quarentena. **Não é um contexto.**
 *
 * `hashDoContexto` produz base36 de um FNV-1a — dígitos e letras minúsculas,
 * nunca sublinhados. Então esta chave não colide com nenhum contexto real, e a
 * linha da quarentena não pode ocupar o lugar de um look.
 */
const HASH_DA_FALHA = "__falha__";

/**
 * Registra que ESTA PEÇA foi tentada e não deu. Uma linha por âncora.
 *
 * Existe porque falha que não deixa rastro vira laço: sem linha, a visita
 * seguinte não sabe que a anterior já tentou, e cada pageview dispara uma
 * chamada nova de até 120s. Com a section na home, isso é *toda* visita —
 * inclusive bot, preview e health check. O sistema respondia a "o provedor está
 * saturado" gerando mais carga.
 *
 * **A quarentena é por peça, e não pelo par (peça, contexto).** A primeira
 * versão usava o par, e isso tinha um furo que anulava quase todo o conserto:
 * `marcarVisita` grava `deco_recent` em toda PDP, `colherSementes` lê esse
 * cookie e `hashDoContexto` inclui as sementes — então quem navega gera um
 * contexto NOVO a cada página. Um par novo nunca teve marcador, e a quarentena
 * não errava: ela simplesmente nunca era consultada. Para visitante anônimo, que
 * não tem sinal mais forte que `recent`, era o caso comum, não a exceção.
 *
 * Por peça isso fecha, e fecha pelo motivo certo: **o que estamos registrando
 * quase nunca é propriedade do contexto.** "Modelo indisponível" é propriedade
 * do provedor; a peça é a chave mais fina que ainda faz sentido. O preço é uma
 * falha de composição específica de um contexto atrasar em 10 minutos os outros
 * contextos daquela peça — que se cura sozinho e custa muito menos que o laço.
 *
 * **Nada disto muda o que alguém vê.** `lerLook` continua com a chave completa
 * `(anchor_id, contexto_hash)`, então a personalização é exatamente a de antes.
 * A alternativa sugerida na revisão — tirar `recent` do hash — também fecharia o
 * furo, mas ao preço de servir a uma pessoa um look composto a partir das peças
 * que outra viu. Isso é decisão de produto, não conserto de laço.
 *
 * **O marcador não é um look de consolação.** Ele grava `origem = 'falha'` com
 * `titulo` e `pecas` vazios; `lerLook` já ignora tudo que não seja `'agente'`,
 * então nada disto pode aparecer na tela. A regra do §4 do doc continua de pé.
 *
 * O `WHERE looks.origem <> 'agente'` no UPSERT não é defensividade barata: é o
 * que impede um `look:warm` que falhe de APAGAR um look bom já gravado. Com o
 * hash reservado ele é cinto e suspensório, mas o cinto é de graça.
 */
export const gravarFalha = async (anchorId: string, motivo: string): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO looks (anchor_id, contexto_hash, titulo, confianca, pecas, origem,
                            motivo_do_fallback, generated_at)
              VALUES (?, ?, '', 0, '[]', 'falha', ?,
                      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (anchor_id, contexto_hash) DO UPDATE
                 SET origem = 'falha',
                     motivo_do_fallback = EXCLUDED.motivo_do_fallback,
                     generated_at = EXCLUDED.generated_at
               WHERE looks.origem <> 'agente'`,
      )
      .bind(anchorId, HASH_DA_FALHA, motivo.slice(0, 200))
      .run();

    return true;
  } catch (erro) {
    console.error("[look] gravarFalha falhou", erro);
    return false;
  }
};

/**
 * Se esta peça já falhou nos últimos `minutos` — a quarentena que corta o laço.
 *
 * A comparação é de STRING, e isso é correto aqui em vez de sorte: `generated_at`
 * é ISO 8601 UTC de largura fixa, formato em que ordem lexicográfica e ordem
 * cronológica são a mesma coisa. É o mesmo recorte que `shelf.d1.ts` já usa para
 * varrer vitrines velhas.
 *
 * Erro devolve `false` — na dúvida, tenta gerar. Um banco intermitente não deve
 * ser capaz de desligar a feature; o pior caso é voltar ao comportamento antigo.
 */
export const falhaRecente = async (anchorId: string, minutos: number): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    const linha = await db
      .prepare(
        `SELECT 1 AS existe
           FROM looks
          WHERE anchor_id = ? AND contexto_hash = ? AND origem = 'falha'
            AND generated_at > to_char((now() - make_interval(mins => ?)) AT TIME ZONE 'UTC',
                                       'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      )
      .bind(anchorId, HASH_DA_FALHA, minutos)
      .first<{ existe: number }>();

    return !!linha;
  } catch (erro) {
    console.error("[look] falhaRecente falhou", erro);
    return false;
  }
};

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
