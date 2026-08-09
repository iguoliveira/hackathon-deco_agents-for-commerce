/**
 * Verifica a feature da PR #24: o agente enxerga a wishlist do banco.
 *
 *   npm run look:wishlist -- 123@gmail.com
 *   npm run look:wishlist                      # usa o e-mail com mais favoritos
 *
 * Roda fora de uma requisição HTTP de propósito: sem `RequestContext`, o cookie
 * `deco_wishlist` contribui zero e a metade do banco fica isolada — que é
 * exatamente o que esta PR acrescenta e o que se quer medir.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env, o erro de DATABASE_URL que vem depois é o diagnóstico útil.
}

import { favoritosDe } from "../src/platform/look/look.d1";
import { colherSementes } from "../src/platform/look/look.seeds";
import { getDb } from "../src/platform/db";

const main = async () => {
  const email = process.argv[2] ?? (await emailComMaisFavoritos());

  if (!email) {
    console.error("Sem ninguém em wishlist_items. Favorite algo pela UI ou semeie a tabela.");
    process.exit(1);
  }

  console.log(`\ne-mail: ${email}\n`);

  // 1. A consulta nova, sozinha.
  const favoritos = await favoritosDe(email, 12);
  console.log(`favoritosDe → ${favoritos.length} semente(s)`);
  for (const s of favoritos) {
    console.log(
      `  ${s.kinds.join("+").padEnd(10)} ${s.titulo.padEnd(32)} ${s.em}  (${s.tags.length} tags)`,
    );
  }

  // 2. O que a feature promete, item por item.
  const semTags = favoritos.filter((s) => s.tags.length === 0);
  const semData = favoritos.filter((s) => !s.em);
  const naoWishlist = favoritos.filter((s) => !s.kinds.includes("wishlist"));
  const ids = favoritos.map((s) => s.productGroupId);
  const duplicados = ids.length !== new Set(ids).size;

  console.log("");
  ok(favoritos.length > 0, "a wishlist do banco chega como semente");
  ok(naoWishlist.length === 0, 'todas marcadas kinds: ["wishlist"]');
  ok(semTags.length === 0, "todas com tags (alimentam combinaComOGuardaRoupa)");
  ok(semData.length === 0, "todas com a data de quando favoritou, não now()");
  ok(!duplicados, "um produto por product_group_id");

  // 3. A data é a real? Compara com a tabela.
  const db = getDb();
  const { results } = await db!
    .prepare(`SELECT max(created_at) AS ultimo FROM wishlist_items WHERE user_id = ?`)
    .bind(email)
    .all<{ ultimo: string }>();
  const ultimoNoBanco = new Date(results[0].ultimo).toISOString().slice(0, 16);
  const maisRecente = favoritos
    .map((s) => s.em)
    .sort()
    .reverse()[0]
    ?.slice(0, 16);
  ok(ultimoNoBanco === maisRecente, `a data bate com a tabela (${ultimoNoBanco})`);

  // 4. Quem não tem favoritos, e quem não tem sessão.
  const vazio = await favoritosDe("ninguem-tem-esse-email@exemplo.com", 6);
  ok(vazio.length === 0, "e-mail sem favoritos devolve lista vazia");

  const semSessao = await colherSementes(null);
  const wishlistSemSessao = semSessao.filter((s) => s.kinds.includes("wishlist"));
  ok(wishlistSemSessao.length === 0, "sem sessão, sem wishlist do banco");

  // 5. A consolidação: as duas casas viram uma lista só, sem repetir peça.
  //
  // Não há mais teto nem hierarquia entre origens: `consolidar` agrupa por
  // produto e UNE os `kinds`. Uma peça favoritada e depois comprada sai como
  // `purchased+wishlist` numa entrada só — o que se confere aqui é que ela
  // aparece uma vez, e que a origem `wishlist` não foi descartada no caminho.
  const sementes = await colherSementes(email);
  console.log(`\ncolherSementes → ${sementes.length} semente(s)`);
  for (const s of sementes) {
    console.log(`  ${s.kinds.join("+").padEnd(10)} ${s.titulo}`);
  }
  const idsFinal = sementes.map((s) => s.productGroupId);
  ok(idsFinal.length === new Set(idsFinal).size, "cada peça aparece uma vez só");

  const doBanco = new Set(favoritos.map((f) => f.productGroupId));
  const sobreviveram = sementes.filter((s) => doBanco.has(s.productGroupId));
  ok(
    sobreviveram.length === doBanco.size,
    `todo favorito do banco chegou à lista final (${sobreviveram.length}/${doBanco.size})`,
  );
  ok(
    sobreviveram.every((s) => s.kinds.includes("wishlist")),
    'e nenhum perdeu a origem "wishlist" ao ser unido com outra',
  );

  console.log("");
  process.exit(falhas === 0 ? 0 : 1);
};

let falhas = 0;
const ok = (condicao: boolean, texto: string) => {
  if (!condicao) falhas++;
  console.log(`  ${condicao ? "PASS" : "FALHA"}  ${texto}`);
};

const emailComMaisFavoritos = async (): Promise<string | null> => {
  const db = getDb();
  if (!db) return null;
  const { results } = await db
    .prepare(
      `SELECT user_id, count(*) AS n FROM wishlist_items
        GROUP BY user_id ORDER BY n DESC LIMIT 1`,
    )
    .all<{ user_id: string }>();
  return results[0]?.user_id ?? null;
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
