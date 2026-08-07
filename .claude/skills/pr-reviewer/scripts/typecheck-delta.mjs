#!/usr/bin/env node
/**
 * Roda o typecheck no merge-base E no head de uma PR, e imprime só a diferença.
 *
 *   node .claude/skills/pr-reviewer/scripts/typecheck-delta.mjs --pr 6
 *   node .claude/skills/pr-reviewer/scripts/typecheck-delta.mjs --head minha-branch
 *   node .claude/skills/pr-reviewer/scripts/typecheck-delta.mjs --pr 6 --base origin/develop
 *
 * Existe porque "o head tem N erros" não é achado de revisão. Só vira achado
 * depois de provar que o merge-base não os tinha. Num caso real deste repo o
 * head tinha 6 erros e 4 já estavam no main (dependência ausente, artefato não
 * buildado) — o que a PR introduzia era um.
 *
 * O valor real, porém, está no `finally`: isto TROCA o branch de trabalho, e
 * uma sequência manual que quebre no meio (tsc travado, Ctrl+C) larga quem
 * rodou em HEAD destacado na branch de outra pessoa, sem aviso. Aqui o branch
 * volta mesmo quando algo falha.
 *
 * Códigos de saída, para automação encadeada conseguir separar achado de pane:
 *
 *   0  mediu, nada introduzido
 *   1  mediu, e a PR INTRODUZ erro (ruído pré-existente NÃO derruba)
 *   2  erro de uso (argumento faltando, --pr não numérico, tsc não instalado,
 *      árvore suja, PR mergeada sem merge commit)
 *   3  não deu para medir (tsc não rodou, ref inexistente, exceção no meio)
 *
 * O 3 existe porque 1 e "quebrei no meio" eram indistinguíveis: qualquer exceção
 * fazia o node sair 1 sozinho, e quem lesse o código concluiria que a PR tinha
 * erro de tipo quando na verdade a medição nunca aconteceu.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Falha de infraestrutura (tsc não rodou, ref não existe), distinta de "a PR
// introduziu erro". As duas saíam 1 antes, e automação encadeada não conseguia
// separar "achei defeito" de "quebrei no meio".
class FalhaOperacional extends Error {}

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

// --- args ------------------------------------------------------------------

const argv = process.argv.slice(2);
const arg = (nome) => {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const pr = arg("pr");
let head = arg("head");

if (!pr && !head) {
  console.error("Informe --pr <numero> ou --head <ref>.");
  process.exit(2);
}

// --- git --------------------------------------------------------------------

// Sempre por execFileSync com array de argumentos: sem shell, então nada aqui
// é interpolado num string de comando. Vale principalmente para `--pr`, que
// vem de fora e entra na montagem de um refspec.
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const gitQuieto = (...args) => spawnSync("git", args, { encoding: "utf8" });

const raiz = git("rev-parse", "--show-toplevel");

// Branch padrão do remoto, não "main" chutado: repo com `master`, `develop` ou
// `trunk` é comum, e um default errado compara contra o ref errado em silêncio.
// Se o remoto não publicou o HEAD, cai em main.
const baseDoRemoto = () => {
  const r = gitQuieto("symbolic-ref", "refs/remotes/origin/HEAD");
  if (r.status !== 0) return "origin/main";
  return r.stdout.trim().replace("refs/remotes/", "");
};
const base = arg("base") ?? baseDoRemoto();

// Mudança RASTREADA + troca de branch = alteração não commitada viajando junto,
// e um typecheck que mede o working tree em vez do commit.
const sujo = git("status", "--porcelain", "--untracked-files=no");
if (sujo) {
  console.error(C.red("Há mudanças não commitadas. Commite ou guarde antes de rodar:"));
  console.error(sujo);
  // 2, não 1: a medição nem começou. Sair 1 aqui devolveria o código reservado
  // para "a PR introduz erro" a quem só esqueceu de commitar, e é o mesmo engano
  // que o 3 existe para evitar do outro lado.
  process.exit(2);
}

// Não rastreado NÃO barra: o git o deixa quieto durante o switch, e exigir
// árvore imaculada tornaria o script inutilizável justamente enquanto se escreve
// algo novo ao lado. Só avisa, porque ainda pode colidir se o ref de destino
// tiver arquivo de mesmo nome.
const naoRastreados = git("status", "--porcelain", "--untracked-files=all")
  .split("\n")
  .filter((l) => l.startsWith("??"));
if (naoRastreados.length) {
  console.log(C.dim(`${naoRastreados.length} arquivo(s) não rastreado(s) — ficam onde estão.`));
}

if (pr) {
  if (!/^\d+$/.test(pr)) {
    console.error("--pr precisa ser um número.");
    process.exit(2);
  }
  // Fora de refs/heads/ de propósito. Um `pr-7` seria um branch no espaço de
  // nomes de quem roda, e o `--force` (necessário para reexecutar) apagaria em
  // silêncio um `pr-7` que a pessoa tivesse criado à mão. Aqui o --force não
  // pisa em nada de ninguém, e o ref não aparece no `git branch`. O SKILL.md
  // usa este mesmo namespace nas receitas manuais: uma PR, um ref.
  head = `refs/pr-review/${pr}`;
  console.log(C.cyan(`buscando refs/pull/${pr}/head -> ${head} ...`));
  git("fetch", "origin", `refs/pull/${pr}/head:${head}`, "--force");
}

gitQuieto("fetch", "origin", base.replace(/^origin\//, ""));

// O caminho --pr acabou de buscar o ref; o --head recebe o que o usuário digitou
// e pode não existir localmente. Sem isto, o `merge-base` abaixo joga e a pessoa
// recebe um stack trace de execFileSync em vez de saber que errou o nome.
for (const [ref, rotulo] of [
  [head, "--head"],
  [base, "--base"],
]) {
  if (gitQuieto("rev-parse", "--verify", "--quiet", `${ref}^{commit}`).status !== 0) {
    console.error(C.red(`Não consegui resolver ${rotulo} "${ref}" neste repositório.`));
    console.error(C.dim("Confira o nome, ou busque antes: git fetch origin <ref>"));
    process.exit(3);
  }
}

let mergeBase = git("merge-base", base, head);
const headSha = git("rev-parse", head);

// PR já mergeada: o head virou ancestral do base, então o merge-base É o head e
// o delta daria zero — um "nada introduzido" falso, que é pior que um erro
// porque parece resposta. A base honesta aí é o 1º pai do merge commit: o
// estado do base imediatamente antes desta PR entrar.
if (mergeBase === headSha) {
  console.log(C.yellow(`${head} já está em ${base} — procurando o merge commit ...`));
  const merges = git("rev-list", "--ancestry-path", "--merges", `${headSha}..${base}`)
    .split("\n")
    .filter(Boolean);
  const mergeCommit = merges.at(-1);
  if (!mergeCommit) {
    console.error(
      C.red(
        `${head} já foi integrado em ${base}, e não achei o merge commit ` +
          `(provável fast-forward ou squash). Passe --base <ref anterior ao merge>.`,
      ),
    );
    // Sem merge commit não há 1º pai para inferir a base: achar o ponto de
    // partida vira leitura humana do histórico. O --base que se procura é o
    // commit do base imediatamente ANTERIOR ao 1º commit desta PR.
    console.error(C.dim(`  git log --oneline --graph ${base} | head -30`));
    process.exit(2);
  }
  mergeBase = git("rev-parse", `${mergeCommit}^1`);
  console.log(C.yellow(`merge commit: ${mergeCommit} -> base = seu 1º pai`));
}

console.log(C.cyan(`merge-base: ${mergeBase}`));

// --- checker ----------------------------------------------------------------

// TypeScript é invocado pelo binário local, com o MESMO node que roda este
// script. Sem `npx` e sem `shell: true`: no Windows o npx é um .cmd, que exige
// shell, e shell reabre a porta de injeção de argumento que o array fecha.
const tsc = join(raiz, "node_modules", "typescript", "bin", "tsc");
if (!existsSync(tsc)) {
  console.error(C.red(`Não achei o TypeScript local em ${tsc}. Rode 'npm install' antes.`));
  process.exit(2);
}

const verificar = (ref, rotulo) => {
  console.log(C.yellow(`\n--- ${rotulo} (${ref}) ---`));
  git("switch", "--detach", ref, "--quiet");
  // tsc escreve diagnóstico em stdout e sai != 0 quando há erro — para o caso
  // normal o status não interessa, só as linhas.
  const r = spawnSync(process.execPath, [tsc, "--noEmit"], { cwd: raiz, encoding: "utf8" });
  if (r.error) throw r.error;
  const erros = (r.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /error TS\d+/.test(l));

  // Mas status != 0 SEM nenhuma linha casada não é "compilou limpo", é "não
  // compilou": OOM, tsconfig ilegível, node incompatível. Sem esta checagem o
  // crash vira lista vazia e o delta responde com confiança — se morrer na BASE,
  // todo erro do head é reportado como introduzido; se morrer no HEAD, a PR passa
  // limpa sem ninguém ter checado. Um "nada introduzido" falso é pior que um
  // erro, porque parece resposta.
  if (r.status !== 0 && erros.length === 0) {
    const saida = ((r.stderr ?? "") + (r.stdout ?? "")).trim();
    // throw, nunca process.exit: exit não roda o `finally`, e o branch ficaria
    // destacado — justamente o que este script existe para não deixar acontecer.
    throw new FalhaOperacional(
      `tsc falhou em ${rotulo} (status ${r.status}) sem emitir diagnóstico.\n` +
        (saida ? saida.slice(0, 2000) : "(sem saída)"),
    );
  }

  console.log(`${erros.length} erro(s).`);
  return erros;
};

// Ponto de retorno. O `symbolic-ref` responde a pergunta certa — "HEAD está
// preso a um branch?" — em vez de inferir pelo formato do nome: `rev-parse
// --abbrev-ref` devolve a string "HEAD" quando destacado, e um branch cujo nome
// seja hexadecimal (`deadbeef`) é indistinguível de um SHA por regex.
const refSimbolico = gitQuieto("symbolic-ref", "--short", "-q", "HEAD");
const eraBranch = refSimbolico.status === 0;
const voltarPara = eraBranch ? refSimbolico.stdout.trim() : git("rev-parse", "HEAD");

let antes, depois, falha;
try {
  antes = verificar(mergeBase, "BASE");
  // Pelo SHA, não pelo nome: `refs/pr-review/N` é um ref fora de refs/heads/ e
  // o `switch --detach` merece um commit-ish sem ambiguidade.
  depois = verificar(headSha, `HEAD (${head})`);
} catch (e) {
  // Capturado, não propagado: propagar faria o node sair 1 sozinho, que é o
  // código reservado para "a PR introduziu erro". O `finally` restaura primeiro,
  // e a saída certa é decidida depois dele.
  falha = e;
} finally {
  // `eraBranch` vem do `symbolic-ref` lá de cima, não de adivinhar o formato do
  // nome: um branch chamado `deadbeef` casa com regex de SHA e ficaria destacado.
  if (eraBranch) gitQuieto("switch", voltarPara, "--quiet");
  else gitQuieto("switch", "--detach", voltarPara, "--quiet");
  console.log(C.dim(`\nbranch restaurado: ${voltarPara}`));
}

if (falha) {
  console.error(C.red(`\n${falha.message}`));
  if (!(falha instanceof FalhaOperacional)) console.error(falha.stack ?? "");
  // 3 = não consegui medir. Distinto de 1 = medi, e a PR introduziu erro.
  process.exit(3);
}

// --- delta ------------------------------------------------------------------

// Multiconjunto, não Set: o mesmo diagnóstico pode aparecer várias vezes, e com
// Set um head com duas ocorrências de um erro que a base tinha uma vez sairia
// como "nada introduzido". Compara por contagem, então a segunda ocorrência conta.
const contar = (lista) => lista.reduce((m, e) => m.set(e, (m.get(e) ?? 0) + 1), new Map());
const cAntes = contar(antes);
const cDepois = contar(depois);
const diferenca = (a, b) =>
  [...a].flatMap(([erro, n]) => Array(Math.max(0, n - (b.get(erro) ?? 0))).fill(erro));
const novos = diferenca(cDepois, cAntes);
const sumidos = diferenca(cAntes, cDepois);

console.log(C.cyan("\n================ DELTA ================"));
console.log(`base: ${antes.length}   head: ${depois.length}`);

if (novos.length) {
  console.log(C.red(`\nINTRODUZIDOS por esta PR (${novos.length}):`));
  novos.forEach((e) => console.log(`  ${e}`));
} else {
  console.log(C.green("\nNenhum erro introduzido."));
}

if (sumidos.length) {
  console.log(C.green(`\nCORRIGIDOS por esta PR (${sumidos.length}):`));
  sumidos.forEach((e) => console.log(`  ${e}`));
}

if (antes.length) {
  console.log(C.dim(`\nPré-existentes (NÃO reportar como achado da PR): ${antes.length}`));
}

process.exit(novos.length ? 1 : 0);
