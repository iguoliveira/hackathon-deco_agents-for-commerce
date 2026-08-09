/**
 * Pré-aquece o look das peças do roteiro. **Chama o modelo e grava.**
 *
 *   npm run look:warm -- vintage-wash-tee heavyweight-boxy-tee
 *
 * O passo 7 do plano (docs/agente-de-combinacoes.md §8) — e, desde que o
 * fallback por SQL caiu, **não é mais otimização**. A primeira pessoa a abrir
 * uma PDP num contexto frio não vê a section: ela some e o agente compõe atrás,
 * para a visita seguinte. Sem pré-aquecer, a demo não tem feature.
 *
 * Grava sob o hash real de `lookDaPeca` (é o que `aquecerLook` garante), então
 * o que fica no cache é lido pela PDP de verdade. O `--gravar` do dry run não
 * serve para isso: ele usa `contexto_hash = 'dryrun'`, que a PDP nunca lê.
 *
 * **O contexto é o de quem roda, e do terminal ele é o errado.** `aquecerLook`
 * lê identidade e local da requisição corrente; fora de uma, `donoDaVitrine()`
 * devolve `null` e `localDaRequisicao()` cai em São Paulo. O que este comando
 * aquece, portanto, é o par (peça, conta sem histórico) — que **não é caso de
 * uso desta feature**: ela pressupõe usuário logado, e visitante anônimo está
 * fora do escopo (docs/agente-de-combinacoes.md, recorte no topo e regra 10).
 *
 * O par que precisa estar quente é **(peça do roteiro, persona logada)**, e hoje
 * o único caminho para produzi-lo é abrir a PDP logado como ela e esperar a
 * geração em background. Mesma coisa para outra cidade: o `deco_local` é cookie,
 * e não há como informá-lo por aqui.
 *
 * **Cuidado com o falso positivo:** este script imprime `✓ … aquecida` sempre
 * que o agente compõe, inclusive quando compôs para o contexto que ninguém vai
 * usar. Sucesso aqui não é sinal de que a demo está pronta.
 *
 * Fechar isso é acrescentar `--email` e `--cidade`, montando o `Contexto` na mão
 * em vez de herdá-lo da requisição. É a melhoria de maior retorno que ficou
 * pendente neste script.
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
 * não é erro aqui, mas é fatal para o resultado: sem credencial não há
 * composição, nada é gravado, e o script reporta todas as peças como sem look.
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

    // `null` cobre os três casos, e o log de `comporLook` já disse qual foi:
    // peça inexistente, pool pequeno demais, ou o agente não compôs.
    if (!look) {
      console.log(`  \x1b[31m✗\x1b[0m ${handle} — sem look (motivo acima) · ${decorrido}s`);
      continue;
    }

    comAgente++;
    const blocos = new Set(look.pecas.map((peca) => peca.ocasiao)).size;
    console.log(
      `  \x1b[32m✓\x1b[0m ${handle} — "${look.titulo}" · ${look.pecas.length} peças em ${blocos} bloco(s) · confiança ${look.confianca} · ${decorrido}s`,
    );
  }

  console.log(`\n${comAgente}/${pecas.length} aquecida(s).`);
  if (comAgente < pecas.length) {
    // Não há mais meio-termo: sem look gravado a section não renderiza, então
    // uma peça que ficou de fora simplesmente não tem a feature na demo.
    console.log("As demais NÃO vão mostrar a section na PDP — rode de novo antes do pitch.");
  }
  process.exit(0);
};

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
