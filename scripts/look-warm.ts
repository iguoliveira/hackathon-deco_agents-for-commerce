/**
 * Pré-aquece o look das peças do roteiro. **Chama o modelo e grava.**
 *
 *   npm run look:warm -- vintage-wash-tee heavyweight-boxy-tee
 *
 * O passo 7 do plano (docs/agente-de-combinacoes.md §8). Sem isto, a primeira
 * pessoa a abrir uma PDP na demo vê a ordenação do SQL sem motivos — que é a
 * degradação correta do produto e a pior imagem possível no palco, porque é
 * exatamente onde os motivos deveriam estar.
 *
 * Grava sob o hash real de `lookDaPeca` (é o que `aquecerLook` garante), então
 * o que fica no cache é lido pela PDP de verdade. O `--gravar` do dry run não
 * serve para isso: ele usa `contexto_hash = 'dryrun'`, que a PDP nunca lê.
 *
 * **O contexto é o de quem roda** — do terminal, "visitante sem histórico em
 * São Paulo". É o contexto de quem chega pelo link do pitch sem ter navegado
 * antes, que é o caso que precisa estar quente.
 */

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env: o erro de "DATABASE_URL não definida" que vem depois é o útil.
}

import { readFileSync } from "node:fs";
import { aquecerLook } from "../src/platform/look/look.actions";

/**
 * `.dev.vars` guarda as credenciais do Decopilot em desenvolvimento. Ausência
 * não é erro — sem credencial o agente cai no fallback por SQL, e aí o
 * pré-aquecimento grava um look sem motivos, que este script avisa.
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

const main = async (): Promise<void> => {
  const pecas = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

  if (pecas.length === 0) {
    console.error("Passe os handles: npm run look:warm -- vintage-wash-tee heavyweight-boxy-tee");
    process.exit(1);
  }

  carregarDevVars();

  let comAgente = 0;

  // Em série, e não em paralelo: são 22-41s de modelo cada, e o Decopilot entra
  // em `waiting-capacity` quando recebe várias threads de uma vez — paralelizar
  // aqui troca "lento" por "lento e às vezes sem resposta".
  for (const handle of pecas) {
    const inicio = Date.now();
    const look = await aquecerLook(handle);
    const decorrido = ((Date.now() - inicio) / 1000).toFixed(1);

    if (!look) {
      console.log(`  \x1b[31m✗\x1b[0m ${handle} — peça inexistente ou sem candidatos suficientes`);
      continue;
    }

    if (look.origem === "agente") {
      comAgente++;
      const blocos = new Set(look.pecas.map((peca) => peca.ocasiao)).size;
      console.log(
        `  \x1b[32m✓\x1b[0m ${handle} — "${look.titulo}" · ${look.pecas.length} peças em ${blocos} bloco(s) · confiança ${look.confianca} · ${decorrido}s`,
      );
    } else {
      console.log(
        `  \x1b[33m!\x1b[0m ${handle} — gravado SEM motivos (${look.motivoDoFallback}) · ${decorrido}s`,
      );
    }
  }

  console.log(`\n${comAgente}/${pecas.length} com o texto do agente.`);
  if (comAgente < pecas.length) {
    console.log(
      "As demais vão aparecer na PDP como lista ordenada, sem os motivos — rode de novo.",
    );
  }
  process.exit(0);
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
