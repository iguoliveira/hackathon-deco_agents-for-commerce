# A cor como critério de composição

> **Status: implementado, com uma lacuna aberta.** O agente lê cor de
> `products.color` e a usa para escolher e explicar. O que ainda não é
> consistente é citar o armário da pessoa quando a peça aberta tem cor — ver §7.
>
> Este documento foi reescrito depois da implementação. A versão anterior
> planejava ler a cor do título; o desenho final é o oposto, e o §2 explica por
> quê. Medições em [medicao-baseline-cor.md](./medicao-baseline-cor.md).

O agente já compunha lendo o lugar e o mês. Agora lê também a cor — a da peça
aberta e a do que a pessoa já tem.

---

## 1. Onde a cor mora (e onde morava)

Antes da migration `0018`, a cor vivia no **fim do título**:
`"Heavyweight Boxy Tee - Black"`. Havia também `variant_options` com
`name='Color'`, mas cobrindo só 21 dos 135 produtos, com sete valores em
camelCase (`DarkGreen`, `LightBlue`) que não batiam com o vocabulário dos
títulos — `Olive`, `Cream`, `Tan` e `Navy` simplesmente não existiam lá.

Ou seja: as duas fontes discordavam, e a estruturada cobria um sexto do
catálogo.

A `0018` resolveu tirando a cor da apresentação e transformando-a em atributo:

```
title = 'Heavyweight Boxy Tee'
color = 'Black'
```

Aplicado: **104 produtos ganharam `color`, 31 ficaram `NULL`, zero títulos com
hífen restante, zero casos ambíguos de parsing.** Nada se perdeu — a coluna
guarda exatamente o que saiu do título.

`variant_options` não foi tocada. Ela modela cor **por variante** (a mesma peça
em duas cores); `products.color` modela cor **por produto**, que é como este
catálogo está montado — cada cor é um produto separado, com handle próprio. As
duas coexistem enquanto ninguém derivar uma da outra.

## 2. Por que atributo, e por que isso não fere a regra da §1

O plano original **rejeitava** extrair a cor em código. O argumento era bom:
`split(" - ")` mentiria nos 31 produtos sem hífen, e classificar cor em código
travaria o sistema em moda, que é o que a §1 de
`personal-shopping-agent-mudancas.md` proíbe.

O que mudou não foi o argumento — foi perceber que ele mirava a coisa errada.
**Ter cor como dado não é o mesmo que interpretar cor em código.**

- Não existe lista de cores, enum, `CHECK` ou mapa de famílias em lugar nenhum.
- `color` é `TEXT` livre. O banco aceita `Sage`, `Floral` ou `Multicolor` sem
  saber o que são.
- Quem decide que `Charcoal`, `Grey` e `Navy` formam uma paleta continua sendo
  **o modelo**.

Mudou de onde o dado vem, não quem o interpreta. A regra segue de pé: troque o
catálogo por um de vinho e `color` guardaria `Tinto` sem uma linha de código
mudar.

E há um ganho que só apareceu depois. Com a cor dentro de uma string,
**"não tem cor no título" e "não tem cor" eram indistinguíveis**. Agora `NULL`
diz explicitamente "o catálogo não sabe", e o agente tem como se calar pelo
motivo certo nos 31 produtos que não têm cor conhecida.

## 3. O desenho: um critério, duas fontes

> A cor é mais um critério de composição, ao lado do tipo, das tags e do clima.

**A peça aberta manda.** Quando ela tem `cor`, o conjunto se monta em volta
dela — quem abriu uma peça vermelha recebe um look que acompanha vermelho,
mesmo que só tenha comprado bege até hoje. Precedente do clima: *"se a peça
aberta desmentir o clima, componha para a peça mesmo assim"*.

Quando a `cor` da âncora é `NULL`, não há fonte primária, e quem guia é o
armário.

**As sementes mandam na cor.** Quando várias ficam no mesmo território, o
agente deve usar isso para escolher entre candidatos que empatam nos outros
critérios — e deve dizer no motivo.

## 4. Falar do que a pessoa TEM, não do que ela prefere

Esta seção existe por uma objeção que a feature não tinha resposta: **comprar
uma peça preta não prova gostar de preto.** Pode ter sido básico, presente, ou
a única cor no tamanho dela.

Os dados agravam: `Black` é a segunda cor mais frequente do catálogo (11
títulos, atrás só de `White`). Se quase todo mundo compra preto porque preto é
o que mais existe, *"você prefere preto"* é tão vazio quanto dizer que algo é
"da mesma marca" numa loja de marca única — o que a regra 6 do prompt já proíbe.

A saída foi trocar o que se afirma:

| | |
|---|---|
| ❌ *"Você prefere neutros"* | suposição sobre desejo |
| ✅ *"Combina com as peças escuras que você já tem"* | fato sobre o armário |

O segundo é verificável, mais útil, e sobrevive ao caso em que a pessoa quer
outra coisa hoje.

O prompt também passou a distinguir o que cada semente diz, coisa que estava
desperdiçada:

| origem | o que significa |
|---|---|
| `purchased` | ela **tem** — fala de compatibilidade |
| `waited` / `wishlist` | ela **quer** — desejo declarado |
| `recent` | ela **olhou** — sinal fraco |

## 5. Identidade × parentesco

A regra 3 original tratava dois atos como um só:

> *"Só afirme que duas peças têm a mesma cor se as duas trouxerem a MESMA
> palavra ali."*

Ela nasceu de um erro real (o agente afirmando "moletom cinza" sobre peça azul)
e o que ela protege continua protegido. Mas o texto agora separa:

- **Identidade** (*"são da mesma cor"*) — estrito, mesmo valor em `cor`.
  `Charcoal` não é `Black`.
- **Parentesco** (*"conversam"*, *"mesmo território"*) — livre, e o prompt diz
  com todas as letras que `Charcoal`, `Grey` e `Navy` são **três cores
  diferentes e uma paleta só**.

## 6. Cor e clima são eixos separados

`"Cor fria"` e `"clima frio"` não são a mesma coisa, e sem uma regra explícita o
modelo tende a derivar uma da outra — *"está quente, use claro"*. Isso inventa
preferência a partir do eixo errado e some com a pessoa que deveria estar sendo
ouvida.

O prompt agora proíbe nas duas direções, com exemplos. Quem decide cor é a peça
aberta e o armário; quem decide peso, tecido e camada é o clima.

## 7. O que funciona e o que não

Medido ao longo da implementação, com o dry run:

| comportamento | estado |
|---|---|
| a cor move a **seleção** (o tote `Tan` passou a ser escolhido) | ✅ |
| zero suposição de gosto — "prefere" sumiu | ✅ |
| controle nunca inventou paleta (12+ execuções) | ✅ |
| cor e clima separados | ✅ |
| repetição de cor eliminada (3 menções por look → 1) | ✅ |
| citar o armário com **âncora sem cor** | ✅ 2 de 2 |
| citar o armário com **âncora colorida** | ⚠️ intermitente |

### A lacuna, e o que se sabe dela

Quando a peça aberta tem cor, o agente gasta as menções de cor nela e o armário
aparece pouco. Três hipóteses foram testadas e descartadas:

1. **A regra 3 bloqueava** — reescrita, não mudou nada.
2. **Falta de espaço nos 90 caracteres** — os motivos usam em média **59**, com
   31 sobrando. E a regra de não-repetição liberou espaço que foi para caimento
   e volume, não para o armário.
3. **A instrução era fraca** — virou imperativa, melhorou mas não resolveu.

O que sobra é **prioridade**, e ela é auto-infligida: o prompt diz
**"A PEÇA ABERTA manda"**, pensando na escolha, e o modelo aplica também à
explicação. Com âncora sem cor a hierarquia não tem o que aplicar e o armário
aparece em 100% dos casos.

A hipótese não testada: **separar a hierarquia de escolha da de explicação.** A
âncora ganha a decisão e perde a linha de texto, justamente por ser previsível —
que o look combine com a peça aberta é o pressuposto do carrossel inteiro, não
uma descoberta.

## 8. Lacunas conhecidas fora deste domínio

- **`shelf.prompt.ts`** — o agente da vitrine tinha a mesma regra mandando ler
  cor do título, e encontraria títulos limpos. Recebeu proibição explícita de
  afirmar cor, já que não recebe o campo. Funciona, mas ficou sem o eixo.
- **`WaitedItem`** — não carrega cor, e enriquecê-lo é mexer em
  `src/platform/alerts/`. As sementes "avise-me" vão com `cor: null`. Custa: é
  o segundo sinal mais forte (peso 3) e está fora do eixo de cor. Conserto:
  acrescentar `color` ao `SELECT` de `findWaitedItems` e ao tipo.
- **`comprasDe()` está quebrada em `main`** — a `0017_orders_with_items`,
  aplicada no banco compartilhado e **não versionada em branch alguma**,
  reescreveu `orders` para um modelo com `order_items`. A query ainda faz
  `JOIN variants ON v.variant_id = o.variant_id`, coluna que não existe mais; o
  `try/catch` engole e devolve `[]`. **A semente `purchased` está morta em
  produção, em silêncio.** Corrigir aqui seria apostar num schema que o
  repositório não tem — a `0017` precisa ser publicada primeiro.

## 9. O que este trabalho NÃO fez

- Nenhum seed de `orders`. Tudo foi testado com sementes forjadas pelo dry run.
- Nenhuma lista de cores, família cromática ou união de literais em TypeScript.
- Nenhum filtro de candidatos por cor — a cor desempata, não elimina.
- Nada de seletor de paleta na UI.
- Nenhuma mudança em `hashDoContexto`.

## 10. Nota sobre a numeração da migration

`0018` e não `0015`, que seria o próximo livre olhando só o repositório. O banco
compartilhado tem `0015_fix_duplicate_images`, `0015_wishlist` (**duas com o
mesmo número**), `0016_sync_variant_images` e `0017_orders_with_items`
aplicadas — nenhuma versionada. `0018` é o próximo livre de fato.

Enquanto esta PR não for mergeada, quem rodar `db:migrate` num clone limpo terá
um banco diferente do compartilhado: os títulos já mudaram para todo mundo, mas
a `0018` só existe nesta branch.
