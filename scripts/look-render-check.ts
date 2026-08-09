/**
 * Verificação do caminho de RENDERIZAÇÃO do look. **Não chama o modelo.**
 *
 *   npm run look:check
 *
 * O dry run (`look:dryrun`) exercita o agente: candidatos → prompt → validação.
 * Este script exercita o trecho que fica **entre a URL da PDP e o agente**, que
 * é onde a feature falhava em silêncio: o slug que o site gera não é o handle,
 * e o loader roda numa requisição que não é a da página.
 *
 * Nenhum dos dois defeitos aparecia no typecheck, no dry run ou numa chamada
 * direta a `lookDaPeca("handle")` — todas essas rotas entregam o handle puro,
 * que é justamente o caso que nunca acontece num clique de verdade.
 *
 * Sai 0 se tudo passar, 1 no primeiro erro real. Precisa de `DATABASE_URL`;
 * **não** precisa das `STUDIO_*`, porque não fala com o Decopilot.
 *
 * **Precisa do cache quente.** Desde que o fallback por SQL caiu, um par
 * (peça, contexto) sem look gravado não renderiza — então rode
 * `npm run look:warm -- <handle>` antes da primeira vez. O script detecta o caso
 * e diz isso, em vez de acusar o slug de um erro que não cometeu.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env: o erro de "DATABASE_URL não definida" que vem depois é o útil.
}

import completeTheLookLoader from "../src/loaders/completeTheLook";
import { lookDaPeca } from "../src/platform/look/look.actions";
import { acharAncora } from "../src/platform/look/look.d1";
import { montarCandidatos } from "../src/platform/look/look.candidates";
import { consolidar } from "../src/platform/look/look.seeds";
import { localEmTexto, mesAtual } from "../src/platform/look/look.local";
import { lerVistos, serializarVistos, lerLocalEscolhido } from "../src/platform/look/look.cookies";
import { validar } from "../src/platform/look/look.agent";
import type { Candidato, Semente } from "../src/platform/look/look.types";

let passaram = 0;
const falhas: string[] = [];

const ok = (nome: string, condicao: boolean, detalhe = ""): void => {
  if (condicao) {
    passaram++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } else {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}${detalhe ? `\n      ${detalhe}` : ""}`);
  }
};

const titulo = (texto: string): void => console.log(`\n\x1b[1m${texto}\x1b[0m`);

/** O sufixo que `catalog.mapper.ts:productPath` anexa em TODO link do site. */
const numeroDaVariante = (variantId: string): string => variantId.split("/").pop() ?? variantId;

const main = async (): Promise<void> => {
  // ------------------------------------------------------------------
  // Uma peça real do catálogo, para não testar contra fixture inventada
  // ------------------------------------------------------------------
  const pedido = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "vintage-wash-tee";
  const ancora = await acharAncora(pedido);
  if (!ancora) {
    console.error(
      `\nNão achei \`${pedido}\` no catálogo — o banco está vazio ou é outro.\n` +
        "Rode `npm run db:migrate` antes, ou passe outra peça: npm run look:check -- <handle>",
    );
    process.exit(1);
  }

  const handle = ancora.ancora.handle;
  const slugDaPdp = `${handle}-${numeroDaVariante(ancora.variantId)}`;

  titulo(`Âncora: ${ancora.ancora.titulo}`);
  console.log(`  handle:  ${handle}`);
  console.log(`  slug PDP: ${slugDaPdp}   (é este que chega pela URL)`);

  // ------------------------------------------------------------------
  titulo("1. acharAncora aceita o slug que o site realmente gera");
  // ------------------------------------------------------------------
  const porSlug = await acharAncora(slugDaPdp);
  ok(
    "slug com sufixo de variante resolve",
    porSlug !== null,
    `acharAncora("${slugDaPdp}") devolveu null — a section sumiria em todo clique`,
  );
  ok(
    "resolve para o MESMO produto que o handle puro",
    porSlug?.ancora.productGroupId === ancora.ancora.productGroupId,
  );
  ok("handle puro continua funcionando", (await acharAncora(handle)) !== null);
  ok("slug inexistente devolve null", (await acharAncora("nao-existe-isto-aqui-123")) === null);
  ok("slug vazio devolve null", (await acharAncora("")) === null);

  // ------------------------------------------------------------------
  titulo("2. A precedência protege handle legítimo terminado em número");
  // ------------------------------------------------------------------
  // O caso que fez `getProductDetailsPage` inverter a ordem: existe um produto
  // cujo handle TERMINA em número e não é variante de nada. Se a regex viesse
  // primeiro, ele resolveria para o produto errado, sem erro nenhum.
  const terminaEmNumero = await acharAncora("high-top-canvas-shoes-1");
  if (terminaEmNumero) {
    ok(
      "handle terminado em número resolve para si mesmo",
      terminaEmNumero.ancora.handle === "high-top-canvas-shoes-1",
      `resolveu para "${terminaEmNumero.ancora.handle}" — a regex ganhou do handle exato`,
    );
  } else {
    console.log("  \x1b[33m-\x1b[0m  `high-top-canvas-shoes-1` não está neste catálogo, pulando");
  }

  // ------------------------------------------------------------------
  titulo("3. O loader lê o slug de __pageUrl, não da requisição corrente");
  // ------------------------------------------------------------------
  // Este é o teste que encena o caminho diferido: fora de um RequestContext,
  // a ÚNICA coisa que o loader tem é `__pageUrl`. Se ele dependesse de
  // `RequestContext.request.url`, tudo abaixo voltaria null.
  const pelaPagina = await completeTheLookLoader({
    __pageUrl: `https://loja.exemplo.com/products/${slugDaPdp}`,
  });

  // Sem o fallback por SQL, `null` aqui tem DUAS causas possíveis, e confundi-las
  // manda consertar o arquivo errado: ou o slug não resolveu (o bug que este
  // script existe para pegar), ou o par (peça, contexto) simplesmente não está
  // no cache. Este script roda do terminal, então o contexto é sempre
  // "visitante sem histórico em São Paulo" — o mesmo que `look:warm` aquece.
  if (pelaPagina === null) {
    console.error(
      `\n  Não há look gravado para \`${handle}\` no contexto deste terminal.\n` +
        "  Isso NÃO é falha de renderização — desde que o fallback por SQL caiu, a\n" +
        "  section só aparece com o cache quente. Aqueça e rode de novo:\n\n" +
        `      npm run look:warm -- ${handle}\n`,
    );
    process.exit(1);
  }

  ok(
    "PDP via __pageUrl devolve look",
    pelaPagina !== null,
    "o loader não recuperou o slug — voltou ao bug do `_serverFn`",
  );
  ok("o look tem blocos", (pelaPagina?.blocos.length ?? 0) > 0);
  ok(
    "o look tem pelo menos 4 peças",
    (pelaPagina?.blocos.reduce((s, b) => s + b.pecas.length, 0) ?? 0) >= 4,
  );
  ok(
    "cada peça carrega um produto renderizável (url + preço)",
    (pelaPagina?.blocos ?? []).every((bloco) =>
      bloco.pecas.every((peca) => !!peca.product.url && !!peca.product.offers),
    ),
  );
  ok(
    "a procedência vem preenchida",
    !!pelaPagina?.lugar && !!pelaPagina?.mes,
    `lugar="${pelaPagina?.lugar}" mes="${pelaPagina?.mes}"`,
  );

  // Uma URL que NÃO é de produto não pode virar look.
  ok(
    "URL de PLP não vira look",
    (await completeTheLookLoader({ __pageUrl: "https://loja.exemplo.com/s?q=tee" })) === null,
  );
  ok("sem __pageUrl e sem RequestContext devolve null", (await completeTheLookLoader({})) === null);

  // A prop fixa continua servindo para fixar uma peça fora da PDP.
  ok(
    "prop `handle` explícita continua funcionando",
    (await completeTheLookLoader({ handle })) !== null,
  );

  // ------------------------------------------------------------------
  titulo("4. O que a section vai desenhar");
  // ------------------------------------------------------------------
  const look = pelaPagina!;
  console.log(`  "${look.titulo}"   sementes: ${look.sementes}`);
  console.log(`  procedência: ${look.lugar} em ${look.mes}`);
  for (const bloco of look.blocos) {
    console.log(`  ┌─ ${bloco.ocasiao}`);
    for (const peca of bloco.pecas) {
      // A MESMA precedência de `ProductCard.tsx:52` (`isVariantOf?.name ??
      // product.name`). Imprimir `product.name` cru mostraria "XS" e "White",
      // que são títulos de variante — o script diria que a tela está quebrada
      // quando ela não está. Mesmo erro que o agrupamento do dry run cometia.
      console.log(`  │  ${peca.product.isVariantOf?.name ?? peca.product.name}`);
      if (peca.motivo) console.log(`  │    ${peca.motivo}`);
    }
  }

  ok(
    "nenhum bloco vazio chega à tela",
    look.blocos.every((bloco) => bloco.pecas.length > 0),
  );
  ok(
    "as ocasiões não se repetem entre blocos",
    new Set(look.blocos.map((b) => b.ocasiao)).size === look.blocos.length,
    "duas entradas com o mesmo rótulo viram dois cabeçalhos iguais na tela",
  );
  ok(
    "nenhuma peça duplicada no look inteiro",
    (() => {
      const ids = look.blocos.flatMap((b) => b.pecas.map((p) => p.product.productID));
      return new Set(ids).size === ids.length;
    })(),
  );
  // A invariante que substituiu o fallback: se chegou look, TODA peça tem
  // motivo. Não há mais o estado "look sem texto" — ver look.types.ts → `Look`.
  ok(
    "toda peça na tela carrega um motivo",
    look.blocos.every((bloco) => bloco.pecas.every((peca) => peca.motivo.trim().length > 0)),
    "peça sem motivo é o carrossel genérico que esta feature existe para não ser",
  );

  // ------------------------------------------------------------------
  titulo("5. O cookie de vistos guarda handle, não slug");
  // ------------------------------------------------------------------
  // Se o loader gravasse o slug da URL, `sementesPorHandle` (que casa
  // `p.handle`) nunca resolveria a semente e o cookie viraria lixo silencioso.
  const cookieCru = serializarVistos([], handle);
  ok("serializa com o handle canônico", cookieCru.includes(encodeURIComponent(handle)));
  const req = new Request("https://loja.exemplo.com/", {
    headers: { cookie: cookieCru.split(";")[0]! },
  });
  ok("e volta legível", lerVistos(req)[0] === handle);
  ok(
    "cookie corrompido vira lista vazia",
    lerVistos(
      new Request("https://x/", {
        headers: { cookie: "deco_recent=%7Bnao-json" },
      }),
    ).length === 0,
  );
  ok(
    "teto de 8 respeitado",
    (() => {
      let vistos: string[] = [];
      for (let i = 0; i < 12; i++) {
        const c = serializarVistos(vistos, `peca-${i}`);
        vistos = lerVistos(new Request("https://x/", { headers: { cookie: c.split(";")[0]! } }));
      }
      return vistos.length === 8 && vistos[0] === "peca-11";
    })(),
  );

  // ------------------------------------------------------------------
  titulo("6. O seletor de cidade: cookie ida e volta");
  // ------------------------------------------------------------------
  const comLocal = new Request("https://x/", {
    headers: {
      cookie: `deco_local=${encodeURIComponent(JSON.stringify({ cidade: "Recife", regiao: "PE", pais: "BR" }))}`,
    },
  });
  const escolhido = lerLocalEscolhido(comLocal);
  ok("cidade escolhida volta do cookie", escolhido?.cidade === "Recife");
  ok("e marcada como origem `seletor`", escolhido?.origem === "seletor");
  ok(
    "vira o texto que vai ao prompt",
    localEmTexto(escolhido!) === "Recife, PE, BR",
    `veio "${escolhido ? localEmTexto(escolhido) : ""}"`,
  );
  ok(
    "cookie sem cidade é ignorado",
    lerLocalEscolhido(
      new Request("https://x/", {
        headers: { cookie: `deco_local=${encodeURIComponent(JSON.stringify({ regiao: "PE" }))}` },
      }),
    ) === null,
  );
  ok("mês sai por extenso, em português", /^[a-zç]+$/.test(mesAtual()), mesAtual());

  // ------------------------------------------------------------------
  titulo("7. Invariantes que a renderização não pode quebrar");
  // ------------------------------------------------------------------
  const candidatos = await montarCandidatos(ancora.variantId);
  ok("o pool tem candidatos", candidatos.length > 0, `${candidatos.length}`);
  ok(
    "nenhum candidato é a própria âncora",
    candidatos.every((c: Candidato) => c.handle !== handle),
  );

  // A validação continua descartando, nunca corrigindo — o contrato do agente
  // não pode afrouxar por causa da tela.
  const forjado = [
    { handle: candidatos[0]!.handle, motivo: "combina", ocasiao: "para o frio" },
    { handle: `${candidatos[0]!.handle}x`, motivo: "quase certo", ocasiao: "x" },
    { handle: candidatos[1]?.handle, motivo: "   ", ocasiao: "y" },
  ];
  const validadas = validar(forjado, candidatos);
  ok("handle inventado é descartado", !validadas.some((p) => p.handle.endsWith("x")));
  ok("peça sem motivo é descartada", validadas.length === 1);

  const sementes: Semente[] = [
    { productGroupId: "a", titulo: "A", tipo: "T", cor: null, kind: "recent", em: "2026-08-01" },
    { productGroupId: "a", titulo: "A", tipo: "T", cor: null, kind: "purchased", em: "2026-07-01" },
  ];
  ok("a mesma peça por dois caminhos vira uma semente só", consolidar(sementes).length === 1);
  ok("e fica com a origem mais forte", consolidar(sementes)[0]?.kind === "purchased");

  // ------------------------------------------------------------------
  console.log(
    `\n\x1b[1m${passaram} asserção(ões) passaram${falhas.length ? `, ${falhas.length} falharam\x1b[0m` : "\x1b[0m"}`,
  );
  if (falhas.length) {
    for (const falha of falhas) console.log(`  \x1b[31m✗\x1b[0m ${falha}`);
    process.exit(1);
  }
  process.exit(0);
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
