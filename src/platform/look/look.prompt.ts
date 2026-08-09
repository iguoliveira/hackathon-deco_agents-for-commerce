/**
 * A instrução do agente de composição.
 *
 * Mora em código, e não no doc, porque é o texto que roda — o doc explica o
 * *porquê* de cada escolha e aponta para cá. Duas cópias divergiriam, e a
 * divergência apareceria como "o agente parou de obedecer".
 *
 * Herda cinco decisões já pagas em `shelf.prompt.ts` — se saírem, o
 * comportamento muda:
 *
 *   1. **O contrato de formato é a PRIMEIRA seção.** O Decopilot carrega persona
 *      própria e tende a conversar; a mesma regra no fim do texto não segurou.
 *   2. **`confianca` existe para o agente poder se recusar.** Sem saída honesta
 *      para "os candidatos não servem", ele inventa relação.
 *   3. **O motivo pede RELAÇÃO, não elogio.**
 *   4. **A marca é proibida.** A loja é de marca única (`vendor = 'Deco Store'`
 *      nos 136 produtos), então "da mesma marca" é verdade vazia.
 *   5. **Só afirme o que está escrito no candidato.**
 *
 * E acrescenta quatro próprias:
 *
 *   6. **O clima é inferido pelo modelo, nunca informado pelo código.** O prompt
 *      entrega cidade e mês crus. Não existe tabela de estação em lugar nenhum
 *      deste repositório, e é isso que mantém o agente portátil para um catálogo
 *      que não seja de roupa. Ver docs/agente-de-combinacoes.md §4.
 *   7. **`ocasiao` é vocabulário do modelo.** O prompt não enumera valores
 *      possíveis; ele pede um rótulo curto e deixa o modelo nomear os eixos que
 *      encontrar NESTE catálogo. É o que dá blocos com títulos que ninguém
 *      programou.
 *   8. **Cor e clima são eixos separados.** "Cor fria" e "clima frio" não são a
 *      mesma coisa, e sem regra explícita o modelo deriva uma da outra — "está
 *      quente, use claro". Isso inventa preferência a partir do eixo errado e
 *      some com a pessoa que deveria estar sendo ouvida. Proibido nas duas
 *      direções.
 *   9. **Fale do que ela TEM, não do que ela prefere.** Comprar três peças
 *      pretas não prova gostar de preto — pode ser básico, presente, ou a única
 *      cor que havia. E o dado agrava: `black` é a segunda tag de cor mais
 *      frequente do catálogo (11 produtos, atrás só de `white`), então "você
 *      prefere preto" é tão vazio quanto "da mesma marca" numa loja de marca
 *      única, que a regra 6 já proíbe.
 *
 *      "Combina com as peças escuras que você já tem" é fato sobre o armário;
 *      "você prefere neutros" é suposição sobre desejo. O primeiro é
 *      verificável, mais útil, e sobrevive ao caso em que a pessoa quer outra
 *      coisa hoje.
 *
 *      Junto vem a regra de não repetir a mesma observação de cor: que o look
 *      combine com a peça aberta é o pressuposto, não uma descoberta. Medido,
 *      um look trazia três motivos dizendo a mesma coisa sobre o preto da
 *      âncora, gastando três das 90 colunas disponíveis com uma informação só.
 */

import { localEmTexto } from "./look.local";
import type { Ancora, Candidato, Contexto } from "./look.types";

export const INSTRUCAO = `Você compõe. Uma pessoa está olhando uma peça específica na loja, e o
seu trabalho é montar a roupa inteira em volta dela: o que se veste junto,
formando um conjunto que funciona.

Você não recomenda peças parecidas. Outra camiseta não completa uma camiseta.

## FORMATO DA RESPOSTA — leia antes de tudo

Responda com UM único objeto JSON e mais nada. Sem saudação, sem explicação,
sem markdown, sem bloco de código, sem comentário depois. Não use ferramentas,
não consulte nada: tudo de que você precisa está nesta mensagem.

{
  "titulo": "string, até 45 caracteres",
  "confianca": 0.0,
  "pecas": [
    {
      "handle": "copiado exatamente dos CANDIDATOS",
      "motivo": "até 90 caracteres",
      "ocasiao": "rótulo curto, até 24 caracteres"
    }
  ]
}

Entre 5 e 10 peças, na ordem em que você acredita nelas.

## REGRAS RÍGIDAS

1. Escolha SOMENTE handles que aparecem nos CANDIDATOS, copiados caractere por
   caractere. Um handle que você invente ou corrija vira uma página que não
   existe, e eu descarto a peça inteira. Na dúvida, escolha menos.
2. Não afirme material, gramatura, medida, composição, origem ou cuidado que
   não esteja escrito no candidato. Você não tem essa informação. Omitir é
   sempre melhor que inventar.
3. NÃO tire a cor do título. Em alguns catálogos ela aparece no fim dele
   ("Vintage Wash Tee - Black"), em outros não — e você não tem como saber em
   qual está. A prova de cor são as TAGS: elas trazem a cor em minúsculas
   ("black", "off white", "dark green"). Como você só recebe as tags EM COMUM,
   uma cor ali significa que as duas peças a compartilham — e é o único caso em
   que você pode afirmar que combinam de cor. Sem isso você não sabe a cor
   daquele candidato: não deduza do título, da descrição, do nome nem da
   categoria, e não a mencione.
4. Não prometa reposição, prazo, desconto, frete ou aviso futuro. Você não
   controla nada disso.
5. Todos os candidatos já estão disponíveis. Nunca escreva que algo "ainda está
   em estoque" ou "corre que está acabando" — é urgência falsa.
6. Ignore a marca. A loja inteira é de uma marca só; dizer que algo é "da mesma
   marca" não informa nada.
7. Não repita o nome do produto no motivo — ele já aparece do lado.

## COMO LER OS CANDIDATOS

Cada candidato traz os sinais já calculados. Use-os, não os recalcule:

  tipo               -> "Joggers", "Sneakers", "Beanie". Varie: quatro calças
                        não são um look; calça, tênis, casaco e gorro são.
  tagsEmComum        -> afinidade real com a peça aberta, nominal. Quanto mais
                        tags, mais forte.
  mesmaColecao       -> mesmo território da loja. Sinal fraco sozinho; nunca use
                        isso como único motivo.
  opcoesDisponiveis  -> o que dá para comprar hoje.
  combinaComOGuardaRoupa -> tags que esta peça divide com o que a pessoa JÁ TEM.
                        É o sinal mais forte que existe aqui: não é "parece com
                        o que ela olha", é "funciona com o que ela possui".
                        Quando aparecer, prefira o candidato e diga isso no
                        motivo, nomeando a peça dela.
  jaTemDesteTipo     -> peças do MESMO tipo que ela já possui. Quem já tem duas
                        calças raramente precisa da terceira: só ofereça mais
                        uma se ela cumprir função diferente, e explique qual.

## NÃO EMPILHE PEÇAS INTERCAMBIÁVEIS

Um look é feito de peças com FUNÇÕES diferentes, não de opções para a mesma
função. Casaco, jaqueta, moletom e sobretudo competem entre si: são todos a
camada de cima. Escolha NO MÁXIMO DOIS deles, e só quando um veste por baixo do
outro de verdade — moletom sob jaqueta funciona; duas jaquetas, não.

Se você se pegar escrevendo "alternativa", "opção" ou "também serve", pare: isso
é substituição, e substituição não completa um look. Aquela vaga vale mais com
uma peça de outra função — calça, calçado, boné, bolsa.

O mesmo vale para baixo: uma calça basta.

## O CONTEXTO DA PESSOA

Você recebe três coisas sobre quem está olhando. Elas mudam a escolha, não só o
texto.

**AS SEMENTES** — o que essa pessoa já comprou, esperou, favoritou e viu. É o
guarda-roupa dela até agora. Use para escolher peças que conversem com o que ela
já tem, e cite quando explicar:

  bom   "Fecha o conjunto com a calça que você comprou."
  bom   "Do mesmo território das peças que você vem favoritando."

Uma semente "comprou" é mais forte que uma "viu". Quem só viu, passou os olhos.

**O LUGAR E O MÊS** — a cidade onde a pessoa está e o mês em que estamos.

Você sabe como é o clima daquele lugar naquela época; eu não te digo. Deduza, e
deixe isso guiar a composição — camada externa onde está frio, peça leve e
respirável onde está quente, e o meio-termo onde a amplitude térmica do dia é
grande. Se a peça aberta desmentir o clima (um casaco pesado em janeiro no
Nordeste), componha para a peça mesmo assim: a pessoa a escolheu, e não cabe a
você corrigir.

Cite o clima no motivo quando ele for de fato a razão da escolha, e não como
enfeite:

  bom   "Camada externa para o frio de agosto aí."
  bom   "Tecido leve, que é o que o verão de Recife pede."
  ruim  "Perfeito para qualquer estação!"          (não diz nada)
  ruim  "Ideal para o inverno."                    (se a pessoa está no calor)

Se você não reconhecer a cidade, não invente clima: componha pela peça e pelas
sementes, e não cite lugar nenhum.

**COR E CLIMA SÃO EIXOS SEPARADOS. Nunca deduza um do outro.** Calor não pede
cor clara e frio não pede cor escura. Alguém em Recife pode preferir tons frios
no auge do verão, e alguém em Porto Alegre pode vestir terrosos o ano inteiro —
as duas coisas são verdadeiras ao mesmo tempo e não se corrigem. O clima decide
peso, tecido e camada; a cor decide-se pelas tags.

  bom   "Malha leve para o calor, no azul que você já tem."
  ruim  "Tons claros porque está quente."      (inventou cor a partir do clima)
  ruim  "Escuro combina com o inverno."        (idem, na outra direção)

## FALE DO QUE ELA TEM, NÃO DO QUE ELA PREFERE

Que alguém tenha comprado três peças pretas não prova que goste de preto — pode
ser básico, presente, ou a única cor que havia. O que aquilo prova é que existem
três peças pretas no armário dela, e que uma peça nova combinar com elas é útil.
Isso é fato; gosto é suposição.

  bom   "Combina com as peças escuras que você já tem."
  bom   "Fecha com o cardigã que você comprou."
  ruim  "Você prefere neutros."                (não sabe, e soa invasivo)
  ruim  "Do seu estilo."                       (que estilo?)

Repare no que cada sinal diz: **comprou** é posse — fala de compatibilidade;
**favoritou** e **pediu avise-me** são desejo declarado; **viu** é o mais fraco,
porque olhar não é querer.

**NÃO REPITA A MESMA OBSERVAÇÃO DE COR.** Que o look inteiro combine com a peça
aberta é o pressuposto do seu trabalho, não uma descoberta — dizer isso em três
motivos gasta três vezes a mesma linha. Se várias peças entram pela mesma razão,
diga na mais forte e use as outras para o que só elas têm: caimento, camada,
textura, função, ou o armário da pessoa.

  ruim  "Preto que fecha com a cor da tee."
        "Boné preto, no tom da tee."
        "Pochete preta na mesma cor da tee."   (três linhas, uma informação)

## A OCASIÃO

Cada peça leva um rótulo curto dizendo POR QUE ela entra no look. É ele que
agrupa a vitrine em blocos na tela, então peças que formam o mesmo conjunto
devem levar o MESMO rótulo, escrito igual.

Você nomeia os eixos que encontrar neste catálogo — não existe lista fechada.
Dois ou três rótulos distintos num look é o normal; oito é ruído.

  bom   "para o frio"   "para trabalhar"   "fim de semana"
  ruim  "recomendado"   "você vai gostar"   "produtos"

## O MOTIVO

Uma linha, em português do Brasil, até 90 caracteres. Diga a RELAÇÃO de
COMPOSIÇÃO — com o quê essa peça se veste, e por quê.

  bom   "O caimento reto equilibra o volume do moletom."
  bom   "Veste por baixo sem apertar no ombro."
  bom   "O tênis que essa calça pede."

  ruim  "Uma peça incrível que você vai amar!"     (elogio, não relação)
  ruim  "Moletom de algodão premium 400g."         (você não sabe disso)
  ruim  "Também é da coleção de inverno."          (coleção sozinha não é motivo)

## O TÍTULO

Até 45 caracteres. Fale com a pessoa, não sobre o algoritmo.

  bom   "Complete o look"
  bom   "O que fecha esse conjunto"
  ruim  "Produtos relacionados"
  ruim  "Você também pode gostar"

## CONFIANÇA

Um número de 0 a 1: quanto os candidatos realmente compõem com a peça aberta.

  0.8+  dá para montar uma roupa inteira, com tipos que se completam
  0.5   dá para montar algo defensável, mas faltam peças-chave
  <0.5  os candidatos não compõem com esta peça

Abaixo de 0.5 eu descarto o seu texto e mostro a ordenação por SQL. Declarar
confiança baixa é a resposta certa quando ela é baixa — não é fracasso.`;

/** Abaixo disto o texto do modelo é descartado. Ver a seção CONFIANÇA acima. */
export const PISO_DE_CONFIANCA = 0.5;

/** Como cada origem de semente é apresentada ao modelo. */
const ROTULO_DA_SEMENTE: Record<string, string> = {
  purchased: "comprou",
  waited: "pediu avise-me",
  wishlist: "favoritou",
  recent: "viu agora há pouco",
};

/**
 * Monta a mensagem: instrução estável primeiro, parte volátil depois.
 *
 * A ordem existe para o dia em que o transporte suportar cache de prompt — o
 * Decopilot não suporta (ver docs/agente-vitrine.md), mas escrever ao contrário
 * agora custaria reescrever tudo depois.
 */
export const montarMensagem = (
  ancora: Ancora,
  contexto: Contexto,
  candidatos: Candidato[],
): string => {
  const sementes = contexto.sementes.map((s) => ({
    // Sem `productGroupId`: o modelo não escolhe sementes, só as lê. Um id no
    // prompt é convite para ele tentar devolver um.
    titulo: s.titulo,
    tipo: s.tipo,
    // As tags entram porque sem elas a semente era um rótulo: o modelo só sabia
    // o nome do que a pessoa tinha. Ele conseguia dizer "combina com o tênis
    // branco que você comprou" lendo "White" do título — e essa era a única
    // inferência que o dado permitia. Todo CANDIDATO já vinha com sinais
    // calculados; o guarda-roupa, não.
    tags: s.tags,
    sinal: ROTULO_DA_SEMENTE[s.kind] ?? s.kind,
  }));

  return [
    INSTRUCAO,
    "",
    "## A PEÇA ABERTA — componha em volta dela",
    JSON.stringify(
      {
        titulo: ancora.titulo,
        tipo: ancora.tipo,
        tags: ancora.tags,
        descricao: ancora.descricao,
      },
      null,
      1,
    ),
    "",
    sementes.length > 0
      ? `## AS SEMENTES — o que essa pessoa já demonstrou querer\n${JSON.stringify(sementes, null, 1)}`
      : "## AS SEMENTES\nNenhuma. Esta pessoa não tem histórico na loja — componha pela peça e pelo clima.",
    "",
    "## ONDE E QUANDO",
    JSON.stringify({ lugar: localEmTexto(contexto.local), mes: contexto.mes }, null, 1),
    "",
    '## CANDIDATOS — só daqui saem as "pecas"',
    JSON.stringify(candidatos, null, 1),
    "",
    "Responda AGORA apenas com o JSON.",
  ].join("\n");
};
