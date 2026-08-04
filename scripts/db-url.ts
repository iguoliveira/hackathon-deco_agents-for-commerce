/**
 * Carrega e valida a `DATABASE_URL` — compartilhado por migrate.ts e query.ts.
 *
 * A validação existe porque o driver falha de um jeito que não ajuda: uma URL
 * malformada faz ele cair em `localhost` e devolver `ECONNREFUSED` com
 * `message` vazia, que se parece com "o banco está fora do ar" e manda a pessoa
 * investigar rede, firewall e Supabase antes de olhar para a própria string.
 *
 * NENHUMA mensagem daqui imprime o valor bruto. Uma connection string contém a
 * senha do banco, e o caso mais comum de erro é justamente o que engana um
 * parser de URL — foi assim que uma senha acabou num log de diagnóstico.
 */

const HINT =
  "Pegue em: Supabase → Connect → Connection string → Transaction pooler (porta 6543).\n" +
  "Cole por cima da linha inteira no .env, não depois do que já estava lá.";

const fail = (problem: string): never => {
  console.error(`DATABASE_URL inválida: ${problem}\n\n${HINT}`);
  process.exit(1);
};

/** Devolve a URL validada, ou encerra o processo com um diagnóstico útil. */
export const resolveDatabaseUrl = (): string => {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // Sem .env: o erro de "não definida" logo abaixo é o útil, não este.
    }
  }

  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    console.error(`DATABASE_URL não definida.\n\n${HINT}`);
    process.exit(1);
  }

  // Checado antes do parser: `postgresql://postgresql://...` é URL válida para
  // o `new URL`, que lê host vazio em silêncio — o erro só apareceria como
  // ECONNREFUSED lá na frente.
  const schemes = raw.match(/postgres(ql)?:\/\//g);
  if (schemes && schemes.length > 1) {
    fail(`o prefixo "postgresql://" aparece ${schemes.length} vezes (deve aparecer 1)`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("não é uma URL válida");
  }

  if (!/^postgres(ql)?:$/.test(url.protocol))
    fail(`protocolo "${url.protocol}" (esperado postgresql:)`);
  if (!url.hostname) fail("sem host");
  if (!url.username) fail("sem usuário");
  if (!url.password) fail("sem senha");

  // Avisos, não erros: funcionam, mas não são o que a Vercel precisa.
  if (url.port === "5432" && url.hostname.includes("pooler")) {
    console.warn(
      "aviso: porta 5432 no host do pooler é o modo SESSION.\n" +
        "       Funciona, mas em serverless esgota conexão — prefira 6543.\n",
    );
  } else if (!url.hostname.includes("pooler")) {
    console.warn(
      "aviso: esta é a conexão DIRETA, não o pooler.\n" +
        "       No plano free ela só resolve em IPv6 e costuma dar timeout.\n",
    );
  }

  return raw;
};

/** A URL sem a senha, para log. */
export const redact = (url: string): string => url.replace(/:[^:@/]*@/, ":***@");
