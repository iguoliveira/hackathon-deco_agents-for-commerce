# A cor como critério de composição

> **Status: parcialmente superado.** O núcleo desta branch — fazer o agente usar
> a cor do armário da pessoa — foi resolvido em `main` pela #16, por um caminho
> melhor. O que sobreviveu aqui está na §4.
>
> Este documento foi reescrito duas vezes e guarda o histórico de propósito: as
> conclusões erradas custaram medições, e repetir o caminho custaria de novo.

---

## 1. O problema

O agente compunha lendo o lugar e o mês. Faltava a cor — a da peça aberta e a do
que a pessoa já tem.

## 2. O que esta branch tentou

Duas coisas, em sequência:

**Uma migration (`0018`) tirando a cor do título** e transformando-a em atributo
(`products.color`). 104 produtos ganharam cor, 31 ficaram `NULL`, zero casos
ambíguos de parsing. **Isto continua valendo** — ver §4.

**Um prompt lendo cor desse campo**, com a peça aberta como fonte primária e as
sementes como secundária. Isto foi superado.

## 3. Por que a solução de `main` é melhor

A #16 diagnosticou a causa que esta branch perseguiu por cinco iterações sem
achar:

> *"Todo candidato já vinha com `tagsEmComum`; o que a pessoa possui, não.
> **A assimetria é que tornava a compra decorativa.**"*

Era exatamente isso. O armário chegava ao modelo como **texto solto** (título e
tipo), enquanto os candidatos chegavam com **sinais calculados**. Nenhuma força
de instrução compensa essa diferença — e foi o que esta branch tentou, com
imperativo, com regra de não-repetição, com vocabulário. Todas melhoraram algo,
nenhuma resolveu.

O que a #16 fez:

| mecanismo | o que dá |
|---|---|
| `Semente.tags` | o armário chega com os mesmos sinais dos candidatos |
| `combinaComOGuardaRoupa` | o cruzamento é calculado **em código**, como `tagsEmComum` |
| `jaTemDesteTipo` | saturação — três casacos desqualificam o quarto |
| `tagsBanais()` | descarta tag comum demais (`everyday` está em 65% do catálogo) |

E é **mais genérico** que a nossa: resolve cor, qualquer outro atributo e ainda
saturação de tipo — sem depender de schema nenhum. `products.color` resolvia só
cor e exigia uma migration.

### A objeção que derrubou o nosso prompt

A regra que escrevemos afirmava que a cor **não** está no título. Isso é
verdadeiro contra o banco compartilhado, onde a `0018` está aplicada, e **falso**
contra `main`, cuja `0011` ainda gera `'Essential Cotton Tee - White'`.

Mergear assim deixaria `main` internamente inconsistente — a mesma classe de
deriva que a #16 acabara de consertar em `comprasDe`. A regra de `main` é
verdadeira nos dois estados:

> *"NÃO tire a cor do título. Em alguns catálogos ela aparece no fim dele, em
> outros não — e você não tem como saber em qual está. A prova de cor são as
> TAGS."*

## 4. O que sobreviveu desta branch

**A migration `0018`.** Continua valendo por um motivo independente do agente: a
cor no fim do título é apresentação carregando dado, e `"- Black"` não deveria
aparecer na vitrine nem na busca. Ela convive com a regra de `main`, que foi
escrita justamente para não depender de qual migration o banco tem.

**Cor e clima como eixos separados.** `"Cor fria"` e `"clima frio"` não são a
mesma coisa; sem regra explícita o modelo deriva uma da outra. Não estava
coberto em `main`.

**Falar do que a pessoa tem, não do que ela prefere.** Comprar três peças pretas
não prova gostar de preto — e `black` é a segunda tag de cor mais frequente do
catálogo, então a afirmação seria quase vazia. `"Combina com as peças escuras
que você já tem"` é fato; `"você prefere neutros"` é suposição.

**Não repetir a mesma observação de cor.** Medido: um look trazia três motivos
dizendo a mesma coisa sobre o preto da âncora.

**`scripts/look-eval.ts`.** Roda N repetições por condição e reporta
estabilidade — a fração de peças presentes em todas. Existe porque `perguntar()`
não expõe temperatura nem seed, e uma execução por condição não distingue efeito
de ruído.

## 5. O que foi medido e continua valendo

Da [medição de baseline](./medicao-baseline-cor.md), feita antes de tudo isto:

- **Estabilidade varia de 38% a 100%** entre condições. Comparar antes/depois com
  N=3 só vale onde a estabilidade é alta.
- **Os motivos usam 59 dos 90 caracteres** em média. Falta de espaço nunca foi a
  causa de nada aqui.
- **Âncora de cor forte é pior em tudo:** 5 peças contra 8, confiança 0,67 contra
  0,78, e 37s contra 21–27s, com o mesmo pool de 18.

## 6. O erro de processo

Duas pessoas atacaram o mesmo problema em paralelo, sem saber. O trabalho da #16
e o desta branch se sobrepõem quase inteiramente, e a descoberta só aconteceu
quando a PR acusou conflito.

Não é problema de código. Fica registrado porque o custo foi real.
