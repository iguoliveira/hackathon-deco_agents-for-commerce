/**
 * Dry run do agente da vitrine. **Não grava nada, salvo com `--gravar`.**
 *
 *   npm run shelf:dryrun -- ams.igorfigueiredo@gmail.com
 *   npm run shelf:dryrun -- ams.igorfigueiredo@gmail.com --candidatos
 *   npm run shelf:dryrun -- ams.igorfigueiredo@gmail.com --gravar
 *
 * O padrão é não gravar porque o uso comum é iterar no prompt, e cada execução
 * sobrescreveria a vitrine boa da vez anterior por uma pior enquanto se
 * experimenta. `--gravar` é o modo "semear a demo".
 *
 * Existe porque a vitrine vai virar uma section diferida, e neste site
 * **status 200 não é sinal de saúde**: um loader que falha vira section vazia
 * e a página continua respondendo 200. Sem isto, a única forma de olhar a
 * saída do agente seria subir tudo e abrir o navegador — o que torna cada
 * iteração no prompt cara demais para valer a pena.
 *
 * É ferramenta de desenvolvimento antes de ser feature, e é por isso que foi
 * escrita antes da persistência e da tela.
 *
 * Imprime o título de cada item ao lado do handle de propósito: é assim que se
 * flagra o modelo afirmando "moletom cinza" sobre uma peça azul. Essa
 * conferência é humana e não dá para automatizar.
 */

process.loadEnvFile(".env");

import { readFileSync } from "node:fs";
import { montarEspacoDeEscolha } from "../src/platform/shelf/shelf.candidates";
import { montarVitrineDoEspaco } from "../src/platform/shelf/shelf.agent";
import { gravarVitrine } from "../src/platform/shelf/shelf.d1";

/**
 * `.dev.vars` guarda as credenciais do Decopilot em desenvolvimento.
 *
 * Não é carregado por ninguém automaticamente: o plugin de env do TanStack só
 * roda sob o Vite, e este script roda em tsx puro — o mesmo motivo pelo qual
 * `npm run preview` não enxergava o `.env`. Ausência não é erro: sem
 * credencial o agente cai no fallback determinístico, que também vale exibir.
 */
const carregarDevVars = (): void => {
  let conteudo: string;
  try {
    conteudo = readFileSync(".dev.vars", "utf8");
  } catch {
    console.warn("[dryrun] .dev.vars ausente — o agente vai cair no fallback por SQL");
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

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  const verCandidatos = args.includes("--candidatos");

  if (!email) {
    console.error("Passe o e-mail: npm run shelf:dryrun -- alguem@exemplo.com");
    process.exit(1);
  }

  carregarDevVars();

  const espaco = await montarEspacoDeEscolha(email);

  console.log(`\n=== DESEJOS DE ${email} ===`);
  if (espaco.desejos.length === 0) {
    console.log("(nenhum desejo pendente — ou não há alerta, ou o item já voltou ao estoque)");
    process.exit(0);
  }
  for (const [i, d] of espaco.desejos.entries()) {
    console.log(`${i === 0 ? "âncora " : "        "}${d.titulo} [${d.tamanho}] — ${d.tipo}`);
  }

  console.log(`\n=== ${espaco.candidatos.length} CANDIDATOS ===`);
  if (verCandidatos) {
    for (const c of espaco.candidatos) {
      const papel = c.mesmoTipo
        ? "ALTERNATIVA"
        : c.tagsEmComum.length >= 2
          ? "PARECIDO   "
          : "fraco      ";
      console.log(
        `  ${papel} ${c.titulo.padEnd(34)} tags=${c.tagsEmComum.length} <- ${c.paraODesejo}`,
      );
    }
  } else {
    console.log("(use --candidatos para listar)");
  }

  const inicio = Date.now();
  const vitrine = await montarVitrineDoEspaco(espaco, `dryrun ${email}`);
  const decorrido = ((Date.now() - inicio) / 1000).toFixed(1);

  if (args.includes("--gravar")) {
    const ancora = espaco.brutos[0];
    const ok = ancora ? await gravarVitrine(email, vitrine, ancora.variantId) : false;
    console.log(`\n[gravar] ${ok ? "gravada em `shelves`" : "FALHOU"}`);
  }

  const titulos = new Map(espaco.candidatos.map((c) => [c.handle, c.titulo]));

  console.log(`\n=== VITRINE (${vitrine.origem}, ${decorrido}s) ===`);
  if (vitrine.motivoDoFallback) console.log(`fallback: ${vitrine.motivoDoFallback}`);
  console.log(`"${vitrine.titulo}"   confiança ${vitrine.confianca}\n`);

  for (const item of vitrine.itens) {
    console.log(`  ${titulos.get(item.handle)}`);
    console.log(`    ${item.motivo || "(sem motivo — vitrine do SQL)"}`);
  }

  console.log("");
  process.exit(0);
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
