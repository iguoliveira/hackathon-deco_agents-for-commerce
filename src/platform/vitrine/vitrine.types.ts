/**
 * Tipos da vitrine recomendada. **Não há âncora aqui, e é essa a feature.**
 *
 * O domínio `look` compõe uma roupa em volta de uma peça aberta; este recomenda
 * produtos a partir de quem a pessoa é. A diferença não é de grau — é a
 * pergunta que se faz. Ver docs/vitrine-sem-ancora.md.
 *
 * Mesma fronteira dos outros domínios: linha crua não sai daqui. Quem consome
 * recebe `Vitrine`, que já passou pela validação — nenhum handle dela pode ter
 * vindo de fora dos candidatos.
 *
 * **`Persona` e `Semente` são importadas de `look`**, e a direção está
 * invertida de propósito e por pouco tempo: a vitrine substitui o look (passo 8
 * do §8 do doc), e é lá que os dois tipos mudam de casa. Duplicá-los agora, para
 * a seta apontar bonito durante a convivência, criaria duas verdades sobre o que
 * é uma persona — que é o preço que nenhum dos dois lados vale.
 */

import type { Persona, Semente } from "../look/look.types";

export type { Persona, Semente };

/**
 * Um produto do catálogo, no formato que o modelo recebe.
 *
 * Repare no que **não** tem, comparado com o `Candidato` do look:
 *
 *   `tagsEmComum`   morreu — era afinidade com a peça aberta, e não há peça
 *                   aberta. Não existe contra o quê medir.
 *   `mesmaColecao`  morreu — mesma razão.
 *   `descricao`     ficou de fora por custo: ela sozinha triplica o prompt
 *                   (10.3k contra 4.7k tokens no catálogo inteiro) e é o campo
 *                   que menos decide escolha. Se fizer falta, volta só para as
 *                   peças escolhidas, numa segunda passada barata.
 *
 * O que sobrou são os sinais **relativos à pessoa** — e eles deixam de ser
 * secundários para virar a única coisa que liga candidato a quem vai ver.
 */
export interface Candidato {
  handle: string;
  titulo: string;
  tipo: string;
  preco: number;
  /** Todas as tags da peça. Sem âncora, elas vão cruas: quem cruza é o modelo. */
  tags: string[];
  /** Só as opções com variante disponível AGORA (tamanhos, cores…). */
  opcoesDisponiveis: string[];
  /**
   * Tags que este produto divide com o que a pessoa **COMPROU**.
   *
   * Era o segundo sinal do look, atrás de `tagsEmComum`. Aqui é o primeiro,
   * porque `tagsEmComum` não existe — e foi essa promoção que tornou o conserto
   * de `comOGuardaRoupa` pré-requisito em vez de melhoria. Ver o passo 0.
   */
  combinaComOGuardaRoupa?: string[];
  /**
   * Tags que este produto divide com o que ela **FAVORITOU ou pediu "avise-me"**.
   *
   * Numa recomendação de compra este pode valer mais que o de cima: quem
   * favoritou três jaquetas está dizendo o que quer comprar; quem já comprou uma
   * talvez não precise da segunda. Quem decide é o modelo.
   */
  combinaComOQueQuer?: string[];
  /**
   * Peças do MESMO tipo que ela comprou.
   *
   * **Não é freio de variedade.** Oito camisetas é resultado válido — a vitrine
   * recomenda produtos, não monta conjunto, e não há regra de função para
   * respeitar. Isto é fato sobre a pessoa: recomendar a quarta calça preta para
   * quem tem três é gastar a vaga com o que ela já tem, e o modelo é quem julga
   * se é o caso.
   */
  jaTemDesteTipo?: string[];
}

/**
 * Uma peça recomendada, já resolvida contra os candidatos.
 *
 * **Sem `ocasiao`.** No look ele agrupava por função (calça, calçado, camada),
 * porque uma roupa tem partes. Uma lista de recomendações não tem, e o
 * agrupamento viraria cerimônia herdada — mais um campo que o modelo pode errar
 * sem nada em troca.
 *
 * A regra que o `ocasiao` demonstrava — vocabulário do modelo, nunca união de
 * literais — continua valendo e continua demonstrada por `EixoDaPersona.eixo`.
 * O exemplo mudou de lugar, não sumiu.
 */
export interface PecaRecomendada {
  handle: string;
  /**
   * Uma linha dizendo por que **esta pessoa**, não por que este produto.
   *
   * É o que separa a vitrine de uma grade de "recomendados" que qualquer loja
   * tem. E é onde a `evidencia` da persona se paga: sem âncora para citar, o
   * motivo viraria generalidade se não houvesse peças reais da pessoa para
   * nomear.
   */
  motivo: string;
  position: number;
}

/**
 * A vitrine pronta. **Se existe uma `Vitrine`, ela é do agente.**
 *
 * Mesma decisão do `Look`: não há caminho que produza uma sem o modelo. A
 * degradação é para **nada** — sem persona confiável, sem vitrine, e a section
 * não aparece.
 *
 * Isso é mais fácil de defender aqui do que lá: esta não é a section principal
 * do site, é uma recomendação extra na home. Um buraco onde ela estaria não
 * quebra nada. Uma vitrine genérica, sim — ocuparia o lugar da prova de
 * personalização com exatamente aquilo que a feature existe para contradizer.
 */
export interface Vitrine {
  titulo: string;
  /**
   * Quanto o modelo acredita na recomendação.
   *
   * Existe pelo mesmo motivo de sempre: sem saída honesta para "estes candidatos
   * não servem a esta pessoa", o modelo preenche. E aqui ele preenche mais fácil
   * — sem âncora, qualquer produto é uma resposta sintaticamente válida.
   */
  confianca: number;
  /** Na ordem em que o agente acredita nelas. Sem agrupamento. */
  pecas: PecaRecomendada[];
}

/** O que o modelo devolve, antes de qualquer validação. Nada aqui é confiável. */
export interface RespostaCrua {
  titulo?: unknown;
  confianca?: unknown;
  pecas?: unknown;
}
