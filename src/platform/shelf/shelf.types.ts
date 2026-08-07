/**
 * Tipos do agente da vitrine.
 *
 * Mesma fronteira dos outros domínios: linha crua não sai daqui. Quem consome
 * recebe `Vitrine`, que já passou pela validação da etapa 3 — nenhum handle
 * dela pode ter vindo de fora dos candidatos.
 *
 * O domínio se chama `shelf` e não `agent` de propósito: `src/platform/agent/`
 * já existe, construído, na branch `feature/agente-vendas-ia-phase1`. Ver
 * `docs/agente-vitrine.md`, decisão 8.
 */

/**
 * Um candidato, já reduzido ao que o modelo precisa ver.
 *
 * Reduzido, e não o `CatalogRecord` inteiro, porque o prompt é o custo
 * dominante: imagens, props e todas as variantes multiplicariam os tokens sem
 * mudar uma escolha. Os sinais vêm **calculados** de `findSimilarAvailable` —
 * o modelo lê `mesmoTipo`, não deduz tipo comparando strings.
 */
export interface Candidato {
  handle: string;
  titulo: string;
  tipo: string;
  preco: number;
  /** Mesmo `product_type` do desejado: é uma ALTERNATIVA. */
  mesmoTipo: boolean;
  /** Mesma coleção: sinal fraco, nunca motivo sozinho. */
  mesmaColecao: boolean;
  /** Tags em comum com o desejado — o eixo mais forte de "combina com". */
  tagsEmComum: string[];
  /** Só os tamanhos com variante disponível AGORA. */
  tamanhosDisponiveis: string[];
  descricao: string;
  /**
   * De qual desejo este candidato veio.
   *
   * Um comprador pode ter esperado por várias peças (o usuário de teste tem
   * três, de tipos diferentes). Sem procedência o motivo degenera para um
   * "combina com você" genérico; com ela o agente escreve "para a calça que
   * você queria".
   */
  paraODesejo: string;
}

/** O desejo que ancora a vitrine, na forma que vai para o prompt. */
export interface DesejoNoPrompt {
  titulo: string;
  tipo: string;
  tamanho: string;
}

/** Um item escolhido pelo modelo, já resolvido contra os candidatos. */
export interface ItemDaVitrine {
  handle: string;
  /** Uma linha explicando a RELAÇÃO com o desejo. Vazio quando veio do fallback. */
  motivo: string;
}

/**
 * A vitrine pronta.
 *
 * `origem` não é telemetria decorativa: é o que permite responder "por que esta
 * vitrine está sem texto?" sem reabrir o log. `sql` significa que o modelo
 * falhou, recusou-se (confiança baixa) ou devolveu lixo, e o que está na tela é
 * a ordenação determinística.
 */
export interface Vitrine {
  titulo: string;
  confianca: number;
  /** Substituem o que faltou: mesmo tipo do desejado. */
  itens: ItemDaVitrine[];
  /** Título da segunda vitrine. */
  tituloCombina: string;
  /**
   * Completam o look: outro tipo, mesmo estilo.
   *
   * Lista separada e não uma flag em `itens` porque são duas vitrines na tela,
   * com perguntas diferentes — "no lugar do quê" e "junto com o quê". Misturar
   * as duas foi o que a primeira versão fazia, e o resultado era uma prateleira
   * só, onde o boné no meio de quatro camisetas parecia erro de ordenação.
   */
  combinam: ItemDaVitrine[];
  origem: "agente" | "sql";
  /** Preenchido quando `origem === "sql"` — a razão exata da queda. */
  motivoDoFallback?: string;
}

/** O que o modelo devolve, antes de qualquer validação. Nada aqui é confiável. */
export interface RespostaCrua {
  titulo?: unknown;
  confianca?: unknown;
  itens?: unknown;
  tituloCombina?: unknown;
  combinam?: unknown;
}
