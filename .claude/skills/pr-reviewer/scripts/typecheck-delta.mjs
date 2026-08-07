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
 * Sai 1 só quando a PR INTRODUZ erro — ruído pré-existente não derruba
 * automação encadeada.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
  process.exit(1);
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
  head = `pr-${pr}`;
  console.log(C.cyan(`buscando refs/pull/${pr}/head -> ${head} ...`));
  git("fetch", "origin", `refs/pull/${pr}/head:${head}`, "--force");
}

gitQuieto("fetch", "origin", base.replace(/^origin\//, ""));

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
  // tsc escreve diagnóstico em stdout e sai != 0 quando há erro — o status não
  // interessa, só as linhas.
  const r = spawnSync(process.execPath, [tsc, "--noEmit"], { cwd: raiz, encoding: "utf8" });
  const erros = (r.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /error TS\d+/.test(l));
  console.log(`${erros.length} erro(s).`);
  return erros;
};

// Ponto de retorno. Em HEAD destacado, `--abbrev-ref` devolve "HEAD" — aí só o
// SHA serve.
let voltarPara = git("rev-parse", "--abbrev-ref", "HEAD");
if (voltarPara === "HEAD") voltarPara = git("rev-parse", "HEAD");

let antes, depois;
try {
  antes = verificar(mergeBase, "BASE");
  depois = verificar(head, "HEAD");
} finally {
  gitQuieto("switch", "--detach", voltarPara, "--quiet");
  // Se era branch nomeado, reata o nome em vez de deixar HEAD destacado.
  if (!/^[0-9a-f]{7,40}$/.test(voltarPara)) gitQuieto("switch", voltarPara, "--quiet");
  console.log(C.dim(`\nbranch restaurado: ${voltarPara}`));
}

// --- delta ------------------------------------------------------------------

const setAntes = new Set(antes);
const setDepois = new Set(depois);
const novos = depois.filter((e) => !setAntes.has(e));
const sumidos = antes.filter((e) => !setDepois.has(e));

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
