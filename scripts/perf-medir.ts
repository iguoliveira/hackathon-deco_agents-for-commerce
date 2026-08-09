/**
 * Mede o site em produção do jeito que o visitante sente: latência e, sobretudo,
 * **se a resposta veio do cache ou de uma função**.
 *
 *   npm run perf:medir                      # mede o deploy de produção
 *   npm run perf:medir -- https://outra-url # mede um preview
 *
 * Existe porque "está lento" não é mensurável e "melhorou" ainda menos. As duas
 * colunas que decidem tudo são `x-vercel-cache` e o tempo — um `MISS` de 250ms
 * é uma função executando na Virgínia; um `HIT` de 50ms é a borda respondendo
 * em São Paulo. A diferença entre os dois é o trabalho inteiro.
 *
 * **Cada caminho é medido duas vezes de propósito.** A primeira chamada pode
 * popular o cache; é a segunda que revela se ele acertou. Um caminho que dá
 * `MISS` nas duas não é lento por azar — ele não é cacheável, e é aí que mora
 * o problema.
 */

interface Medida {
  caminho: string;
  status: number;
  ms: number;
  cache: string;
  cacheControl: string;
  vary: string;
  setCookie: boolean;
  bytes: number;
}

const medir = async (base: string, caminho: string): Promise<Medida> => {
  const inicio = performance.now();
  const resposta = await fetch(`${base}${caminho}`, {
    // Sem cookie e sem cache local: queremos o que a borda faz por um visitante
    // novo, não o que o nosso navegador guardou.
    headers: { "cache-control": "no-cache", "user-agent": "perf-medir/1.0" },
    redirect: "follow",
  });
  const corpo = await resposta.arrayBuffer();
  const ms = Math.round(performance.now() - inicio);

  return {
    caminho,
    status: resposta.status,
    ms,
    cache: resposta.headers.get("x-vercel-cache") ?? "—",
    cacheControl: resposta.headers.get("cache-control") ?? "—",
    vary: resposta.headers.get("vary") ?? "—",
    setCookie: !!resposta.headers.get("set-cookie"),
    bytes: corpo.byteLength,
  };
};

/**
 * Os caminhos que importam.
 *
 * O `_serverFn` não entra aqui porque o hash dele muda a cada build — quem o
 * mede é a seção "sections" abaixo, que o descobre lendo o HTML da página.
 */
const CAMINHOS = ["/", "/shirts", "/products/vintage-wash-tee-900600"];

/**
 * Descobre os endpoints de section.
 *
 * O HTML **não** os contém: o cliente monta a URL a partir de um id que vive no
 * bundle do router. Então o caminho é ler o bundle, colher os ids de 64 hex e
 * sondar cada um — hoje são 16, e o número se atualiza sozinho a cada build.
 *
 * Sondar é necessário porque nem todo id de 64 caracteres no bundle é uma server
 * function; o que separa é a resposta.
 */
const sectionsDe = async (base: string): Promise<string[]> => {
  try {
    const html = await (await fetch(base)).text();
    const bundles = [...new Set(html.match(/\/assets\/[a-zA-Z0-9_-]+\.js/g) ?? [])];

    const ids = new Set<string>();
    for (const bundle of bundles) {
      const js = await (await fetch(`${base}${bundle}`)).text();
      for (const id of js.match(/[a-f0-9]{64}/g) ?? []) ids.add(id);
    }

    const validos: string[] = [];
    for (const id of ids) {
      const caminho = `/_serverFn/${id}`;
      const r = await fetch(`${base}${caminho}`, { method: "GET" });
      if (r.ok) validos.push(caminho);
      await r.arrayBuffer();
    }
    return validos;
  } catch {
    return [];
  }
};

const linha = (m: Medida): string => {
  const cor = m.cache === "HIT" || m.cache === "STALE" ? "\x1b[32m" : "\x1b[31m";
  return (
    `  ${m.caminho.padEnd(42).slice(0, 42)} ` +
    `${String(m.ms).padStart(5)}ms  ` +
    `${cor}${m.cache.padEnd(6)}\x1b[0m ` +
    `${String(m.bytes).padStart(7)}B  ` +
    `${m.setCookie ? "\x1b[33mset-cookie\x1b[0m " : "           "}` +
    `${m.cacheControl.slice(0, 42)}`
  );
};

const main = async (): Promise<void> => {
  const base = (
    process.argv.slice(2).find((a) => a.startsWith("http")) ??
    "https://hackathon-deco-agents-for-commerce.vercel.app"
  ).replace(/\/$/, "");

  console.log(`\n\x1b[1mMedindo ${base}\x1b[0m`);
  console.log(`  ${new Date().toISOString()}\n`);

  const todas: Medida[] = [];

  console.log("\x1b[1mPÁGINAS\x1b[0m  (2ª passada é a que conta — a 1ª pode popular o cache)");
  for (const caminho of CAMINHOS) {
    await medir(base, caminho); // aquece
    const m = await medir(base, caminho);
    todas.push(m);
    console.log(linha(m));
    if (m.vary !== "—") console.log(`  ${"".padEnd(42)}         vary: ${m.vary}`);
  }

  console.log("\n\x1b[1mSECTIONS\x1b[0m  (é aqui que mora o conteúdo)");
  const sections = await sectionsDe(base);
  if (sections.length === 0) console.log("  \x1b[33mnenhuma encontrada\x1b[0m");
  for (const section of sections) {
    await medir(base, section);
    const m = await medir(base, section);
    todas.push(m);
    console.log(linha(m));
  }

  // ------------------------------------------------------------------
  const doCache = todas.filter((m) => m.cache === "HIT" || m.cache === "STALE").length;
  const total = todas.length;
  const mediaHit = todas.filter((m) => m.cache === "HIT").map((m) => m.ms);
  const mediaMiss = todas.filter((m) => m.cache === "MISS").map((m) => m.ms);
  const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b) / xs.length) : 0);

  console.log(`\n\x1b[1mRESUMO\x1b[0m`);
  console.log(`  servidos do cache : ${doCache}/${total}`);
  console.log(`  média HIT         : ${media(mediaHit)}ms`);
  console.log(`  média MISS        : ${media(mediaMiss)}ms  \x1b[2m(função executando)\x1b[0m`);
  console.log("");
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
