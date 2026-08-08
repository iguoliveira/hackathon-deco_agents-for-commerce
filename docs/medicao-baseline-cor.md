# Baseline do eixo cor — o "antes"

> Medido em **2026-08-08**, com `npm run look:eval -- --rotulo antes --n 3`.
> 4 condições × 3 repetições = 12 chamadas reais ao Decopilot.
> Dados brutos em `.eval/antes.json` (não versionado).
>
> Este é o número contra o qual a mudança de prompt será comparada. Ver o plano
> em [agente-especificidade-de-cor.md](./agente-especificidade-de-cor.md).

## Por que medir antes

O agente **já cita cor por conta própria** — isso apareceu na revisão da #12,
em motivos como *"Mesma cor da camiseta e contraste de couro por cima do
algodão"*. Sem saber o quanto ele já faz isso, qualquer afirmação de que a
feature melhorou algo seria chute.

E como o recorte escolhido (§1.1 do plano) mexe na **seleção** e não só no
texto, era preciso registrar *quais peças* saem hoje, não só quantos motivos
falam de cor.

## Os números

| condição | pool | peças | tipos | blocos | confiança | estabilidade | cor nos motivos | seg |
|---|---|---|---|---|---|---|---|---|
| `preta-sem-sementes` | 18 | 7,3 | 7,3 | 3,0 | **0,78** | 5/10 (50%) | **6/22 (27%)** | 26,5 |
| `preta-concordante` | 18 | 8,0 | 7,0 | 3,0 | 0,77 | 7/10 (70%) | **2/24 (8%)** | 24,5 |
| `preta-dispersa` | 18 | 8,0 | 8,0 | 2,3 | 0,75 | 8/8 (100%) | 6/24 (25%) | 21,4 |
| `laranja-sem-sementes` | 18 | **5,0** | 5,0 | 2,7 | **0,67** | 3/8 (38%) | 1/15 (7%) | **37,2** |

*Estabilidade = peças presentes em todas as 3 repetições ÷ peças que apareceram
em alguma. Mede quanto do look é escolha e quanto é sorteio.*

---

## Achado 1 — dar uma paleta óbvia fez o agente falar MENOS de cor

É o resultado mais contra-intuitivo, e ele contradiz a intuição que originou a
feature.

| condição | cor nos motivos |
|---|---|
| sem sementes | **27%** |
| **três compras, todas `Black`** | **8%** |
| sementes dispersas | 25% |

Com uma paleta clara e fácil de nomear, a taxa **caiu para menos de um terço**
da condição sem histórico nenhum.

**A explicação mais provável: o motivo tem orçamento.** São 90 caracteres, e os
eixos competem por eles. Com sementes disponíveis, o agente prefere justificar
pela relação com o que a pessoa comprou (*"fecha o conjunto com a calça que
você comprou"*) e a cor perde a vaga. Sem sementes, a cor é um dos poucos eixos
concretos que sobram.

**Consequência para o desenho:** acrescentar cor ao prompt pode **deslocar**
outro eixo em vez de somar informação. A avaliação da tarefa 6 precisa checar o
que *saiu* dos motivos, não só se cor entrou. Um agente que passa a falar de
paleta e para de citar a compra não melhorou — trocou.

## Achado 2 — a estabilidade varia de 38% a 100%, e isso muda o método

Foi para isso que a ferramenta existe, e o número justifica a decisão.

- `preta-dispersa`: **100%** — as mesmas 8 peças nas 3 execuções
- `preta-concordante`: 70%
- `preta-sem-sementes`: 50%
- `laranja-sem-sementes`: **38%** — só 3 de 8 peças se repetem

**Na condição laranja, N=3 não distingue efeito de ruído.** Se o prompt novo
mudar a seleção lá, não haverá como atribuir a mudança ao prompt. Ou N sobe
para 7–10 nessa condição, ou ela vira observacional e sai do critério de aceite.

Observação secundária: **sementes parecem estabilizar a escolha** (50% → 70% e
100% com histórico). Mais contexto, decisão mais determinada. Com 3 repetições
isso é indício, não conclusão.

## Achado 3 — âncora de cor forte é um caso pior em tudo

`Cropped Zip Hoodie - Orange` contra as tees pretas:

| | preta | laranja |
|---|---|---|
| peças | 7,3–8,0 | **5,0** |
| tipos | 7,0–8,0 | **5,0** |
| confiança | 0,75–0,78 | **0,67** |
| estabilidade | 50–100% | **38%** |
| latência | 21–27s | **37,2s** |

Mesmo pool de 18 candidatos, e ainda assim o agente escolhe **menos peças, com
menos confiança, menos estabilidade e mais tempo**. Ele acha genuinamente mais
difícil compor em volta de uma cor forte — que é exatamente onde uma feature de
cor precisaria ajudar mais.

Isso torna a condição laranja a mais informativa das quatro, e ao mesmo tempo a
mais difícil de medir (achado 2). A tensão precisa ser resolvida antes da
tarefa 6.

## Achado 4 — o vocabulário de ocasião é estável e não foi programado

Os rótulos que o modelo inventou, por condição:

- `preta-sem-sementes` — *para o frio · casual · dia a dia · streetwear casual · acessório*
- `preta-concordante` — *para o dia a dia · para o frio · acessório · streetwear*
- `preta-dispersa` — *streetwear casual · para o frio · streetwear · acessório*
- `laranja-sem-sementes` — *para o frio · camada de baixo · streetwear · look casual · camada de base*

Nenhum está no código. E repare em *"camada de baixo"* / *"camada de base"*, que
só apareceram na condição laranja — o modelo tratou a hoodie como peça externa e
nomeou o eixo de acordo. Títulos também variam com sentido: *"Streetwear pra
noite fria de SP"*, *"Complete o look de inverno"*.

**Nenhum rótulo de ocasião menciona cor hoje.** Se a feature funcionar, é um
dos lugares onde se espera ver diferença.

## O que isto fixa como critério de aceite

Pisos que o "depois" não pode furar, por condição:

| condição | confiança ≥ | tipos ≥ | peças ≥ |
|---|---|---|---|
| `preta-sem-sementes` | 0,78 | 7,3 | 7,3 |
| `preta-concordante` | 0,77 | 7,0 | 8,0 |
| `preta-dispersa` | 0,75 | 8,0 | 8,0 |
| `laranja-sem-sementes` | 0,67 | 5,0 | 5,0 |

E dois critérios que não são numéricos:

1. **A condição dispersa é o controle.** Ela tem de continuar sem afirmação de
   preferência de paleta — é a regra do silêncio (§5 do plano). Se a taxa de cor
   subir *ali*, a feature está inventando padrão onde não há.
2. **O que sai dos motivos importa tanto quanto o que entra** (achado 1).

## Limitações desta medição

- **N=3.** Suficiente para as condições estáveis, insuficiente para a laranja.
- **A ferramenta não guarda o texto dos motivos**, só a contagem de quantos
  citam cor. Para julgar *qualidade* — e não só presença — é preciso registrar
  os motivos. É a melhoria mais útil no `look-eval.ts` antes do "depois".
- **A detecção de cor é por palavra-chave** e conta `paleta`, `tom`, `neutro`
  junto com nomes de cor. Superestima um pouco.
- **Uma única cidade e um único mês** (São Paulo, agosto). O eixo clima está
  fixo, o que é proposital, mas significa que não sabemos se o comportamento de
  cor muda com clima diferente.
- Duas execuções bateram no `waiting-capacity` do Decopilot e demoraram
  visivelmente mais. Nenhuma caiu para o fallback SQL — **as 12 vieram do
  agente**, então a amostra é limpa nesse aspecto.
