/**
 * Etapa 2: a única chamada ao modelo. Cliente do Decopilot do deco.
 *
 * É o provedor porque é o que funciona — cinco outros caminhos foram tentados
 * e falharam (ver `docs/agente-vitrine.md`, decisão 3). O custo é latência:
 * ~33s por vitrine, medido. Por isso nada aqui pode rodar no caminho de uma
 * request que alguém esteja esperando.
 *
 * Nunca lança e nunca registra a chave. Falha vira `null`, e quem chama cai no
 * fallback determinístico.
 */

const TIMEOUT_MS = 120_000;

interface Config {
  root: string;
  org: string;
  agentId: string;
  apiKey: string;
}

/**
 * Lê a configuração do ambiente.
 *
 * Em produção vem das variáveis da Vercel; em desenvolvimento, de `.dev.vars`
 * carregado pelo script. Devolve `null` — e não lança — quando falta algo:
 * ambiente sem chave é uma situação normal (um clone novo, um preview deploy),
 * e ela deve degradar para o fallback, não derrubar o clique de quem pediu
 * aviso de reposição.
 */
const lerConfig = (): Config | null => {
  const root = process.env.STUDIO_BASE_URL;
  const org = process.env.STUDIO_ORG;
  const agentId = process.env.STUDIO_AGENT_ID;
  const apiKey = process.env.STUDIO_API_KEY;

  if (!root || !org || !agentId || !apiKey) {
    const faltando = Object.entries({
      STUDIO_BASE_URL: root,
      STUDIO_ORG: org,
      STUDIO_AGENT_ID: agentId,
      STUDIO_API_KEY: apiKey,
    })
      .filter(([, valor]) => !valor)
      .map(([nome]) => nome);
    console.warn(`[shelf] sem credencial do Decopilot (faltam: ${faltando.join(", ")})`);
    return null;
  }

  return { root: root.replace(/\/$/, ""), org, agentId, apiKey };
};

const cabecalhos = (config: Config) => ({
  Authorization: `Bearer ${config.apiKey}`,
  "Content-Type": "application/json",
});

/**
 * Cria a thread. **Uma por execução, sempre.**
 *
 * Reaproveitar é tentador (é uma chamada a menos) e está errado por dois
 * motivos: o histórico acumula — medido, 15.940 tokens numa thread nova contra
 * 21.191 numa usada — e os dados de um comprador ficariam no contexto do
 * próximo.
 *
 * O endpoint é o transporte REST de ferramenta (`/tools/{NOME}`), e não o
 * `/mcp` da mesma org: o MCP rejeita os nomes do próprio catálogo
 * (`unknown namespace "COLLECTION"`). O `id` devolvido é o que vale — mandar
 * um `id` no corpo não o impõe.
 */
const criarThread = async (config: Config, titulo: string): Promise<string | null> => {
  const resposta = await fetch(`${config.root}/api/${config.org}/tools/COLLECTION_THREADS_CREATE`, {
    method: "POST",
    headers: cabecalhos(config),
    body: JSON.stringify({ data: { title: titulo, virtual_mcp_id: config.agentId } }),
  });

  if (!resposta.ok) {
    console.error(`[shelf] falha ao criar thread: HTTP ${resposta.status}`);
    return null;
  }

  const corpo = (await resposta.json()) as { item?: { id?: string } };
  return corpo.item?.id ?? null;
};

export interface RespostaDoModelo {
  texto: string;
  latenciaMs: number;
  tokensEntrada?: number;
  tokensSaida?: number;
}

/**
 * Manda a mensagem e devolve o texto do modelo.
 *
 * A ordem importa e não é intuitiva: **o stream tem de estar aberto antes do
 * POST**, porque ele não reproduz o que já passou. Abrir depois é a receita
 * para um cliente que espera para sempre por eventos que já aconteceram.
 */
export const perguntar = async (
  mensagem: string,
  rotulo: string,
): Promise<RespostaDoModelo | null> => {
  const config = lerConfig();
  if (!config) return null;

  const inicio = Date.now();
  const abortar = new AbortController();
  const relogio = setTimeout(() => abortar.abort(), TIMEOUT_MS);

  try {
    const thread = await criarThread(config, rotulo);
    if (!thread) return null;

    const base = `${config.root}/api/${config.org}/decopilot/threads/${thread}`;

    const stream = await fetch(`${base}/stream`, {
      headers: { ...cabecalhos(config), Accept: "text/event-stream" },
      signal: abortar.signal,
    });
    if (!stream.ok || !stream.body) {
      console.error(`[shelf] stream não abriu: HTTP ${stream.status}`);
      return null;
    }

    const enfileirada = await fetch(`${base}/messages`, {
      method: "POST",
      headers: cabecalhos(config),
      body: JSON.stringify({
        messages: [{ role: "user", parts: [{ type: "text", text: mensagem }] }],
        agent: { id: config.agentId },
      }),
    });
    if (!enfileirada.ok) {
      console.error(`[shelf] mensagem recusada: HTTP ${enfileirada.status}`);
      return null;
    }

    return await lerStream(stream.body, inicio);
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    console.error(`[shelf] chamada ao Decopilot falhou: ${detalhe}`);
    return null;
  } finally {
    clearTimeout(relogio);
    abortar.abort();
  }
};

/** Acumula os `text-delta` até o `finish`. */
const lerStream = async (
  corpo: ReadableStream<Uint8Array>,
  inicio: number,
): Promise<RespostaDoModelo | null> => {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let texto = "";
  let pendente = "";
  let uso: { inputTokens?: number; outputTokens?: number } | undefined;
  let terminou = false;

  while (!terminou) {
    const { value, done } = await leitor.read();
    if (done) break;

    pendente += decodificador.decode(value, { stream: true });
    // Guarda a última linha: um chunk pode partir um evento no meio, e
    // parsear metade do JSON descartaria o evento inteiro em silêncio.
    const linhas = pendente.split("\n");
    pendente = linhas.pop() ?? "";

    for (const linha of linhas) {
      if (!linha.startsWith("data: ")) continue;

      let evento: { type?: string; delta?: string; messageMetadata?: { usage?: typeof uso } };
      try {
        evento = JSON.parse(linha.slice(6));
      } catch {
        continue;
      }

      if (evento.type === "text-delta") texto += evento.delta ?? "";
      if (evento.type === "finish") {
        uso = evento.messageMetadata?.usage;
        terminou = true;
        break;
      }
    }
  }

  if (!texto) {
    console.error("[shelf] stream terminou sem texto");
    return null;
  }

  return {
    texto,
    latenciaMs: Date.now() - inicio,
    tokensEntrada: uso?.inputTokens,
    tokensSaida: uso?.outputTokens,
  };
};
