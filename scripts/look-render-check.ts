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
 * **Precisa do cache quente, e o cache é diário.** Desde que o fallback por SQL
 * caiu, uma peça sem look gravado não renderiza — e desde que a chave passou a
 * ser (peça, pessoa, lugar, dia), o que estava quente ontem não está hoje. Rode
 * `npm run look:refresh -- <handle>` antes da primeira vez do dia. O script
 * detecta o caso e diz isso, em vez de acusar o slug de um erro que não cometeu.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env: o erro de "DATABASE_URL não definida" que vem depois é o útil.
}

import completeTheLookLoader from "../src/loaders/completeTheLook";
import { chaveDoDia, diaDeHoje, lookDaPeca } from "../src/platform/look/look.actions";
import { acharAncora } from "../src/platform/look/look.d1";
import { montarCandidatos } from "../src/platform/look/look.candidates";
import { consolidar, herdarDataReal } from "../src/platform/look/look.seeds";
import { localEmTexto, mesAtual } from "../src/platform/look/look.local";
import { lerVistos, serializarVistos, lerLocalEscolhido } from "../src/platform/look/look.cookies";
import { validar } from "../src/platform/look/look.agent";
import { validarPersona } from "../src/platform/look/persona.agent";
import { montarMensagemDaPersona } from "../src/platform/look/persona.prompt";
import { hashDosSinais } from "../src/platform/look/look.hash";
import { getDb } from "../src/platform/db";
import type { Candidato, Local, Semente } from "../src/platform/look/look.types";

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

/** Quantas linhas há em `looks`. É como o bloco 7c mede "não gerou nada". */
const contarLooks = async (): Promise<number> => {
  const db = getDb();
  if (!db) return -1;
  const { results } = await db.prepare(`SELECT count(*)::int AS n FROM looks`).all<{ n: number }>();
  return results[0]?.n ?? -1;
};

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
  titulo("3. O loader monta a section na home, com a peça vinda da prop");
  // ------------------------------------------------------------------
  // **Reescrito depois da #27**, que tirou a section da PDP e a pôs na home. O
  // bloco anterior chamava o loader com `__pageUrl` de PDP e afirmava que aquilo
  // devolvia look — o que o guarda `ehHome` agora recusa, corretamente. A #27
  // mudou o loader e não mexeu neste script, então o teste passou a exercitar um
  // caminho que a feature abandonou.
  //
  // Continua encenando o caminho diferido: fora de um RequestContext, a ÚNICA
  // coisa que o loader tem é `__pageUrl`. Se ele dependesse de
  // `RequestContext.request.url`, tudo abaixo voltaria null.
  const pelaHome = await completeTheLookLoader({
    handle,
    __pageUrl: "https://loja.exemplo.com/",
  });

  // `null` aqui tem mais de uma causa, e confundi-las manda consertar o arquivo
  // errado: o guarda pode ter recusado a página, o handle pode não ter
  // resolvido, ou o par (peça, dia) simplesmente não está no cache — que é o
  // caso comum, já que a chave inclui o dia desde a #30.
  if (pelaHome === null) {
    console.error(
      `\n  O loader devolveu null para \`${handle}\` na home, dia ${diaDeHoje()}.\n` +
        "  A causa mais provável NÃO é renderização: a chave do cache inclui o dia,\n" +
        "  então o que estava quente ontem não está hoje. Aqueça e rode de novo:\n\n" +
        `      npm run look:refresh -- ${handle}\n\n` +
        "  Se persistir depois de aquecer, aí sim é o loader — comece pelo guarda\n" +
        "  `ehHome` em src/loaders/completeTheLook.ts.\n",
    );
    process.exit(1);
  }

  ok(
    "home + handle na prop devolve look",
    pelaHome !== null,
    "o loader não montou a section — veja o guarda `ehHome` ou o `_serverFn`",
  );
  ok("o look tem blocos", (pelaHome?.blocos.length ?? 0) > 0);
  ok(
    "o look tem pelo menos 4 peças",
    (pelaHome?.blocos.reduce((s, b) => s + b.pecas.length, 0) ?? 0) >= 4,
  );
  ok(
    "cada peça carrega um produto renderizável (url + preço)",
    (pelaHome?.blocos ?? []).every((bloco) =>
      bloco.pecas.every((peca) => !!peca.product.url && !!peca.product.offers),
    ),
  );
  ok(
    "a procedência vem preenchida",
    !!pelaHome?.lugar && !!pelaHome?.mes,
    `lugar="${pelaHome?.lugar}" mes="${pelaHome?.mes}"`,
  );

  // O guarda da #27: fora da home, a section não existe — nem em PDP, que é
  // onde ela morava antes e de onde alguém pode tentar trazê-la de volta pelo
  // admin sem perceber que a decisão foi deliberada.
  ok(
    "PDP não monta a section, mesmo com handle válido",
    (await completeTheLookLoader({
      handle,
      __pageUrl: `https://loja.exemplo.com/products/${slugDaPdp}`,
    })) === null,
  );
  ok(
    "PLP também não",
    (await completeTheLookLoader({ handle, __pageUrl: "https://loja.exemplo.com/s?q=tee" })) ===
      null,
  );
  ok(
    "home sem handle devolve null em vez de adivinhar a peça",
    (await completeTheLookLoader({ __pageUrl: "https://loja.exemplo.com/" })) === null,
  );

  // A prop fixa continua servindo para fixar uma peça fora da PDP.
  ok(
    "prop `handle` explícita continua funcionando",
    (await completeTheLookLoader({ handle })) !== null,
  );

  // ------------------------------------------------------------------
  titulo("4. O que a section vai desenhar");
  // ------------------------------------------------------------------
  const look = pelaHome!;
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

  // As tags participam agora: `consolidar` as une, porque um "avise-me" chega
  // sem tags e a mesma peça vinda de uma compra chega com elas. Ficar com a
  // lista vazia por ordem de chegada empobreceria `combinaComOGuardaRoupa`.
  const sementes: Semente[] = [
    { productGroupId: "a", titulo: "A", tipo: "T", tags: [], kinds: ["recent"], em: "2026-08-01" },
    {
      productGroupId: "a",
      titulo: "A",
      tipo: "T",
      tags: ["black"],
      kinds: ["purchased"],
      em: "2026-07-01",
    },
  ];
  const consolidadas = consolidar(sementes);
  ok("a mesma peça por dois caminhos vira uma semente só", consolidadas.length === 1);
  ok(
    "e guarda AS DUAS origens, sem escolher vencedor",
    !!consolidadas[0] &&
      consolidadas[0].kinds.includes("purchased") &&
      consolidadas[0].kinds.includes("recent"),
  );
  ok("as tags das duas se unem", consolidadas[0]?.tags.includes("black") === true);
  ok("e o `em` fica com o sinal mais recente", consolidadas[0]?.em === "2026-08-01");

  // O cookie de favoritos não guarda QUANDO cada um foi feito, então chega
  // carimbado com o instante da requisição — que vence qualquer data real na
  // comparação de `consolidar`. `herdarDataReal` desarma isso antes.
  //
  // As três colisões são testadas separadamente porque a primeira versão da
  // correção só cobria a primeira: o conjunto era montado apenas com os
  // favoritos do banco, e compra e avise-me continuavam sendo atropelados.
  const agora = "2026-08-09T20:00:00Z";
  const doCookie: Semente[] = [
    { productGroupId: "p", titulo: "P", tipo: "T", tags: [], kinds: ["wishlist"], em: agora },
  ];
  const semente = (kind: Semente["kinds"][number], em: string): Semente => ({
    productGroupId: "p",
    titulo: "P",
    tipo: "T",
    tags: [],
    kinds: [kind],
    em,
  });

  for (const [kind, rotulo] of [
    ["purchased", "de uma compra"],
    ["waited", "de um avise-me"],
    ["wishlist", "de um favorito do banco"],
  ] as const) {
    const [herdada] = herdarDataReal(doCookie, [semente(kind, "2026-05-02T10:00:00Z")]);
    ok(`o cookie não sobrepõe a data ${rotulo}`, herdada?.em === "2026-05-02T10:00:00Z");
  }

  // E o que se ganha ao herdar em vez de descartar: a origem sobrevive.
  const misturada = consolidar([
    semente("purchased", "2026-05-02T10:00:00Z"),
    ...herdarDataReal(doCookie, [semente("purchased", "2026-05-02T10:00:00Z")]),
  ]);
  ok(
    "a peça comprada E favoritada mantém as duas origens",
    misturada[0]?.kinds.includes("purchased") === true &&
      misturada[0]?.kinds.includes("wishlist") === true,
  );
  ok("e a data continua sendo a da compra", misturada[0]?.em === "2026-05-02T10:00:00Z");

  // Favorito que só existe no cookie não tem data melhor — segue com `agora`.
  const soNoCookie = herdarDataReal(doCookie, []);
  ok("favorito só do cookie mantém o instante da requisição", soNoCookie[0]?.em === agora);

  // ------------------------------------------------------------------
  titulo("7b. A chave do cache é (pessoa, lugar, dia) — não muda ao navegar");
  // ------------------------------------------------------------------
  //
  // Este bloco existe por causa de um defeito que a suíte não pegava: enquanto
  // as sementes entravam na chave, `marcarVisita` gravava a peça aberta em
  // `deco_recent` DEPOIS de compor, e o segundo acesso à mesma PDP errava o
  // cache sempre. Navegar por N peças produzia da ordem de N² gerações de ~80s.
  //
  // Nada disso lançava, e o `typecheck` não tinha o que dizer — só aparecia na
  // conta do provedor e na latência de quem atualizava a página.
  const sp: Local = { cidade: "São Paulo", regiao: "SP", pais: "BR", origem: "padrao" };
  const poa: Local = { cidade: "Porto Alegre", regiao: "RS", pais: "BR", origem: "seletor" };
  const hoje = diaDeHoje();

  ok(
    "duas chamadas seguidas dão a mesma chave",
    chaveDoDia("ana@x.com", sp, hoje) === chaveDoDia("ana@x.com", sp, hoje),
  );
  ok(
    "e depende dos VALORES, não da identidade do objeto de lugar",
    // Duas visitas da mesma pessoa constroem `Local` novos a cada requisição.
    // Se a chave dependesse da referência, cada pageview seria um miss — que é
    // a forma que o bug antigo tomaria se voltasse por outro caminho.
    chaveDoDia("ana@x.com", { ...sp }, hoje) === chaveDoDia("ana@x.com", { ...sp }, hoje),
  );
  ok(
    "e a origem do lugar não entra na chave",
    // `origem` distingue "geo adivinhou" de "a pessoa escolheu no seletor". É
    // procedência para a tela, não parte de onde ela está — se entrasse, abrir o
    // seletor e reescolher a MESMA cidade recomporia o look.
    chaveDoDia("ana@x.com", sp, hoje) ===
      chaveDoDia("ana@x.com", { ...sp, origem: "seletor" }, hoje),
  );
  ok(
    "pessoas diferentes não dividem look",
    chaveDoDia("ana@x.com", sp, hoje) !== chaveDoDia("bruno@x.com", sp, hoje),
  );
  ok(
    "cidades diferentes não dividem look",
    chaveDoDia("ana@x.com", sp, hoje) !== chaveDoDia("ana@x.com", poa, hoje),
  );
  ok(
    "amanhã é outra chave — é o que faz o look ser diário",
    chaveDoDia("ana@x.com", sp, "2026-08-09") !== chaveDoDia("ana@x.com", sp, "2026-08-10"),
  );
  ok(
    "sem sessão todo mundo cai na mesma chave",
    chaveDoDia(null, sp, hoje) === chaveDoDia(null, sp, hoje),
  );

  // ------------------------------------------------------------------
  titulo("7c. Sem sessão, o agente não é acionado");
  // ------------------------------------------------------------------
  //
  // A regra 10 do §7: o público é o usuário logado. Sem identidade não há
  // armário, e o que sairia é o carrossel de relacionados que esta feature
  // existe para contradizer.
  //
  // O custo de não ter o guarda era o pior possível porque a section vive na
  // HOME: toda visita anônima disparava ~80s de modelo — bot, preview de link,
  // health check, aba esquecida aberta. O teto diário não protege disso, porque
  // o visitante anônimo é sempre outro.
  //
  // Este script roda fora de um RequestContext, então `donoDaVitrine()` devolve
  // `null` — é exatamente o caso anônimo, sem precisar forjar sessão.
  const antesDoAnonimo = await contarLooks();
  const semSessao = await lookDaPeca(handle);
  // Dá tempo de um disparo em background chegar ao banco, se houver. Sem esta
  // espera o teste passaria por medir cedo demais, que é a forma mais fácil de
  // um teste de "não aconteceu" mentir.
  await new Promise((r) => setTimeout(r, 1500));
  const depoisDoAnonimo = await contarLooks();

  ok(
    "visitante anônimo não dispara composição",
    depoisDoAnonimo === antesDoAnonimo,
    `looks foram de ${antesDoAnonimo} para ${depoisDoAnonimo} — o guarda de sessão caiu`,
  );
  ok(
    "e recebe o look aquecido quando existe, em vez de nada",
    // A assimetria é deliberada: ler é livre, gerar exige sessão. A home pública
    // mostra a feature sem que ninguém anônimo pague por ela.
    semSessao !== null,
    "não havia look aquecido para o par anônimo — rode `npm run look:refresh -- " +
      `${handle}\` e repita`,
  );

  // ------------------------------------------------------------------
  titulo("8. A persona não pode afirmar mais do que observou");
  // ------------------------------------------------------------------
  //
  // `validarPersona` é pura: resolve o retorno do modelo contra os sinais que o
  // geraram, sem tocar em banco nem em provedor. É por isso que a persona pode
  // ser verificada de verdade mesmo com o provedor sem token — o que NÃO dá
  // para verificar aqui é a qualidade do retrato, só o contrato.
  const armario: Semente[] = [
    {
      productGroupId: "p1",
      titulo: "Pleated Chino",
      tipo: "Pants",
      tags: ["black"],
      kinds: ["purchased"],
      em: "2026-08-01",
    },
    {
      productGroupId: "p2",
      titulo: "Ribbed Cardigan",
      tipo: "Knit",
      tags: ["black"],
      kinds: ["wishlist"],
      em: "2026-07-01",
    },
  ];

  const doModelo = [
    // legítimo: os dois títulos existem
    { eixo: "cor dominante", valor: "escuros", evidencia: ["Pleated Chino", "Ribbed Cardigan"] },
    // evidência PARCIALMENTE inventada — o eixo inteiro cai
    { eixo: "material", valor: "algodão", evidencia: ["Pleated Chino", "Linen Shirt"] },
    // evidência totalmente inventada
    { eixo: "caimento", valor: "solto", evidencia: ["Oversized Tee"] },
    // sem apoio nenhum: é opinião sobre a pessoa
    { eixo: "estilo", valor: "minimalista", evidencia: [] },
    // duplicata do primeiro eixo
    { eixo: "Cor Dominante", valor: "neutros", evidencia: ["Pleated Chino"] },
  ];

  const eixos = validarPersona(doModelo, armario);
  ok(
    "eixo com evidência real sobrevive",
    eixos.some((e) => e.eixo === "cor dominante"),
  );
  ok("eixo sem evidência nenhuma é descartado", !eixos.some((e) => e.eixo === "estilo"));
  ok("evidência inventada é descartada", !eixos.some((e) => e.eixo === "caimento"));
  ok("eixo repetido não entra duas vezes", eixos.length === 2, `${eixos.length} eixo(s)`);
  ok(
    "e o eixo que sobrou por evidência parcial só cita peça real",
    eixos.every((e) => e.evidencia.every((t) => armario.some((s) => s.titulo === t))),
  );
  ok(
    "lixo no lugar dos eixos vira lista vazia",
    validarPersona("nada disso", armario).length === 0,
  );

  // O hash dos sinais é a chave do cache da persona. Se ele mudar com a ORDEM,
  // a mesma pessoa sintetiza de novo a cada pageview — que é exatamente o laço
  // que a quarentena da #20 teve de consertar uma camada abaixo.
  ok(
    "o hash dos sinais não depende da ordem",
    hashDosSinais(armario) === hashDosSinais([...armario].reverse()),
  );
  ok(
    "mas muda quando um sinal novo chega na mesma peça",
    hashDosSinais(armario) !==
      hashDosSinais([{ ...armario[0]!, kinds: ["purchased", "wishlist"] }, armario[1]!]),
  );

  // O prompt da síntese não pode vazar id: o modelo não escolhe peça aqui, e um
  // id no texto é convite para ele devolver um.
  const mensagem = montarMensagemDaPersona(armario);
  ok("o prompt da persona não carrega productGroupId", !mensagem.includes("p1"));
  ok("e traduz o sinal para português", mensagem.includes("comprou"));

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
