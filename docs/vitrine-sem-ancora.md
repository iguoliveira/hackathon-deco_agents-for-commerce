# A vitrine sem âncora

> **Desenho, não implementação.** Tira o produto do centro da recomendação e põe
> a pessoa. O agente deixa de completar um look em volta de uma peça aberta e
> passa a montar uma vitrine de produtos recomendados a partir do que a pessoa é.
>
> Depende de `persona-do-guarda-roupa.md`, que já construiu metade disto sem
> saber.

---

## 1. Por que a ideia está certa, e o motivo é mais forte que "não queremos look"

**Todo agente deste repositório ancora.** Não é coincidência, é uma premissa que
nunca foi questionada:

| Agente | Âncora | O que devolve |
|---|---|---|
| `shelf` | o item esgotado do "avise-me" | substitutos + complementos |
| `look` | a peça aberta na PDP | a roupa em volta dela |

`shelf.candidates.ts:4` diz isso como decisão de produto: *"Aqui está a decisão
que define o produto: os candidatos vêm sempre ancorados"*.

A consequência é que **nada hoje responde "o que ESTA pessoa deveria ver?"**.
Todo caminho responde "o que combina com ISTO?". A pergunta da loja
personalizada nunca foi feita.

### E o cron já decidiu por nós

Este é o argumento que fecha. Um job que roda às 3h **não tem PDP aberta**. Não
existe âncora para ancorar. Rodar o agente atual por cron exigiria inventar uma
peça — escolher uma do histórico e fingir que a pessoa está olhando para ela —,
e aí a recomendação inteira passa a depender de um palpite que ninguém tomou.

Não é preferência de produto. **A decisão de rodar por cron é incompatível com
âncora**, e a arquitetura tem de acompanhar.

---

## 2. Metade já está pronta

A #26 construiu a persona: o modelo lê **todos** os sinais da pessoa e devolve um
retrato com eixos e evidência. Três propriedades dela foram desenhadas para o
look e servem melhor aqui:

- **É por pessoa, não por peça aberta.** A chave é `hashDosSinais` — o hash não
  tem âncora dentro. Já é a chave certa para uma vitrine.
- **Não tem identidade.** Duas pessoas com o mesmo armário compartilham o
  retrato. Num cron que varre gente, isso é economia direta.
- **Carrega `evidencia`** — os títulos das peças que sustentam cada eixo. É o que
  vai permitir o motivo continuar concreto **sem âncora para citar**.

Aquele último ponto é o que salva a feature. Hoje o motivo diz *"fecha com o
cardigã que você comprou"* porque existe uma peça aberta para relacionar. Sem
âncora, o motivo teria virado generalidade — se não fosse a evidência da persona
dar peças reais para citar.

---

## 3. A pergunta difícil: qual é o pool sem âncora?

É a única coisa que a ideia esconde. Hoje o pool sai de
`findComplementsAvailable(variantId)` — 30 do banco, cortados para 18. Tudo
ancorado. Sem âncora, `variantId` não existe e o pool não tem de onde sair.

Três saídas possíveis, e **a medição resolve a discussão**:

```
produtos disponíveis: 127

catálogo INTEIRO, formato de hoje   ~ 10.279 tokens
catálogo INTEIRO, sem descrição     ~  4.712 tokens
os 18 candidatos de hoje            ~  1.496 tokens
```

**O catálogo inteiro cabe.** Sem descrição são ~4.7k tokens, cerca de 3× o
prompt atual — e o prompt atual já roda em background, sem ninguém esperando.

Isso elimina a etapa que seria a mais arriscada de projetar: **não há critério de
pré-seleção para inventar.** Qualquer filtro em código antes do modelo seria o
código decidindo o que a pessoa pode ver, que é exatamente a classe de decisão
que a #26 tirou do código quando matou a tabela de pesos.

> **A regra 11 do §7 vale aqui inteira:** nenhuma tabela de pesos, nenhum número
> escolhido a olho. Se o catálogo cabe, mandar o catálogo é a única opção que não
> reintroduz um critério não medido.

A descrição sai do candidato porque é ela que triplica o custo (10.3k → 4.7k) e
é o campo que menos decide escolha — o modelo escolhe por tipo, tags e preço. Se
a descrição fizer falta, ela volta só para as peças escolhidas, numa segunda
passada barata.

**Quando o catálogo não couber mais**, a saída não é filtrar por regra: é dar ao
modelo o catálogo em duas etapas (ele pede o que quer ver), ou paginar por tipo.
Fica registrado para não ser reinventado sob pressão.

---

## 4. O que morre, o que sobrevive, o que muda de sentido

| | Hoje | Depois |
|---|---|---|
| `Ancora`, `acharAncora`, `buscarAncora` | a peça aberta | **morre** |
| `tagsEmComum` | tags em comum com a âncora | **morre** — não há contra o quê |
| `mesmaColecao` | mesma coleção da âncora | **morre** |
| `montarCandidatos(variantId, …)` | pool ancorado | vira `catalogoDisponivel()` |
| `looks.anchor_id` | parte da chave | **sai da chave** |
| `combinaComOGuardaRoupa` | tags que o candidato divide com o que a pessoa tem | **sobrevive e vira o sinal principal** |
| `jaTemDesteTipo` | saturação por tipo | sobrevive — e é o que evita a vitrine virar oito camisetas |
| `motivo` | relação com a âncora | relação com **a pessoa** |
| `ocasiao` | função no look (calça, calçado, camada) | vira **tema** da prateleira |
| persona | entrada da composição | **entrada única** |

### O caso do `combinaComOGuardaRoupa`

Ele é calculado hoje contra as sementes e era o segundo sinal, atrás de
`tagsEmComum`. Sem âncora, **ele passa a ser o primeiro** — é o único que
relaciona candidato e pessoa.

Mas ele carrega um defeito conhecido que precisa ser consertado **antes**, não
depois: hoje trata as quatro origens como posse, então "favoritou" e "viu" viram
"você já tem". Está documentado na #24 e vira PR própria. Numa vitrine sem
âncora esse campo deixa de ser um sinal entre vários e passa a ser o eixo —
entrar nele quebrado é diferente de entrar quebrado hoje.

---

## 5. A forma do resultado

```ts
interface Vitrine {
  titulo: string;
  confianca: number;
  /** Agrupadas por tema — vocabulário do modelo, como `ocasiao` sempre foi. */
  prateleiras: { tema: string; pecas: PecaRecomendada[] }[];
}

interface PecaRecomendada {
  handle: string;
  /** Por que ESTA pessoa, não por que esta peça. */
  motivo: string;
  position: number;
}
```

**A chave de cache perde a âncora e ganha nada:** `hashDosSinais` sozinho. É a
mesma chave da persona, o que significa que persona e vitrine se invalidam
juntas — quando um sinal muda, as duas são refeitas, e nunca há vitrine composta
a partir de um retrato velho.

Isso também é o que torna o cron simples: varrer `personas` e gerar a vitrine de
cada hash é um `SELECT` e um laço, sem precisar saber quem é ninguém.

---

## 6. O que precisa de decisão sua

Três, e nenhuma é técnica.

### a) Três agentes de vitrine, ou este absorve os outros?

Ficariam: `shelf` (ancorado no esgotado), `look` (ancorado na PDP) e este. Os
três montam vitrine por IA e os três gravam tabela própria.

Minha leitura: **este substitui o `look`** — mesma pergunta, resposta melhor — e
**convive com o `shelf`**, que responde algo genuinamente diferente ("o que
comprar no lugar do que faltou"). Mas isso é decisão de produto e de tempo de
hackathon, não minha.

### b) Quem não tem sinal nenhum vê o quê?

Hoje o contrato é duro: *"ou o look é do agente, ou a section não aparece"*. Faz
sentido para "complete o look" — sem histórico não há o que completar.

Para uma vitrine de loja, "não aparece" é mais estranho: um visitante novo vê um
buraco onde deveria haver recomendação. As saídas são vitrine genérica (e aí ela
deixa de ser do agente), ou continuar sumindo. **Eu manteria sumindo** — a
feature existe para provar personalização, e uma vitrine igual para todo mundo
não prova nada — mas quero isso dito, não assumido.

### c) Tema, ou lista única?

`ocasiao` agrupava por função no look. Sem look, agrupar ainda pode informar
("para o frio que vem", "as peças escuras") ou pode virar cerimônia. Eu
manteria, porque é o que diferencia da grade de "recomendados" de qualquer loja
— mas com liberdade para o modelo devolver uma prateleira só.

---

## 7. Riscos, ditos antes de codar

**Sem âncora, o modelo tem menos restrição — e restrição era o que segurava a
alucinação.** Hoje ele escolhe 5 a 10 entre 18 candidatos relacionados. Passará
a escolher entre 127 sem nada que o obrigue a se relacionar com coisa alguma. A
validação da etapa 3 continua impedindo handle inventado, mas não impede escolha
arbitrária — e "arbitrário" é indistinguível de "personalizado" na tela.

Mitigação: a persona é a restrição. Se ela estiver fraca, a vitrine é aleatória
com texto bonito. **O piso de confiança da persona passa a proteger a vitrine
inteira**, não só o retrato.

**O `look:eval` não serve como está.** Ele mede estabilidade de composição em
volta de uma âncora. Sem âncora, as condições mudam de forma e a comparação com
as medições antigas deixa de valer — inclusive a de `medicao-baseline-cor.md`.

**Nada disto foi medido com modelo.** O provedor está sem token desde ontem. O
desenho é derivado do que já roda, não de observação nova.
