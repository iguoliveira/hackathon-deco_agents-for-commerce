/**
 * Acesso à tabela `shelves`. Único arquivo que fala SQL de vitrine.
 *
 * Nada aqui lança: quem consome é uma section, e vitrine vazia é resultado
 * aceitável — derrubar a home por causa dela não é.
 */

import { getDb } from "../db";
import type { ItemDaVitrine, Vitrine } from "./shelf.types";

interface ShelfRow {
  email: string;
  title: string;
  confidence: number;
  items: string;
  source: string;
  fallback_reason: string | null;
  anchor_variant_id: string;
  generated_at: string;
}

/**
 * Grava a vitrine, substituindo a anterior.
 *
 * Substitui em vez de acumular porque ninguém consome vitrine antiga: a atual
 * é a única que qualquer consumidor quer, e um histórico exigiria decidir
 * quando podar. Se um dia for preciso medir a evolução, isso é log, não esta
 * tabela.
 */
export const gravarVitrine = async (
  email: string,
  vitrine: Vitrine,
  ancoraVariantId: string,
): Promise<boolean> => {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .prepare(
        `INSERT INTO shelves
           (email, title, confidence, items, source, fallback_reason, anchor_variant_id, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?,
                 to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
         ON CONFLICT (email) DO UPDATE SET
           title = excluded.title,
           confidence = excluded.confidence,
           items = excluded.items,
           source = excluded.source,
           fallback_reason = excluded.fallback_reason,
           anchor_variant_id = excluded.anchor_variant_id,
           generated_at = excluded.generated_at`,
      )
      .bind(
        email,
        vitrine.titulo,
        vitrine.confianca,
        JSON.stringify(vitrine.itens),
        vitrine.origem,
        vitrine.motivoDoFallback ?? null,
        ancoraVariantId,
      )
      .run();
    return true;
  } catch (erro) {
    console.error("[shelf] falha ao gravar vitrine:", erro);
    return false;
  }
};

export interface VitrineGravada extends Vitrine {
  ancoraVariantId: string;
  geradaEm: string;
}

/**
 * A vitrine gravada de um comprador. `null` quando não há.
 *
 * Devolve os handles como o agente os escolheu, **sem** conferir estoque — a
 * conferência é do `catalog.d1.findAvailableCatalogRecordsByHandles`, no
 * momento do render. Separar os dois é o que permite a mesma linha servir a
 * section e ao e-mail sem duplicar a regra.
 */
export const lerVitrine = async (email: string): Promise<VitrineGravada | null> => {
  const db = getDb();
  if (!db) return null;

  try {
    const linha = await db
      .prepare(
        `SELECT email, title, confidence, items, source, fallback_reason,
                anchor_variant_id, generated_at
           FROM shelves WHERE email = ?`,
      )
      .bind(email)
      .first<ShelfRow>();

    if (!linha) return null;

    // O JSON foi escrito por nós, mas a coluna é TEXT e um dia alguém edita à
    // mão no painel do Supabase. Parse defensivo custa nada aqui.
    let itens: ItemDaVitrine[] = [];
    try {
      const cru = JSON.parse(linha.items);
      if (Array.isArray(cru)) itens = cru;
    } catch {
      console.error(`[shelf] items inválido para ${email}`);
      return null;
    }

    return {
      titulo: linha.title,
      confianca: Number(linha.confidence) || 0,
      itens,
      origem: linha.source === "agente" ? "agente" : "sql",
      motivoDoFallback: linha.fallback_reason ?? undefined,
      ancoraVariantId: linha.anchor_variant_id,
      geradaEm: linha.generated_at,
    };
  } catch (erro) {
    console.error("[shelf] falha ao ler vitrine:", erro);
    return null;
  }
};

/**
 * Compradores cuja vitrine está mais velha que `dias` — os mais antigos
 * primeiro.
 *
 * A ordem é o que torna o cron auto-recuperável sem fila nem tabela de
 * controle: quem ficou de fora por falta de orçamento hoje é o primeiro
 * amanhã. Inclui quem tem alerta e ainda não tem vitrine nenhuma (LEFT JOIN),
 * porque esse é o caso em que a geração no clique falhou.
 */
export const acharVitrinesVencidas = async (dias = 3, limite = 20): Promise<string[]> => {
  const db = getDb();
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT DISTINCT a.email,
                COALESCE(s.generated_at, '') AS geradaEm
           FROM stock_alerts a
           LEFT JOIN shelves s ON s.email = a.email
          WHERE s.generated_at IS NULL
             OR s.generated_at < to_char((now() - make_interval(days => ?)) AT TIME ZONE 'UTC',
                                         'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ORDER BY geradaEm ASC
          LIMIT ?`,
      )
      .bind(dias, limite)
      .all<{ email: string }>();

    return results.map((linha) => linha.email);
  } catch (erro) {
    console.error("[shelf] falha ao achar vitrines vencidas:", erro);
    return [];
  }
};
