/**
 * A instrução da síntese: sinais soltos → retrato do guarda-roupa.
 *
 * Herda as decisões já pagas em `look.prompt.ts` — se saírem, o comportamento
 * muda:
 *
 *   1. **O contrato de formato é a PRIMEIRA seção.** O Decopilot carrega
 *      persona própria e tende a conversar; a mesma regra no fim não segurou.
 *   2. **`confianca` existe para o modelo poder se recusar.** Sem saída honesta
 *      para "estes sinais não descrevem ninguém", ele inventa um perfil — e aqui
 *      o custo é maior que no look, porque a persona fica a montante de tudo.
 *   3. **Só afirme o que está nos sinais.**
 *
 * E acrescenta a que define esta etapa:
 *
 *   4. **Descrever, nunca supor.** É a mesma linha que `look.prompt.ts` traça
 *      entre "combina com as peças escuras que você já tem" e "você prefere
 *      neutros", e ela vale ainda mais aqui: um retrato é exatamente o formato
 *      em que a suposição se disfarça de conhecimento.
 *
 *      O argumento é medido, não estético. `black` é a segunda tag de cor mais
 *      frequente do catálogo — se quase todo mundo compra preto porque preto é
 *      o que mais existe, "prefere preto" não informa nada sobre a pessoa.
 *
 *   5. **O eixo é vocabulário do modelo.** Nenhuma lista de eixos possíveis
 *      aparece aqui, pelo mesmo motivo que `ocasiao` não tem união de literais.
 *      Num catálogo de vinho ele emitiria "corpo" e "acidez" sozinho.
 */

import type { Semente } from "./look.types";

export const INSTRUCAO_DA_PERSONA = `Você observa guarda-roupas.

Recebe as peças que uma pessoa comprou, favoritou, esperou voltar ao estoque ou
apenas olhou. Seu trabalho é escrever um **retrato do que existe nesse armário**
— não um palpite sobre a personalidade dela.

## O FORMATO

Responda APENAS com JSON, sem texto antes ou depois, sem crase, sem markdown:

{
  "eixos": [
    { "eixo": "<curto>", "valor": "<curto>", "evidencia": ["<título exato>", ...] }
  ],
  "confianca": <0 a 1>
}

De 2 a 5 eixos. Menos de 2 significa que os sinais não sustentam um retrato — e
aí devolva confiança baixa em vez de encher.

## A REGRA QUE MANDA EM TUDO

**Descreva o que está lá. Nunca suponha o que a pessoa gosta.**

Ter três peças pretas não prova gostar de preto — pode ser básico, presente, ou
a única cor que havia na hora. O que aquilo prova é que **existem três peças
pretas naquele armário**, e que uma peça nova combinar com elas é útil.

  bom   "cor dominante" / "escuros"        evidência: as peças escuras
  bom   "caimento"      / "solto"          evidência: as peças de corte largo
  bom   "camada"        / "sobreposição"   evidência: as peças de vestir por cima

  ruim  "estilo"        / "minimalista"    (que critério? de onde?)
  ruim  "preferência"   / "gosta de preto" (não sabe — e soa invasivo)
  ruim  "perfil"        / "urbano moderno" (não descreve nada verificável)

Se você não conseguir apontar as peças que sustentam um eixo, **o eixo não
existe**. Não escreva.

## A EVIDÊNCIA

Cada eixo lista os **títulos exatos** das peças que o sustentam, copiados dos
sinais que você recebeu, caractere por caractere. Título que você invente ou
corrija faz o eixo inteiro ser descartado.

No mínimo um título por eixo. Um eixo apoiado em uma peça só é fraco e deve
baixar a sua confiança — mas é honesto, e melhor que um eixo sem apoio nenhum.

## O QUE CADA SINAL DIZ

Eles não valem a mesma coisa, e **você decide quanto cada um pesa** — não existe
tabela:

  comprou             -> ela TEM a peça. É o armário de verdade.
  pediu avise-me      -> ela QUER, e a loja não tinha. Desejo declarado e frustrado.
  favoritou           -> ela QUER. Levantou a mão por aquilo.
  viu agora há pouco  -> ela OLHOU. O mais fraco: olhar não é querer.

Posse descreve o armário; desejo descreve o que falta nele. Os dois cabem no
retrato, e vale distinguir quando fizer diferença — "tem muitas peças escuras,
mas vem olhando cores" é um retrato melhor que qualquer um dos dois sozinho.

## O EIXO

Você nomeia. Não há lista. Use o vocabulário que **este** conjunto de peças
pede, em duas ou três palavras.

  bom   "cor dominante"   "caimento"   "material"   "camada"   "uso"
  ruim  "características"   "geral"   "outros"

## A CONFIANÇA

Um número de 0 a 1: quanto estes sinais realmente descrevem um armário.

  0.8+  muitos sinais, e eles concordam entre si
  0.5   dá para dizer algo, mas o conjunto é pequeno ou disperso
  <0.5  os sinais não formam retrato nenhum

Abaixo de 0.5 eu descarto o seu texto e o agente compõe sem persona. **Declarar
confiança baixa é a resposta certa quando ela é baixa** — três peças de tipos e
cores diferentes não são um perfil, são três peças.`;

/** Como cada origem de sinal é apresentada ao modelo. */
const ROTULO: Record<string, string> = {
  purchased: "comprou",
  waited: "pediu avise-me",
  wishlist: "favoritou",
  recent: "viu agora há pouco",
};

/**
 * Monta a mensagem da síntese: instrução estável primeiro, sinais depois.
 *
 * **Sem teto.** É a diferença que justifica a etapa existir: a composição corta
 * em seis porque muitos sinais a fazem compor "para todo mundo", mas sintetizar
 * é o oposto — quanto mais do armário, melhor o retrato. Ver
 * docs/persona-do-guarda-roupa.md §4.
 *
 * `productGroupId` fica de fora: o modelo não escolhe peça aqui, só descreve. Um
 * id no prompt é convite para ele devolver um.
 */
export const montarMensagemDaPersona = (sinais: Semente[]): string =>
  [
    INSTRUCAO_DA_PERSONA,
    "",
    "## O ARMÁRIO",
    JSON.stringify(
      sinais.map((s) => ({
        titulo: s.titulo,
        tipo: s.tipo,
        tags: s.tags,
        sinal: s.kinds.map((k) => ROTULO[k] ?? k).join(" e "),
      })),
      null,
      1,
    ),
    "",
    "Responda AGORA apenas com o JSON.",
  ].join("\n");

/** Abaixo disto o retrato é descartado. Ver a seção CONFIANÇA acima. */
export const PISO_DA_PERSONA = 0.5;

/** Menos que isto não é retrato. Ver o FORMATO. */
export const MIN_EIXOS = 2;
