/**
 * Avaliação do agente de composição. **Não grava nada no banco, nunca.**
 *
 *   npm run look:eval -- --rotulo antes
 *   npm run look:eval -- --rotulo depois --n 5
 *   npm run look:eval -- --comparar antes depois
 *   npm run look:eval -- --so preta-concordante
 *
 * Existe por um motivo que o `look:dryrun` não cobre: **o modelo não é
 * determinístico.** `perguntar()` não expõe temperatura nem seed, então duas
 * execuções idênticas devolvem looks diferentes. Uma execução por condição é
 * anedota — se as peças mudarem entre o antes e o depois, não dá para saber se
 * foi o prompt ou o ruído.
 *
 * O dry run responde "o que o agente diz?". Este responde "o que ele diz
 * ESTAVELMENTE, e o que mudou quando eu mexi no prompt?".
 *
 * O número que decide se a comparação vale é a **estabilidade**: a fração de
 * peças que aparece em TODAS as repetições de uma condição. Estabilidade baixa
 * significa que o ruído domina e que N precisa crescer antes de qualquer
 * conclusão sobre seleção.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env o erro útil vem do driver, não daqui. Mesma lição de db-url.ts:29
  // — e o oposto do que look-dryrun.ts:34 faz, que morre com ENOENT antes de
  // dizer qualquer coisa.
}

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { comporLook, jaComprados } from "../src/platform/look/look.agent";
import { montarCandidatos } from "../src/platform/look/look.candidates";
import { acharAncora } from "../src/platform/look/look.d1";
import { mesAtual } from "../src/platform/look/look.local";
import type { Contexto, Local, Semente } from "../src/platform/look/look.types";

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
    const i = limpa.indexOf("=");
    if (i <= 0) continue;
    const chave = limpa.slice(0, i).trim();
    if (!process.env[chave]) process.env[chave] = limpa.slice(i + 1).trim();
  }
};

const SAIDA = ".eval";

/**
 * Termos de cor em português, para detectar quando um motivo fala de cor.
 *
 * **Esta lista é da FERRAMENTA, e não pode migrar para `src/`.** A §1 de
 * personal-shopping-agent-mudancas.md proíbe literal de catálogo no produto, e
 * é justamente por isso que a cor vai crua ao prompt. Aqui a regra não se
 * aplica pelo mesmo motivo que um teste pode conhecer o resultado esperado: o
 * medidor não é o medido.
 *
 * Não dá para derivar do catálogo: lá as cores estão em inglês (`Black`,
 * `Cream`) e os motivos saem em português ("preto", "creme").
 */
const TERMOS_DE_COR = [
  "pret", "branc", "cinz", "cinza", "bege", "creme", "marrom", "azul", "verde",
  "vermelh", "amarel", "laranj", "rosa", "roxo", "lilás", "vinho", "caqui",
  "oliva", "areia", "off-white", "neutr", "terros", "sóbri", "paleta", "tom ",
  "tons", "cor ", "cores", "colorid", "monocrom", "escur", "clar",
];

const citaCor = (motivo: string): boolean => {
  const m = motivo.toLowerCase();
  return TERMOS_DE_COR.some((t) => m.includes(t));
};

// ---------------------------------------------------------------------------
// As condições
// ---------------------------------------------------------------------------

interface Condicao {
  nome: string;
  /** A peça aberta. */
  ancora: string;
  /** Handles tratados como compra. ATENÇÃO: saem do pool (ver `jaComprados`). */
  sementes: string[];
  cidade: Local;
  descricao: string;
}

const SP: Local = { cidade: "São Paulo", regiao: "SP", pais: "BR", origem: "seletor" };

/**
 * Quatro condições, desenhadas para isolar o eixo cor.
 *
 * As três primeiras compartilham a âncora (uma tee preta) e variam só as
 * sementes — é a única forma de atribuir diferença ao histórico. A quarta troca
 * a âncora por uma peça de cor forte, para não afinarmos o prompt inteiro em
 * cima de preto e descobrirmos tarde que ele só funciona em neutro.
 */
const CONDICOES: Condicao[] = [
  {
    nome: "preta-sem-sementes",
    ancora: "heavyweight-boxy-tee",
    sementes: [],
    cidade: SP,
    descricao: "visitante anônimo — só a âncora pode informar cor",
  },
  {
    nome: "preta-concordante",
    ancora: "heavyweight-boxy-tee",
    sementes: ["pleated-chino", "tailored-blazer", "faux-leather-biker"],
    cidade: SP,
    descricao: "três compras, todas Black — a paleta existe e é óbvia",
  },
  {
    nome: "preta-dispersa",
    ancora: "heavyweight-boxy-tee",
    sementes: ["pleated-chino", "cardigan-open-knit", "trail-sneakers"],
    cidade: SP,
    descricao: "Black + Cream + Red — CONTROLE: aqui o agente deve se calar sobre paleta",
  },
  {
    nome: "laranja-sem-sementes",
    ancora: "cropped-zip-hoodie",
    sementes: [],
    cidade: SP,
    descricao: "âncora de cor forte — o prompt não pode servir só a neutro",
  },
];

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

interface Execucao {
  handles: string[];
  ocasioes: string[];
  confianca: number;
  titulo: string;
  /** Tipos distintos entre as peças escolhidas — o antídoto do "quatro calças". */
  tiposDistintos: number;
  motivosComCor: number;
  totalMotivos: number;
  segundos: number;
}

interface ResultadoCondicao {
  nome: string;
  descricao: string;
  ancora: string;
  /** Quantos candidatos o SQL ofereceu. Muda entre condições porque as sementes
   *  `purchased` saem do pool — sem isto, comparar condições engana. */
  tamanhoDoPool: number;
  /** Execuções em que o modelo não devolveu look. Instabilidade da condição. */
  falhas: number;
  execucoes: Execucao[];
}

const sementesDe = async (handles: string[]): Promise<Semente[]> => {
  const agora = new Date().toISOString();
  const out: Semente[] = [];
  for (const handle of handles) {
    const alvo = await acharAncora(handle);
    if (!alvo) {
      console.warn(`  ! semente "${handle}" não existe — ignorada`);
      continue;
    }
    out.push({
      productGroupId: alvo.ancora.productGroupId,
      titulo: alvo.ancora.titulo,
      tipo: alvo.ancora.tipo,
      // As tags e não a cor: desde a #16 o armário chega ao modelo com os
      // mesmos sinais calculados que os candidatos já tinham, e é delas que
      // sai `combinaComOGuardaRoupa`. Forjar semente sem tags aqui produziria
      // um armário mudo e mediria o agente errado.
      tags: alvo.ancora.tags,
      kind: "purchased",
      em: agora,
    });
  }
  return out;
};

const rodarCondicao = async (cond: Condicao, n: number): Promise<ResultadoCondicao | null> => {
  const alvo = await acharAncora(cond.ancora);
  if (!alvo) {
    console.error(`Âncora "${cond.ancora}" não existe no catálogo.`);
    return null;
  }

  const contexto: Contexto = {
    sementes: await sementesDe(cond.sementes),
    local: cond.cidade,
    mes: mesAtual(),
  };

  const candidatos = await montarCandidatos(alvo.variantId, jaComprados(contexto));

  console.log(`\n### ${cond.nome}`);
  console.log(`    ${cond.descricao}`);
  console.log(`    âncora: ${alvo.ancora.titulo} · pool: ${candidatos.length} candidatos`);

  const execucoes: Execucao[] = [];
  let falhas = 0;
  for (let i = 1; i <= n; i++) {
    const inicio = Date.now();
    const look = await comporLook(alvo.ancora, contexto, candidatos);
    const segundos = (Date.now() - inicio) / 1000;

    // Desde "ou o look é do agente, ou a section não aparece", `comporLook`
    // devolve `null` quando o modelo falha, se recusa ou responde lixo — não há
    // mais fallback por SQL. Para a avaliação isso é dado, não erro: uma
    // condição que falha muito é uma condição instável, e registrar a falha é
    // mais honesto que descartá-la da amostra.
    if (!look) {
      falhas++;
      console.log(`    [${i}/${n}] FALHOU — sem look (modelo indisponível ou recusou)`);
      continue;
    }

    const porHandle = new Map(candidatos.map((c) => [c.handle, c]));
    const tipos = new Set(
      look.pecas.map((p) => porHandle.get(p.handle)?.tipo).filter(Boolean) as string[],
    );
    const comCor = look.pecas.filter((p) => p.motivo && citaCor(p.motivo)).length;

    execucoes.push({
      handles: look.pecas.map((p) => p.handle),
      ocasioes: [...new Set(look.pecas.map((p) => p.ocasiao))],
      confianca: look.confianca,
      titulo: look.titulo,
      tiposDistintos: tipos.size,
      motivosComCor: comCor,
      totalMotivos: look.pecas.filter((p) => p.motivo).length,
      segundos,
    });

    console.log(
      `    [${i}/${n}] ${look.pecas.length} peças · ${tipos.size} tipos · ` +
        `conf ${look.confianca} · cor em ${comCor}/${look.pecas.length} · ${segundos.toFixed(1)}s`,
    );
  }

  return {
    nome: cond.nome,
    descricao: cond.descricao,
    ancora: alvo.ancora.titulo,
    tamanhoDoPool: candidatos.length,
    falhas,
    execucoes,
  };
};

// ---------------------------------------------------------------------------
// Estabilidade — o número que valida (ou invalida) qualquer comparação
// ---------------------------------------------------------------------------

/**
 * Núcleo = peças presentes em TODAS as repetições. União = presentes em alguma.
 *
 * A razão entre os dois é o quanto do look é escolha e o quanto é sorteio. Sem
 * este número, uma diferença entre antes e depois não significa nada.
 */
const estabilidade = (execs: Execucao[]) => {
  if (execs.length === 0) return { nucleo: [] as string[], uniao: [] as string[], taxa: 0 };
  const uniao = new Set<string>();
  for (const e of execs) for (const h of e.handles) uniao.add(h);
  const nucleo = [...uniao].filter((h) => execs.every((e) => e.handles.includes(h)));
  return { nucleo, uniao: [...uniao], taxa: uniao.size ? nucleo.length / uniao.size : 0 };
};

const media = (ns: number[]): number => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);

const resumir = (r: ResultadoCondicao) => {
  const est = estabilidade(r.execucoes);
  const motivos = r.execucoes.reduce((s, e) => s + e.totalMotivos, 0);
  const comCor = r.execucoes.reduce((s, e) => s + e.motivosComCor, 0);
  return {
    condicao: r.nome,
    pool: r.tamanhoDoPool,
    pecas: media(r.execucoes.map((e) => e.handles.length)).toFixed(1),
    tipos: media(r.execucoes.map((e) => e.tiposDistintos)).toFixed(1),
    blocos: media(r.execucoes.map((e) => e.ocasioes.length)).toFixed(1),
    confianca: media(r.execucoes.map((e) => e.confianca)).toFixed(2),
    estabilidade: `${est.nucleo.length}/${est.uniao.length} (${(est.taxa * 100).toFixed(0)}%)`,
    corNosMotivos: motivos ? `${comCor}/${motivos} (${((comCor / motivos) * 100).toFixed(0)}%)` : "—",
    segundos: media(r.execucoes.map((e) => e.segundos)).toFixed(1),
  };
};

// ---------------------------------------------------------------------------
// Comparação entre duas rodadas
// ---------------------------------------------------------------------------

const comparar = (antes: ResultadoCondicao[], depois: ResultadoCondicao[]): void => {
  console.log("\n\n=== COMPARAÇÃO ===\n");
  for (const a of antes) {
    const d = depois.find((x) => x.nome === a.nome);
    if (!d) continue;

    const ea = estabilidade(a.execucoes);
    const ed = estabilidade(d.execucoes);
    const entrou = ed.nucleo.filter((h) => !ea.nucleo.includes(h));
    const saiu = ea.nucleo.filter((h) => !ed.nucleo.includes(h));

    console.log(`### ${a.nome}`);
    if (a.tamanhoDoPool !== d.tamanhoDoPool) {
      console.log(`  ! pool mudou (${a.tamanhoDoPool} -> ${d.tamanhoDoPool}) — comparação suspeita`);
    }
    console.log(`  núcleo antes : ${ea.nucleo.length}/${ea.uniao.length}`);
    console.log(`  núcleo depois: ${ed.nucleo.length}/${ed.uniao.length}`);
    console.log(`  entrou no núcleo: ${entrou.length ? entrou.join(", ") : "(nada)"}`);
    console.log(`  saiu do núcleo  : ${saiu.length ? saiu.join(", ") : "(nada)"}`);

    const mc = (r: ResultadoCondicao) => {
      const t = r.execucoes.reduce((s, e) => s + e.totalMotivos, 0);
      const c = r.execucoes.reduce((s, e) => s + e.motivosComCor, 0);
      return t ? ((c / t) * 100).toFixed(0) : "—";
    };
    console.log(`  cor nos motivos : ${mc(a)}% -> ${mc(d)}%`);
    console.log(
      `  tipos distintos : ${media(a.execucoes.map((e) => e.tiposDistintos)).toFixed(1)}` +
        ` -> ${media(d.execucoes.map((e) => e.tiposDistintos)).toFixed(1)}`,
    );
    console.log(
      `  confiança       : ${media(a.execucoes.map((e) => e.confianca)).toFixed(2)}` +
        ` -> ${media(d.execucoes.map((e) => e.confianca)).toFixed(2)}\n`,
    );
  }
};

const ler = (rotulo: string): ResultadoCondicao[] =>
  JSON.parse(readFileSync(`${SAIDA}/${rotulo}.json`, "utf8"));

// ---------------------------------------------------------------------------

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const valor = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const paraComparar = args.indexOf("--comparar");
  if (paraComparar !== -1) {
    comparar(ler(args[paraComparar + 1]), ler(args[paraComparar + 2]));
    process.exit(0);
  }

  carregarDevVars();

  const n = Number(valor("--n") ?? 3);
  const rotulo = valor("--rotulo") ?? "sem-rotulo";
  const so = valor("--so");
  const condicoes = so ? CONDICOES.filter((c) => c.nome === so) : CONDICOES;

  if (condicoes.length === 0) {
    console.error(`Condição "${so}" não existe. Disponíveis: ${CONDICOES.map((c) => c.nome).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n=== AVALIAÇÃO "${rotulo}" · ${condicoes.length} condições × ${n} repetições ===`);
  console.log(`(estimativa: ~${Math.round((condicoes.length * n * 30) / 60)} min)`);

  const resultados: ResultadoCondicao[] = [];
  for (const cond of condicoes) {
    const r = await rodarCondicao(cond, n);
    if (r) resultados.push(r);
  }

  console.log("\n\n=== RESUMO ===\n");
  console.table(resultados.map(resumir));

  console.log("\n=== NÚCLEO ESTÁVEL POR CONDIÇÃO ===");
  for (const r of resultados) {
    const est = estabilidade(r.execucoes);
    console.log(`\n${r.nome}  (${est.nucleo.length} de ${est.uniao.length} peças)`);
    for (const h of est.nucleo) console.log(`  = ${h}`);
    for (const h of est.uniao.filter((x) => !est.nucleo.includes(x))) console.log(`  ~ ${h}`);
  }

  if (!existsSync(SAIDA)) mkdirSync(SAIDA, { recursive: true });
  writeFileSync(`${SAIDA}/${rotulo}.json`, JSON.stringify(resultados, null, 2));
  console.log(`\n\nSalvo em ${SAIDA}/${rotulo}.json`);
  console.log(`Compare depois com: npm run look:eval -- --comparar ${rotulo} <outro>\n`);

  process.exit(0);
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
