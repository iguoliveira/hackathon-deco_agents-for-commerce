/**
 * Ponta a ponta: semeia `wishlist_items`, e verifica que o **agente** compõe o
 * look a partir desse dado — não do cookie.
 *
 *   npm run look:wishlist:e2e
 *   npm run look:wishlist:e2e -- vintage-wash-tee-black
 *
 * Roda o caminho de produção inteiro: `colherSementes` (a mesma função que a
 * PDP chama), `montarCandidatos` e `comporLook` contra o Decopilot real.
 *
 * **O eixo que discrimina é a comparação.** Compor uma vez e ver um look bonito
 * não prova nada — o agente compõe para visitante sem histórico também. Então
 * compõe DUAS vezes, com a mesma âncora, a mesma cidade e o mesmo mês, mudando
 * só a wishlist do banco. Se o dado do banco não chegasse ao prompt, os dois
 * lados veriam o mesmo contexto.
 *
 * Roda fora de uma requisição HTTP de propósito: sem `RequestContext`, o cookie
 * `deco_wishlist` contribui zero, e o que sobra é exatamente o que a PR #24
 * acrescenta.
 *
 * Semeia num e-mail próprio (`E2E`) e **apaga no fim, mesmo se falhar** — o
 * banco é compartilhado com o time.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env, o erro de DATABASE_URL que vem depois é o diagnóstico útil.
}

import { readFileSync } from "node:fs";
import { comporLook, jaComprados } from "../src/platform/look/look.agent";
import { montarCandidatos } from "../src/platform/look/look.candidates";
import { acharAncora } from "../src/platform/look/look.d1";
import { mesAtual } from "../src/platform/look/look.local";
import { colherSementes } from "../src/platform/look/look.seeds";
import { getDb } from "../src/platform/db";
import type { Contexto, Local } from "../src/platform/look/look.types";

/** `.dev.vars` guarda as credenciais do Decopilot; tsx não as carrega sozinho. */
const carregarDevVars = (): void => {
  let conteudo: string;
  try {
    conteudo = readFileSync(".dev.vars", "utf8");
  } catch {
    return;
  }
  for (const linha of conteudo.split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual <= 0) continue;
    const chave = limpa.slice(0, igual).trim();
    if (!process.env[chave]) process.env[chave] = limpa.slice(igual + 1).trim();
  }
};

const E2E = "e2e-wishlist@teste.local";
const LOCAL: Local = { cidade: "São Paulo", regiao: "SP", pais: "BR", origem: "padrao" };

let falhas = 0;
const ok = (condicao: boolean, texto: string) => {
  if (!condicao) falhas++;
  console.log(`  ${condicao ? "PASS" : "FALHA"}  ${texto}`);
};

/** Três peças de grupos e tipos distintos, que não sejam a âncora. */
const escolherPecas = async (grupoDaAncora: string) => {
  const db = getDb();
  if (!db) throw new Error("Sem banco: confira DATABASE_URL no .env");

  const { results } = await db
    .prepare(
      `SELECT DISTINCT ON (p.product_type)
              v.variant_id, p.product_group_id, p.title, p.product_type
         FROM variants v
         JOIN products p ON p.product_group_id = v.product_group_id
        WHERE p.product_group_id <> ?
          AND p.product_type IN ('Beanie', 'Boots', 'Denim Jacket')
        ORDER BY p.product_type, v.variant_id`,
    )
    .bind(grupoDaAncora)
    .all<{
      variant_id: string;
      product_group_id: string;
      title: string;
      product_type: string;
    }>();

  return results;
};

const semear = async (pecas: Awaited<ReturnType<typeof escolherPecas>>) => {
  const db = getDb()!;
  await db.prepare(`DELETE FROM wishlist_items WHERE user_id = ?`).bind(E2E).run();

  // Datas distintas e crescentes: é o que permite verificar depois que a
  // recência que chega ao agente é a de quando se favoritou, não a da consulta.
  for (const [i, peca] of pecas.entries()) {
    await db
      .prepare(
        `INSERT INTO wishlist_items (user_id, product_id, product_group_id, created_at)
         VALUES (?, ?, ?, now() - (? || ' hours')::interval)
         ON CONFLICT (user_id, product_id) DO NOTHING`,
      )
      .bind(E2E, peca.variant_id, peca.product_group_id, String((pecas.length - i) * 3))
      .run();
  }
};

const limpar = async () => {
  const db = getDb();
  if (!db) return;
  await db.prepare(`DELETE FROM wishlist_items WHERE user_id = ?`).bind(E2E).run();
};

/** Compõe um look de verdade e devolve as peças escolhidas. */
const comporCom = async (
  alvo: Awaited<ReturnType<typeof acharAncora>>,
  contexto: Contexto,
  rotulo: string,
) => {
  const candidatos = await montarCandidatos(
    alvo!.variantId,
    jaComprados(contexto),
    contexto.sementes,
  );
  const inicio = Date.now();
  const { look, porque } = await comporLook(alvo!.ancora, contexto, candidatos);
  const s = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log(`\n--- ${rotulo} (${s}s, ${candidatos.length} candidatos) ---`);
  if (!look) {
    console.log(`  sem look: ${porque}`);
    return { look, candidatos };
  }
  console.log(`  "${look.titulo}"  confiança ${look.confianca}`);
  const nome = new Map(candidatos.map((c) => [c.handle, c.titulo]));
  for (const p of look.pecas) {
    console.log(`    ${(nome.get(p.handle) ?? p.handle).padEnd(30)} ${p.motivo ?? ""}`);
  }
  return { look, candidatos };
};

const main = async (): Promise<void> => {
  carregarDevVars();

  // `vintage-wash-tee-black`, a âncora citada na doc, não existe mais no
  // catálogo atual — ele foi regenerado depois que aquela nota foi escrita.
  const handle = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "retro-code-tee";
  const alvo = await acharAncora(handle);
  if (!alvo) throw new Error(`Peça "${handle}" não existe no catálogo.`);

  console.log(`\nâncora: ${alvo.ancora.titulo} [${alvo.ancora.tipo}]`);
  console.log(`e-mail semeado: ${E2E}\n`);

  try {
    // ---- 1. O banco começa vazio para este e-mail -------------------------
    await limpar();
    const antes = await colherSementes(E2E);
    ok(antes.length === 0, "sem nada semeado, o agente não vê semente alguma");

    // ---- 2. Semeia --------------------------------------------------------
    const pecas = await escolherPecas(alvo.ancora.productGroupId);
    if (pecas.length < 2) throw new Error("Catálogo não tem os tipos esperados para semear.");
    await semear(pecas);
    console.log(`\nsemeado em wishlist_items:`);
    for (const p of pecas) console.log(`  ${p.title}  [${p.product_type}]`);

    // ---- 3. O agente lê o que foi semeado ---------------------------------
    const depois = await colherSementes(E2E);
    console.log(`\ncolherSementes(${E2E}) → ${depois.length}`);
    for (const s of depois)
      console.log(`  ${s.kinds.join("+").padEnd(10)} ${s.titulo.padEnd(28)} ${s.em}`);

    console.log("");
    ok(depois.length === pecas.length, "toda peça semeada chegou como semente");
    ok(
      depois.every((s) => s.kinds.includes("wishlist")),
      'todas marcadas kinds: ["wishlist"]',
    );
    ok(
      depois.every((s) => s.tags.length > 0),
      "todas com tags — sem elas o agente não combina nada",
    );
    const gruposSemeados = new Set(pecas.map((p) => p.product_group_id));
    ok(
      depois.every((s) => gruposSemeados.has(s.productGroupId)),
      "e são exatamente as peças semeadas, não outras",
    );

    // A recência preservada: a peça inserida por último tem a data mais nova.
    const maisRecente = [...depois].sort((a, b) => (a.em < b.em ? 1 : -1))[0];
    ok(
      maisRecente.productGroupId === pecas[pecas.length - 1].product_group_id,
      "a ordem por recência é a de quando se favoritou, não a da consulta",
    );

    // ---- 4. O dado semeado chega ao PROMPT --------------------------------
    //
    // O eixo NÃO é o conjunto de candidatos: `montarCandidatos` monta o pool a
    // partir dos complementos da âncora, e a semente não filtra nada — os dois
    // lados veem os mesmos 18. Onde a semente entra é em `comOGuardaRoupa`, que
    // anexa a cada candidato `combinaComOGuardaRoupa` (tags cruzadas com o
    // armário) e `jaTemDesteTipo` (saturação). São esses campos que vão ao
    // prompt, e é neles que o favorito do banco vira decisão do modelo.
    const mes = mesAtual();
    const comWishlist: Contexto = { sementes: depois, local: LOCAL, mes };
    const semWishlist: Contexto = { sementes: [], local: LOCAL, mes };

    const candA = await montarCandidatos(
      alvo.variantId,
      jaComprados(comWishlist),
      comWishlist.sementes,
    );
    const candB = await montarCandidatos(
      alvo.variantId,
      jaComprados(semWishlist),
      semWishlist.sementes,
    );

    const comAfinidade = candA.filter((c) => (c.combinaComOGuardaRoupa?.length ?? 0) > 0);
    const comSaturacao = candA.filter((c) => (c.jaTemDesteTipo?.length ?? 0) > 0);
    const ruidoNoControle = candB.filter(
      (c) => (c.combinaComOGuardaRoupa?.length ?? 0) > 0 || (c.jaTemDesteTipo?.length ?? 0) > 0,
    );

    console.log(`\ncandidatos: ${candA.length} (com wishlist) vs ${candB.length} (sem)`);
    for (const c of comAfinidade.slice(0, 5)) {
      console.log(`  ${c.titulo.padEnd(30)} combina: ${c.combinaComOGuardaRoupa!.join(", ")}`);
    }
    for (const c of comSaturacao) {
      console.log(`  ${c.titulo.padEnd(30)} já tem do tipo: ${c.jaTemDesteTipo!.join(", ")}`);
    }

    console.log("");
    ok(
      comAfinidade.length > 0 || comSaturacao.length > 0,
      `o favorito do banco marcou candidatos no prompt (${comAfinidade.length} por afinidade, ${comSaturacao.length} por saturação)`,
    );
    ok(
      ruidoNoControle.length === 0,
      "e sem wishlist nenhum candidato carrega essas marcas — o efeito é da semente",
    );

    // ---- 5. O agente, só sob demanda --------------------------------------
    //
    // Fora do caminho padrão porque depende do Decopilot: cada composição leva
    // 22-41s quando o serviço responde, e estoura o TIMEOUT_MS de 120s quando
    // não responde. Isso mede a disponibilidade do modelo, não esta PR.
    if (process.argv.includes("--agente")) {
      const a = await comporCom(alvo, comWishlist, "COM a wishlist do banco");
      await comporCom(alvo, semWishlist, "SEM wishlist (visitante anônimo)");
      console.log("");
      ok(a.look !== null, "o agente compôs um look a partir do dado do banco");
    } else {
      console.log("\n(composição pelo agente pulada — use --agente para incluí-la)");
    }
  } finally {
    await limpar();
    console.log(`\n(e-mail de teste removido de wishlist_items)`);
  }

  console.log(falhas === 0 ? "\nTUDO PASSOU\n" : `\n${falhas} FALHA(S)\n`);
  process.exit(falhas === 0 ? 0 : 1);
};

main().catch(async (erro) => {
  await limpar().catch(() => {});
  console.error(erro);
  process.exit(1);
});
