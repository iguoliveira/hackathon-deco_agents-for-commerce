/**
 * Dry run do agente de composição. **Não grava nada, salvo com `--gravar`.**
 *
 *   npm run look:dryrun -- vintage-wash-tee-black
 *   npm run look:dryrun -- vintage-wash-tee-black --cidade "Porto Alegre,RS,BR"
 *   npm run look:dryrun -- vintage-wash-tee-black --semente slim-chino --semente beanie
 *   npm run look:dryrun -- vintage-wash-tee-black --candidatos
 *   npm run look:dryrun -- vintage-wash-tee-black --gravar
 *
 * O padrão é não gravar porque o uso comum é iterar no prompt, e cada execução
 * sobrescreveria o look bom da vez anterior por um pior enquanto se experimenta.
 * `--gravar` é o modo "pré-aquecer o roteiro da demo".
 *
 * Existe porque a section é diferida, e neste site **status 200 não é sinal de
 * saúde**: um loader que falha vira section vazia e a página continua
 * respondendo 200. Sem isto, a única forma de olhar a saída do agente seria
 * subir tudo e abrir o navegador — o que torna cada iteração no prompt cara
 * demais para valer a pena. Lição de docs/agente-vitrine.md, não reaprendida.
 *
 * `--cidade` e `--semente` existem porque as duas coisas que esta feature
 * acrescentou ao agente são justamente as que **não dá para exercitar por
 * navegador sem montar a persona inteira**. Aqui se troca a cidade e se vê o
 * look mudar em segundos — que é o passo 8 do plano, feito no terminal antes de
 * ser feito no palco.
 *
 * Imprime o título e o tipo de cada peça ao lado do handle de propósito: é
 * assim que se flagra o modelo afirmando "moletom cinza" sobre uma peça azul, e
 * é assim que se vê que o look virou quatro calças. Essa conferência é humana e
 * não dá para automatizar.
 */

process.loadEnvFile(".env");

import { readFileSync } from "node:fs";
import { comporLook, jaComprados } from "../src/platform/look/look.agent";
import { montarCandidatos } from "../src/platform/look/look.candidates";
import { acharAncora, gravarLook } from "../src/platform/look/look.d1";
import { mesAtual } from "../src/platform/look/look.local";
import type { Contexto, Local, Semente } from "../src/platform/look/look.types";

/**
 * `.dev.vars` guarda as credenciais do Decopilot em desenvolvimento.
 *
 * Não é carregado por ninguém automaticamente: o plugin de env do TanStack só
 * roda sob o Vite, e este script roda em tsx puro. Ausência não é erro — sem
 * credencial o agente cai no fallback determinístico, que também vale exibir.
 */
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

/** Todos os valores de uma flag repetível: `--semente a --semente b`. */
const valoresDe = (args: string[], flag: string): string[] =>
  args.flatMap((arg, i) => (arg === flag && args[i + 1] ? [args[i + 1]] : []));

const lerCidade = (args: string[]): Local => {
  const cru = valoresDe(args, "--cidade")[0];
  if (!cru) return { cidade: "São Paulo", regiao: "SP", pais: "BR", origem: "padrao" };
  const [cidade = "", regiao = "", pais = ""] = cru.split(",").map((p) => p.trim());
  return { cidade, regiao, pais, origem: "seletor" };
};

/**
 * As sementes vêm por handle na linha de comando, e não por e-mail de persona.
 *
 * É o que permite testar o efeito do contexto **antes** de existir uma persona
 * semeada no banco: passar `--semente slim-chino` é dizer "finja que essa pessoa
 * comprou a calça". Semear a persona de verdade continua sendo o que a demo usa.
 */
const lerSementes = async (handles: string[]): Promise<Semente[]> => {
  const agora = new Date().toISOString();
  const sementes: Semente[] = [];

  for (const handle of handles) {
    const alvo = await acharAncora(handle);
    if (!alvo) {
      console.warn(`[dryrun] semente "${handle}" não existe no catálogo — ignorada`);
      continue;
    }
    sementes.push({
      productGroupId: alvo.ancora.productGroupId,
      titulo: alvo.ancora.titulo,
      tipo: alvo.ancora.tipo,
      cor: alvo.ancora.cor,
      kind: "purchased",
      em: agora,
    });
  }

  return sementes;
};

/** Flags que consomem o argumento seguinte — o valor delas não é o handle. */
const FLAGS_COM_VALOR = new Set(["--cidade", "--semente", "--mes"]);

/**
 * O primeiro argumento solto, ignorando valores de flag.
 *
 * O cuidado não é teórico: `--cidade "Porto Alegre,RS,BR"` passa um argumento
 * que não começa com `--`, e um `args.find(a => !a.startsWith("--"))` ingênuo o
 * pegaria como handle sempre que a flag viesse antes da peça.
 */
const lerHandle = (args: string[]): string | undefined => {
  for (const [i, arg] of args.entries()) {
    if (arg.startsWith("--")) continue;
    if (i > 0 && FLAGS_COM_VALOR.has(args[i - 1])) continue;
    return arg;
  }
  return undefined;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const handle = lerHandle(args);

  if (!handle) {
    console.error("Passe o handle da peça: npm run look:dryrun -- vintage-wash-tee-black");
    process.exit(1);
  }

  carregarDevVars();

  const alvo = await acharAncora(handle);
  if (!alvo) {
    console.error(`Peça "${handle}" não existe no catálogo.`);
    process.exit(1);
  }

  const contexto: Contexto = {
    sementes: await lerSementes(valoresDe(args, "--semente")),
    local: lerCidade(args),
    mes: valoresDe(args, "--mes")[0] ?? mesAtual(),
  };

  console.log(`\n=== A PEÇA ABERTA ===`);
  console.log(`${alvo.ancora.titulo}  [${alvo.ancora.tipo}]`);
  console.log(`tags: ${alvo.ancora.tags.join(", ") || "(nenhuma)"}`);

  console.log(`\n=== O CONTEXTO ===`);
  console.log(
    `lugar: ${[contexto.local.cidade, contexto.local.regiao, contexto.local.pais].filter(Boolean).join(", ")}  ·  mês: ${contexto.mes}`,
  );
  if (contexto.sementes.length === 0) {
    console.log("sementes: nenhuma (visitante sem histórico)");
  } else {
    for (const s of contexto.sementes) {
      console.log(`sementes: ${s.titulo} [${s.tipo}] — ${s.kind}`);
    }
  }

  const candidatos = await montarCandidatos(alvo.variantId, jaComprados(contexto));
  console.log(`\n=== ${candidatos.length} CANDIDATOS ===`);
  if (args.includes("--candidatos")) {
    // O tipo de cada candidato é o que se olha aqui: se a lista tiver seis
    // calças, o equilíbrio por tipo em look.candidates.ts não está pegando.
    for (const c of candidatos) {
      console.log(`  ${c.titulo.padEnd(36)} ${c.tipo.padEnd(18)} tags=${c.tagsEmComum.length}`);
    }
  } else {
    const tipos = [...new Set(candidatos.map((c) => c.tipo))];
    console.log(`(${tipos.length} tipos distintos — use --candidatos para listar)`);
  }

  if (candidatos.length === 0) {
    console.error(
      "\nSem candidatos: esta peça não compartilha tag nem coleção com nada disponível.",
    );
    process.exit(1);
  }

  const inicio = Date.now();
  const look = await comporLook(alvo.ancora, contexto, candidatos);
  const decorrido = ((Date.now() - inicio) / 1000).toFixed(1);

  const rotulo = new Map(candidatos.map((c) => [c.handle, `${c.titulo}  [${c.tipo}]`]));

  console.log(`\n=== O LOOK (${look.origem}, ${decorrido}s) ===`);
  if (look.motivoDoFallback) console.log(`fallback: ${look.motivoDoFallback}`);
  console.log(`\n"${look.titulo}"   confiança ${look.confianca}\n`);

  // Agrupa por ocasião do MESMO jeito que `montarBlocos` faz — com um Map, que
  // funde rótulos repetidos venham eles em que ordem vierem.
  //
  // A primeira versão imprimia um cabeçalho toda vez que o rótulo mudava em
  // relação à peça anterior, e isso MENTE: o modelo intercala ("frio", "dia a
  // dia", "frio"), então a mesma ocasião aparecia três vezes e o agrupamento
  // parecia quebrado quando não estava. Num script cujo propósito é ser a única
  // janela para a saída do agente, um print que não bate com a tela é pior que
  // print nenhum — manda ajustar um prompt que está certo.
  const porOcasiao = new Map<string, typeof look.pecas>();
  for (const peca of look.pecas) {
    porOcasiao.set(peca.ocasiao, [...(porOcasiao.get(peca.ocasiao) ?? []), peca]);
  }

  for (const [ocasiao, pecas] of porOcasiao) {
    console.log(`  ┌─ ${ocasiao}`);
    for (const peca of pecas) {
      console.log(`  │  ${rotulo.get(peca.handle)}`);
      console.log(`  │    ${peca.motivo || "(sem motivo — look do SQL)"}`);
    }
  }

  // O número de blocos é o sinal que se olha: um só significa que o modelo não
  // separou nada; seis ou mais viram ruído na tela.
  console.log(`\n  ${porOcasiao.size} bloco(s) · ${look.pecas.length} peça(s)`);

  if (args.includes("--gravar")) {
    // O hash aqui é fixo e explícito: gravar do dry run serve para pré-aquecer
    // um par (peça, contexto) do roteiro, e usar o hash real exigiria replicar
    // `hashDoContexto`, que é privado de propósito. Para o pré-aquecimento de
    // verdade, o caminho é abrir a PDP como a persona.
    const ok = await gravarLook(alvo.ancora.productGroupId, "dryrun", look);
    console.log(`\n[gravar] ${ok ? "gravado em `looks` (contexto_hash='dryrun')" : "FALHOU"}`);
  }

  console.log("");
  process.exit(0);
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
