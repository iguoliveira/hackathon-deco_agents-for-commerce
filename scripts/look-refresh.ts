/**
 * Força o look de hoje a ser recomposto. **Chama o modelo e grava.**
 *
 *   npm run look:refresh -- retro-code-tee
 *   npm run look:refresh -- retro-code-tee --email 123@gmail.com
 *   npm run look:refresh -- retro-code-tee --email 123@gmail.com --cidade "Porto Alegre,RS,BR"
 *   npm run look:refresh -- retro-code-tee --email 123@gmail.com --checar
 *
 * `--checar` responde "a PDP acharia look para hoje?" **sem gastar chamada** —
 * mesma chave e mesma consulta do caminho quente. Sai 1 se alguma peça estiver
 * fria, o que o torna usável como conferência de roteiro antes da demo.
 *
 * A chave do cache é (peça, pessoa, lugar, dia), então uma peça compõe **uma vez
 * por dia por pessoa** — o que é a feature, e não uma limitação a contornar:
 * refresh, navegação e volta à mesma PDP passaram a ser de graça.
 *
 * O preço é que favoritar algo às 14h não muda o look até amanhã. Isto aqui é a
 * válvula para esse preço, e o caso que a exige é **a própria demo**: mostrar a
 * wishlist mudando a composição exige recompor no mesmo dia.
 *
 * Sobrescreve a linha do dia (o `gravarLook` faz UPSERT na chave), então rodar
 * duas vezes não acumula lixo. Não mexe em nenhum outro dia nem em nenhuma outra
 * pessoa.
 *
 * **Aquece o par que a demo vai ler**, que é o que o `look:warm` não conseguia
 * fazer: com `--email`, o contexto é o da persona, e a chave também. Sem
 * `--email`, aquece o par anônimo — útil para a home, inútil para o roteiro.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env, o erro de DATABASE_URL que vem depois é o diagnóstico útil.
}

import { readFileSync } from "node:fs";
import { aquecerLook, chaveDoDia, diaDeHoje } from "../src/platform/look/look.actions";
import { acharAncora, lerLook } from "../src/platform/look/look.d1";
import type { Local } from "../src/platform/look/look.types";

/** O mesmo padrão de `localDaRequisicao()` fora de uma requisição. */
const PADRAO: Local = { cidade: "São Paulo", regiao: "SP", pais: "BR", origem: "padrao" };

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

const FLAGS_COM_VALOR = new Set(["--email", "--cidade"]);

const valorDe = (args: string[], flag: string): string | undefined =>
  args.flatMap((arg, i) => (arg === flag && args[i + 1] ? [args[i + 1]] : []))[0];

/** Os handles soltos, ignorando valores de flag — mesmo cuidado do dry run. */
const handlesDe = (args: string[]): string[] =>
  args.filter((arg, i) => !arg.startsWith("--") && !(i > 0 && FLAGS_COM_VALOR.has(args[i - 1]!)));

const lerCidade = (cru: string | undefined): Local | undefined => {
  if (!cru) return undefined;
  const [cidade = "", regiao = "", pais = ""] = cru.split(",").map((p) => p.trim());
  return { cidade, regiao, pais, origem: "seletor" };
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const handles = handlesDe(args);

  if (handles.length === 0) {
    console.error(
      "Passe ao menos uma peça:\n" +
        "  npm run look:refresh -- retro-code-tee --email 123@gmail.com",
    );
    process.exit(1);
  }

  carregarDevVars();

  const email = valorDe(args, "--email") ?? null;
  const local = lerCidade(valorDe(args, "--cidade"));
  const soChecar = args.includes("--checar");

  console.log(`\ndia ${diaDeHoje()} · ${email ?? "anônimo"}${local ? ` · ${local.cidade}` : ""}\n`);

  // `--checar` responde "a PDP acharia look para hoje?" **sem gastar chamada**.
  // É a mesma leitura que `lookDaPeca` faz no caminho quente: mesma chave, mesma
  // consulta. Existe para conferir o roteiro minutos antes da demo, quando
  // descobrir que algo está frio ainda dá tempo de aquecer — e para provar, em
  // teste, que uma peça já composta não recompõe.
  if (soChecar) {
    const chave = chaveDoDia(email, local ?? PADRAO);
    let frias = 0;

    for (const handle of handles) {
      const alvo = await acharAncora(handle);
      if (!alvo) {
        frias++;
        console.log(`  ? ${handle.padEnd(28)} não existe no catálogo`);
        continue;
      }

      const inicio = Date.now();
      const look = await lerLook(alvo.ancora.productGroupId, chave);
      const ms = Date.now() - inicio;

      if (look) {
        console.log(
          `  ✓ ${handle.padEnd(28)} quente  ${String(ms).padStart(4)}ms  "${look.titulo}"  ${look.pecas.length} peças`,
        );
      } else {
        frias++;
        console.log(`  ✗ ${handle.padEnd(28)} FRIA — a section não apareceria`);
      }
    }

    console.log(
      frias === 0
        ? `\nchave ${chave} · tudo quente para hoje.\n`
        : `\nchave ${chave} · ${frias} de ${handles.length} fria(s). Rode sem --checar para compor.\n`,
    );
    process.exit(frias === 0 ? 0 : 1);
  }

  let falhas = 0;
  for (const handle of handles) {
    const inicio = Date.now();
    // `email` explícito mesmo quando null: fora de uma request, deixar o padrão
    // agir devolveria `donoDaVitrine() === null` de qualquer forma, mas passá-lo
    // torna a intenção legível e a chave previsível.
    const look = await aquecerLook(handle, { email, local });
    const s = ((Date.now() - inicio) / 1000).toFixed(1);

    if (look) {
      console.log(`  ✓ ${handle.padEnd(28)} ${s}s  "${look.titulo}"  ${look.pecas.length} peças`);
    } else {
      falhas++;
      console.log(`  ✗ ${handle.padEnd(28)} ${s}s  sem look — peça inexistente ou modelo fora`);
    }
  }

  console.log(
    falhas === 0
      ? `\n${handles.length} peça(s) recomposta(s) para hoje.\n`
      : `\n${falhas} de ${handles.length} não recompuseram.\n`,
  );
  process.exit(falhas === 0 ? 0 : 1);
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
