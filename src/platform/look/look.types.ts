/**
 * Tipos do agente de composição.
 *
 * Mesma fronteira dos outros domínios: linha crua não sai daqui. Quem consome
 * recebe `Look`, que já passou pela validação — nenhum handle dele pode ter
 * vindo de fora dos candidatos.
 *
 * O domínio se chama `look` e não `agent` porque `src/platform/agent/` já
 * existe, construído, na branch `feature/agente-vendas-ia-phase1`. Mesma razão
 * que fez `shelf` se chamar `shelf` — ver docs/agente-vitrine.md.
 */

/**
 * De onde veio o interesse. **A ordem de força é esta**, e ela é usada para
 * desempatar quando a mesma peça aparece por dois caminhos.
 *
 * `purchased` na frente porque é o único sinal que custou dinheiro: quem
 * comprou a calça declarou mais sobre o próprio guarda-roupa do que quem
 * favoritou dez peças numa tarde.
 */
export type SeedKind = "purchased" | "waited" | "wishlist" | "recent";

/**
 * O que a pessoa declarou querer. Substitui perfil e intenção — e essa
 * substituição é deliberada.
 *
 * Quem favoritou uma jaqueta e pediu "avise-me" de um moletom não precisa de um
 * modelo classificando isso como "look de inverno" antes do agente ler: **a
 * semente já é a intenção**, e uma etapa de rotulagem no meio só perderia
 * informação. Ver docs/personal-shopping-agent-proposta.md §7.
 */
export interface Semente {
  productGroupId: string;
  /** Título do produto — é o que o agente lê para saber o que a pessoa gosta. */
  titulo: string;
  /** `products.product_type`. */
  tipo: string;
  /**
   * `products.color`, desde a 0018. `null` quando o catálogo não sabe.
   *
   * É por aqui que a cor do armário chega ao agente. Antes da 0018 ela vinha
   * escondida no fim do `titulo`, e ler cor exigia parsing de string — o que
   * dava certo em 77% dos produtos e falhava em silêncio no resto.
   */
  cor: string | null;
  kind: SeedKind;
  /** ISO 8601. Semente recente pesa mais no desempate. */
  em: string;
}

/**
 * Onde a pessoa está — **cru, do jeito que chegou**.
 *
 * Repare no que NÃO tem aqui: estação, clima, temperatura, hemisfério. Isso é
 * a decisão central da feature e não uma omissão. O código não converte lugar
 * em clima; ele entrega "Porto Alegre, RS, BR" e "agosto" ao modelo, e o modelo
 * sabe que é frio.
 *
 * Um campo `estacao: "inverno" | "verao"` aqui seria a forma mais silenciosa de
 * tornar o sistema específico de moda e de hemisfério sul para sempre. Trocar o
 * catálogo por um de vinho, e a mesma linha continua produzindo "para o calor
 * de Recife, um branco gelado" — sem editar nada.
 */
export interface Local {
  /** "Porto Alegre". Vazio quando não deu para saber, e isso é aceitável. */
  cidade: string;
  /** "RS" — região/estado, quando o provedor manda. */
  regiao: string;
  /** ISO-3166 alpha-2: "BR". */
  pais: string;
  /** Como o valor chegou. Vira rótulo no seletor e nada mais. */
  origem: "seletor" | "geo" | "padrao";
}

/**
 * Quem está olhando, no formato que vai para o prompt e para o hash do cache.
 *
 * O mês é separado do local porque **entra no hash**: um look de agosto em
 * Porto Alegre não serve em dezembro, e sem o mês na chave ele seria servido.
 */
export interface Contexto {
  sementes: Semente[];
  local: Local;
  /** Nome do mês em português — o modelo raciocina melhor sobre isso que sobre `8`. */
  mes: string;
}

/**
 * Um candidato, já reduzido ao que o modelo precisa ver.
 *
 * Reduzido, e não o `CatalogRecord` inteiro, porque o prompt é o custo
 * dominante: imagens, props e todas as variantes multiplicariam os tokens sem
 * mudar uma escolha. Os sinais vêm **calculados** de `findComplementsAvailable`
 * — o modelo lê `tagsEmComum`, não deduz afinidade comparando strings.
 */
export interface Candidato {
  handle: string;
  titulo: string;
  tipo: string;
  /** `products.color`. `null` = o catálogo não sabe a cor desta peça. */
  cor: string | null;
  preco: number;
  /** Mesma coleção da âncora: sinal fraco, nunca motivo sozinho. */
  mesmaColecao: boolean;
  /** Tags em comum com a âncora — o eixo mais forte de "combina com". */
  tagsEmComum: string[];
  /** Só as opções com variante disponível AGORA (tamanhos, cores…). */
  opcoesDisponiveis: string[];
  descricao: string;
}

/** A peça aberta na PDP, na forma que vai para o prompt. */
export interface Ancora {
  productGroupId: string;
  handle: string;
  titulo: string;
  tipo: string;
  /** `products.color`. `null` = o catálogo não sabe a cor da peça aberta. */
  cor: string | null;
  descricao: string;
  tags: string[];
}

/** Uma peça escolhida pelo modelo, já resolvida contra os candidatos. */
export interface PecaDoLook {
  handle: string;
  /** Uma linha explicando a RELAÇÃO com a âncora e com a pessoa. */
  motivo: string;
  /**
   * O eixo pelo qual esta peça entra no look — **vocabulário do modelo**.
   *
   * `string`, e não união de literais, e isso não é preguiça de tipagem: é a
   * regra da §1 de docs/personal-shopping-agent-mudancas.md. Em moda o modelo
   * emite "para o frio"; em vinho emitiria "harmonização". O código lê o que
   * vier e agrupa por igualdade, sem conhecer nenhum valor.
   */
  ocasiao: string;
  position: number;
}

/**
 * O look pronto.
 *
 * `origem` não é telemetria decorativa: é o que permite responder "por que este
 * look está sem texto?" sem reabrir o log. `sql` significa que o modelo falhou,
 * recusou-se (confiança baixa) ou devolveu lixo, e o que está na tela é a
 * ordenação determinística de `findComplementsAvailable`.
 */
export interface Look {
  titulo: string;
  confianca: number;
  pecas: PecaDoLook[];
  origem: "agente" | "sql";
  /** Preenchido quando `origem === "sql"` — a razão exata da queda. */
  motivoDoFallback?: string;
}

/** O que o modelo devolve, antes de qualquer validação. Nada aqui é confiável. */
export interface RespostaCrua {
  titulo?: unknown;
  confianca?: unknown;
  pecas?: unknown;
}
