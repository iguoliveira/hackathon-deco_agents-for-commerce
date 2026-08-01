#!/usr/bin/env node
/**
 * Valida um domínio de src/platform/ contra o padrão do time (ver ../SKILL.md).
 *
 *   node .claude/skills/agent-creator/scripts/validate-domain.mjs src/platform/agent
 *   node .claude/skills/agent-creator/scripts/validate-domain.mjs src/platform/analytics
 *
 * Sai com 1 se algo estiver fora do contrato. Com 5 pessoas e prazo curto
 * ninguém relê documento, mas todo mundo respeita um script que falha.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/** Contratos que precisam estar declarados em cada domínio (ver SKILL.md). */
const REQUIRED_TYPES = {
  agent: ["StructuredFilters"],
  analytics: ["AgentQueryLog", "TopicRanking"],
};

/** O agente é read-only por decisão de escopo — nada de escrita. */
const FORBIDDEN_IN_AGENT = [
  { pattern: /\baddToCart\b|\baddItems\b|addItemServerFn/, label: "ação de carrinho" },
  { pattern: /\bcheckout\b/i, label: "fluxo de checkout" },
  { pattern: /platform\/cart/, label: "import de platform/cart" },
];

const dir = process.argv[2];
if (!dir) {
  console.error("uso: validate-domain.mjs src/platform/<dominio>");
  process.exit(2);
}
if (!existsSync(dir)) {
  console.error(`diretório não encontrado: ${dir}`);
  process.exit(2);
}

const domain = basename(dir);
const files = readdirSync(dir);
const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null);

// --- estrutura: espelha src/platform/cart/ ---
for (const f of [`${domain}.types.ts`, "index.ts"]) {
  if (!files.includes(f)) err(`falta ${f} (siga a forma de src/platform/cart/)`);
}
if (!files.includes(`${domain}.actions.ts`)) {
  // wishlist é assim: os server fns vivem em src/actions/. Legítimo, mas vale notar.
  warn(`sem ${domain}.actions.ts — ok se os server fns deste domínio vivem em src/actions/`);
}
if (!files.includes(`${domain}.hooks.ts`)) {
  warn(`sem ${domain}.hooks.ts — ok se nada no client consome este domínio`);
}
for (const f of files) {
  if (f === "index.ts") continue;
  if (!f.startsWith(`${domain}.`)) {
    // Helper interno (ex.: address/cookie.ts). Não quebra nada, mas some do radar
    // de quem procura pelo prefixo do domínio.
    warn(`${f}: fora da convenção ${domain}.<papel>.ts — ok se for helper interno`);
  }
}

// --- tipos: contratos compartilhados declarados aqui ---
const types = read(`${domain}.types.ts`);
if (types) {
  for (const t of REQUIRED_TYPES[domain] ?? []) {
    if (!new RegExp(`export\\s+(interface|type)\\s+${t}\\b`).test(types)) {
      err(`${domain}.types.ts: falta \`export interface ${t}\` — é contrato compartilhado`);
    }
  }
  if (/\bfetch\(|createServerFn|useQuery/.test(types)) {
    err(`${domain}.types.ts: só tipos aqui — mova comportamento para .actions.ts / .hooks.ts`);
  }
  if (domain === "agent" && /sort\??:\s*string/.test(types)) {
    err('agent.types.ts: `sort` deve ser o literal "BEST_SELLING", não string (v1 fixa o sort)');
  }
  if (domain === "analytics" && !/from\s+["'].*platform\/agent|from\s+["']\.\.\/agent/.test(types)) {
    warn(
      "analytics.types.ts: StructuredFilters deveria ser importado de platform/agent, não redeclarado",
    );
  }
}

// --- actions: server functions, sem vazar payload cru ---
const actions = read(`${domain}.actions.ts`);
if (actions) {
  if (!/createServerFn\s*\(/.test(actions)) {
    err(`${domain}.actions.ts: sem createServerFn — server functions são o padrão do repo`);
  }
  // Um POST sem entrada (ex.: signOut) não precisa de validator. O que importa é:
  // se o handler lê ctx.data, essa entrada tem que ter sido validada.
  const blocks = actions.split(/(?=export\s+const\s+\w+\s*=\s*createServerFn)/);
  for (const b of blocks) {
    const m = b.match(/export\s+const\s+(\w+)\s*=\s*createServerFn/);
    if (!m) continue;
    const readsInput = /\bctx\.data\b|\(\{\s*data\s*[},]/.test(b);
    if (readsInput && !/\.inputValidator\(/.test(b)) {
      err(`${domain}.actions.ts: ${m[1]} lê ctx.data sem .inputValidator() — valide a entrada`);
    }
  }
  if (domain === "agent") {
    if (!/logAgentQuery/.test(actions)) {
      err(
        "agent.actions.ts: logAgentQuery precisa ser chamado aqui (mesmo server fn do resolveSearchQuery) — um único ponto de escrita",
      );
    } else if (!/try\s*\{[\s\S]{0,400}logAgentQuery|logAgentQuery[\s\S]{0,200}catch/.test(actions)) {
      warn("agent.actions.ts: logAgentQuery parece fora de try/catch — telemetria não pode derrubar a busca");
    }
  }
}

// --- barrel: exports nomeados explícitos ---
const index = read("index.ts");
if (index) {
  if (/export\s+\*/.test(index)) {
    err("index.ts: evite `export *` — liste export por export (esconde a API pública e quebra o knip)");
  }
  if (!/export\s*(type\s*)?\{/.test(index)) {
    err("index.ts: barrel sem exports nomeados");
  }
  for (const t of REQUIRED_TYPES[domain] ?? []) {
    if (!index.includes(t)) warn(`index.ts: ${t} não está reexportado — quem consome vai importar do caminho interno`);
  }
}

// --- exclusões de escopo (só valem para o agente) ---
if (domain === "agent") {
  for (const f of files.filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(dir, f), "utf8");
    for (const { pattern, label } of FORBIDDEN_IN_AGENT) {
      if (pattern.test(src)) {
        err(`${f}: ${label} — o agente é read-only por decisão de escopo (ver explicit_exclusions da spec)`);
      }
    }
  }
}

for (const w of warnings) console.log(`aviso  ${w}`);
for (const e of errors) console.log(`ERRO   ${e}`);

if (errors.length) {
  console.log(`\n${errors.length} erro(s) — fora do padrão. Ver .claude/skills/agent-creator/SKILL.md`);
  process.exit(1);
}
console.log(`\nok — ${dir} dentro do padrão${warnings.length ? ` (${warnings.length} aviso(s))` : ""}`);
