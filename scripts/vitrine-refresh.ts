/**
 * Recompõe a vitrine de alguém **agora**, sem esperar o dia virar.
 *
 *   npm run vitrine:refresh -- ana.escura@demo.local
 *
 * É a válvula da chave diária. Uma vitrine por pessoa por dia é o que impede a
 * home de disparar o agente a cada visita — mas tem um preço, e ele aparece
 * exatamente na demo: **favoritar às 14h não muda a vitrine até amanhã.**
 *
 * Este comando paga esse preço quando ele incomoda. Escreve na chave de HOJE, e
 * o `UPSERT` de `gravarVitrine` sobrescreve — não cria linha nova, não toca em
 * outro dia nem em outra pessoa.
 *
 * **Leva 60-150s** e não imprime nada enquanto pensa: são duas chamadas ao
 * modelo em sequência (persona, depois recomendação), e a primeira só acontece
 * se os sinais tiverem mudado desde a última — a persona tem cache próprio.
 *
 * Sai 1 quando não houve vitrine, para poder encadear com `&&` num roteiro de
 * demo. `null` aqui não é erro: pode ser pessoa sem sinais, persona abaixo do
 * piso, ou modelo indisponível — a linha de log diz qual.
 */

import { resolveDatabaseUrl } from "./db-url";
import { gerarVitrine } from "../src/platform/vitrine/vitrine.actions";

// Só para validar a URL e dar o diagnóstico bom antes de qualquer coisa. O
// `getDb()` do domínio abre a conexão de verdade.
resolveDatabaseUrl();

const email = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

if (!email) {
  console.error(
    "Passe o e-mail: npm run vitrine:refresh -- ana.escura@demo.local\n\n" +
      "Quem tem sinais no banco sai de `npm run look:armarios -- --listar`.",
  );
  process.exit(1);
}

const inicio = Date.now();
console.log(`\n  recompondo a vitrine de ${email}…`);

// `forcar`: sem ele o `gerarVitrine` devolveria a vitrine de hoje que já
// existe, e o comando que existe para refazer não refaria nada.
const vitrine = await gerarVitrine(email, undefined, true);
const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

if (!vitrine) {
  console.error(`\n  sem vitrine (${segundos}s). O motivo está na linha de log acima.\n`);
  process.exit(1);
}

console.log(`\n  "${vitrine.titulo}"  ·  confiança ${vitrine.confianca}  ·  ${segundos}s\n`);
for (const peca of vitrine.pecas) {
  console.log(`   ${peca.position + 1}. ${peca.handle}`);
  console.log(`      ${peca.motivo}`);
}
console.log("");
process.exit(0);
