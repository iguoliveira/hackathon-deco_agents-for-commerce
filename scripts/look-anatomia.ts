/**
 * Anatomia de uma geração: o que entra na decisão, e quanto custa.
 *
 *   npm run look:anatomia
 *   npm run look:anatomia -- heavyweight-boxy-tee
 *
 * **Não chama o modelo.** Ele monta exatamente a mensagem que iria para o
 * Decopilot e a disseca — porque a pergunta "quanto custa uma section" não se
 * responde com o total, e sim com a repartição: quanto é instrução fixa, quanto
 * é catálogo, quanto é a pessoa.
 *
 * A contagem de tokens é **estimada** em 4 caracteres por token. O Decopilot não
 * expõe o contador, e a alternativa seria trazer um tokenizador para dentro do
 * projeto por causa de um número de apresentação. A estimativa erra para mais em
 * português (acentos custam mais de um byte, não mais de um token) — então trate
 * como teto, não como medida.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env o erro de DATABASE_URL que vem depois é o útil.
}

import { montarCandidatos } from "../src/platform/look/look.candidates";
import { acharAncora } from "../src/platform/look/look.d1";
import { montarMensagem, INSTRUCAO } from "../src/platform/look/look.prompt";
import { mesAtual } from "../src/platform/look/look.local";
import type { Contexto } from "../src/platform/look/look.types";

const TOKENS_POR_CARACTERE = 1 / 4;
const tokens = (texto: string): number => Math.round(texto.length * TOKENS_POR_CARACTERE);

const linha = (rotulo: string, texto: string, total: number): string => {
  const pct = Math.round((texto.length / total) * 100);
  const barra = "█".repeat(Math.max(1, Math.round(pct / 2.5)));
  return (
    `  ${rotulo.padEnd(26)} ${String(texto.length).padStart(6)} car  ` +
    `~${String(tokens(texto)).padStart(5)} tok  ${String(pct).padStart(3)}%  \x1b[2m${barra}\x1b[0m`
  );
};

const main = async (): Promise<void> => {
  const pedido = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "vintage-wash-tee";

  const alvo = await acharAncora(pedido);
  if (!alvo) {
    console.error(`\nNão achei \`${pedido}\`. Rode \`npm run db:migrate\` ou passe outro handle.\n`);
    process.exit(1);
  }

  const candidatos = await montarCandidatos(alvo.variantId);

  // Contexto sem sementes: é o piso do custo. Com sementes ele sobe, e a §
  // "o que a pessoa acrescenta" abaixo mede exatamente quanto.
  const semSementes: Contexto = {
    sementes: [],
    local: { cidade: "Porto Alegre", regiao: "RS", pais: "BR", origem: "padrao" },
    mes: mesAtual(),
  };

  const mensagem = montarMensagem(alvo.ancora, semSementes, candidatos);

  // ------------------------------------------------------------------
  console.log(`\n\x1b[1mANATOMIA — ${alvo.ancora.titulo}\x1b[0m`);
  console.log(`  tipo: ${alvo.ancora.tipo}   tags: ${alvo.ancora.tags.length}`);

  console.log(`\n\x1b[1mO ESPAÇO DE ESCOLHA\x1b[0m`);
  const tipos = new Map<string, number>();
  for (const c of candidatos) tipos.set(c.tipo, (tipos.get(c.tipo) ?? 0) + 1);
  console.log(`  ${candidatos.length} candidatos em ${tipos.size} tipos distintos`);
  console.log(
    `  afinidade: ${candidatos.filter((c) => c.tagsEmComum.length > 0).length} por tag, ` +
      `${candidatos.filter((c) => c.mesmaColecao).length} pela coleção`,
  );
  const semTag = candidatos.filter((c) => c.tagsEmComum.length === 0);
  if (semTag.length > 0) {
    console.log(
      `  \x1b[33m${semTag.length} entraram SÓ pela coleção\x1b[0m — para eles o sinal do ` +
        `guarda-roupa não pode disparar (ver look.candidates.ts)`,
    );
  }

  // Quanto de `tagsEmComum` é informação e quanto é o catálogo?
  //
  // `combinaComOGuardaRoupa` descarta tag presente em mais da metade do pool,
  // pelo argumento de que `everyday` em 65% do catálogo não distingue ninguém.
  // `tagsEmComum` NÃO passa por esse filtro — e é o eixo que o prompt chama de
  // "o mais forte de combina com". Este bloco mede se a assimetria custa algo.
  const frequencia = new Map<string, number>();
  for (const c of candidatos) {
    for (const tag of new Set(c.tagsEmComum)) frequencia.set(tag, (frequencia.get(tag) ?? 0) + 1);
  }
  const metade = candidatos.length / 2;
  const banais = [...frequencia].filter(([, n]) => n > metade).map(([t]) => t);
  const soBanais = candidatos.filter(
    (c) => c.tagsEmComum.length > 0 && c.tagsEmComum.every((t) => banais.includes(t)),
  );

  if (banais.length > 0) {
    console.log(
      `  tags banais no pool (>${Math.floor(metade)} dos ${candidatos.length}): ` +
        banais.map((t) => `${t}(${frequencia.get(t)})`).join(", "),
    );
    console.log(
      `  ${soBanais.length > 0 ? "\x1b[33m" : ""}${soBanais.length} candidato(s) cuja afinidade ` +
        `com a âncora é SÓ tag banal\x1b[0m` +
        (soBanais.length > 0 ? ` — ${soBanais.map((c) => c.titulo).join(", ").slice(0, 70)}` : ""),
    );
  }

  console.log(`\n\x1b[1mO QUE VAI PARA O MODELO\x1b[0m  (${mensagem.length} caracteres)`);
  const total = mensagem.length;
  const secao = (marca: string, fim?: string): string => {
    const i = mensagem.indexOf(marca);
    if (i < 0) return "";
    const j = fim ? mensagem.indexOf(fim, i) : -1;
    return mensagem.slice(i, j > 0 ? j : undefined);
  };

  console.log(linha("instrução (fixa)", INSTRUCAO, total));
  console.log(linha("a peça aberta", secao("## A PEÇA ABERTA", "## AS SEMENTES"), total));
  console.log(linha("sementes (nenhuma aqui)", secao("## AS SEMENTES", "## ONDE E QUANDO"), total));
  console.log(linha("lugar e mês", secao("## ONDE E QUANDO", "## CANDIDATOS"), total));
  console.log(linha("candidatos", secao("## CANDIDATOS"), total));
  console.log(`  ${"".padEnd(26)} ${String(total).padStart(6)} car  ~${tokens(mensagem)} tok  TOTAL`);

  // ------------------------------------------------------------------
  console.log(`\n\x1b[1mO QUE A PESSOA ACRESCENTA\x1b[0m`);
  const comUma: Contexto = {
    ...semSementes,
    sementes: [
      {
        productGroupId: "x",
        titulo: "Wide Leg Trousers",
        tipo: "Trousers",
        tags: ["everyday", "black"],
        kind: "purchased",
        em: new Date().toISOString(),
      },
    ],
  };
  const umaSemente = montarMensagem(alvo.ancora, comUma, candidatos).length - total;
  console.log(`  cada semente custa ~${umaSemente} caracteres (~${Math.round(umaSemente / 4)} tokens)`);
  console.log(`  com as 6 vagas cheias: ~${umaSemente * 6} car (~${Math.round((umaSemente * 6) / 4)} tok)`);
  console.log(
    `  \x1b[2m→ ${Math.round(((umaSemente * 6) / total) * 100)}% a mais que o piso; ` +
      `a personalização é barata perto do catálogo\x1b[0m`,
  );

  console.log(`\n\x1b[1mO QUE ISSO NÃO MEDE\x1b[0m`);
  console.log(`  A sobrecarga do próprio agente no Decopilot — system prompt e schemas`);
  console.log(`  das ferramentas ligadas a ele. Medida por terceiros em ~15.900 tokens,`);
  console.log(`  contra os ~${tokens(mensagem)} daqui: \x1b[1m${Math.round((15900 / (15900 + tokens(mensagem))) * 100)}% do custo não é o nosso texto.\x1b[0m`);
  console.log("");
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
