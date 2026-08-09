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
 * De onde veio o interesse.
 *
 * **A ordem aqui já foi de força**, e era usada para desempatar quando a mesma
 * peça chegava por dois caminhos. Não é mais: nada em código ranqueia estes
 * valores. O que cada um significa está dito em português no prompt — *comprou*
 * é posse, *avise-me* é desejo frustrado, *viu* é fraco — e quem decide quanto
 * pesa é o modelo, com o conjunto todo na frente. Ver
 * docs/persona-do-guarda-roupa.md §1.
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
   * As tags da peça (`product_props` com `name = 'TAG'`).
   *
   * Sem elas a semente chegava ao modelo como **rótulo, não como dado**: só
   * título e tipo. Ele conseguia dizer "combina com o tênis branco que você
   * comprou" porque leu "White" da string do título — e era a única inferência
   * que o dado permitia. Todo candidato já vinha com `tagsEmComum`; o que a
   * pessoa possui, não. A assimetria é que tornava a compra decorativa.
   *
   * É delas que sai `combinaComOGuardaRoupa` em `look.candidates.ts`, calculado
   * em código, do mesmo jeito que `tagsEmComum` é calculado contra a âncora.
   */
  tags: string[];
  /**
   * **Todas** as formas pelas quais a pessoa sinalizou esta peça. Nunca vazio.
   *
   * Era `kind: SeedKind`, um só, e a mesma peça chegando por dois caminhos —
   * favoritar e depois comprar é o percurso normal, não a exceção — obrigava a
   * escolher um vencedor. Escolher exigia a tabela de pesos, e a tabela nunca
   * foi medida.
   *
   * Guardar as duas dissolve a pergunta em vez de respondê-la melhor: *"comprou
   * e já tinha favoritado"* é mais informação que qualquer um dos dois sozinho,
   * e é informação que existia e estava sendo jogada fora.
   *
   * E fecha um furo real. `look.agent.ts` exclui dos candidatos o que a pessoa
   * já comprou; com um `kind` só, uma compra sombreada por um `recent` mais novo
   * sumia, e a peça voltava a ser recomendada — exatamente o que o commit
   * "não recomendar o que a pessoa já comprou" tinha consertado.
   */
  kinds: SeedKind[];
  /** ISO 8601 do sinal MAIS RECENTE desta peça. Ordena o prompt; não pesa nada. */
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
  /**
   * O retrato do guarda-roupa, quando existe. **Substitui as sementes no
   * prompt** — não se soma a elas, ou a medição do `look:eval` não conseguiria
   * atribuir a diferença a nada.
   *
   * Opcional, e ausente é caminho normal: visitante sem histórico nunca teve
   * persona, e uma síntese que falhou compõe sem ela. Nos dois casos o prompt
   * volta a listar as sementes, que é exatamente o comportamento de hoje.
   *
   * **Fora do `hashDoContexto` de propósito.** A persona é derivada das
   * sementes, e as sementes já estão no hash — incluí-la seria pôr a mesma
   * informação duas vezes na chave, e pior: uma síntese que falhasse mudaria a
   * chave do look e descartaria um cache válido.
   */
  persona?: Persona;
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
  preco: number;
  /** Mesma coleção da âncora: sinal fraco, nunca motivo sozinho. */
  mesmaColecao: boolean;
  /** Tags em comum com a âncora — o eixo mais forte de "combina com". */
  tagsEmComum: string[];
  /** Só as opções com variante disponível AGORA (tamanhos, cores…). */
  opcoesDisponiveis: string[];
  descricao: string;
  /**
   * Tags que este candidato divide com o que a pessoa **já tem**.
   *
   * Simétrico a `tagsEmComum`, que é contra a peça aberta. Ausente quando não há
   * interseção — omitir é mais barato que mandar `[]` em 18 candidatos, e o
   * campo ausente lê-se como "nada a dizer" em vez de "medido e deu zero".
   */
  combinaComOGuardaRoupa?: string[];
  /**
   * Tags que este candidato divide com o que a pessoa **QUER** — favoritou ou
   * pediu "avise-me". Ausente quando não há interseção.
   *
   * Separado de `combinaComOGuardaRoupa` porque **não é a mesma afirmação**.
   * Aquele diz "funciona com o que ela possui"; este diz "é do território do que
   * ela vem pedindo". Somar os dois num campo só foi o defeito que a #24
   * documentou: o prompt descrevia posse e o código entregava posse ∪ desejo ∪
   * "viu numa PDP".
   *
   * Para uma recomendação de compra o desejo pode valer MAIS que a posse — quem
   * favoritou três jaquetas está dizendo o que quer comprar, enquanto quem já
   * comprou uma talvez não precise da segunda. Quem decide é o modelo; o código
   * só para de misturar as duas coisas.
   */
  combinaComOQueQuer?: string[];
  /**
   * Peças do MESMO tipo que a pessoa já possui.
   *
   * É o que deixa o modelo enxergar saturação — quem já tem duas calças não
   * precisa da terceira — sem que o código decida por ele quantas são demais.
   */
  jaTemDesteTipo?: string[];
}

/**
 * Um eixo do retrato do guarda-roupa — **observação, nunca preferência**.
 *
 * A distinção é a regra inteira, e ela não é de estilo de texto. O prompt de
 * composição proíbe afirmar gosto ("você prefere neutros") com um argumento
 * medido: `black` é a segunda tag de cor mais frequente do catálogo, então
 * quase todo mundo compra preto porque preto é o que mais existe. Dizer que a
 * pessoa gosta é suposição; dizer que o armário dela é escuro é fato.
 *
 *   ✅ { eixo: "cor dominante", valor: "escuros", evidencia: ["Pleated Chino"] }
 *   ❌ { eixo: "estilo",        valor: "prefere neutros", evidencia: [] }
 */
export interface EixoDaPersona {
  /**
   * Como o **modelo** chamou o eixo. `string`, nunca união de literais.
   *
   * Mesma regra que fez `ocasiao` ser `string`: fixar `cor | tom | modelo`
   * cravaria vocabulário de moda no domínio, e é o que já foi recusado para o
   * clima (`estacao`) e para os tamanhos (`Size`). Num catálogo de vinho o
   * modelo emite "corpo" ou "acidez" sem uma linha de código mudar.
   */
  eixo: string;
  /** O que ele observou nesse eixo. */
  valor: string;
  /**
   * Os títulos das peças que sustentam a afirmação. **Nunca vazio.**
   *
   * É o que separa esta persona da que o prompt proíbe: um eixo sem evidência é
   * opinião sobre a pessoa; com evidência, é descrição do que ela tem. E é
   * prático além de ético — é daqui que sai a citação concreta no motivo, sem a
   * qual a composição perderia o "o cardigã que você comprou" e ficaria só com
   * generalidade.
   *
   * `validar` descarta eixo cujo título não esteja entre os sinais recebidos:
   * evidência inventada é alucinação com aparência de fundamento.
   */
  evidencia: string[];
}

/**
 * O retrato do guarda-roupa de uma pessoa, sintetizado pelo modelo.
 *
 * Substitui a pesagem de sementes (`FORCA`), que respondia a uma pergunta de
 * **truncamento** — quais sinais cabem nas seis vagas — e não de recomendação.
 * Aqui o modelo recebe tudo e decide sozinho o que importa.
 *
 * **É por pessoa, não por peça aberta.** Uma persona serve para todas as PDPs
 * que aquela pessoa abrir, e o cache é pelo hash dos sinais — ver
 * docs/persona-do-guarda-roupa.md §4.
 */
export interface Persona {
  eixos: EixoDaPersona[];
  /**
   * Quanto o modelo acredita no retrato. Abaixo do piso não há persona, e o
   * look compõe sem ela — como já faz hoje para quem não tem histórico.
   *
   * Existe pelo mesmo motivo que a confiança do look: sem saída honesta para
   * "estes sinais não descrevem ninguém", o modelo inventa um perfil.
   */
  confianca: number;
}

/** O que o modelo devolve na síntese, antes de qualquer validação. */
export interface RespostaDaPersona {
  eixos?: unknown;
  confianca?: unknown;
}

/** A peça aberta na PDP, na forma que vai para o prompt. */
export interface Ancora {
  productGroupId: string;
  handle: string;
  titulo: string;
  tipo: string;
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
 * O look pronto. **Se existe um `Look`, ele é do agente** — não há outra forma
 * de produzir um.
 *
 * Já houve: até esta versão, quando o modelo falhava, recusava-se (confiança
 * baixa) ou devolvia lixo, o código montava um look com os candidatos na ordem
 * que o SQL já dava, sem motivos, e a section renderizava assim. A degradação
 * era de "look explicado" para "look sem texto".
 *
 * Isso caiu, e o motivo é de produto, não de código: sem os motivos e sem o
 * agrupamento por ocasião, o que sobra na tela é indistinguível de um carrossel
 * de "produtos relacionados", que toda loja já tem. A feature inteira existe
 * para provar que a composição é raciocinada — e uma versão dela que não prova
 * nada, mostrada exatamente no momento em que o agente falhou, é pior que a
 * ausência: ela ocupa o lugar onde a prova deveria estar.
 *
 * A degradação agora é para **nada**. Quem consome trata `null` como "a section
 * some", e o próximo carregamento tenta de novo.
 */
export interface Look {
  titulo: string;
  confianca: number;
  pecas: PecaDoLook[];
}

/** O que o modelo devolve, antes de qualquer validação. Nada aqui é confiável. */
export interface RespostaCrua {
  titulo?: unknown;
  confianca?: unknown;
  pecas?: unknown;
}
